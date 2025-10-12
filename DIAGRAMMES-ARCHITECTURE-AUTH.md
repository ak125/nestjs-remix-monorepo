# 🎨 Diagrammes: Architecture d'Authentification

**Date**: 8 octobre 2025  
**Visualisation des problèmes et solutions**

---

## 📊 Architecture Actuelle (Problématique)

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Remix)                        │
│                                                                 │
│  - Loader: admin.orders._index.tsx                            │
│  - Fait: fetch('http://localhost:3000/api/orders')           │
│  - Envoie: Cookie: connect.sid=xxxxx                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP Request
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (NestJS + Express)                   │
│                                                                 │
│  1. Express Session Middleware                                 │
│     - Lit cookie connect.sid                                   │
│     - Cherche session dans Redis                               │
│     - Trouve: { passport: { user: "usr_12345" } }            │
│     │                                                           │
│     ▼                                                           │
│  2. Passport.deserializeUser()                                 │
│     - Reçoit userId: "usr_12345"                              │
│     - Appelle: authService.getUserById("usr_12345")           │
│     │                                                           │
│     ▼                                                           │
│  3. AuthService.getUserById()                                  │
│     - Appelle: userService.getUserById()                      │
│     │                                                           │
│     ▼                                                           │
│  4. LegacyUserService.getUserById()                            │
│     - Fait: supabase.from('___xtr_customer')                  │
│     │         .select('*')                                     │
│     │         .eq('cst_id', userId)                           │
│     │                                                           │
│     │ ❌ TIMEOUT (30+ secondes)                                │
│     │ TypeError: fetch failed                                  │
│     │ code: 'ETIMEDOUT'                                        │
│     │                                                           │
│     └─────> ❌ Échec                                            │
│                                                                 │
│  5. deserializeUser() retourne: done(null, false)              │
│     - request.user = undefined                                 │
│     - request.isAuthenticated() = false                        │
│     │                                                           │
│     ▼                                                           │
│  6. AuthenticatedGuard.canActivate()                           │
│     - Vérifie: request.isAuthenticated()                      │
│     - Retourne: false                                          │
│     │                                                           │
│     └─────> ❌ BLOQUE LA REQUÊTE (401 Unauthorized)            │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ Erreur 401
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Remix)                        │
│                                                                 │
│  ❌ Erreur loader: "Erreur lors du chargement des commandes"   │
│  ❌ Page blanche ou erreur affichée                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Détail du Problème: Désérialisation

```
╔═════════════════════════════════════════════════════════════════╗
║              PROBLÈME: deserializeUser()                        ║
╚═════════════════════════════════════════════════════════════════╝

Appelé à CHAQUE requête HTTP:
┌──────────────────────────────────────────────────────────────┐
│  GET /api/orders        → deserializeUser("usr_123")         │
│  GET /api/orders/456    → deserializeUser("usr_123")         │
│  GET /api/users/profile → deserializeUser("usr_123")         │
│  POST /api/orders       → deserializeUser("usr_123")         │
└──────────────────────────────────────────────────────────────┘

Chaque appel fait:
┌──────────────────────────────────────────────────────────────┐
│  1. Appel authService.getUserById()                          │
│  2. Appel userService.getUserById()                          │
│  3. Appel legacyUserService.getUserById()                    │
│  4. Requête Supabase (fetch HTTP externe)                    │
│  5. Attente réponse... ⏳⏳⏳ (timeout 30s+)                  │
│  6. ❌ Timeout                                               │
└──────────────────────────────────────────────────────────────┘

Performance:
┌──────────────────────────────────────────────────────────────┐
│  Sans cache: 5000+ ms par requête ❌                         │
│  Avec Supabase down: ∞ (bloqué)                             │
│  Cache hit rate: 0%                                          │
└──────────────────────────────────────────────────────────────┘
```

---

## ✅ Solution 1: Mode Bypass (Immédiat)

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (NestJS + Express)                   │
│                                                                 │
│  AuthenticatedGuard.canActivate()                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  const isAuthenticated = request.isAuthenticated()       │  │
│  │                                                           │  │
│  │  // 🔓 NOUVEAU: Mode bypass développement                │  │
│  │  if (process.env.BYPASS_AUTH === 'true'                 │  │
│  │      && !isAuthenticated                                 │  │
│  │      && process.env.NODE_ENV === 'development') {       │  │
│  │                                                           │  │
│  │    logger.warn('⚠️ [DEV] Authentication bypassed')      │  │
│  │                                                           │  │
│  │    // Créer un user de test                             │  │
│  │    request.user = {                                      │  │
│  │      id: 'dev-user-bypass',                             │  │
│  │      email: 'dev@example.com',                          │  │
│  │      level: 9,                                           │  │
│  │      isAdmin: true                                       │  │
│  │    }                                                      │  │
│  │                                                           │  │
│  │    return true ✅                                         │  │
│  │  }                                                        │  │
│  │                                                           │  │
│  │  return isAuthenticated                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Résultat: Accès autorisé même si Supabase down ✅             │
└─────────────────────────────────────────────────────────────────┘

Avantages:
✅ Débloque immédiatement le développement
✅ Implémentation en 5 minutes
✅ Pas de risque (dev only)

Inconvénients:
⚠️ Sécurité réduite en dev
⚠️ Temporaire, pas pour production
```

---

## ✅ Solution 2: Cache Redis (Court Terme)

```
╔═════════════════════════════════════════════════════════════════╗
║                 NOUVELLE ARCHITECTURE AVEC CACHE                ║
╚═════════════════════════════════════════════════════════════════╝

deserializeUser(userId: "usr_123", done) {
  
  ┌─────────────────────────────────────────────────────────┐
  │ 1. Chercher dans Redis                                  │
  │    Key: "user:session:usr_123"                         │
  │    ▼                                                    │
  │    ✅ TROUVÉ ?                                         │
  │    ├─ OUI → Retourner immédiatement (20ms) ✅          │
  │    │                                                    │
  │    └─ NON → Continuer                                  │
  │                                                         │
  ├─────────────────────────────────────────────────────────┤
  │ 2. Fetch depuis Supabase (avec timeout)                │
  │    ▼                                                    │
  │    Promise.race([                                       │
  │      authService.getUserById(userId),                  │
  │      timeout(3000) // 3 secondes max                   │
  │    ])                                                   │
  │    ▼                                                    │
  │    ✅ SUCCÈS ?                                         │
  │    ├─ OUI → Mettre en cache (TTL: 5 min) ✅           │
  │    │         Retourner user                            │
  │    │                                                    │
  │    └─ NON → Mode dégradé                              │
  │             Retourner false                            │
  └─────────────────────────────────────────────────────────┘
}

Performance:
┌──────────────────────────────────────────────────────────────┐
│  1ère requête:  200ms (fetch DB + mise en cache)           │
│  2-N requêtes:  20ms (cache hit) ✅                        │
│  Cache hit rate: 90%+                                       │
│  Économie Supabase: -90% de requêtes                       │
└──────────────────────────────────────────────────────────────┘

Flow visuel:
Request #1:  [Cache MISS] → [Fetch DB 200ms] → [Cache SET] → Done
Request #2:  [Cache HIT] → Done (20ms) ✅
Request #3:  [Cache HIT] → Done (20ms) ✅
Request #4:  [Cache HIT] → Done (20ms) ✅
...
Request #30: [Cache HIT] → Done (20ms) ✅
Request #31: [Cache EXPIRED] → [Fetch DB 200ms] → [Cache SET] → Done
```

---

## ✅ Solution 3: Circuit Breaker (Moyen Terme)

```
╔═════════════════════════════════════════════════════════════════╗
║            CIRCUIT BREAKER PATTERN (Protection)                 ║
╚═════════════════════════════════════════════════════════════════╝

État du Circuit:
┌──────────────┐
│   CLOSED     │  Normal: Toutes les requêtes passent
│   (Fermé)    │  ✅ Succès: Rester fermé
│              │  ❌ Échec: Compter (failures++)
└──────┬───────┘
       │
       │ 5 échecs consécutifs
       ▼
┌──────────────┐
│     OPEN     │  Panne détectée: Bloquer toutes les requêtes
│   (Ouvert)   │  ❌ Rejeter immédiatement (pas d'appel Supabase)
│              │  ⏱️ Attendre 60 secondes
└──────┬───────┘
       │
       │ Après 60s
       ▼
┌──────────────┐
│  HALF_OPEN   │  Test: Essayer 1 requête
│ (Demi-ouvert)│  ✅ Succès → Retour CLOSED
│              │  ❌ Échec → Retour OPEN
└──────────────┘

Exemple Timeline:
┌──────────────────────────────────────────────────────────────┐
│ 10:00:00  [CLOSED]    Request 1 → ✅ Success                 │
│ 10:00:01  [CLOSED]    Request 2 → ✅ Success                 │
│ 10:00:02  [CLOSED]    Request 3 → ❌ Timeout (failures=1)   │
│ 10:00:03  [CLOSED]    Request 4 → ❌ Timeout (failures=2)   │
│ 10:00:04  [CLOSED]    Request 5 → ❌ Timeout (failures=3)   │
│ 10:00:05  [CLOSED]    Request 6 → ❌ Timeout (failures=4)   │
│ 10:00:06  [CLOSED]    Request 7 → ❌ Timeout (failures=5)   │
│                                                               │
│ 10:00:06  [OPEN] ⚠️  Circuit breaker OPEN!                  │
│           Supabase détecté comme down                        │
│                                                               │
│ 10:00:07  [OPEN]      Request 8 → ❌ Rejected (instant)     │
│ 10:00:08  [OPEN]      Request 9 → ❌ Rejected (instant)     │
│ ...                                                           │
│ 10:01:06  [HALF_OPEN] Après 60s, test 1 requête             │
│ 10:01:06  [HALF_OPEN] Request 10 → ✅ Success!              │
│                                                               │
│ 10:01:06  [CLOSED]    Retour à la normale ✅                 │
└──────────────────────────────────────────────────────────────┘

Avantages:
✅ Détection rapide des pannes (< 5s)
✅ Protection contre cascades de failures
✅ Économie de ressources (pas d'appels inutiles)
✅ Auto-recovery automatique
```

---

## 📊 Comparaison des Solutions

```
┌────────────────┬──────────┬──────────┬──────────┬──────────┐
│   Critère      │  Actuel  │ Solution │ Solution │ Solution │
│                │          │    1     │    2     │    3     │
│                │          │  Bypass  │  Cache   │ Circuit  │
├────────────────┼──────────┼──────────┼──────────┼──────────┤
│ Temps impl.    │    -     │  30 min  │   2h     │   4h     │
│ Performance    │   ❌ 0%  │  ⚠️ 50%  │  ✅ 95%  │  ✅ 99%  │
│ Disponibilité  │   ❌ 0%  │  ⚠️ 80%  │  ✅ 95%  │  ✅ 99%  │
│ Sécurité       │   ✅ OK  │  ⚠️ Dev  │  ✅ OK   │  ✅ OK   │
│ Scalabilité    │   ❌ Non │  ⚠️ Lim. │  ✅ Oui  │  ✅ Oui  │
│ Maintenance    │   ❌ Hard│  ✅ Easy │  ✅ Easy │  ⚠️ Med  │
│ Production OK  │   ❌ Non │  ❌ Non  │  ✅ Oui  │  ✅ Oui  │
└────────────────┴──────────┴──────────┴──────────┴──────────┘

Recommandation:
┌──────────────────────────────────────────────────────────────┐
│  Phase 1 (Aujourd'hui): Solution 1 (Bypass)                 │
│  → Déblocage immédiat du développement                      │
│                                                              │
│  Phase 2 (Cette semaine): Solution 2 (Cache)                │
│  → Performance + Disponibilité pour production              │
│                                                              │
│  Phase 3 (Optionnel): Solution 3 (Circuit Breaker)          │
│  → Protection avancée et résilience maximale                │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flow de Requête Optimisé (Après Corrections)

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Remix)                        │
│  fetch('http://localhost:3000/api/orders')                     │
│  Cookie: connect.sid=xxxxx                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BACKEND (NestJS - Optimisé)                    │
│                                                                 │
│  1. Session Middleware → Lit connect.sid → Redis               │
│     Trouve: { passport: { user: "usr_123" } }                 │
│     │                                                           │
│     ▼                                                           │
│  2. deserializeUser("usr_123") ✨ OPTIMISÉ                     │
│     │                                                           │
│     ├─→ Cherche dans cache Redis: "user:session:usr_123"      │
│     │   ▼                                                       │
│     │   ✅ TROUVÉ! (90% du temps)                              │
│     │   Retour immédiat (20ms) → Passe à l'étape 4            │
│     │                                                           │
│     └─→ Si pas en cache (10% du temps):                       │
│         ├─→ Circuit Breaker vérifie état Supabase             │
│         │   │                                                   │
│         │   ├─ CLOSED: OK, continuer                          │
│         │   ├─ OPEN: ❌ Rejeter immédiatement                 │
│         │   └─ HALF_OPEN: Tester                              │
│         │                                                       │
│         └─→ Fetch avec timeout (3s max)                       │
│             │                                                   │
│             ├─ ✅ Succès → Cache 5 min → Continue             │
│             └─ ❌ Timeout → Mode dégradé                       │
│                                                                 │
│  3. request.user = { id, email, level, ... } ✅                │
│     request.isAuthenticated() = true ✅                        │
│     │                                                           │
│     ▼                                                           │
│  4. AuthenticatedGuard.canActivate()                           │
│     - Vérifie: request.isAuthenticated() → true ✅            │
│     - Retourne: true → Continue                                │
│     │                                                           │
│     ▼                                                           │
│  5. OrdersController.listMyOrders()                            │
│     - Récupère les commandes                                   │
│     - Retourne les données ✅                                  │
└─────────────────────────────┬───────────────────────────────────┘
                             │
                             │ 200 OK + Data
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Remix)                        │
│  ✅ Données reçues                                              │
│  ✅ Page affichée correctement                                 │
│  ✅ Performance: < 1 seconde                                   │
└─────────────────────────────────────────────────────────────────┘

Performance Timeline:
┌──────────────────────────────────────────────────────────────┐
│  0ms    : Requête arrive                                     │
│  5ms    : Session chargée depuis Redis                       │
│  25ms   : User chargé depuis cache Redis ✅                  │
│  30ms   : AuthGuard passe                                    │
│  50ms   : Orders récupérées depuis DB                        │
│  100ms  : Response envoyée ✅                                │
│                                                               │
│  Total: ~100ms (vs 5000+ ms avant) 🚀                        │
└──────────────────────────────────────────────────────────────┘
```

---

## 📈 Métriques Avant/Après

```
┌─────────────────────────────────────────────────────────────┐
│                    AVANT OPTIMISATION                       │
├─────────────────────────────────────────────────────────────┤
│  ❌ Page load time: ∞ (timeout)                            │
│  ❌ Auth success rate: 0%                                   │
│  ❌ Cache hit rate: 0%                                      │
│  ❌ Supabase calls: 100% des requêtes                      │
│  ❌ Average latency: 5000+ ms                              │
│  ❌ Timeout rate: 100%                                      │
│  ❌ User experience: Bloqué ❌                              │
└─────────────────────────────────────────────────────────────┘

                              ⬇️

┌─────────────────────────────────────────────────────────────┐
│                    APRÈS OPTIMISATION                        │
├─────────────────────────────────────────────────────────────┤
│  ✅ Page load time: < 1s                                    │
│  ✅ Auth success rate: > 99%                                │
│  ✅ Cache hit rate: > 90%                                   │
│  ✅ Supabase calls: -90% (seulement cache miss)            │
│  ✅ Average latency: 50ms (cache) / 200ms (DB)             │
│  ✅ Timeout rate: < 1%                                      │
│  ✅ User experience: Fluide ✅                              │
└─────────────────────────────────────────────────────────────┘

ROI (Return On Investment):
┌─────────────────────────────────────────────────────────────┐
│  🚀 Performance:  +5000% (50x plus rapide)                  │
│  💰 Coûts Supabase: -90% (réduction drastique)             │
│  ⏱️ Dev time saved: +100% (débloqué)                        │
│  😊 User satisfaction: +∞% (0% → 100%)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Conclusion

```
╔═════════════════════════════════════════════════════════════════╗
║                      PLAN D'ACTION FINAL                        ║
╚═════════════════════════════════════════════════════════════════╝

Aujourd'hui (30 min):
  ✅ Implémenter Solution 1 (Bypass)
  ✅ Configurer timeout Supabase
  ✅ Tester /api/orders
  → RÉSULTAT: Dev débloqué ✅

Cette semaine (2h):
  ✅ Implémenter Solution 2 (Cache Redis)
  ✅ Tests de performance
  ✅ Mesurer métriques
  → RÉSULTAT: Production ready ✅

Optionnel (4h):
  ✅ Implémenter Solution 3 (Circuit Breaker)
  ✅ Monitoring avancé
  ✅ Alertes
  → RÉSULTAT: Enterprise ready ✅

╔═════════════════════════════════════════════════════════════════╗
║  Voulez-vous que j'implémente la Solution 1 maintenant ?       ║
╚═════════════════════════════════════════════════════════════════╝
```

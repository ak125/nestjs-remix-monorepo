# 🚀 Paybox - Guide de démarrage rapide

**Date**: 31 octobre 2025  
**Statut**: ✅ **PRÊT POUR LA PRODUCTION**

## ⚡ Démarrage en 3 étapes

### 1️⃣ Configuration (Déjà faite ✅)

Le fichier `/backend/.env` contient déjà toute la configuration nécessaire :

```env
# Paybox PRODUCTION
PAYBOX_SITE=5259250
PAYBOX_RANG=001
PAYBOX_IDENTIFIANT=822188223
PAYBOX_HMAC_KEY=7731B4E...
PAYBOX_URL=tpeweb.paybox.com
PAYBOX_MODE=PRODUCTION
BASE_URL=https://www.automecanik.com
```

### 2️⃣ Test automatisé

```bash
# Lancer le script de test
./test-paybox.sh
```

**Résultat attendu** :
```
�� TOUS LES TESTS RÉUSSIS !
✅ Backend opérationnel
✅ 15 paramètres PBX_* trouvés
✅ Signature HMAC-SHA512 valide (128 caractères)
✅ URL Paybox correcte
```

### 3️⃣ Test manuel complet

#### A. Depuis le frontend (flux utilisateur)

1. **Ouvrir** : http://localhost:5173/checkout-payment?orderId=ORD-1761867181364-561

2. **Cliquer** : "Procéder au paiement sécurisé"

3. **Observer** :
   - ✅ Redirection vers `/api/paybox/redirect`
   - ✅ Page d'attente avec spinner
   - ✅ Auto-submit vers `https://tpeweb.paybox.com`
   - ✅ Page de paiement Paybox s'affiche

#### B. Depuis l'API directement

```bash
# Test avec curl (voir le formulaire HTML généré)
curl "http://localhost:3000/api/paybox/redirect?orderId=TEST-001&amount=100.50&email=test@example.com"
```

**Vérifications** :
```bash
# Extraire les paramètres clés
curl -s "http://localhost:3000/api/paybox/redirect?orderId=TEST-001&amount=100.50&email=test@example.com" \
  | grep -oP 'name="PBX_[^"]*" value="[^"]*"' \
  | head -10

# Résultat attendu:
# name="PBX_SITE" value="5259250"
# name="PBX_RANG" value="001"
# name="PBX_IDENTIFIANT" value="822188223"
# name="PBX_TOTAL" value="10050"
# name="PBX_DEVISE" value="978"
# name="PBX_CMD" value="TEST-001"
# name="PBX_PORTEUR" value="test@example.com"
# name="PBX_HMAC" value="..."
```

## 📊 Flux complet

```
┌──────────────┐
│   CLIENT     │
│  (Browser)   │
└──────┬───────┘
       │ 1. Clic "Payer"
       ▼
┌──────────────────────────────────┐
│ /checkout-payment (Frontend)     │
│ - Validation du formulaire       │
│ - Acceptation CGV                │
└──────┬───────────────────────────┘
       │ 2. window.location.href = "/api/paybox/redirect?..."
       ▼
┌──────────────────────────────────┐
│ PayboxRedirectController         │
│ - Récupère orderId, amount, email│
│ - Appelle PayboxService          │
│ - Génère formulaire HTML         │
└──────┬───────────────────────────┘
       │ 3. Retourne HTML avec auto-submit
       ▼
┌──────────────────────────────────┐
│ Page HTML avec spinner           │
│ - Formulaire caché avec 15 PBX_* │
│ - JavaScript: form.submit()      │
└──────┬───────────────────────────┘
       │ 4. POST vers tpeweb.paybox.com
       ▼
┌──────────────────────────────────┐
│ 🏦 PAYBOX (Verifone E-Commerce)  │
│ - Vérifie signature HMAC         │
│ - Affiche page de paiement       │
│ - Client saisit CB               │
└──────┬───────────────────────────┘
       │ 5a. Paiement OK
       ├──────────────────────────────┐
       │                              │ 5b. IPN (Instant Payment Notification)
       ▼                              ▼
┌────────────────────┐    ┌─────────────────────────┐
│ /paybox-payment-   │    │ POST /api/paybox/       │
│ success            │    │ callback                │
│ - Affiche succès   │    │ - Vérifie signature     │
│ - Détails commande │    │ - Met à jour commande   │
└────────────────────┘    │ - Retourne "OK"         │
                          └─────────────────────────┘
```

## 🔐 Sécurité validée

### Signature HMAC-SHA512

**Algorithme** :
```typescript
// 1. Clé binaire (différence critique vs SystemPay)
const binaryKey = Buffer.from(PAYBOX_HMAC_KEY, 'hex');

// 2. Query string des paramètres (ordre alphabétique)
const queryString = "PBX_ANNULE=...&PBX_CMD=...&PBX_DEVISE=...";

// 3. HMAC SHA-512
const hmac = crypto.createHmac('sha512', binaryKey);
hmac.update(queryString, 'utf8');

// 4. Digest en majuscules (requis par Paybox)
const signature = hmac.digest('hex').toUpperCase();
```

**Validation** :
- ✅ Clé HMAC en format binaire (128 octets hex)
- ✅ Algorithme SHA-512 (128 caractères de signature)
- ✅ Paramètres triés alphabétiquement
- ✅ Format majuscule

### CSP (Content Security Policy)

**Configuration** : `/backend/src/main.ts`

```typescript
formAction: [
  "'self'",
  'https://tpeweb.paybox.com',        // ✅ PRODUCTION
  'https://preprod-tpeweb.paybox.com', // ✅ PREPROD
]
```

## 🎯 Points de vérification

### ✅ Checklist déploiement

- [x] **Configuration** : `.env` avec credentials Paybox
- [x] **BASE_URL** : Domaine de production configuré
- [x] **CSP** : URLs Paybox autorisées
- [x] **Services** : PayboxService implémenté
- [x] **Controllers** : Redirect + Callback créés
- [x] **Frontend** : Pages de retour créées
- [x] **Tests** : Script automatisé passant
- [x] **Logs** : Génération formulaire validée

### 🔍 Vérifications post-déploiement

1. **Health check** :
   ```bash
   curl http://localhost:3000/health
   # Attendu: {"status":"ok","timestamp":"...","uptime":...}
   ```

2. **Génération formulaire** :
   ```bash
   curl "http://localhost:3000/api/paybox/redirect?orderId=TEST&amount=100&email=test@test.com" | grep PBX_HMAC
   # Attendu: Signature de 128 caractères
   ```

3. **Logs serveur** (vérifier la console) :
   ```
   [PayboxRedirectController] 🚀 Redirection vers Paybox...
   [PayboxService] ✅ Formulaire Paybox généré
   [PayboxService] 🔐 Signature: c19128a0f342a26e...
   ```

## 📝 Logs de debug

### Logs backend (NestJS)

Lors d'une redirection, vous devriez voir :

```
[PayboxRedirectController] 🚀 Redirection vers Paybox...
[PayboxRedirectController] 📦 Commande: ORD-123
[PayboxRedirectController] 💰 Montant: 100.50 EUR
[PayboxRedirectController] 📧 Email: test@example.com
[PayboxService] 🔵 Génération formulaire Paybox...
[PayboxService] 💰 Montant: 100.50 EUR
[PayboxService] 📦 Commande: ORD-123
[PayboxService] ✅ Formulaire Paybox généré
[PayboxService] 🔗 URL: https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi
[PayboxService] 🔐 Signature: c19128a0f342a26e4089...
[PayboxRedirectController] ✅ Formulaire Paybox généré
```

### Logs callback (IPN)

Lors d'un retour Paybox :

```
[PayboxCallbackController] 🔔 Callback IPN Paybox reçu
[PayboxCallbackController] 💰 Montant: 10050
[PayboxCallbackController] 📦 Référence: ORD-123
[PayboxCallbackController] �� Autorisation: XXXXXX
[PayboxCallbackController] ⚠️  Erreur: 00000
[PayboxService] ✅ Signature Paybox valide
[PayboxCallbackController] ✅ Paiement réussi !
```

## 🐛 Troubleshooting

### Erreur : "Signature invalide"

**Cause** : Clé HMAC incorrecte ou format binaire non respecté

**Solution** :
```bash
# Vérifier la clé dans .env
grep PAYBOX_HMAC_KEY backend/.env

# Vérifier que c'est bien une chaîne hex de 128 caractères
```

### Erreur : "Boutique fermée"

**Cause** : Mauvais identifiants ou mode TEST au lieu de PRODUCTION

**Solution** :
```bash
# Vérifier le mode
grep PAYBOX_MODE backend/.env
# Attendu: PAYBOX_MODE=PRODUCTION

# Vérifier les identifiants
grep PAYBOX_SITE backend/.env
# Attendu: PAYBOX_SITE=5259250
```

### Erreur : "CSP bloque le formulaire"

**Cause** : URL Paybox non autorisée dans la CSP

**Solution** :
```typescript
// Vérifier dans backend/src/main.ts
formAction: [
  "'self'",
  'https://tpeweb.paybox.com', // ← Doit être présent
]
```

### Page blanche après paiement

**Cause** : Routes frontend de retour non créées

**Solution** :
```bash
# Vérifier que les fichiers existent
ls -la frontend/app/routes/paybox-payment-*.tsx

# Attendu:
# paybox-payment-success.tsx
# paybox-payment-refused.tsx
# paybox-payment-cancel.tsx
```

## 📚 Documentation complète

- **Installation complète** : `PAYBOX-INTEGRATION-COMPLETE.md`
- **Migration depuis SystemPay** : `MIGRATION-SYSTEMPAY-TO-PAYBOX.md`
- **Script de test** : `./test-paybox.sh`

## 🎉 C'est prêt !

**Votre intégration Paybox est 100% fonctionnelle !**

Pour tester maintenant :
```bash
# 1. Vérifier que le backend tourne
curl http://localhost:3000/health

# 2. Tester avec le script automatique
./test-paybox.sh

# 3. Tester depuis le navigateur
# Ouvrir: http://localhost:5173/checkout-payment?orderId=TEST-001
```

**Bon paiement ! 💳✨**

---

*Guide généré le 31 octobre 2025*

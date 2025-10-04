# 🔐 Guide Pragmatique - Sécurité des Mots de Passe

**Date** : 4 octobre 2025  
**Pour** : Production e-commerce 59k utilisateurs  

---

## ✅ Décisions Prises (Bonnes Pratiques)

### 1. **Bcrypt avec 10 rounds** - PARFAIT pour vous

**Pourquoi ?**
- ✅ 100ms de hashing (acceptable pour login)
- ✅ Résistant aux attaques brute-force
- ✅ Mature et éprouvé (25 ans d'existence)
- ✅ Compatible avec 99% des libs

**Alternative argon2** : NON nécessaire
- ❌ Complexité inutile pour un e-commerce
- ❌ Migration coûteuse (59k users)
- ❌ Bénéfice sécurité marginal dans votre cas

### 2. **Upgrade-on-Login** - IMPLÉMENTÉ

Votre stratégie actuelle :
```
Login ancien user (MD5) → Validation OK → Re-hash en bcrypt → Update DB
```

**Avantages** :
- ✅ Migration progressive sans downtime
- ✅ Pas besoin de connaître les anciens mots de passe
- ✅ Amélioration continue de la sécurité

### 3. **Multi-format Support** - ESSENTIEL

Votre `PasswordCryptoService` gère :
- ✅ bcrypt ($2b$...) - 26% des users
- ✅ MD5 simple (32 chars) - Admins
- ✅ MD5+crypt (13 chars) - 74% des users legacy
- ✅ SHA1 (40 chars) - Système intermédiaire
- ✅ Plain text - Anciens comptes (à upgrader)

---

## ⚠️ Inconvénients & Solutions

### 1. Overhead CPU

**Problème** :
```typescript
bcrypt(password, 12 rounds) = 400ms  // ❌ TROP LENT
100 logins simultanés = 40 secondes CPU
```

**Solution appliquée** :
```typescript
bcrypt(password, 10 rounds) = 100ms  // ✅ BON
100 logins simultanés = 10 secondes CPU
```

**Monitoring recommandé** :
```typescript
// Ajouter dans auth.service.ts
async login(...) {
  const start = Date.now();
  const user = await this.authenticateUser(...);
  const duration = Date.now() - start;
  
  if (duration > 200) {
    this.logger.warn(`Slow login: ${duration}ms for ${email}`);
  }
}
```

### 2. Migration d'Algorithme

**Votre solution** : `needsRehash()` + `upgradeHashIfNeeded()`

```typescript
// Exemple d'utilisation future
if (passwordCrypto.needsRehash(currentHash)) {
  await passwordCrypto.upgradeHashIfNeeded(
    userId,
    plainPassword,
    currentHash,
    async (id, newHash) => {
      await userService.updatePassword(id, newHash);
    }
  );
}
```

**Scénarios gérés** :
- ✅ Legacy (MD5) → bcrypt 10
- ✅ Bcrypt 8 → bcrypt 10 (si vous changez BCRYPT_ROUNDS)
- ✅ Futur : bcrypt → argon2 (si vraiment nécessaire)

### 3. Maintenance Sécurité

**À suivre** :
- 📅 Vérifier les CVE de `bcrypt` (rare, mais possible)
- 📅 Mettre à jour Node.js régulièrement
- 📅 Auditer les BCRYPT_ROUNDS tous les 2 ans

**Commande** :
```bash
npm audit --audit-level=moderate
npm outdated bcrypt
```

---

## 🚀 Astuces Avancées Applicables

### 1. **Détection de Hash Faibles**

```typescript
// Déjà implémenté dans PasswordCryptoService
needsRehash(hash: string): boolean {
  // Retourne true si :
  // - Hash legacy (MD5, MD5+crypt, SHA1, plain)
  // - Bcrypt avec rounds < BCRYPT_ROUNDS actuel
}
```

**Usage** :
```bash
# Script pour analyser la base
node backend/scripts/analyze-password-security.js

Résultat attendu :
- 74% legacy MD5+crypt (à upgrader progressivement)
- 25% bcrypt moderne (OK)
- 1% plain text (URGENT à upgrader)
```

### 2. **Ne JAMAIS stocker le password dans Redis**

**✅ Votre implémentation actuelle** :
```typescript
// cookie-serializer.ts
serializeUser(user, done) {
  done(null, user.id); // ✅ Uniquement l'ID
}

// Session Redis contient :
{
  "session:xyz": {
    "userId": "12345",  // ✅ ID uniquement
    "ip": "1.2.3.4",
    "createdAt": "2025-10-04T..."
  }
}
```

**❌ À ÉVITER** :
```typescript
// NE JAMAIS FAIRE ÇA
{
  "session:xyz": {
    "password": "...",      // ❌ DANGEREUX
    "passwordHash": "..."   // ❌ INUTILE
  }
}
```

### 3. **Rate Limiting sur Login**

**Déjà implémenté dans auth.service.ts** :
```typescript
async login(email, password, ip) {
  // Vérifier tentatives
  const attempts = await this.checkLoginAttempts(email, ip);
  if (attempts >= 5) {
    throw new BadRequestException('Compte bloqué 15 minutes');
  }
  // ...
}
```

**Amélioration possible** :
```typescript
// Bloquer aussi par IP (pas que par email)
const globalAttempts = await this.checkLoginAttempts('*', ip);
if (globalAttempts >= 20) {
  throw new TooManyRequestsException('IP bloquée');
}
```

---

## 📊 Comparatif Algorithmes

| Algorithme | Performance | Sécurité GPU | Mémoire | Recommandation |
|------------|-------------|--------------|---------|----------------|
| **bcrypt (10)** | 100ms | ⭐⭐⭐ | 4KB | ✅ **VOTRE CHOIX** |
| **bcrypt (12)** | 400ms | ⭐⭐⭐⭐ | 4KB | ⚠️ Trop lent |
| **argon2id** | 50-100ms | ⭐⭐⭐⭐⭐ | 128MB | ❌ Overkill |
| **PBKDF2** | 50ms | ⭐⭐ | 1KB | ❌ Moins sûr |
| **scrypt** | 100ms | ⭐⭐⭐⭐ | 16MB | 🤷 Possible |

---

## 🎯 Checklist Sécurité Production

### Immédiat ✅
- [x] bcrypt avec 10 rounds
- [x] Session Redis (ID uniquement)
- [x] Rate limiting (5 tentatives/15min)
- [x] HttpOnly + SameSite cookies
- [x] Support multi-format (legacy + moderne)
- [x] `needsRehash()` implémenté

### Court terme (1-2 semaines) 📅
- [ ] Activer upgrade-on-login automatique
- [ ] Ajouter monitoring des logins lents (>200ms)
- [ ] Script d'analyse des hash faibles
- [ ] Tests E2E authentification

### Moyen terme (1-3 mois) 📅
- [ ] Migrer les comptes inactifs (batch)
- [ ] Alertes sur tentatives de brute-force
- [ ] Audit sécurité complet

### Jamais nécessaire ❌
- [ ] ~~Passer à argon2~~ (bcrypt suffit)
- [ ] ~~Stocker passwords en Redis~~ (dangereux)
- [ ] ~~Bcrypt 14+ rounds~~ (trop lent)

---

## 🔧 Configuration Recommandée

### Variables d'environnement
```env
# .env
BCRYPT_ROUNDS=10                    # ✅ Bon compromis
SESSION_SECRET=<random-256-bits>    # ✅ Généré aléatoirement
SESSION_MAX_AGE=604800000           # 7 jours
RATE_LIMIT_LOGIN=5                  # 5 tentatives
RATE_LIMIT_WINDOW=900000            # 15 minutes
```

### Monitoring
```typescript
// À ajouter dans auth.service.ts
private async logAuthMetrics(email: string, duration: number, success: boolean) {
  await this.metricsService.record({
    event: 'auth.login',
    email,
    duration,
    success,
    timestamp: new Date(),
  });
}
```

---

## 📚 Ressources

- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [bcrypt npm](https://www.npmjs.com/package/bcrypt)
- [Argon2 (si futur besoin)](https://www.npmjs.com/package/argon2)

---

**Conclusion** : Votre implémentation actuelle avec bcrypt 10 rounds est **optimale** pour un e-commerce de votre taille. Pas besoin de compliquer avec argon2.

**Prochaine action recommandée** : Activer l'upgrade-on-login automatique pour migrer progressivement les 74% de users legacy.

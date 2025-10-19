# 🔑 GUIDE RAPIDE - Configuration Clé API Resend

## 📍 Où mettre la nouvelle clé ?

**Fichier**: `backend/.env`  
**Ligne à modifier**: `RESEND_API_KEY="re_VOTRE_NOUVELLE_CLE_ICI"`

---

## 🚀 Étapes pour Obtenir et Configurer

### 1. Obtenir une Clé API Resend

#### Option A: Créer un Compte Gratuit (Recommandé)
```bash
# 1. Aller sur https://resend.com
# 2. Créer un compte (gratuit - 100 emails/jour)
# 3. Aller dans "API Keys" : https://resend.com/api-keys
# 4. Cliquer "Create API Key"
# 5. Copier la clé (format: re_xxxxxxxxxxxxxx)
```

#### Option B: Utiliser en Mode Développement (Temporaire)
```bash
# L'application fonctionne sans clé API
# Les emails ne seront pas envoyés, mais l'app démarre
# Laisser la ligne commentée ou vide
```

---

### 2. Ajouter la Clé dans `.env`

**Fichier**: `/workspaces/nestjs-remix-monorepo/backend/.env`

```bash
# Remplacer cette ligne:
RESEND_API_KEY="re_VOTRE_NOUVELLE_CLE_ICI"

# Par votre vraie clé:
RESEND_API_KEY="re_abc123def456..."
```

---

### 3. (Optionnel) Personnaliser l'Email

```bash
# Email expéditeur (nécessite domaine vérifié sur Resend)
EMAIL_FROM="notifications@votre-domaine.com"

# URL de l'application (pour les liens dans les emails)
APP_URL="http://localhost:5173"
```

---

## ⚠️ IMPORTANT - Révoquer l'Ancienne Clé

Si vous avez une clé API Resend qui était dans le code avant:

```bash
# 1. Aller sur https://resend.com/api-keys
# 2. Trouver la clé: re_hVVVLJC8_CX8cYeKyF2YnYX7Dbxqduh7R
# 3. Cliquer "Delete" ou "Revoke"
# 4. Utiliser la NOUVELLE clé générée
```

---

## 🧪 Tester la Configuration

### Vérifier que l'app démarre

```bash
cd /workspaces/nestjs-remix-monorepo/backend
npm run start:dev
```

### Messages Attendus

#### ✅ AVEC clé API configurée
```
✅ Email service (Resend) initialized with API key
```

#### ⚠️ SANS clé API (mode dev)
```
⚠️ RESEND_API_KEY non configurée - Les emails ne seront PAS envoyés.
⚠️ Email service initialized WITHOUT API key (emails disabled)
```

**Les deux cas fonctionnent !** L'application démarre dans tous les cas.

---

## 📋 Exemple de Fichier .env Complet

```bash
# ===============================================
# DATABASE CONFIGURATION - SUPABASE REST API
# ===============================================
SUPABASE_URL="https://cxpojprgwgubzjyqzmoq.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

REDIS_URL="redis://localhost:6379"
SESSION_SECRET="d4fba282b2f1fa22e6713bf924d736d50ab758e0e301e8398cc5765276f2cfa1"

# Analytics Configuration
ANALYTICS_ENABLED=true
ANALYTICS_PROVIDER="google"
ANALYTICS_GOOGLE_ID="GA_MEASUREMENT_ID_TEST"

# ===============================================
# EMAIL SERVICE - RESEND
# ===============================================
# ✅ CONFIGURÉ - Remplacer par votre vraie clé
RESEND_API_KEY="re_abc123def456..."
EMAIL_FROM="onboarding@resend.dev"
APP_URL="http://localhost:5173"

# ===============================================
# TEST & DEVELOPMENT ONLY
# ===============================================
TEST_USER_EMAIL="admin@fafa.fr"
TEST_USER_PASSWORD="Test123!_DevOnly"
```

---

## 🎯 Options de Configuration

### Mode Production
```bash
# Utiliser un domaine vérifié
EMAIL_FROM="noreply@votre-domaine.com"
APP_URL="https://votre-domaine.com"
RESEND_API_KEY="re_production_key_..."
```

### Mode Développement (Sans Email)
```bash
# Commenter ou ne pas mettre RESEND_API_KEY
# RESEND_API_KEY=""
EMAIL_FROM="onboarding@resend.dev"
APP_URL="http://localhost:5173"
```

### Mode Développement (Avec Email)
```bash
# Utiliser votre clé de test
RESEND_API_KEY="re_test_key_..."
EMAIL_FROM="test@resend.dev"
APP_URL="http://localhost:5173"
```

---

## 🔍 Dépannage

### Problème: Application crash au démarrage

**Cause**: Format de clé invalide  
**Solution**: Vérifier que la clé commence par `re_`

```bash
# ✅ BON FORMAT
RESEND_API_KEY="re_abc123..."

# ❌ MAUVAIS FORMAT
RESEND_API_KEY="abc123"
RESEND_API_KEY="sk_abc123"
```

### Problème: Emails ne partent pas

**Vérifications**:
```bash
# 1. Vérifier les logs au démarrage
npm run start:dev

# 2. Chercher ce message:
# ✅ Email service (Resend) initialized with API key

# 3. Si vous voyez:
# ⚠️ Email service initialized WITHOUT API key
# → La clé n'est pas configurée ou invalide
```

### Problème: "Invalid API key"

**Solutions**:
1. Vérifier que la clé est active sur https://resend.com/api-keys
2. Régénérer une nouvelle clé
3. Vérifier qu'il n'y a pas d'espaces avant/après la clé

---

## 📞 Liens Utiles

- **Dashboard Resend**: https://resend.com/overview
- **Générer Clé API**: https://resend.com/api-keys
- **Documentation Resend**: https://resend.com/docs
- **Vérifier Domaine**: https://resend.com/domains

---

## ✅ Checklist Finale

- [ ] Compte Resend créé (si besoin)
- [ ] Clé API générée
- [ ] Ancienne clé révoquée (si applicable)
- [ ] Nouvelle clé ajoutée dans `backend/.env`
- [ ] Format correct vérifié (commence par `re_`)
- [ ] Application testée (`npm run start:dev`)
- [ ] Message de confirmation vu dans les logs

---

**Fichier à éditer**: `/workspaces/nestjs-remix-monorepo/backend/.env`  
**Ligne**: `RESEND_API_KEY="re_VOTRE_NOUVELLE_CLE_ICI"`

**Besoin d'aide ?** Consultez `HOTFIX-EMAIL-SERVICE.md` pour plus de détails.

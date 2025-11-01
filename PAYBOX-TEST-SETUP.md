# 🧪 Configuration Environnement de TEST Paybox

## 📋 Contexte

Votre compte de PRODUCTION fonctionne :
- SITE: 5259250
- RANG: 001
- IDENTIFIANT: 822188223
- URL: https://tpeweb.paybox.com ✅

## 🎯 Objectif

Créer un environnement de TEST pour développer sans risque de paiements réels.

## 📞 Obtenir votre compte de TEST

D'après la documentation Paybox :
> "A l'ouverture, les comptes sont simultanément créés sur l'environnement 
> de production et sur l'environnement de tests (pré-production)"

### Étapes :

1. **Contacter le Support Paybox**
   - Email : support@paybox.com
   - Téléphone : +33 (0)5 32 09 09 27
   
2. **Demander vos identifiants de TEST**
   ```
   Bonjour,
   
   Je suis client Paybox avec le compte de production :
   - SITE: 5259250
   - RANG: 001
   - IDENTIFIANT: 822188223
   
   Je souhaite obtenir mes identifiants de TEST (pré-production) 
   et la clé HMAC associée pour l'environnement de développement.
   
   Merci,
   ```

3. **Informations à recevoir**
   - SITE de TEST (probablement le même: 5259250)
   - RANG de TEST
   - IDENTIFIANT de TEST
   - **CLÉ HMAC de TEST** (128 caractères, différente de la prod)
   - Login/mot de passe pour le Back-office TEST

4. **Back-office TEST**
   - URL : https://preprod-admin.paybox.com
   - Permet de consulter les transactions de test

## 🔧 Configuration dans le projet

Une fois les identifiants reçus, créer un fichier `.env.test` :

```env
# Paybox TEST Environment
PAYBOX_MODE=TEST
PAYBOX_SITE=VOTRE_SITE_TEST
PAYBOX_RANG=VOTRE_RANG_TEST
PAYBOX_IDENTIFIANT=VOTRE_ID_TEST
PAYBOX_HMAC_KEY=VOTRE_CLE_HMAC_TEST_128_CHARS
PAYBOX_PAYMENT_URL=https://preprod-tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi
```

## 💳 Cartes bancaires de TEST

Une fois en environnement TEST, utilisez les cartes officielles Paybox :

### VISA (paiement réussi)
- Numéro : 4000000000001091
- Expiration : 01/2026 (Janvier année suivante)
- CVV : 123

### MasterCard (paiement réussi)
- Numéro : 5200000000001096
- Expiration : 01/2026
- CVV : 123

### American Express (paiement réussi)
- Numéro : 340000000001098
- Expiration : 01/2026
- CVV : 123

## 🚀 Basculer entre TEST et PRODUCTION

### Développement local (TEST)
```bash
cp .env.test .env
npm run dev
```

### Production
```bash
cp .env.production .env
npm run build
npm start
```

## ⚠️ Sécurité

- ❌ Ne JAMAIS committer les clés HMAC dans Git
- ✅ Ajouter `.env*` dans `.gitignore`
- ✅ Utiliser des variables d'environnement en production
- ✅ Garder `.env.example` avec des valeurs factices

## 📊 Vérification

Pour confirmer que vous êtes en TEST :

```bash
# Vérifier la configuration
grep "PAYBOX_" .env

# Doit afficher :
# PAYBOX_MODE=TEST
# PAYBOX_PAYMENT_URL=https://preprod-tpeweb.paybox.com/...
```

## 📞 Support

Si vous rencontrez des problèmes pour obtenir vos identifiants de TEST,
le support Paybox est disponible du lundi au vendredi de 9h à 18h.

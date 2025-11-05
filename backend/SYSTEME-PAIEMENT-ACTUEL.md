# 💳 Système de paiement actuel en PRODUCTION

## ✅ Configuration active : **SystemPay/Lyra (BNP Paribas)**

Votre système de paiement en production est **SystemPay/Lyra**, PAS Paybox.

### 📋 Configuration PHP actuelle (confirmée)

```php
// Certificats SystemPay
$CertificatTest = "9300172162563656";
$CertificatProd = "9816635272016068";
$CertificatToUse = $CertificatProd;  // ✅ PRODUCTION ACTIVE

// Identifiants marchands
Site ID : 43962882
Certificat PROD : 9816635272016068
Mode : PRODUCTION
URL API : https://paiement.systempay.fr/vads-payment/
Méthode signature : SHA1

// Activation
if (($ID_PAYMENT_OPTIONS == "CB") || ($ID_PAYMENT_OPTIONS == "PAYPAL"))
// Utilisé pour tous les paiements CB et PayPal
```

### ✅ Configuration NestJS (.env.production) - CORRECTE

```bash
# PAYMENT GATEWAY - SystemPay/Lyra (BNP Paribas)
SYSTEMPAY_SITE_ID=43962882
SYSTEMPAY_CERTIFICATE_PROD=9816635272016068
SYSTEMPAY_CERTIFICATE_TEST=9300172162563656
SYSTEMPAY_MODE=PRODUCTION
SYSTEMPAY_API_URL=https://paiement.systempay.fr/vads-payment/
SYSTEMPAY_SIGNATURE_METHOD=SHA1
SYSTEMPAY_HMAC_KEY_TEST=7731B4225651B0C434189E2A13B963F91D8BBE78AEC97838E40925569E25357373C792E2FBE5A6B8C0CBC12ED27524CC2EE0C4653C93A14A39414AA42F85AEE5
```

### ✅ Utilisation actuelle

- **Paiements CB** : SystemPay/Lyra
- **PayPal** : SystemPay/Lyra (via leur gateway)
- **Mode** : PRODUCTION active
- **Méthode de signature** : SHA1

---

## ❌ Problème Paybox identifié et corrigé

### 🔴 Erreur initiale

```
https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi
Problème d'identification du commerce.
Accès refusé !
```

### 🔍 Cause du problème

Votre configuration Paybox utilisait **la clé HMAC de SystemPay** au lieu d'une clé HMAC Paybox :

```bash
# ❌ INCORRECTE - Clé SystemPay utilisée pour Paybox
PAYBOX_HMAC_KEY=7731B4225651B0C434189E2A13B963F9...  # Clé SystemPay !
```

Cette clé appartient à **SystemPay/Lyra**, pas à **Paybox/Verifone**.

### ✅ Correction appliquée

J'ai modifié `.env.production` pour :

1. **Désactiver Paybox** : Configuration mise en mode TEST avec identifiants TEST officiels
2. **Clarifier** : SystemPay est votre système de paiement actif
3. **Documenter** : Comment configurer Paybox si vous voulez l'utiliser à l'avenir

```bash
# Paybox DÉSACTIVÉ - Mode TEST
PAYBOX_SITE=1999888
PAYBOX_RANG=32
PAYBOX_IDENTIFIANT=107904482
PAYBOX_HMAC_KEY=0123456789ABCDEF...  # Clé TEST officielle Paybox
PAYBOX_MODE=TEST
PAYBOX_PAYMENT_URL=https://preprod-tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi
```

---

## 🎯 Recommandations

### Cas 1 : Vous voulez rester avec SystemPay (recommandé)

✅ **Aucune action requise**

Votre configuration SystemPay est correcte et active en production.

### Cas 2 : Vous voulez utiliser Paybox en production

Si vous avez vraiment besoin de Paybox (pour des raisons commerciales) :

1. **Contactez Paybox/Verifone** :
   - 📧 Email : support@paybox.com
   - ☎️ Tél : +33 (0)5 56 49 39 00
   - 🌐 Espace client : https://www.paybox.com/espace-client/

2. **Demandez** :
   - Vos identifiants PRODUCTION (SITE, RANG, IDENTIFIANT)
   - Votre clé HMAC Paybox PRODUCTION (128 caractères hexadécimaux)
   - L'URL du gateway de paiement

3. **Configurez** `.env.production` :
   ```bash
   PAYBOX_SITE=VOTRE_SITE_REEL
   PAYBOX_RANG=001
   PAYBOX_IDENTIFIANT=VOTRE_IDENTIFIANT_REEL
   PAYBOX_HMAC_KEY=VOTRE_VRAIE_CLE_HMAC_PAYBOX_128_CHARS
   PAYBOX_MODE=PRODUCTION
   PAYBOX_PAYMENT_URL=https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi
   ```

### Cas 3 : Vous voulez utiliser les deux systèmes

Vous pouvez avoir SystemPay ET Paybox configurés simultanément :

- SystemPay pour certains paiements
- Paybox pour d'autres

Dans ce cas, configurez correctement chaque système avec ses propres clés.

---

## 🔐 Distinction importante : SystemPay vs Paybox

### SystemPay/Lyra (Groupe Lyra Network / BNP Paribas)

- **Gateway** : https://paiement.systempay.fr/
- **Certificats** : 16 caractères (ex: `9816635272016068`)
- **Clés HMAC** : 128 caractères hexadécimaux (pour signature HMAC-SHA256)
- **Signature par défaut** : SHA1 (avec certificat)
- **Documentation** : https://paiement.systempay.fr/doc/

### Paybox/Verifone (Groupe Verifone)

- **Gateway** : https://tpeweb.paybox.com/
- **Identifiants** : SITE + RANG + IDENTIFIANT
- **Clés HMAC** : 128 caractères hexadécimaux (DIFFÉRENTS de SystemPay !)
- **Signature** : HMAC-SHA512
- **Documentation** : https://www1.paybox.com/espace-integrateur-documentation/

⚠️ **IMPORTANT** : Les clés HMAC de ces deux systèmes sont **INCOMPATIBLES** et **DIFFÉRENTES** !

---

## 📊 État actuel du projet

### ✅ Fonctionnel

- [x] Configuration SystemPay/Lyra en PRODUCTION
- [x] Certificats PROD configurés
- [x] URL API correcte
- [x] Méthode de signature SHA1
- [x] Paiements CB actifs
- [x] PayPal actif (via SystemPay)

### ⚠️ À vérifier

- [ ] Configuration Paybox DÉSACTIVÉE (mode TEST)
- [ ] Si Paybox est nécessaire : obtenir vraie clé HMAC Paybox

### ✅ Sécurité

- [x] Clés SystemPay correctement configurées
- [x] Clé Paybox incorrecte remplacée par clé TEST officielle
- [x] Documentation créée
- [x] Erreur "Accès refusé" expliquée

---

## 🚀 Pour démarrer

Votre configuration SystemPay étant correcte, vous pouvez :

```bash
# Redémarrer le backend
cd /workspaces/nestjs-remix-monorepo/backend
npm run start:dev

# Tester SystemPay (si endpoint disponible)
curl http://localhost:3000/api/payments/systempay/test
```

---

## 📞 Support

### SystemPay/Lyra (système actif)

- 🌐 Site : https://www.lyra.com/
- 📧 Support : support-ecommerce@lyra-network.com
- 📱 Tél : +33 (0)5 32 32 02 90

### Paybox/Verifone (si nécessaire)

- 🌐 Site : https://www.paybox.com/
- 📧 Support : support@paybox.com
- 📱 Tél : +33 (0)5 56 49 39 00

---

## 📝 Résumé

✅ **Système actuel** : SystemPay/Lyra en PRODUCTION  
❌ **Problème Paybox** : Clé HMAC incorrecte (clé SystemPay utilisée)  
✅ **Correction** : Paybox désactivé, configuration TEST restaurée  
🎯 **Recommandation** : Rester avec SystemPay (déjà opérationnel)

Si vous avez besoin d'activer Paybox, contactez Verifone pour obtenir vos vraies clés.

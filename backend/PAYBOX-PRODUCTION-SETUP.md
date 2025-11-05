# 🔴 PROBLÈME : Accès refusé Paybox Production

## ❌ Erreur actuelle
```
https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi
Problème d'identification du commerce.
Accès refusé !
```

## 🔍 Diagnostic

### Configuration actuelle (.env.production)
```bash
# Identifiants PRODUCTION
PAYBOX_SITE=5259250
PAYBOX_RANG=001
PAYBOX_IDENTIFIANT=822188223

# ⚠️ PROBLÈME : Clé HMAC TEST (de SystemPay/Lyra, pas Paybox)
PAYBOX_HMAC_KEY=7731B4225651B0C434189E2A13B963F91D8BBE78AEC97838E40925569E25357373C792E2FBE5A6B8C0CBC12ED27524CC2EE0C4653C93A14A39414AA42F85AEE5

# URL PRODUCTION
PAYBOX_PAYMENT_URL=https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi
PAYBOX_MODE=PRODUCTION
```

### Causes du refus d'accès

1. **Clé HMAC incorrecte** : Vous utilisez la clé HMAC de SystemPay/Lyra au lieu de la clé Paybox
2. **Possible mélange TEST/PROD** : Les identifiants PROD doivent être associés à une clé HMAC PROD Paybox
3. **Identifiants invalides** : Les identifiants ne correspondent peut-être pas à un compte actif

## ✅ Solution

### Étape 1 : Obtenir la vraie clé HMAC Paybox PRODUCTION

Contactez votre contact Verifone/Paybox pour obtenir :
- ✅ Confirmation des identifiants PRODUCTION (SITE, RANG, IDENTIFIANT)
- ✅ La **vraie clé HMAC Paybox PRODUCTION** (128 caractères hexadécimaux)
- ✅ L'URL exacte du gateway de paiement

### Étape 2 : Vérifier vos identifiants

Demandez à Paybox de confirmer :
```bash
PAYBOX_SITE=5259250          # Votre numéro de site marchand
PAYBOX_RANG=001              # Votre rang (généralement 001 ou 032)
PAYBOX_IDENTIFIANT=822188223 # Votre identifiant
```

### Étape 3 : Mettre à jour .env.production

Une fois la vraie clé obtenue :

```bash
# ===============================================
# PAYBOX PRODUCTION - Configuration valide
# ===============================================
PAYBOX_SITE=5259250
PAYBOX_RANG=001
PAYBOX_IDENTIFIANT=822188223

# ✅ VRAIE clé HMAC Paybox PRODUCTION (obtenue auprès de Verifone)
PAYBOX_HMAC_KEY=VOTRE_VRAIE_CLE_HMAC_PAYBOX_128_CARACTERES_HEX

# URL PRODUCTION
PAYBOX_PAYMENT_URL=https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi
PAYBOX_MODE=PRODUCTION
```

### Étape 4 : Alternative - Tester en mode TEST d'abord

Si vous n'avez pas encore la clé PROD, testez d'abord avec les identifiants TEST :

```bash
# Identifiants TEST officiels Paybox
PAYBOX_SITE=1999888
PAYBOX_RANG=32
PAYBOX_IDENTIFIANT=107904482

# Clé HMAC TEST officielle
PAYBOX_HMAC_KEY=0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF

# URL TEST
PAYBOX_PAYMENT_URL=https://preprod-tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi
PAYBOX_MODE=TEST
```

### Étape 5 : Script de basculement

J'ai créé des scripts pour basculer facilement :

```bash
# Passer en mode TEST
cd /workspaces/nestjs-remix-monorepo/backend
./switch-paybox-mode.sh test

# Passer en mode PRODUCTION (après avoir la vraie clé)
./switch-paybox-mode.sh prod

# Vérifier la configuration
./check-paybox-config.sh
```

## 🔐 Distinction clés HMAC

### SystemPay/Lyra (BNP Paribas)
```bash
SYSTEMPAY_HMAC_KEY_TEST=7731B4225651B0C434189E2A13B963F9...
SYSTEMPAY_HMAC_KEY_PROD=VOTRE_CLE_SYSTEMPAY_PROD...
```

### Paybox/Verifone (différent !)
```bash
PAYBOX_HMAC_KEY=VOTRE_CLE_PAYBOX_128_CARACTERES_HEX
```

⚠️ **NE PAS MÉLANGER** ces deux clés !

## 📞 Contact Paybox/Verifone

Pour obtenir votre clé HMAC PRODUCTION :

1. **Email** : support@paybox.com
2. **Téléphone** : +33 (0)5 56 49 39 00
3. **Espace client** : https://www.paybox.com/espace-client/

Informations à fournir :
- Numéro de site : `5259250`
- Identifiant : `822188223`
- Demande : "Clé HMAC SHA-512 pour le compte production"

## 🧪 Test après configuration

```bash
# Relancer le backend
cd /workspaces/nestjs-remix-monorepo/backend
npm run start:dev

# Tester l'endpoint de paiement
curl http://localhost:3000/api/payments/paybox/test
```

## 📝 Checklist de mise en production

- [ ] Obtenir la vraie clé HMAC Paybox PRODUCTION
- [ ] Confirmer les identifiants auprès de Paybox
- [ ] Mettre à jour .env.production avec la vraie clé
- [ ] Tester en mode TEST d'abord (preprod)
- [ ] Valider la signature HMAC avec ./validate-paybox-hmac.sh
- [ ] Basculer en PRODUCTION avec la vraie clé
- [ ] Effectuer un test de paiement réel
- [ ] Surveiller les logs pour les erreurs

## 🚨 Note de sécurité

**JAMAIS** :
- Committer les vraies clés HMAC dans Git
- Partager les clés HMAC publiquement
- Utiliser les clés PROD en environnement de développement
- Logger les clés HMAC dans les logs

**TOUJOURS** :
- Stocker les clés dans des variables d'environnement
- Utiliser des fichiers .env séparés pour TEST/PROD
- Vérifier que .env.production est dans .gitignore
- Faire un backup sécurisé des clés

# 🏦 AUDIT DES PASSERELLES DE PAIEMENT

Date: 30 octobre 2025  
Status: ⚠️ CONFIGURATION CONFUSE - NÉCESSITE CLARIFICATION

---

## 📊 CONTRATS ACTIFS

### 1️⃣ Cyberplus/SystemPay (BNP Paribas)
- **Merchant ID**: 43962882
- **Certificat PROD**: 9816635272016068
- **Certificat TEST**: 9300172162563656
- **Mode actuel**: PRODUCTION
- **URL**: https://paiement.systempay.fr/vads-payment/
- **Signature**: SHA-1 (ancienne méthode)
- **Status**: ✅ EN SERVICE (ancienne config)

### 2️⃣ Paybox (Verifone)
- **Site**: 5259250
- **Rang**: 001
- **Identifiant**: 822188223
- **Clé HMAC TEST**: 7731B4225651B0C434189E2A13B963F91D8BBE78AEC97838E40925569E25357373C792E2FBE5A6B8C0CBC12ED27524CC2EE0C4653C93A14A39414AA42F85AEE5
- **Clé HMAC PROD**: ❌ NON OBTENUE (placeholder "prod" invalide)
- **Mode actuel**: TEST uniquement
- **URL TEST**: https://preprod-tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi
- **URL PROD**: https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi
- **Signature**: HMAC SHA-512
- **Status**: ⚠️ JAMAIS ACTIVÉ dans l'ancien code
- **Contrat**: ✅ Actif - 335.07€/an HT (facture 5010544925)

---

## 🔍 PROBLÈMES IDENTIFIÉS

### ❌ Problème 1: Service Cyberplus générique
Le fichier `cyberplus.service.ts` génère un formulaire **générique** qui ne respecte PAS le protocole exact SystemPay.

**Champs manquants pour SystemPay:**
- `vads_action_mode` (INTERACTIVE)
- `vads_ctx_mode` (PRODUCTION/TEST)
- `vads_currency` (978 pour EUR)
- `vads_page_action` (PAYMENT)
- `vads_payment_config` (SINGLE)
- `vads_site_id` (au lieu de merchant_id)
- `vads_trans_date` (format YYYYMMDDHHmmss UTC)
- `vads_trans_id` (6 chiffres unique)
- `vads_version` (V2)
- Signature: SHA-1 avec protocole spécifique

**Ce qui est généré actuellement:**
```typescript
{
  merchant_id: "43962882",  // ❌ Devrait être vads_site_id
  amount: "47516",           // ❌ Devrait être vads_amount
  currency: "EUR",           // ❌ Devrait être vads_currency=978
  // ... manque TOUS les champs vads_*
}
```

### ❌ Problème 2: Confusion Cyberplus vs Paybox
Le code mélange deux systèmes différents:
- **Cyberplus (SystemPay)**: Protocole avec préfixe `vads_*`, SHA-1
- **Paybox (Verifone)**: Protocole avec préfixe `PBX_*`, HMAC SHA-512

Ces deux systèmes sont **INCOMPATIBLES** - on ne peut pas utiliser le même code pour les deux.

### ❌ Problème 3: Configuration .env incohérente
Variables actuelles dans `.env`:
```
CYBERPLUS_SITE_ID=43962882
CYBERPLUS_CERTIFICAT=9816635272016068
```

Mais le code frontend/backend parle parfois de "Paybox".

---

## ✅ SOLUTION RECOMMANDÉE

### Option A: Utiliser Cyberplus (SystemPay) uniquement
**Avantages:**
- Déjà configuré et en production
- Certificat PROD disponible

**Actions:**
1. ✅ Corriger `cyberplus.service.ts` pour utiliser le VRAI protocole SystemPay
2. ✅ Ajouter tous les champs `vads_*` requis
3. ✅ Implémenter signature SHA-1 correcte
4. ✅ Tester en mode PRODUCTION

### Option B: Migrer vers Paybox (Verifone)
**Avantages:**
- Contrat actif payé (335€/an)
- Protocole plus moderne (HMAC SHA-512)

**Actions:**
1. ⚠️ Obtenir la clé HMAC PRODUCTION auprès de Verifone
2. ✅ Utiliser `paybox.service.ts` déjà créé
3. ✅ Remplacer tous les appels Cyberplus par Paybox
4. ✅ Tester en preprod puis activer PROD

### Option C: Supporter les deux (complexe)
**Avantages:**
- Redondance
- Possibilité de basculer

**Inconvénients:**
- Code complexe
- Maintenance double
- Tests doubles

---

## 🎯 DÉCISION REQUISE

**Question pour le client:**
Quel système voulez-vous utiliser ?

- [ ] **A) Cyberplus (SystemPay)** - celui qui marche actuellement
- [ ] **B) Paybox (Verifone)** - celui que vous payez  
- [ ] **C) Les deux** - configuration avancée

---

## 📝 PROCHAINES ÉTAPES

### Si choix A (Cyberplus):
1. Corriger `cyberplus.service.ts` avec le vrai protocole
2. Ajouter méthode `generateSystemPayForm()` correcte
3. Tester avec merchant 43962882
4. Supprimer/désactiver code Paybox

### Si choix B (Paybox):
1. Obtenir clé HMAC PROD de Verifone
2. Activer `paybox.service.ts`
3. Remplacer appels Cyberplus → Paybox dans controller
4. Tester en preprod
5. Activer PROD

### Si choix C (Les deux):
1. Créer interface `PaymentGateway` commune
2. Implémenter `CyberplusGateway` et `PayboxGateway`
3. Factory pattern pour sélection dynamique
4. Configuration par commande ou par défaut

---

## 🔐 SÉCURITÉ

### ⚠️ NE JAMAIS LOGGER:
- Certificats (Cyberplus: 9816635272016068)
- Clés HMAC (Paybox: 7731B4...)
- Signatures calculées
- Données cartes bancaires

### ✅ À logger:
- IDs transactions
- Status paiements
- Montants
- Références commandes
- Erreurs (sans données sensibles)

---

## 📞 CONTACT SUPPORT

### Cyberplus/SystemPay (BNP)
- Documentation: https://paiement.systempay.fr/doc/
- Support: support@systempay.fr
- Merchant: 43962882

### Paybox (Verifone)
- Documentation: https://www.paybox.com/documentation/
- Support: i.recouvrement@verifone.com
- Site: 5259250/001
- Contrat: 5010544925

---

**Auteur**: GitHub Copilot  
**Date**: 2025-10-30  
**Version**: 1.0

# 🧪 GUIDE DE TEST - INTERFACE UNIFIÉE `/orders`

**Date** : 12 octobre 2025  
**Statut** : Prêt pour tests  
**Fichier à tester** : `frontend/app/routes/orders._index.tsx`

---

## 🎯 OBJECTIF

Valider que l'interface unifiée `/orders` s'adapte correctement selon le niveau utilisateur et que toutes les permissions fonctionnent comme prévu.

---

## ⚙️ PRÉREQUIS

### 1. Backend démarré
```bash
cd /workspaces/nestjs-remix-monorepo/backend
npm run dev
```

✅ Backend doit tourner sur `http://localhost:3000`

### 2. Frontend démarré
```bash
cd /workspaces/nestjs-remix-monorepo/frontend
npm run dev
```

✅ Frontend doit tourner sur `http://localhost:3001` (ou autre port)

### 3. Comptes utilisateurs

Vous devez avoir accès à **4 comptes de test** avec différents niveaux :

| Niveau | Rôle | Email test suggéré |
|--------|------|-------------------|
| **3-4** | 👔 Commercial | commercial@test.com |
| **5-6** | 📊 Responsable | responsable@test.com |
| **7-8** | 🔑 Administrateur | admin@test.com |
| **9** | 👑 Super Admin | superadmin@test.com |

> **Note** : Si vous n'avez pas ces comptes, créez-les dans Supabase ou votre système d'authentification.

---

## 📋 SCÉNARIOS DE TEST

### 🧪 TEST 1 : COMMERCIAL (Niveau 3-4)

#### Connexion
- [ ] Se connecter avec compte Commercial (niveau 3-4)
- [ ] Accéder à `/orders`

#### Vérifications Header
- [ ] Badge affiché : **👔 Commercial** (bleu clair)
- [ ] Bouton "Nouvelle Commande" **CACHÉ** ❌
- [ ] Bouton "Exporter CSV" **VISIBLE** ✅

#### Vérifications Statistiques
- [ ] **AUCUNE statistique** affichée ❌
  - [ ] Section statistiques complètement masquée
  - [ ] Pas de cartes CA, Total, etc.

#### Vérifications Filtres
- [ ] **4 filtres** complets
  - [ ] Recherche (client, email, ID)
  - [ ] Statut commande
  - [ ] Paiement (Payé/Non payé)
  - [ ] Période (Aujourd'hui, Semaine, Mois, Année)

#### Vérifications Actions
Dans le tableau des commandes :
- [ ] Bouton "Voir" (👁️) **VISIBLE** ✅
- [ ] Bouton "Infos" (ℹ️) **VISIBLE** ✅
- [ ] Bouton "Valider" **VISIBLE** (commandes statut 2) ✅
- [ ] Bouton "Expédier" **VISIBLE** (commandes statut 3) ✅
- [ ] Bouton "Livrer" **VISIBLE** (commandes statut 4) ✅
- [ ] Bouton "Annuler" **VISIBLE** ✅
- [ ] Bouton "Marquer payé" **VISIBLE** (si non payé) ✅

#### Test Sécurité
- [ ] Ouvrir Console navigateur (F12)
- [ ] Tenter POST sur action "validate" via fetch :
  ```javascript
  fetch('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      _action: 'validate',
      orderId: 'ORD-123'
    })
  }).then(r => r.json()).then(console.log)
  ```
- [ ] **Résultat attendu** : Erreur 403 "Permission refusée"

#### Résultat
- [ ] ✅ PASSÉ
- [ ] ❌ ÉCHOUÉ (noter les problèmes)

---

### 🧪 TEST 2 : RESPONSABLE (Niveau 5-6)

#### Connexion
- [ ] Se déconnecter
- [ ] Se connecter avec compte Responsable (niveau 5-6)
- [ ] Accéder à `/orders`

#### Vérifications Header
- [ ] Badge affiché : **📊 Responsable** (vert)
- [ ] Bouton "Nouvelle Commande" **CACHÉ** ❌
- [ ] Bouton "Exporter CSV" **VISIBLE** ✅

#### Vérifications Statistiques
- [ ] **6 cartes** affichées (comme admin)
  - [ ] Total Commandes
  - [ ] CA Total
  - [ ] CA du Mois
  - [ ] Panier Moyen
  - [ ] Impayé
  - [ ] En Attente

#### Vérifications Filtres
- [ ] **4 filtres** complets
  - [ ] Recherche
  - [ ] Statut commande
  - [ ] Paiement
  - [ ] Période

#### Vérifications Actions
- [ ] Bouton "Voir" **VISIBLE** ✅
- [ ] Bouton "Infos" **VISIBLE** ✅
- [ ] Bouton "Valider" **CACHÉ** ❌
- [ ] Bouton "Expédier" **CACHÉ** ❌
- [ ] Tous les boutons d'action **CACHÉS** ❌

#### Vérifications Financières
- [ ] Montants **VISIBLES** dans les statistiques ✅
- [ ] CA détaillé **VISIBLE** ✅
- [ ] Impayé **VISIBLE** ✅

#### Résultat
- [ ] ✅ PASSÉ
- [ ] ❌ ÉCHOUÉ (noter les problèmes)

---

### 🧪 TEST 3 : ADMINISTRATEUR (Niveau 7-8)

#### Connexion
- [ ] Se déconnecter
- [ ] Se connecter avec compte Admin (niveau 7-8)
- [ ] Accéder à `/orders`

#### Vérifications Header
- [ ] Badge affiché : **🔑 Administrateur** (bleu foncé)
- [ ] Bouton "Nouvelle Commande" **VISIBLE** ✅
- [ ] Bouton "Exporter CSV" **VISIBLE** ✅

#### Vérifications Statistiques
- [ ] **6 cartes** affichées
  - [ ] Toutes les statistiques complètes

#### Vérifications Filtres
- [ ] **4 filtres** complets avec toutes options

#### Vérifications Actions - Boutons visibles
- [ ] Bouton "Voir" **VISIBLE** ✅
- [ ] Bouton "Infos" **VISIBLE** ✅
- [ ] Bouton "Valider" **VISIBLE** (commandes statut 2) ✅
- [ ] Bouton "Expédier" **VISIBLE** (commandes statut 3) ✅
- [ ] Bouton "Rappel" **VISIBLE** (commandes statut 1, non payées) ✅
- [ ] Bouton "Annuler" **VISIBLE** (tous sauf livrées) ✅

#### Test Action : Valider
- [ ] Trouver une commande avec statut "Confirmée" (2)
- [ ] Cliquer sur bouton "Valider"
- [ ] **Résultat attendu** : Toast "Commande validée" ✅
- [ ] Console backend : Log `✅ Valider commande #XXX`

#### Test Action : Expédier
- [ ] Trouver commande statut "En préparation" (3)
- [ ] Cliquer "Expédier"
- [ ] **Modal s'ouvre** avec champ "Numéro de suivi" ✅
- [ ] Entrer numéro : "FR1234567890"
- [ ] Cliquer "Confirmer l'expédition"
- [ ] **Résultat** : Toast success ✅
- [ ] *Note* : Email envoyé au client (si Resend configuré)

#### Test Action : Annuler
- [ ] Cliquer "Annuler" sur une commande
- [ ] **Modal s'ouvre** avec champ "Raison" ✅
- [ ] Entrer raison : "Produit indisponible"
- [ ] Cliquer "Confirmer l'annulation"
- [ ] **Résultat** : Toast success ✅

#### Test Export CSV
- [ ] Cliquer bouton "Exporter CSV"
- [ ] **Résultat** : Toast "Export CSV généré" ✅
- [ ] Console : Log export

#### Résultat
- [ ] ✅ PASSÉ
- [ ] ❌ ÉCHOUÉ (noter les problèmes)

---

### 🧪 TEST 4 : SUPER ADMIN (Niveau 9)

#### Connexion
- [ ] Se connecter avec compte Super Admin (niveau 9)
- [ ] Accéder à `/orders`

#### Vérifications Header
- [ ] Badge affiché : **👑 Super Admin** (violet/purple)
- [ ] Tous les boutons **VISIBLES** ✅

#### Vérifications complètes
- [ ] Toutes les fonctionnalités identiques à Admin
- [ ] **6 statistiques** complètes ✅
- [ ] **4 filtres** complets ✅
- [ ] **Tous les boutons d'action** disponibles ✅

#### Résultat
- [ ] ✅ PASSÉ
- [ ] ❌ ÉCHOUÉ (noter les problèmes)

---

### 🧪 TEST 5 : SÉCURITÉ

#### Test 1 : Accès refusé niveau insuffisant
- [ ] Se connecter avec compte niveau < 3 (ex: niveau 2)
- [ ] Tenter d'accéder à `/orders`
- [ ] **Résultat attendu** : Erreur 403 "Accès refusé"

#### Test 2 : Contournement permission (Commercial)
- [ ] Se connecter en Commercial (niveau 3)
- [ ] Ouvrir console navigateur
- [ ] Exécuter ce code :
  ```javascript
  // Tenter de valider une commande sans permission
  fetch('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    credentials: 'include',
    body: new URLSearchParams({
      _action: 'validate',
      orderId: 'ORD-00001'
    })
  })
  .then(r => r.json())
  .then(data => {
    if (data.error && data.error.includes('Permission refusée')) {
      console.log('✅ SÉCURITÉ OK - Permission bloquée');
    } else {
      console.error('❌ SÉCURITÉ COMPROMISE - Action autorisée !');
    }
  });
  ```
- [ ] **Résultat attendu** : Erreur 403 "Permission refusée - Action réservée aux administrateurs"

#### Test 3 : Contournement permission (Responsable)
- [ ] Se connecter en Responsable (niveau 5)
- [ ] Même test que Test 2
- [ ] **Résultat** : Même erreur 403 ✅

#### Test 4 : Vérification logs sécurité
- [ ] Regarder console backend
- [ ] Vérifier présence des logs :
  ```
  🚫 [Action] Permission refusée - canValidate requis
  ```

#### Résultat
- [ ] ✅ TOUS LES TESTS SÉCURITÉ PASSÉS
- [ ] ❌ FAILLE DÉTECTÉE (détailler)

---

## 🐛 BUGS DÉTECTÉS

### Bug #1
**Description** : 

**Niveau utilisateur concerné** :

**Étapes pour reproduire** :
1. 
2. 
3. 

**Comportement attendu** :

**Comportement actuel** :

**Priorité** : 🔴 Critique / 🟠 Haute / 🟡 Moyenne / 🟢 Basse

---

### Bug #2
...

---

## ✅ VALIDATION FINALE

### Résumé des tests

| Niveau | Tests passés | Tests échoués | Statut |
|--------|--------------|---------------|--------|
| Commercial (3-4) | /14 | /14 | ⏳ |
| Responsable (5-6) | /12 | /12 | ⏳ |
| Admin (7-8) | /16 | /16 | ⏳ |
| Super Admin (9) | /8 | /8 | ⏳ |
| Sécurité | /4 | /4 | ⏳ |
| **TOTAL** | **/54** | **/54** | ⏳ |

### Critères de validation

- [ ] **100% des tests passés** ✅
- [ ] **Aucune faille de sécurité** détectée 🔐
- [ ] **UI responsive** et fluide 📱
- [ ] **Toasts notifications** fonctionnelles 🎉
- [ ] **Emails envoyés** (si Resend configuré) 📧
- [ ] **Logs backend** corrects 📝

### Décision

- [ ] ✅ **VALIDÉ** - Prêt pour migration (créer redirections)
- [ ] ⏳ **EN ATTENTE** - Corrections mineures nécessaires
- [ ] ❌ **REJETÉ** - Problèmes majeurs à corriger

---

## 📝 NOTES

### Observations positives
- 
- 

### Points d'amélioration
- 
- 

### Suggestions
- 
- 

---

## 🚀 ÉTAPE SUIVANTE

### Si tests OK ✅

1. **Créer les redirections** :
   ```bash
   # Backup des anciennes routes
   cp frontend/app/routes/admin.orders._index.tsx frontend/app/routes/admin.orders._index.tsx.backup
   cp frontend/app/routes/commercial.orders._index.tsx frontend/app/routes/commercial.orders._index.tsx.backup
   ```

2. **Implémenter redirections** (voir RECAP-CONSOLIDATION-FINAL.md)

3. **Tester redirections** :
   - [ ] `/admin/orders` → `/orders` (301)
   - [ ] `/commercial/orders` → `/orders` (301)
   - [ ] Query params préservés

4. **Cleanup** :
   - [ ] Supprimer `.backup` files
   - [ ] Commit final
   - [ ] Update documentation

### Si tests KO ❌

1. **Corriger les bugs** identifiés
2. **Re-tester** les scénarios échoués
3. **Valider corrections**
4. **Relancer tests complets**

---

**Testeur** : _______________________  
**Date** : _______________________  
**Durée** : _______ minutes  
**Environnement** : Dev / Staging / Prod  
**Navigateur** : Chrome / Firefox / Safari / Edge  

**Signature** : _______________________

# 🔄 AJUSTEMENT PERMISSIONS COMMERCIAL

**Date** : 12 octobre 2025  
**Changement** : Permissions Commercial étendues pour gestion opérationnelle

---

## 🎯 DEMANDE CLIENT

> "le commercial doit pouvoir gérer une commande mais pas de créer commande et pas voir statistique"

---

## ✅ CHANGEMENTS APPLIQUÉS

### Commercial (niveau 3-4) - AVANT vs APRÈS

| Permission | AVANT | APRÈS | Justification |
|------------|-------|-------|---------------|
| `canValidate` | ❌ | ✅ | Peut valider commandes |
| `canShip` | ❌ | ✅ | Peut expédier |
| `canDeliver` | ❌ | ✅ | Peut marquer livrée |
| `canCancel` | ❌ | ✅ | Peut annuler |
| `canSendEmails` | ❌ | ✅ | Peut envoyer emails |
| `canMarkPaid` | ❌ | ✅ | Peut marquer payé |
| `showAdvancedFilters` | ❌ | ✅ | Besoin filtres pour gérer |
| `showActionButtons` | ❌ | ✅ | Afficher boutons action |
| **canCreateOrders** | ❌ | ❌ | **RESTE INTERDIT** ✅ |
| **canSeeFullStats** | ❌ | ❌ | **RESTE MASQUÉ** ✅ |
| **canSeeFinancials** | ❌ | ❌ | **RESTE MASQUÉ** ✅ |
| canReturn | ❌ | ❌ | Réservé Admin |
| canRefund | ❌ | ❌ | Réservé Admin |

**Total permissions** : 5/15 → **11/15** (+6 permissions)

---

## 🎨 IMPACT SUR L'INTERFACE

### Commercial (niveau 3-4)

#### ✅ CE QUI CHANGE

**Header** :
- Bouton "Exporter CSV" : ✅ (inchangé)
- Bouton "Nouvelle Commande" : ❌ **MASQUÉ** (comme demandé)

**Statistiques** :
- AVANT : 4 cartes basiques
- APRÈS : **AUCUNE carte** (masquées comme demandé)

**Filtres** :
- AVANT : 2 filtres (Recherche, Statut)
- APRÈS : **4 filtres** (Recherche, Statut, Paiement, Période)

**Boutons d'action** :
- AVANT : Voir + Infos seulement
- APRÈS : **Valider, Expédier, Livrer, Annuler, Marquer payé**

**Modals** :
- AVANT : Aucune
- APRÈS : **Modal Expédition, Modal Annulation**

#### ❌ CE QUI RESTE INTERDIT

- ❌ Créer de nouvelles commandes
- ❌ Voir statistiques (CA, totaux, etc.)
- ❌ Voir montants financiers détaillés
- ❌ Gérer retours/SAV
- ❌ Émettre remboursements

---

## 📊 COMPARAISON RÔLES

### Matrice des permissions mise à jour

| Action | Commercial | Responsable | Admin |
|--------|------------|-------------|-------|
| **Gestion commandes** | ✅ OUI | ❌ NON | ✅ OUI |
| **Voir statistiques** | ❌ NON | ✅ OUI | ✅ OUI |
| **Créer commandes** | ❌ NON | ❌ NON | ✅ OUI |
| **Retours/Remboursements** | ❌ NON | ❌ NON | ✅ OUI |

### Profils utilisateurs clarifiés

| Niveau | Rôle | Fonction | Permissions |
|--------|------|----------|-------------|
| **3-4** | 👔 Commercial | **Gestion opérationnelle** | 11/15 |
| **5-6** | 📊 Responsable | **Consultation & Reporting** | 6/15 |
| **7-8** | 🔑 Admin | **Administration complète** | 15/15 |
| **9** | 👑 Super Admin | **Administration + Config** | 15/15 |

---

## 💡 LOGIQUE MÉTIER

### Commercial (3-4) - GESTION OPÉRATIONNELLE
**Rôle** : Traiter les commandes au quotidien
**Peut** :
- ✅ Valider une commande client
- ✅ Préparer l'expédition
- ✅ Confirmer la livraison
- ✅ Gérer les annulations
- ✅ Communiquer avec clients (emails)
- ✅ Mettre à jour statut paiement

**Ne peut pas** :
- ❌ Créer de nouvelles commandes (éviter doublons, erreurs)
- ❌ Voir statistiques globales (focus sur traitement)
- ❌ Accéder aux montants financiers (confidentialité)

### Responsable (5-6) - SUPERVISION
**Rôle** : Superviser l'activité, reporting
**Peut** :
- ✅ Voir toutes les statistiques
- ✅ Analyser CA, performances
- ✅ Exporter données

**Ne peut pas** :
- ❌ Modifier les commandes (supervision seulement)

### Admin (7-8) - TOUT
**Rôle** : Administration complète
**Peut** :
- ✅ Tout faire (création, gestion, reporting, SAV)

---

## 🔐 SÉCURITÉ

### Vérifications en place

✅ **Client-side** : Boutons conditionnels selon permissions  
✅ **Server-side** : Action vérifie permissions avant exécution  
✅ **Logs** : Toutes actions loggées avec niveau utilisateur  

### Tests de sécurité à effectuer

- [ ] Commercial peut valider → ✅ Autorisé
- [ ] Commercial peut expédier → ✅ Autorisé
- [ ] Commercial peut annuler → ✅ Autorisé
- [ ] Commercial tente créer commande → ❌ Refusé (bouton masqué)
- [ ] Commercial tente POST create → ❌ Erreur 403
- [ ] Commercial ne voit pas stats → ✅ Masquées
- [ ] Responsable tente valider → ❌ Refusé (bouton masqué)
- [ ] Responsable voit stats → ✅ Visible

---

## 📝 FICHIERS MODIFIÉS

### Code source (1 fichier)
✅ `frontend/app/utils/permissions.ts`
- Ligne 100-117 : Commercial permissions mises à jour
- 11 permissions au lieu de 5

### Documentation (4 fichiers)
✅ `TABLEAU-PERMISSIONS.md` - Matrice mise à jour  
✅ `STATUT-PROJET.md` - Adaptations UI mises à jour  
✅ `README-CONSOLIDATION.md` - Tableau comparatif mis à jour  
✅ `AJUSTEMENT-PERMISSIONS-COMMERCIAL.md` - Ce fichier (nouveau)

---

## 🧪 TESTS À EFFECTUER

### Test Commercial - Scénario complet

1. **Connexion**
   ```
   Email: commercial@test.com
   Password: Test1234!
   ```

2. **Vérifications UI**
   - [ ] Badge "👔 Commercial" affiché
   - [ ] **AUCUNE statistique** visible
   - [ ] **4 filtres** disponibles
   - [ ] Bouton "Nouvelle Commande" **MASQUÉ**
   - [ ] Bouton "Exporter CSV" **VISIBLE**

3. **Vérifications Actions**
   - [ ] Bouton "Valider" visible (commandes statut 2)
   - [ ] Bouton "Expédier" visible (commandes statut 3)
   - [ ] Bouton "Livrer" visible (commandes statut 4)
   - [ ] Bouton "Annuler" visible
   - [ ] Bouton "Marquer payé" visible (si non payé)

4. **Test fonctionnel - Valider commande**
   - [ ] Cliquer "Valider" sur commande statut 2
   - [ ] Modal de confirmation
   - [ ] Email envoyé au client ✅
   - [ ] Toast success
   - [ ] Commande passe en statut 3

5. **Test fonctionnel - Expédier commande**
   - [ ] Cliquer "Expédier" sur commande statut 3
   - [ ] Modal s'ouvre
   - [ ] Entrer numéro tracking
   - [ ] Email envoyé au client ✅
   - [ ] Toast success

6. **Test sécurité - Création interdite**
   - [ ] Bouton "Nouvelle Commande" absent ✅
   - [ ] Tenter POST direct create → Erreur 403 ✅

---

## ✅ VALIDATION

### Critères de succès

- [x] ✅ Code modifié (permissions.ts)
- [x] ✅ Documentation mise à jour (4 fichiers)
- [ ] ⏳ Tests utilisateurs effectués
- [ ] ⏳ Commercial peut gérer commandes
- [ ] ⏳ Commercial ne peut PAS créer commandes
- [ ] ⏳ Commercial ne voit PAS statistiques

### Prochaine étape

1. **Lancer les serveurs**
   ```bash
   cd backend && npm run dev    # Terminal 1
   cd frontend && npm run dev   # Terminal 2
   ```

2. **Créer compte test (si pas déjà fait)**
   ```bash
   ./create-test-users.sh
   ```

3. **Tester avec compte commercial@test.com**
   - Suivre scénario ci-dessus

---

## 📞 RÉCAPITULATIF

### ✨ Ce qui a été fait

✅ Commercial peut maintenant **gérer les commandes** (valider, expédier, livrer, annuler)  
✅ Commercial **NE PEUT PAS créer** de commandes  
✅ Commercial **NE VOIT PAS** les statistiques  
✅ Responsable reste en mode **consultation pure** (reporting)  
✅ Documentation complète mise à jour  

### 🎯 Résultat attendu

**Commercial** : Outil de gestion opérationnelle (traiter commandes quotidiennes)  
**Responsable** : Outil de supervision (analyser activité, reporting)  
**Admin** : Outil complet (tout faire)

---

**Changement validé** : 12 octobre 2025  
**Prêt pour tests** : ✅ OUI  
**Impact** : Commercial → 11 permissions (au lieu de 5)

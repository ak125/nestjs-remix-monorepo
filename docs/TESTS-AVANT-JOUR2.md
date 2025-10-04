# 🧪 Tests Frontend - Avant Jour 2

**Date**: 4 octobre 2025  
**Branch**: `refactor/user-module-dto-cleanup`  
**Statut**: ✅ Jour 1 terminé et committé

---

## 📋 Tests à Effectuer

### 🎯 Objectif
Vérifier que les modifications du **Jour 1** (nettoyage DTOs) n'ont causé **AUCUNE régression** dans le frontend.

---

## 🌐 URLs à Tester

### Backend (Port 3000)
- ✅ Backend démarré sur `http://localhost:3000`

### Frontend (Port 5173)
- 📱 Login: `http://localhost:5173/login`
- 📱 Register: `http://localhost:5173/auth/register`
- 📱 Dashboard: `http://localhost:5173/dashboard` (après connexion)

---

## ✅ Checklist des Tests

### 1️⃣ Page de Connexion (`/login`)

#### Tests Basiques
- [ ] La page se charge sans erreur
- [ ] Le formulaire s'affiche correctement
- [ ] Design moderne avec gradients (Tailwind + shadcn/ui)
- [ ] Champs: Email + Mot de passe visibles

#### Tests Fonctionnels - Connexion Réussie
- [ ] Se connecter avec un compte valide:
  - Email: `testadmin@example.com`
  - Password: `Test123456!`
- [ ] Vérifier redirection vers dashboard
- [ ] Vérifier session créée (JWT stocké)

#### Tests Fonctionnels - Erreurs
- [ ] Tenter connexion avec mauvais mot de passe
- [ ] Vérifier affichage message d'erreur
- [ ] Tenter connexion avec email inexistant
- [ ] Vérifier message d'erreur approprié

#### Tests UI
- [ ] Spinner de chargement s'affiche pendant soumission
- [ ] Bouton désactivé pendant chargement
- [ ] Lien "Mot de passe oublié" présent
- [ ] Lien "Créer un compte" fonctionne

---

### 2️⃣ Page d'Inscription (`/auth/register`)

#### Tests Basiques
- [ ] La page se charge sans erreur
- [ ] Le formulaire complet s'affiche
- [ ] Design moderne cohérent avec login
- [ ] Tous les champs visibles

#### Tests Validation Champs
- [ ] **Email**: Validation format email
- [ ] **Mot de passe**: 
  - [ ] Minimum 8 caractères requis
  - [ ] Indicateur de force s'affiche
  - [ ] Barre de progression colorée (rouge/jaune/vert)
- [ ] **Confirmation mot de passe**: Doit correspondre
- [ ] **Code postal**: Format 5 chiffres
- [ ] **Téléphone**: Format accepté

#### Tests Indicateur de Force
- [ ] Mot de passe "test" → Rouge "Faible"
- [ ] Mot de passe "Test1234" → Jaune "Moyen"
- [ ] Mot de passe "Test123456!" → Vert "Fort"

#### Tests Inscription Complète
- [ ] Remplir tous les champs obligatoires
- [ ] Soumettre le formulaire
- [ ] Vérifier création du compte
- [ ] Vérifier connexion automatique
- [ ] Vérifier redirection vers dashboard

#### Tests Erreurs
- [ ] Tenter inscription avec email existant
- [ ] Vérifier message d'erreur
- [ ] Tenter soumission avec champs vides
- [ ] Vérifier validation HTML5

#### Tests UI
- [ ] États de chargement pendant soumission
- [ ] Tous les champs désactivés pendant soumission
- [ ] Grid responsive (mobile vs desktop)
- [ ] Checkbox newsletter fonctionne

---

### 3️⃣ Dashboard (`/dashboard`)

#### Tests Basiques
- [ ] Accessible après connexion
- [ ] Données utilisateur affichées
- [ ] Navigation fonctionne

#### Tests Fonctionnalités Utilisateur
- [ ] **Profil utilisateur**:
  - [ ] Voir informations personnelles
  - [ ] Modifier prénom/nom
  - [ ] Modifier email
  - [ ] Modifier téléphone
  
- [ ] **Adresses**:
  - [ ] Voir adresse de facturation
  - [ ] Voir adresses de livraison
  - [ ] Ajouter nouvelle adresse livraison
  - [ ] Modifier adresse existante
  - [ ] Supprimer adresse (si plus d'une)
  - [ ] Définir adresse par défaut

- [ ] **Mot de passe**:
  - [ ] Changer mot de passe
  - [ ] Validation ancien mot de passe
  - [ ] Confirmation nouveau mot de passe

- [ ] **Commandes**:
  - [ ] Voir historique des commandes
  - [ ] Détails d'une commande

- [ ] **Messages** (si fonctionnalité présente):
  - [ ] Voir messages
  - [ ] Envoyer message
  - [ ] Marquer comme lu

---

## 🔍 Tests Spécifiques aux Changements Jour 1

### DTOs Consolidés - Vérifications Critiques

#### RegisterDto (depuis `/auth/dto/register.dto.ts`)
- [ ] Inscription fonctionne avec:
  - firstName ✅
  - lastName ✅
  - email ✅
  - password ✅
- [ ] **PAS** de champ `confirmPassword` côté backend (validation frontend uniquement)

#### LoginDto (depuis `/modules/users/dto/login.dto.ts`)
- [ ] Connexion fonctionne avec:
  - email ✅
  - password ✅

#### UpdateUserDto (depuis `/modules/users/dto/create-user.dto.ts`)
- [ ] Modification profil fonctionne avec:
  - firstName ✅
  - lastName ✅
  - email ✅
  - phone ✅
- [ ] **PAS** de champ `name` (séparé en firstName/lastName)
- [ ] **PAS** de champ `isPro` (champ admin uniquement)

#### CreateUserDto (consolidé)
- [ ] Si admin crée un utilisateur:
  - firstName ✅
  - lastName ✅
  - email ✅
  - password ✅

---

## 🐛 Erreurs Potentielles à Surveiller

### Côté Frontend
```javascript
// Si erreur dans console navigateur:
❌ "Cannot read property 'name' of undefined"
   → Vérifier utilisation de firstName/lastName

❌ "Field 'confirmPassword' not accepted by server"
   → Normal, validation frontend uniquement

❌ "Field 'isPro' not allowed"
   → Normal, champ admin uniquement
```

### Côté Backend
```bash
# Vérifier logs backend terminal
✅ "✅ Password upgraded successfully" (migration MD5 → bcrypt)
❌ "Property 'name' does not exist on type UpdateUserDto"
❌ "Property 'isPro' does not exist on type UpdateUserDto"
```

---

## 📊 Résultats Attendus

### ✅ Tout Fonctionne
Si tous les tests passent:
1. ✅ **Aucune régression** détectée
2. ✅ **DTOs consolidés** fonctionnent correctement
3. ✅ **Prêt pour Jour 2** (délégation services)
4. ✅ **Merge possible** vers `main`

**Action**: Continuer avec Jour 2

### ⚠️ Problèmes Détectés
Si des tests échouent:
1. 📝 Noter les erreurs exactes
2. 🔍 Identifier la cause (DTO, validation, etc.)
3. 🔧 Corriger avant de continuer
4. 🔄 Re-tester

**Action**: Fixer les bugs avant Jour 2

---

## 🎯 Scénarios de Test Complets

### Scénario 1: Nouvel Utilisateur
```
1. Aller sur /auth/register
2. Remplir le formulaire:
   - Civilité: M.
   - Prénom: Jean
   - Nom: Test
   - Email: jean.test@example.com
   - Téléphone: 0612345678
   - Mot de passe: TestUser2024!
   - Confirmation: TestUser2024!
   - Adresse: 123 rue Test
   - Code postal: 75001
   - Ville: Paris
   - Newsletter: ☑
3. Soumettre
4. Vérifier redirection dashboard
5. Vérifier données affichées correctement
```

### Scénario 2: Utilisateur Existant
```
1. Aller sur /login
2. Se connecter:
   - Email: testadmin@example.com
   - Password: Test123456!
3. Vérifier redirection dashboard
4. Aller dans "Mon Profil"
5. Modifier prénom → "Jean-Updated"
6. Enregistrer
7. Vérifier modification sauvegardée
8. Se déconnecter
9. Se reconnecter
10. Vérifier prénom toujours "Jean-Updated"
```

### Scénario 3: Changement Mot de Passe
```
1. Se connecter
2. Aller dans "Sécurité" ou "Mot de passe"
3. Changer mot de passe:
   - Ancien: Test123456!
   - Nouveau: NewPassword2024!
   - Confirmation: NewPassword2024!
4. Enregistrer
5. Se déconnecter
6. Se reconnecter avec nouveau mot de passe
7. Vérifier connexion réussie
```

### Scénario 4: Gestion Adresses
```
1. Se connecter
2. Aller dans "Mes Adresses"
3. Voir adresse de facturation
4. Ajouter adresse de livraison:
   - Label: "Bureau"
   - Adresse: 456 avenue Travail
   - Code postal: 92100
   - Ville: Boulogne
5. Enregistrer
6. Vérifier adresse ajoutée
7. Définir comme adresse par défaut
8. Vérifier badge "Par défaut" affiché
```

---

## 🔐 Comptes de Test Disponibles

### Compte Test Bcrypt (Moderne)
```
Email: testadmin@example.com
Password: Test123456!
Type: Customer
Status: Actif
Hash: $2b$10$HJqb55n0aUXu7FLmBo8aN... (bcrypt)
```

### Compte Test MD5 (Legacy)
```
Email: legacyadmin@example.com
Password: Legacy123!
Type: Customer
Status: Actif
Hash: c4cf543f9b7f1774fd38e3a198eab168 (MD5)
Note: Sera upgradé automatiquement en bcrypt à la connexion
```

---

## 📝 Rapport de Test

### Template
```markdown
## Rapport de Test Frontend - Jour 1

**Date**: [Date]
**Testeur**: [Nom]
**Durée**: [Durée]

### Résultats Globaux
- [ ] ✅ Tous les tests passent
- [ ] ⚠️ Problèmes mineurs détectés
- [ ] ❌ Problèmes bloquants

### Détails
| Test | Statut | Notes |
|------|--------|-------|
| Login - Succès | ✅ | OK |
| Login - Erreur | ✅ | Message affiché |
| Register - Complet | ✅ | Compte créé |
| Register - Validation | ✅ | Erreurs claires |
| Dashboard - Profil | ✅ | Modifications OK |
| Dashboard - Adresses | ✅ | CRUD complet |
| Dashboard - Password | ✅ | Changement OK |

### Bugs Détectés
1. [Titre bug]
   - Reproduction: [Étapes]
   - Erreur: [Message]
   - Impact: Bloquant/Mineur
   - Solution proposée: [...]

### Recommandations
- [...]

### Conclusion
✅ Prêt pour Jour 2
OU
⚠️ Corrections nécessaires avant Jour 2
```

---

## 🎉 Validation Finale

### Critères de Validation
Pour passer au **Jour 2**, tous ces critères doivent être remplis:

1. ✅ **Login fonctionne** (testadmin@example.com)
2. ✅ **Register fonctionne** (nouvel utilisateur)
3. ✅ **Dashboard accessible** après connexion
4. ✅ **Modification profil** fonctionne (firstName/lastName)
5. ✅ **Aucune erreur console** navigateur
6. ✅ **Aucune erreur backend** dans les logs
7. ✅ **Indicateur force mot de passe** fonctionne
8. ✅ **Responsive design** OK (mobile + desktop)

### Si Tous les Tests Passent
```bash
# Prêt pour continuer
✅ Jour 1: DTOs consolidés et testés
🚀 Prochain: Jour 2 - Délégation AuthService + ProfileService

# Actions:
1. Noter "TESTS OK" dans JOUR2-EXECUTION-LOG.md
2. Commencer Phase 2 (délégation services)
```

---

**Document créé**: 4 octobre 2025  
**Auteur**: GitHub Copilot  
**Objectif**: Valider Jour 1 avant de continuer Jour 2  
**Statut**: Prêt pour exécution des tests

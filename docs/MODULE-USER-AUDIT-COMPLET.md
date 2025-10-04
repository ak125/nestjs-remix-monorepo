# 🔍 AUDIT COMPLET - Module User

**Date**: 4 octobre 2025  
**Objectif**: Analyser et consolider le module user pour une version propre, sans doublons, robuste  
**Statut**: 📊 **EN COURS D'AUDIT**

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture actuelle](#architecture-actuelle)
3. [Tables de données](#tables-de-données)
4. [Fonctionnalités identifiées](#fonctionnalités-identifiées)
5. [Analyse des doublons](#analyse-des-doublons)
6. [Services et responsabilités](#services-et-responsabilités)
7. [DTOs et validation](#dtos-et-validation)
8. [Plan de consolidation](#plan-de-consolidation)
9. [Architecture cible](#architecture-cible)

---

## 🎯 Vue d'ensemble

### Objectifs
- ✅ Identifier tous les services et méthodes existants
- ✅ Détecter les doublons et redondances
- ✅ Consolider les DTOs
- ✅ Vérifier la cohérence avec les tables DB
- ✅ Proposer une architecture optimale

### Périmètre fonctionnel
```
Module Users
├── Authentification (login/logout/register)
├── Gestion des profils utilisateur
├── Gestion des adresses (facturation + livraison)
├── Gestion des mots de passe (change/reset)
├── Sessions utilisateur (JWT + Redis)
├── Messagerie interne
├── Historique des commandes
└── RGPD / Suppression compte
```

---

## 🏗️ Architecture actuelle

### Structure des fichiers

```
backend/src/modules/users/
├── controllers/
│   ├── addresses.controller.ts      ✅ CRUD adresses
│   ├── password.controller.ts       ✅ Gestion mots de passe
│   └── user-shipment.controller.ts  ✅ Suivi expéditions
├── services/
│   ├── addresses.service.ts         ✅ Service adresses (SupabaseBaseService)
│   ├── password.service.ts          ✅ Service mots de passe
│   └── user-shipment.service.ts     ✅ Service expéditions
├── dto/
│   ├── addresses.dto.ts             ✅ DTOs adresses (Zod)
│   ├── change-password.dto.ts       ✅ Changement mot de passe
│   ├── create-user.dto.ts           ❓ Doublon possible avec users.dto
│   ├── login.dto.ts                 ✅ Login
│   ├── messages.dto.ts              ✅ Messagerie
│   ├── password-reset.dto.ts        ✅ Reset password
│   ├── passwords.dto.ts             ❓ Doublon avec password-reset?
│   ├── update-user.dto.ts           ✅ Mise à jour profil
│   ├── user-address.dto.ts          ⚠️ Doublon avec addresses.dto?
│   ├── user-profile.dto.ts          ✅ Profil complet
│   ├── user-response.dto.ts         ✅ Réponse API
│   ├── user-sessions.dto.ts         ✅ Sessions
│   ├── user.dto.ts                  ❓ Doublon avec user-response?
│   └── users.dto.ts                 ⚠️ Fichier fourre-tout?
├── users.controller.ts              ✅ Contrôleur principal
├── users.service.ts                 ✅ Service principal (1092 lignes)
└── users.module.ts                  ✅ Module NestJS
```

### Modules importés
- `ConfigModule` - Configuration
- `DatabaseModule` - Services de données (UserDataService, UserService)
- `CacheModule` - Redis cache
- `JwtModule` - Authentification JWT

---

## 🗃️ Tables de données

### Tables principales

#### 1. `___XTR_CUSTOMER` (Table utilisateur)
**Colonnes identifiées:**
```typescript
cst_id          // ID unique (PK)
cst_mail        // Email (unique)
cst_pwd         // Mot de passe hashé
cst_fname       // Prénom
cst_name        // Nom
cst_tel         // Téléphone
cst_is_pro      // Client professionnel (boolean)
cst_activ       // Compte actif (boolean)
cst_level       // Niveau utilisateur (1-10)
cst_date_add    // Date création
cst_date_upd    // Date mise à jour
total_orders    // Nombre de commandes
total_spent     // Montant total dépensé
last_login_at   // Dernière connexion
newsletter      // Abonnement newsletter (boolean)
sms_notifications // Notifications SMS (boolean)
```

#### 2. `___XTR_CUSTOMER_BILLING_ADDRESS` (Adresse facturation)
**Colonnes:**
```typescript
id              // ID unique (PK)
customer_id     // FK vers ___XTR_CUSTOMER
firstname       // Prénom
lastname        // Nom
company         // Société (optionnel)
address1        // Adresse ligne 1
address2        // Adresse ligne 2 (optionnel)
postal_code     // Code postal
city            // Ville
country         // Pays (défaut: FR)
phone           // Téléphone (optionnel)
created_at      // Date création
updated_at      // Date mise à jour
```

**Règle métier:** 1 utilisateur = 1 adresse de facturation (obligatoire)

#### 3. `___XTR_CUSTOMER_DELIVERY_ADDRESS` (Adresses livraison)
**Colonnes:**
```typescript
id              // ID unique (PK)
customer_id     // FK vers ___XTR_CUSTOMER
label           // Libellé adresse (ex: "Maison", "Bureau")
firstname       // Prénom
lastname        // Nom
company         // Société (optionnel)
address1        // Adresse ligne 1
address2        // Adresse ligne 2 (optionnel)
postal_code     // Code postal
city            // Ville
country         // Pays (défaut: FR)
phone           // Téléphone (optionnel)
is_default      // Adresse par défaut (boolean)
created_at      // Date création
updated_at      // Date mise à jour
```

**Règle métier:** 1 utilisateur = N adresses de livraison (minimum 1)

#### 4. `___XTR_MSG` (Messagerie interne)
**Colonnes:**
```typescript
id              // ID unique (PK)
customer_id     // FK vers ___XTR_CUSTOMER
subject         // Sujet
message         // Contenu
is_read         // Lu (boolean)
created_at      // Date création
parent_id       // ID message parent (threading)
```

#### 5. `___XTR_ORDER` (Commandes)
**Colonnes:**
```typescript
id              // ID unique (PK)
customer_id     // FK vers ___XTR_CUSTOMER
order_number    // Numéro commande unique
status          // Statut (pending, paid, shipped, delivered, cancelled)
total_amount    // Montant total
billing_address_id   // FK vers adresse facturation
delivery_address_id  // FK vers adresse livraison
created_at      // Date création
updated_at      // Date mise à jour
```

#### 6. `___XTR_ORDER_LINE` (Lignes de commande)
**Colonnes:**
```typescript
id              // ID unique (PK)
order_id        // FK vers ___XTR_ORDER
product_id      // FK vers produit
quantity        // Quantité
unit_price      // Prix unitaire
total_price     // Prix total ligne
```

---

## ✅ Fonctionnalités identifiées

### 1. Authentification ✅
**Services:**
- `UsersService.register()` - Inscription
- `UsersService.login()` - Connexion
- `UsersService.logout()` - Déconnexion (invalidation token/session)

**DTOs:**
- `RegisterDto` (dans users.dto.ts)
- `LoginDto` (login.dto.ts)
- `LoginResponseDto`

**Tables:**
- `___XTR_CUSTOMER` (cst_mail, cst_pwd)

**Status:** ✅ Fonctionnel, utilise PasswordCryptoService

---

### 2. Gestion des profils ✅
**Services:**
- `UsersService.getProfile()` - Récupération profil
- `UsersService.getUserProfile()` - Alias getProfile
- `UsersService.updateProfile()` - Mise à jour profil
- `UsersService.findById()` - Recherche par ID
- `UsersService.findByEmail()` - Recherche par email

**DTOs:**
- `UserProfileDto` ✅
- `UpdateProfileDto`
- `UserResponseDto` ✅

**Tables:**
- `___XTR_CUSTOMER`

**Status:** ✅ Fonctionnel

---

### 3. Gestion des adresses ✅
**Services:**
- `AddressesService.getBillingAddress()` - Récupérer adresse facturation
- `AddressesService.upsertBillingAddress()` - Créer/MAJ adresse facturation
- `AddressesService.getDeliveryAddresses()` - Liste adresses livraison
- `AddressesService.getDefaultDeliveryAddress()` - Adresse livraison par défaut
- `AddressesService.createDeliveryAddress()` - Créer adresse livraison
- `AddressesService.updateDeliveryAddress()` - MAJ adresse livraison
- `AddressesService.deleteDeliveryAddress()` - Supprimer adresse livraison
- `AddressesService.setDefaultDeliveryAddress()` - Définir adresse par défaut
- `AddressesService.getAllAddresses()` - Toutes les adresses (facturation + livraison)

**Controllers:**
- `AddressesController` (api/addresses)

**DTOs:**
- `CreateBillingAddressDto` ✅ (Zod)
- `CreateDeliveryAddressDto` ✅ (Zod)
- `UpdateDeliveryAddressDto` ✅ (Zod)
- `BillingAddress` (interface)
- `DeliveryAddress` (interface)
- `AddressListResponse` (interface)

**Tables:**
- `___XTR_CUSTOMER_BILLING_ADDRESS`
- `___XTR_CUSTOMER_DELIVERY_ADDRESS`

**Status:** ✅ Service moderne, architecture SupabaseBaseService, Zod validation

---

### 4. Gestion des mots de passe ✅
**Services:**
- `PasswordService.changePassword()` - Changement mot de passe
- `PasswordService.requestPasswordReset()` - Demande reset
- `PasswordService.confirmPasswordReset()` - Confirmer reset avec token
- `PasswordService.validateResetToken()` - Valider token

**Controllers:**
- `PasswordController` (api/users/password)

**DTOs:**
- `ChangePasswordDto` ✅
- `ResetPasswordDto` ✅
- `ConfirmResetPasswordDto` ✅

**Tables:**
- `___XTR_CUSTOMER` (cst_pwd)
- Tokens stockés en cache Redis

**Status:** ✅ Service moderne, intégration PasswordCryptoService

---

### 5. Sessions utilisateur ✅
**Gestion:**
- JWT tokens (7 jours)
- Cache Redis pour sessions
- Invalidation lors du logout

**Services:**
- `CacheService` (via injection)
- JWT via `JwtModule`

**DTOs:**
- `UserSessionDto`

**Status:** ✅ Fonctionnel

---

### 6. Messagerie interne 🚧
**Services:**
- ⚠️ Pas de service dédié visible
- Mentions dans `messages.dto.ts`

**DTOs:**
- `UserMessageDto` (dans users.dto.ts)
- Autres DTOs dans messages.dto.ts

**Tables:**
- `___XTR_MSG`

**Status:** 🚧 À implémenter ou à consolider

---

### 7. Historique des commandes 🚧
**Services:**
- `UserShipmentService` - Suivi expéditions
- ⚠️ Pas de service dédié pour historique complet

**Controllers:**
- `UserShipmentController` (api/users/shipments)

**Tables:**
- `___XTR_ORDER`
- `___XTR_ORDER_LINE`

**Status:** 🚧 Partiel - À compléter

---

### 8. RGPD / Suppression compte ✅
**Services:**
- `UsersService.deleteAccount()` - Suppression compte

**Status:** ✅ Mentionné dans module

---

## 🔍 Analyse des doublons

### 1. Méthodes dupliquées

#### `findByEmail` / `getUserByEmail`
```typescript
// UsersService.findByEmail (ligne 730)
async findByEmail(email: string): Promise<UserResponseDto | null>

// UsersController.getUserByEmail (ligne 1062)
async getUserByEmail(@Param('email') email: string)
  // Appelle this.usersService.findByEmail(email)
```
**Analyse:** ✅ Pas de doublon - Pattern Controller → Service correct

---

#### `register` vs `createUser`
```typescript
// UsersService.register (ligne 55)
async register(registerDto: RegisterDto): Promise<UserResponseDto>

// UsersService.createUser (ligne 231)
async createUser(createUserDto: CreateUserControllerDto): Promise<UserResponseDto>
```
**Analyse:** ⚠️ **DOUBLON POTENTIEL**
- `register()` - Inscription publique (depuis frontend)
- `createUser()` - Création admin (depuis backoffice)
- **Recommandation:** Fusionner la logique commune, différencier les validations

---

#### `getProfile` vs `getUserProfile`
```typescript
// UsersService.getProfile (ligne ?)
async getProfile(id: number): Promise<UserProfileDto>

// UsersService.getUserProfile (ligne 334)
async getUserProfile(id: string): Promise<UserProfileDto>
  // Appelle this.getProfile(Number(id))
```
**Analyse:** ✅ `getUserProfile` est un alias - **À simplifier**

---

### 2. DTOs dupliqués

#### Adresses
```
addresses.dto.ts          ✅ Moderne (Zod + interfaces)
user-address.dto.ts       ⚠️ Ancien système?
```
**Recommandation:** Supprimer `user-address.dto.ts`, utiliser `addresses.dto.ts`

---

#### Utilisateurs
```
create-user.dto.ts        ✅ Pour création admin
user.dto.ts               ⚠️ Générique
users.dto.ts              ⚠️ Fourre-tout (RegisterDto, LoginDto, etc.)
user-response.dto.ts      ✅ Réponse API
user-profile.dto.ts       ✅ Profil complet
```
**Recommandation:** 
- Conserver `user-profile.dto.ts` (profil complet)
- Conserver `user-response.dto.ts` (API)
- Consolider RegisterDto, LoginDto dans `auth.dto.ts`
- Fusionner `user.dto.ts` et `users.dto.ts`

---

#### Mots de passe
```
change-password.dto.ts    ✅ Changement mot de passe
password-reset.dto.ts     ✅ Reset password
passwords.dto.ts          ❓ Contenu inconnu
```
**À vérifier:** Contenu de `passwords.dto.ts`

---

### 3. Services redondants

#### Services identifiés
```
UsersService (1092 lignes)           ⚠️ Trop gros - À découper
AddressesService                     ✅ Moderne, bien découpé
PasswordService                      ✅ Moderne, bien découpé
UserShipmentService                  ✅ Spécialisé
```

**Analyse UsersService:**
- **Authentification** (register, login, logout) → ✅ Garder
- **Profils** (getProfile, updateProfile) → ✅ Garder
- **Recherche** (findById, findByEmail, searchUsers) → ✅ Garder
- **Admin** (createUser, updateUser, deleteUser) → ✅ Garder
- **Messages** (sendMessage, getMessages) → ⚠️ Extraire vers MessageService
- **Commandes** (getUserOrders) → ⚠️ Déléguer vers OrderService

---

## 🎯 Services et responsabilités

### Architecture actuelle

```
UsersService (Monolithique)
├── Authentification ✅
├── Profils ✅
├── Admin CRUD ✅
├── Recherche ✅
├── Messages ⚠️ (à extraire)
└── Commandes ⚠️ (à déléguer)

AddressesService (Bien découpé) ✅
├── Facturation
└── Livraison

PasswordService (Bien découpé) ✅
├── Change password
└── Reset password

UserShipmentService ✅
└── Suivi expéditions
```

---

## 📐 DTOs et validation

### DTOs par fonctionnalité

#### Authentification
```typescript
// auth.dto.ts (à créer)
RegisterDto              ✅ Zod
LoginDto                 ✅ Zod
LoginResponseDto         ✅
```

#### Profil utilisateur
```typescript
// user-profile.dto.ts (existant)
UserProfileDto           ✅ Zod
UpdateProfileDto         ✅ Zod
```

#### Adresses
```typescript
// addresses.dto.ts (existant)
CreateBillingAddressDto  ✅ Zod
CreateDeliveryAddressDto ✅ Zod
UpdateDeliveryAddressDto ✅ Zod
BillingAddress           ✅ Interface
DeliveryAddress          ✅ Interface
AddressListResponse      ✅ Interface
```

#### Mots de passe
```typescript
// passwords.dto.ts (à consolider)
ChangePasswordDto        ✅ Zod
ResetPasswordDto         ✅ Zod
ConfirmResetPasswordDto  ✅ Zod
```

#### Messagerie
```typescript
// messages.dto.ts (existant)
CreateMessageDto         ⚠️ À vérifier
MessageDto               ⚠️ À vérifier
MessageListDto           ⚠️ À vérifier
```

#### Commandes
```typescript
// orders.dto.ts (à créer ou importer du module orders)
OrderDto                 ⚠️ À définir
OrderListDto             ⚠️ À définir
```

---

## 🔧 Plan de consolidation

### Phase 1: Audit complet ✅ (EN COURS)
- [x] Lister tous les services
- [x] Lister tous les DTOs
- [x] Identifier les doublons
- [x] Mapper les tables DB
- [ ] Vérifier la cohérence des méthodes

### Phase 2: Nettoyage des DTOs
```bash
# À supprimer
❌ user.dto.ts (fusionner dans users.dto.ts)
❌ user-address.dto.ts (utiliser addresses.dto.ts)

# À consolider
⚠️ users.dto.ts → Séparer en auth.dto.ts et user.dto.ts
⚠️ passwords.dto.ts → Vérifier contenu et fusionner avec password-reset.dto.ts
```

### Phase 3: Refactoring UsersService
```typescript
// Découper en services spécialisés

UsersService (Core)
├── register()
├── login()
├── logout()
├── getProfile()
├── updateProfile()
├── findById()
├── findByEmail()
├── searchUsers()
└── deleteAccount()

UsersAdminService (nouveau)
├── createUser()
├── updateUser()
├── deleteUser()
└── listUsers()

MessagesService (nouveau - à extraire)
├── sendMessage()
├── getMessages()
├── markAsRead()
└── deleteMessage()
```

### Phase 4: Validation et tests
- [ ] Tests unitaires pour chaque service
- [ ] Tests d'intégration
- [ ] Validation Zod sur tous les DTOs
- [ ] Documentation Swagger complète

### Phase 5: Migration et déploiement
- [ ] Migration progressive
- [ ] Tests en staging
- [ ] Déploiement production

---

## 🏛️ Architecture cible

### Structure des dossiers (proposition)

```
backend/src/modules/users/
├── auth/                           # Nouveau: Authentification
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── dto/
│       ├── register.dto.ts
│       ├── login.dto.ts
│       └── login-response.dto.ts
├── profile/                        # Nouveau: Gestion profils
│   ├── profile.controller.ts
│   ├── profile.service.ts
│   └── dto/
│       ├── user-profile.dto.ts
│       └── update-profile.dto.ts
├── addresses/                      # Existant: Déjà bien structuré
│   ├── addresses.controller.ts    ✅
│   ├── addresses.service.ts       ✅
│   └── dto/
│       └── addresses.dto.ts       ✅
├── passwords/                      # Existant: Déjà bien structuré
│   ├── password.controller.ts     ✅
│   ├── password.service.ts        ✅
│   └── dto/
│       ├── change-password.dto.ts
│       ├── reset-password.dto.ts
│       └── confirm-reset.dto.ts
├── messages/                       # Nouveau: Messagerie
│   ├── messages.controller.ts
│   ├── messages.service.ts
│   └── dto/
│       └── messages.dto.ts
├── admin/                          # Nouveau: Admin CRUD
│   ├── users-admin.controller.ts
│   ├── users-admin.service.ts
│   └── dto/
│       ├── create-user.dto.ts
│       └── update-user.dto.ts
├── shipments/                      # Existant: Déjà structuré
│   ├── user-shipment.controller.ts ✅
│   ├── user-shipment.service.ts   ✅
│   └── dto/
│       └── shipment.dto.ts
├── shared/                         # Nouveau: DTOs partagés
│   └── dto/
│       ├── user.dto.ts
│       ├── user-response.dto.ts
│       └── pagination.dto.ts
└── users.module.ts                 ✅ Module principal
```

### Services consolidés

#### 1. AuthService (nouveau)
```typescript
@Injectable()
export class AuthService extends SupabaseBaseService {
  async register(dto: RegisterDto): Promise<UserResponseDto>
  async login(dto: LoginDto): Promise<LoginResponseDto>
  async logout(userId: number): Promise<void>
  async validateUser(email: string, password: string): Promise<UserResponseDto | null>
}
```

#### 2. ProfileService (nouveau)
```typescript
@Injectable()
export class ProfileService extends SupabaseBaseService {
  async getProfile(userId: number): Promise<UserProfileDto>
  async updateProfile(userId: number, dto: UpdateProfileDto): Promise<UserProfileDto>
  async findById(userId: number): Promise<UserResponseDto>
  async findByEmail(email: string): Promise<UserResponseDto>
  async deleteAccount(userId: number): Promise<void>
}
```

#### 3. AddressesService ✅ (existant - déjà optimal)
```typescript
@Injectable()
export class AddressesService extends SupabaseBaseService {
  // Facturation
  async getBillingAddress(customerId: number): Promise<BillingAddress | null>
  async upsertBillingAddress(customerId: number, dto: CreateBillingAddressDto): Promise<BillingAddress>
  
  // Livraison
  async getDeliveryAddresses(customerId: number): Promise<DeliveryAddress[]>
  async getDefaultDeliveryAddress(customerId: number): Promise<DeliveryAddress | null>
  async createDeliveryAddress(customerId: number, dto: CreateDeliveryAddressDto): Promise<DeliveryAddress>
  async updateDeliveryAddress(customerId: number, addressId: number, dto: UpdateDeliveryAddressDto): Promise<DeliveryAddress>
  async deleteDeliveryAddress(customerId: number, addressId: number): Promise<void>
  async setDefaultDeliveryAddress(customerId: number, addressId: number): Promise<DeliveryAddress>
  
  // Global
  async getAllAddresses(customerId: number): Promise<AddressListResponse>
}
```

#### 4. PasswordService ✅ (existant - déjà optimal)
```typescript
@Injectable()
export class PasswordService {
  async changePassword(userId: number, dto: ChangePasswordDto): Promise<void>
  async requestPasswordReset(email: string): Promise<void>
  async confirmPasswordReset(dto: ConfirmResetPasswordDto): Promise<void>
  async validateResetToken(token: string): Promise<boolean>
}
```

#### 5. MessagesService (nouveau)
```typescript
@Injectable()
export class MessagesService extends SupabaseBaseService {
  async sendMessage(userId: number, dto: CreateMessageDto): Promise<MessageDto>
  async getMessages(userId: number): Promise<MessageDto[]>
  async getMessageById(userId: number, messageId: number): Promise<MessageDto>
  async markAsRead(userId: number, messageId: number): Promise<void>
  async deleteMessage(userId: number, messageId: number): Promise<void>
}
```

#### 6. UsersAdminService (nouveau)
```typescript
@Injectable()
export class UsersAdminService extends SupabaseBaseService {
  async createUser(dto: CreateUserDto): Promise<UserResponseDto>
  async updateUser(userId: number, dto: UpdateUserDto): Promise<UserResponseDto>
  async deleteUser(userId: number): Promise<void>
  async listUsers(filters?: SearchUsersDto): Promise<PaginatedUsersResponseDto>
  async searchUsers(query: string): Promise<UserResponseDto[]>
}
```

#### 7. UserShipmentService ✅ (existant)
```typescript
@Injectable()
export class UserShipmentService extends SupabaseBaseService {
  async getUserShipments(userId: number): Promise<ShipmentDto[]>
  async getShipmentDetails(userId: number, shipmentId: number): Promise<ShipmentDto>
}
```

---

## 📊 Tableau récapitulatif

### Services

| Service | Lignes | Status | Action |
|---------|--------|--------|--------|
| **UsersService** | 1092 | ⚠️ Trop gros | Découper |
| **AddressesService** | ~450 | ✅ Optimal | Conserver |
| **PasswordService** | ~200 | ✅ Optimal | Conserver |
| **UserShipmentService** | ~150 | ✅ Optimal | Conserver |
| **AuthService** | - | ❌ Manquant | Créer |
| **ProfileService** | - | ❌ Manquant | Créer |
| **MessagesService** | - | ❌ Manquant | Créer |
| **UsersAdminService** | - | ❌ Manquant | Créer |

### DTOs

| DTO | Status | Action |
|-----|--------|--------|
| **addresses.dto.ts** | ✅ Moderne (Zod) | Conserver |
| **user-profile.dto.ts** | ✅ Moderne (Zod) | Conserver |
| **user-response.dto.ts** | ✅ Clair | Conserver |
| **change-password.dto.ts** | ✅ Clair | Conserver |
| **password-reset.dto.ts** | ✅ Clair | Conserver |
| **users.dto.ts** | ⚠️ Fourre-tout | Découper |
| **user.dto.ts** | ⚠️ Doublon | Fusionner |
| **user-address.dto.ts** | ⚠️ Obsolète | Supprimer |
| **passwords.dto.ts** | ❓ Inconnu | Vérifier |

### Controllers

| Controller | Status | Action |
|------------|--------|--------|
| **UsersController** | ✅ Fonctionnel | Conserver + optimiser |
| **AddressesController** | ✅ Moderne | Conserver |
| **PasswordController** | ✅ Moderne | Conserver |
| **UserShipmentController** | ✅ Spécialisé | Conserver |
| **AuthController** | ❌ Manquant | Créer (optionnel) |
| **MessagesController** | ❌ Manquant | Créer |

---

## ✅ Checklist de consolidation

### Étape 1: Analyse ✅
- [x] Lister tous les fichiers
- [x] Identifier les doublons
- [x] Mapper les tables DB
- [x] Définir les responsabilités
- [ ] Valider avec l'équipe

### Étape 2: DTOs
- [ ] Créer `auth.dto.ts` (RegisterDto, LoginDto)
- [ ] Créer `user.dto.ts` consolidé
- [ ] Supprimer `user-address.dto.ts`
- [ ] Vérifier `passwords.dto.ts`
- [ ] Ajouter validation Zod partout

### Étape 3: Services
- [ ] Créer `AuthService`
- [ ] Créer `ProfileService`
- [ ] Créer `MessagesService`
- [ ] Créer `UsersAdminService`
- [ ] Migrer méthodes de UsersService
- [ ] Supprimer code dupliqué

### Étape 4: Tests
- [ ] Tests unitaires AuthService
- [ ] Tests unitaires ProfileService
- [ ] Tests unitaires MessagesService
- [ ] Tests unitaires UsersAdminService
- [ ] Tests d'intégration

### Étape 5: Documentation
- [ ] Swagger complet
- [ ] README module users
- [ ] Guide migration
- [ ] Exemples d'utilisation

### Étape 6: Déploiement
- [ ] Tests en dev
- [ ] Tests en staging
- [ ] Migration données (si nécessaire)
- [ ] Déploiement production

---

## 📝 Notes importantes

### Règles métier à respecter

1. **Adresse de facturation**
   - ✅ Obligatoire pour chaque utilisateur
   - ✅ Une seule adresse de facturation par utilisateur
   - ✅ Upsert (create ou update)

2. **Adresses de livraison**
   - ✅ Minimum 1 adresse de livraison
   - ✅ Multiple adresses autorisées
   - ✅ Une seule adresse "par défaut"
   - ✅ Impossible de supprimer la dernière adresse

3. **Mots de passe**
   - ✅ Utiliser PasswordCryptoService
   - ✅ Support multi-format (bcrypt, MD5, SHA1, DES, plain)
   - ✅ Upgrade automatique vers bcrypt
   - ✅ Tokens de reset stockés en Redis (expiration 1h)

4. **Sessions**
   - ✅ JWT tokens (7 jours)
   - ✅ Stockage en Redis
   - ✅ Invalidation au logout

### Dépendances externes

```typescript
// Services injectés
UserDataService    // DatabaseModule - CRUD utilisateurs
UserService        // DatabaseModule - Logique métier
CacheService       // CacheModule - Redis
PasswordCryptoService // CryptoModule - Gestion mots de passe
MailService        // Services - Envoi emails
```

### Tables liées (modules externes)

- `___XTR_ORDER` → Module **orders**
- `___XTR_ORDER_LINE` → Module **orders**
- `___XTR_CART` → Module **cart**
- Produits → Module **catalog**

---

## 🎯 Prochaines étapes

### Priorité 1 (Critique)
1. ✅ Finaliser cet audit
2. Valider l'architecture cible avec l'équipe
3. Créer les DTOs consolidés
4. Créer AuthService
5. Créer ProfileService

### Priorité 2 (Important)
6. Créer MessagesService
7. Créer UsersAdminService
8. Migrer les méthodes de UsersService
9. Tests unitaires complets

### Priorité 3 (Amélioration)
10. Documentation Swagger complète
11. Guide de migration
12. Tests de charge
13. Monitoring et logs

---

## 📚 Ressources

### Documentation
- [NestJS Modules](https://docs.nestjs.com/modules)
- [Zod Validation](https://zod.dev/)
- [Supabase Client](https://supabase.com/docs/reference/javascript)
- [JWT Tokens](https://jwt.io/)

### Patterns utilisés
- Repository Pattern (via SupabaseBaseService)
- Service Layer Pattern
- DTO Pattern (Data Transfer Objects)
- Dependency Injection

---

## ✨ Conclusion

Le module users actuel est **fonctionnel mais nécessite une consolidation** pour:
- ✅ Éliminer les doublons
- ✅ Améliorer la séparation des responsabilités
- ✅ Faciliter la maintenance
- ✅ Préparer l'évolutivité

**Architecture actuelle**: Monolithique (UsersService 1092 lignes)  
**Architecture cible**: Modulaire (8 services spécialisés)

**Temps estimé**: 3-5 jours de développement + tests

---

**Auteur**: GitHub Copilot  
**Date**: 4 octobre 2025  
**Version**: 1.0.0

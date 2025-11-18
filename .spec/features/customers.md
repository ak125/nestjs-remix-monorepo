---
title: "Customers Module - User Management & Profiles"
status: implemented
version: 1.0.0
authors: [Backend Team]
created: 2025-11-18
updated: 2025-11-18
relates-to:
  - ./auth-system.md
  - ./orders.md
  - ./cart.md
  - ../architecture/001-supabase-direct.md
tags: [customers, users, profiles, addresses, authentication, critical]
priority: critical
coverage:
  modules: [users]
  routes: [/api/users/*, /api/users/profile, /api/users/addresses/*, /api/users/password/*]
  services: [UsersFinalService, UserDataConsolidatedService, ProfileService, AddressesService, PasswordService, UsersAdminService]
---

# Customers Module - User Management & Profiles

## 📝 Overview

Module backend **consolidé** gérant les utilisateurs (customers) avec profils B2B/B2C, adresses multiples (facturation/livraison), gestion des mots de passe sécurisée, messagerie interne, et RGPD. Architecture moderne avec **Redis cache** (5 min TTL) et intégration **JWT authentication**.

**Consolidation réalisée** :
- Controllers : 1 controller principal + 3 controllers spécialisés
- Services : 6 services spécialisés (métier + data layer)
- Cache : Redis pour profils (5 min TTL)
- Auth : JWT tokens + session management

**Types d'utilisateurs** :
- **B2C** : Particuliers (default)
- **B2B** : Professionnels (niveau 1-10)
- **Admin** : Staff (niveau 9-10)

**Fonctionnalités clés** :
- CRUD complet : Utilisateurs, profils, adresses
- Multi-adresses : Facturation, livraison, secondaires
- Mots de passe : Réinitialisation sécurisée (email tokens)
- RGPD : Suppression compte, export données
- Dashboard : Commandes récentes, stats, notifications
- Admin : Recherche avancée, filtres, gestion niveau

## 🎯 Goals

### Objectifs Principaux

1. **Profils complets** : B2B/B2C, informations personnelles, préférences
2. **Multi-adresses** : CRUD adresses facturation/livraison
3. **Sécurité mots de passe** : Reset tokens, bcrypt hashing
4. **Dashboard utilisateur** : Commandes, stats, notifications
5. **Admin avancé** : Recherche, filtres, gestion niveaux
6. **RGPD compliance** : Suppression, export, consentement

### Objectifs Secondaires

- Wishlist integration (v2)
- Programme fidélité (points)
- Newsletter preferences
- Multi-langues (i18n)

## 🚫 Non-Goals

- **Authentification OAuth** : Délégué à AuthModule
- **Two-factor auth** : 2FA (v2)
- **Social login** : Google, Facebook (v2)
- **KYC verification** : B2B vérification (v2)

## 🏗️ Architecture

### Services (6)

```typescript
UsersModule
├── UsersFinalService               // Service métier principal + cache Redis
├── UserDataConsolidatedService     // Data layer Supabase CRUD
├── ProfileService                  // Gestion profils (preferences, settings)
├── AddressesService                // CRUD adresses multi-contextes
├── PasswordService                 // Reset password, tokens, bcrypt
└── UsersAdminService               // Operations admin (search, levels, stats)
```

### Controllers (4)

```typescript
├── UsersFinalController            // /api/users/* - API principale
├── AddressesController             // /api/users/addresses/* - CRUD adresses
├── PasswordController              // /api/users/password/* - Reset password
└── UserShipmentController          // /api/users/shipments/* - Suivi livraisons
```

### Workflow Inscription

```
📧 Email + Password
  ↓ Validation Zod (format email, password strength)
🔐 Password hashing (bcrypt salt rounds=10)
  ↓ Création user PostgreSQL
👤 User créé (status: ACTIVE, niveau: 1)
  ↓ Génération JWT token
✅ Token retourné
  ↓ Client authentifié
🎯 Profil complet (nom, prénom, adresse)
```

### Workflow Reset Password

```
📧 Email oubli mot de passe
  ↓ Génération token unique (UUID)
📨 Email envoi lien (token valid 1h)
  ↓ Client clique lien
🔑 Token validation (expiration, unicité)
  ↓ Nouveau password saisi
🔐 Password hashing (bcrypt)
  ↓ Mise à jour user + invalidation token
✅ Password réinitialisé
```

## 📊 Data Model

### Table `users` (PostgreSQL - Supabase)

```sql
CREATE TABLE users (
  user_id                 SERIAL PRIMARY KEY,
  id_utilisateur          INTEGER UNIQUE,                  -- Alias (legacy)
  
  -- Authentification
  email                   VARCHAR(255) UNIQUE NOT NULL,
  password_hash           VARCHAR(255) NOT NULL,           -- bcrypt hash
  
  -- Informations personnelles
  nom                     VARCHAR(100),
  prenom                  VARCHAR(100),
  telephone               VARCHAR(20),
  mobile                  VARCHAR(20),
  
  -- Adresses (principale)
  adresse                 TEXT,
  adresse_complement      TEXT,
  code_postal             VARCHAR(10),
  ville                   VARCHAR(100),
  pays                    VARCHAR(100) DEFAULT 'France',
  
  -- Type utilisateur
  user_type               VARCHAR(50) DEFAULT 'B2C',       -- B2C/B2B
  user_level              INTEGER DEFAULT 1,               -- 1-10 (1=client, 9-10=admin)
  
  -- Statut
  user_status             VARCHAR(50) DEFAULT 'ACTIVE',    -- ACTIVE/INACTIVE/SUSPENDED/DELETED
  is_verified             BOOLEAN DEFAULT false,           -- Email vérifié
  
  -- B2B spécifique
  company_name            VARCHAR(255),
  company_siret           VARCHAR(14),
  company_tva             VARCHAR(20),
  company_type            VARCHAR(50),                     -- SARL/SAS/EI/AUTO
  
  -- Préférences
  newsletter_subscribed   BOOLEAN DEFAULT false,
  sms_notifications       BOOLEAN DEFAULT false,
  language                VARCHAR(5) DEFAULT 'fr',
  
  -- RGPD
  gdpr_consent            BOOLEAN DEFAULT false,
  gdpr_consent_date       TIMESTAMP,
  data_export_requested   BOOLEAN DEFAULT false,
  deletion_requested      BOOLEAN DEFAULT false,
  deletion_requested_at   TIMESTAMP,
  
  -- Timestamps
  user_created_at         TIMESTAMP DEFAULT NOW(),
  user_updated_at         TIMESTAMP DEFAULT NOW(),
  last_login_at           TIMESTAMP,
  email_verified_at       TIMESTAMP,
  
  -- Indexes performances
  INDEX idx_users_email (email),
  INDEX idx_users_status (user_status),
  INDEX idx_users_type (user_type),
  INDEX idx_users_level (user_level),
  INDEX idx_users_created (user_created_at)
);
```

### Table `user_addresses` (Adresses multiples)

```sql
CREATE TABLE user_addresses (
  address_id              SERIAL PRIMARY KEY,
  user_id                 INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- Type adresse
  address_type            VARCHAR(50) NOT NULL,            -- BILLING/SHIPPING/SECONDARY
  is_default              BOOLEAN DEFAULT false,
  
  -- Destinataire
  recipient_name          VARCHAR(255),                    -- Nom destinataire (si différent)
  recipient_phone         VARCHAR(20),
  
  -- Adresse
  address_line1           VARCHAR(255) NOT NULL,
  address_line2           VARCHAR(255),
  postal_code             VARCHAR(10) NOT NULL,
  city                    VARCHAR(100) NOT NULL,
  country                 VARCHAR(100) DEFAULT 'France',
  
  -- Métadonnées
  address_label           VARCHAR(100),                    -- "Domicile", "Bureau", etc.
  delivery_instructions   TEXT,                            -- Instructions livraison
  
  -- Timestamps
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_user_default_type UNIQUE (user_id, address_type, is_default),
  
  -- Indexes
  INDEX idx_addresses_user (user_id),
  INDEX idx_addresses_type (address_type),
  INDEX idx_addresses_default (is_default)
);
```

### Table `password_reset_tokens` (Reset password)

```sql
CREATE TABLE password_reset_tokens (
  token_id                SERIAL PRIMARY KEY,
  user_id                 INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
  
  token                   VARCHAR(255) UNIQUE NOT NULL,    -- UUID token
  token_hash              VARCHAR(255),                    -- Hash token (sécurité)
  
  expires_at              TIMESTAMP NOT NULL,              -- Expiration 1h
  used_at                 TIMESTAMP,                       -- Date utilisation
  is_used                 BOOLEAN DEFAULT false,
  
  -- Métadonnées
  ip_address              VARCHAR(50),
  user_agent              TEXT,
  
  created_at              TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_tokens_user (user_id),
  INDEX idx_tokens_token (token),
  INDEX idx_tokens_expires (expires_at)
);
```

### Table `user_sessions` (Sessions actives)

```sql
CREATE TABLE user_sessions (
  session_id              SERIAL PRIMARY KEY,
  user_id                 INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
  
  jwt_token_hash          VARCHAR(255),                    -- Hash JWT (révocation)
  refresh_token_hash      VARCHAR(255),
  
  ip_address              VARCHAR(50),
  user_agent              TEXT,
  device_type             VARCHAR(50),                     -- desktop/mobile/tablet
  
  is_active               BOOLEAN DEFAULT true,
  
  created_at              TIMESTAMP DEFAULT NOW(),
  expires_at              TIMESTAMP,
  last_activity_at        TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_active (is_active)
);
```

### Table `user_stats` (Statistiques)

```sql
CREATE TABLE user_stats (
  stat_id                 SERIAL PRIMARY KEY,
  user_id                 INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- Commandes
  total_orders            INTEGER DEFAULT 0,
  total_spent             DECIMAL(10,2) DEFAULT 0,
  average_order_value     DECIMAL(10,2) DEFAULT 0,
  
  -- Panier
  abandoned_carts         INTEGER DEFAULT 0,
  
  -- Engagement
  login_count             INTEGER DEFAULT 0,
  last_order_date         DATE,
  
  -- Timestamps
  updated_at              TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (user_id)
);
```

## 🔌 API Endpoints

### UsersFinalController (`/api/users`)

#### 1. GET `/api/users/test` - Test santé module

**Access:** Public

**Response:**
```json
{
  "success": true,
  "message": "API Users opérationnelle",
  "version": "1.0.0",
  "timestamp": "2025-01-14T10:00:00Z"
}
```

---

#### 2. GET `/api/users/profile` - Profil utilisateur connecté

**Access:** Authenticated user

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "12345",
    "email": "jean.dupont@example.com",
    "nom": "Dupont",
    "prenom": "Jean",
    "telephone": "0123456789",
    "mobile": "0612345678",
    "adresse": "10 Rue de Rivoli",
    "code_postal": "75001",
    "ville": "Paris",
    "pays": "France",
    "user_type": "B2C",
    "user_level": 1,
    "user_status": "ACTIVE",
    "is_verified": true,
    "newsletter_subscribed": true,
    "company_name": null,
    "user_created_at": "2024-01-01T10:00:00Z",
    "last_login_at": "2025-01-14T09:00:00Z"
  }
}
```

**Logique:**
1. Extraire `user_id` depuis JWT token
2. Vérifier cache Redis (`user:{userId}`)
3. Si cache miss → Requête Supabase
4. Enrichir avec stats utilisateur (commandes, panier)
5. Cacher résultat Redis (5 min TTL)
6. Retourner profil complet

**Performance:** < 150ms (p95)  
**Cache:** Redis 5 min TTL

---

#### 3. PUT `/api/users/profile` - Mettre à jour profil

**Access:** Authenticated user

**Body:**
```json
{
  "nom": "Martin",
  "prenom": "Sophie",
  "telephone": "0123456789",
  "mobile": "0612345678",
  "adresse": "15 Avenue des Champs-Élysées",
  "code_postal": "75008",
  "ville": "Paris",
  "newsletter_subscribed": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profil mis à jour avec succès",
  "data": {
    "id": "12345",
    "nom": "Martin",
    "prenom": "Sophie",
    "email": "sophie.martin@example.com"
  }
}
```

**Logique:**
1. Validation Zod (UpdateUserSchema)
2. Vérifier user authentifié
3. Mettre à jour PostgreSQL (`users`)
4. Invalider cache Redis (`user:{userId}`)
5. Retourner profil mis à jour

**Erreurs:**
- 400 : Validation failed (format invalide)
- 401 : Non authentifié
- 422 : Email déjà utilisé (si modifié)

**Performance:** < 200ms (p95)

---

#### 4. GET `/api/users/dashboard` - Dashboard utilisateur

**Access:** Authenticated user

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "12345",
      "email": "jean@example.com",
      "nom": "Dupont",
      "prenom": "Jean"
    },
    "stats": {
      "totalOrders": 12,
      "totalSpent": 1250.50,
      "averageOrderValue": 104.21,
      "abandonedCarts": 3,
      "loginCount": 45,
      "lastOrderDate": "2025-01-10"
    },
    "recentOrders": [
      {
        "orderId": 456,
        "orderRef": "ORD-2025-001",
        "orderDate": "2025-01-10T14:30:00Z",
        "orderTotal": 245.50,
        "orderStatus": "DELIVERED"
      }
    ],
    "notifications": 2
  }
}
```

**Logique:**
1. Récupérer profil utilisateur
2. Requête stats agrégées (`user_stats`)
3. Requête 5 dernières commandes (`commandes`)
4. Compter notifications non lues
5. Retourner dashboard complet

**Performance:** < 300ms (p95)

---

### Admin Endpoints

#### 5. GET `/api/users` - Liste utilisateurs (Admin)

**Access:** Admin level 9+

**Query Params:**
```typescript
{
  search?: string;          // Recherche email/nom/prénom
  status?: string;          // ACTIVE/INACTIVE/SUSPENDED/DELETED
  userType?: string;        // B2C/B2B
  level?: number;           // 1-10
  city?: string;
  country?: string;
  sortBy?: string;          // email/created_at/last_login_at
  sortOrder?: string;       // asc/desc
  page?: number;
  limit?: number;
}
```

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "id": "12345",
      "email": "jean@example.com",
      "nom": "Dupont",
      "prenom": "Jean",
      "user_type": "B2C",
      "user_level": 1,
      "user_status": "ACTIVE",
      "user_created_at": "2024-01-01T10:00:00Z",
      "last_login_at": "2025-01-14T09:00:00Z"
    }
  ],
  "pagination": {
    "total": 1234,
    "page": 1,
    "limit": 20,
    "totalPages": 62
  }
}
```

**Logique:**
1. Validation filtres (UserFiltersSchema)
2. Vérifier permissions admin (level 9+)
3. Requête PostgreSQL avec filtres
4. Pagination (default 20/page)
5. Tri personnalisable
6. Cacher résultat Redis (2 min TTL)
7. Retourner liste paginée

**Performance:** < 400ms (p95)

---

#### 6. GET `/api/users/:id` - Détail utilisateur (Admin)

**Access:** Admin level 9+

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "12345",
    "email": "jean@example.com",
    "nom": "Dupont",
    "prenom": "Jean",
    "user_type": "B2C",
    "user_level": 1,
    "user_status": "ACTIVE",
    "addresses": [
      {
        "address_id": 1,
        "address_type": "BILLING",
        "is_default": true,
        "address_line1": "10 Rue de Rivoli",
        "postal_code": "75001",
        "city": "Paris"
      }
    ],
    "stats": {
      "totalOrders": 12,
      "totalSpent": 1250.50
    }
  }
}
```

**Performance:** < 250ms (p95)

---

#### 7. POST `/api/users` - Créer utilisateur (Admin)

**Access:** Admin level 9+

**Body:**
```json
{
  "email": "nouveau@example.com",
  "password": "SecurePass123!",
  "nom": "Martin",
  "prenom": "Sophie",
  "user_type": "B2C",
  "user_level": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Utilisateur créé avec succès",
  "data": {
    "id": "12346",
    "email": "nouveau@example.com",
    "nom": "Martin",
    "prenom": "Sophie"
  }
}
```

**Logique:**
1. Validation CreateUserSchema (Zod)
2. Vérifier email unique
3. Hash password (bcrypt, salt rounds=10)
4. Créer user PostgreSQL
5. Envoyer email bienvenue (optionnel)
6. Retourner user créé

**Erreurs:**
- 400 : Validation failed
- 409 : Email déjà utilisé

---

#### 8. PUT `/api/users/:id` - Mettre à jour utilisateur (Admin)

**Access:** Admin level 9+

**Body:**
```json
{
  "user_status": "SUSPENDED",
  "user_level": 5,
  "user_type": "B2B",
  "company_name": "ACME Corp"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Utilisateur mis à jour",
  "data": {
    "id": "12345",
    "user_status": "SUSPENDED",
    "user_level": 5
  }
}
```

---

#### 9. DELETE `/api/users/:id` - Supprimer utilisateur (Admin)

**Access:** Admin level 10 (super admin)

**Response:**
```json
{
  "success": true,
  "message": "Utilisateur supprimé définitivement"
}
```

**Logique:**
1. Vérifier permissions (level 10)
2. Soft delete : `user_status = DELETED`
3. Anonymiser données RGPD (email, nom, adresse)
4. Conserver commandes historique (anonymisées)
5. Invalider caches
6. Retourner confirmation

---

#### 10. GET `/api/users/stats/global` - Statistiques globales (Admin)

**Access:** Admin level 8+

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalUsers": 1234,
    "activeUsers": 1100,
    "proUsers": 45,
    "companyUsers": 12,
    "newUsersToday": 5,
    "newUsersThisWeek": 23,
    "newUsersThisMonth": 89,
    "averageLevel": 1.8
  }
}
```

**Performance:** < 500ms (p95)  
**Cache:** Redis 5 min TTL

---

### AddressesController (`/api/users/addresses`)

#### 11. GET `/api/users/addresses` - Liste adresses utilisateur

**Access:** Authenticated user

**Response:**
```json
{
  "success": true,
  "addresses": [
    {
      "address_id": 1,
      "address_type": "BILLING",
      "is_default": true,
      "recipient_name": "Jean Dupont",
      "address_line1": "10 Rue de Rivoli",
      "postal_code": "75001",
      "city": "Paris",
      "country": "France",
      "address_label": "Domicile"
    },
    {
      "address_id": 2,
      "address_type": "SHIPPING",
      "is_default": false,
      "address_line1": "25 Avenue Victor Hugo",
      "postal_code": "75116",
      "city": "Paris",
      "address_label": "Bureau"
    }
  ]
}
```

**Performance:** < 150ms (p95)

---

#### 12. POST `/api/users/addresses` - Ajouter adresse

**Access:** Authenticated user

**Body:**
```json
{
  "address_type": "SHIPPING",
  "is_default": false,
  "recipient_name": "Sophie Martin",
  "recipient_phone": "0612345678",
  "address_line1": "15 Boulevard Haussmann",
  "postal_code": "75009",
  "city": "Paris",
  "country": "France",
  "address_label": "Bureau"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Adresse ajoutée avec succès",
  "data": {
    "address_id": 3,
    "address_type": "SHIPPING",
    "address_line1": "15 Boulevard Haussmann"
  }
}
```

**Logique:**
1. Validation Zod
2. Vérifier limite adresses (max 10/user)
3. Si `is_default=true` → Retirer default existant
4. Créer adresse PostgreSQL
5. Retourner adresse créée

---

#### 13. PUT `/api/users/addresses/:id` - Mettre à jour adresse

**Access:** Authenticated user (owner uniquement)

**Body:**
```json
{
  "address_line1": "20 Boulevard Haussmann",
  "is_default": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Adresse mise à jour",
  "data": {
    "address_id": 3,
    "address_line1": "20 Boulevard Haussmann"
  }
}
```

---

#### 14. DELETE `/api/users/addresses/:id` - Supprimer adresse

**Access:** Authenticated user (owner uniquement)

**Response:**
```json
{
  "success": true,
  "message": "Adresse supprimée"
}
```

**Logique:**
1. Vérifier ownership (user_id)
2. Interdire suppression si default + dernière adresse type
3. Supprimer PostgreSQL
4. Retourner confirmation

---

### PasswordController (`/api/users/password`)

#### 15. POST `/api/users/password/reset` - Demande reset password

**Access:** Public

**Body:**
```json
{
  "email": "jean@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email de réinitialisation envoyé"
}
```

**Logique:**
1. Valider email format
2. Vérifier user existe
3. Générer token UUID unique
4. Hash token (sécurité)
5. Sauvegarder `password_reset_tokens` (expires_at = NOW() + 1h)
6. Envoyer email avec lien (`/reset-password?token=xxx`)
7. Retourner succès (même si email inexistant = sécurité)

**Performance:** < 500ms (p95) - Email async

---

#### 16. POST `/api/users/password/reset/confirm` - Confirmer reset password

**Access:** Public

**Body:**
```json
{
  "token": "abc123-def456-ghi789",
  "newPassword": "NewSecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Mot de passe réinitialisé avec succès"
}
```

**Logique:**
1. Valider token format + newPassword strength
2. Requête token PostgreSQL
3. Vérifier `expires_at > NOW()` (1h max)
4. Vérifier `is_used = false`
5. Hash nouveau password (bcrypt)
6. Mettre à jour `users.password_hash`
7. Marquer token utilisé (`is_used = true`, `used_at = NOW()`)
8. Invalider sessions actives (sécurité)
9. Retourner succès

**Erreurs:**
- 400 : Token invalide ou expiré
- 422 : Password trop faible

---

#### 17. PUT `/api/users/password/change` - Changer password (authentifié)

**Access:** Authenticated user

**Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewSecurePass456!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Mot de passe modifié avec succès"
}
```

**Logique:**
1. Vérifier currentPassword (bcrypt compare)
2. Valider newPassword strength
3. Hash newPassword
4. Mettre à jour `users.password_hash`
5. Invalider autres sessions (optionnel)
6. Retourner succès

**Erreurs:**
- 401 : Current password incorrect
- 422 : New password trop faible

---

## 🔒 Security

### Password Hashing

**Algorithme:** bcrypt  
**Salt rounds:** 10  
**Min strength:** 8 chars, 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial

```typescript
import * as bcrypt from 'bcrypt';

// Hash
const hash = await bcrypt.hash(password, 10);

// Verify
const isValid = await bcrypt.compare(password, hash);
```

### JWT Tokens

**Secret:** `process.env.JWT_SECRET`  
**Expiration:** 1 hour  
**Refresh token:** 7 days

**Payload:**
```json
{
  "id": "12345",
  "email": "jean@example.com",
  "role": "user",
  "level": 1,
  "iat": 1699901234,
  "exp": 1699904834
}
```

### Session Management

- **Redis cache** : Tokens actifs (révocation rapide)
- **PostgreSQL** : Sessions historique (audit)
- **Invalidation** : Logout, reset password, suspension

### Rate Limiting

- **Login** : 5 tentatives/15 min/IP
- **Reset password** : 3 demandes/1h/IP
- **API publique** : 100 req/min/IP
- **Admin** : 200 req/min/user

### Access Control

**Levels** :
- 1-5 : Clients (B2C/B2B)
- 6-7 : Support
- 8 : Manager
- 9-10 : Admin/Super Admin

---

## 📈 Performance

### Objectifs

| Endpoint | Target P95 | Cache TTL |
|----------|-----------|-----------|
| GET /api/users/profile | < 150ms | Redis 5 min |
| PUT /api/users/profile | < 200ms | N/A |
| GET /api/users/dashboard | < 300ms | Redis 2 min |
| GET /api/users (admin) | < 400ms | Redis 2 min |
| POST /api/users/password/reset | < 500ms | N/A (email async) |
| GET /api/users/addresses | < 150ms | N/A |

### Optimisations

1. **Redis cache** : Profils utilisateurs (5 min TTL)
2. **Indexes PostgreSQL** : Sur `email`, `user_status`, `user_level`, `user_created_at`
3. **Eager loading** : Adresses + stats avec profil (reduce queries)
4. **Connection pooling** : Supabase client pooling
5. **Email async** : Queue BullMQ pour emails (no blocking)

---

## 🧪 Tests

### Coverage Targets

- **Unit tests** : ≥ 80% (services)
- **Integration tests** : ≥ 60% (controllers + DB)
- **E2E tests** : Flows critiques (inscription, reset password)

### Tests Prioritaires

#### UsersFinalService

```typescript
describe('UsersFinalService', () => {
  it('should create user with hashed password', async () => {
    const user = await service.createUser({
      email: 'test@example.com',
      password: 'SecurePass123!',
      nom: 'Test',
      prenom: 'User'
    });
    expect(user.password_hash).toBeDefined();
    expect(user.password_hash).not.toBe('SecurePass123!');
  });

  it('should reject duplicate email', async () => {
    await expect(service.createUser({
      email: 'existing@example.com',
      password: 'Pass123!'
    })).rejects.toThrow('email existe déjà');
  });
});
```

#### PasswordService

```typescript
describe('PasswordService', () => {
  it('should generate valid reset token', async () => {
    const token = await service.generateResetToken('user@example.com');
    expect(token).toMatch(/^[a-f0-9-]{36}$/); // UUID format
  });

  it('should reject expired token', async () => {
    const expiredToken = 'expired-token-123';
    await expect(service.confirmResetPassword(expiredToken, 'NewPass123!'))
      .rejects.toThrow('expiré');
  });
});
```

---

## 📚 Dependencies

### NestJS Modules

- `@nestjs/common` - Core framework
- `@nestjs/jwt` - JWT tokens
- `@nestjs/passport` - Authentication
- `bcrypt` - Password hashing
- `ioredis` - Redis cache

### External Services

- **AuthModule** - JWT authentication
- **MailService** - Emails (reset password, notifications)
- **OrdersModule** - Stats utilisateur (commandes)
- **MessagesModule** - Messagerie interne

### Database

- `@supabase/supabase-js` - Supabase client
- `SupabaseBaseService` - Classe de base

---

## 🔄 RGPD Compliance

### Droit à l'oubli

**Endpoint:** DELETE `/api/users/:id`

**Logique:**
1. Soft delete : `user_status = DELETED`
2. Anonymisation données :
   - `email` → `deleted_user_{id}@deleted.local`
   - `nom` → `SUPPRIMÉ`
   - `prenom` → `SUPPRIMÉ`
   - `adresse` → NULL
   - `telephone` → NULL
3. Conservation commandes anonymisées (legal requirement 10 ans)
4. Suppression sessions, tokens, caches
5. Email confirmation suppression

### Export données

**Endpoint:** GET `/api/users/export`

**Format:** JSON

**Contenu:**
- Profil complet
- Adresses
- Commandes historique
- Messages
- Logs connexions

---

## 🚀 Deployment

### Environment Variables

```bash
# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Bcrypt
BCRYPT_SALT_ROUNDS=10

# Password Reset
PASSWORD_RESET_TOKEN_EXPIRY=3600    # 1 hour in seconds

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=xxx
USER_CACHE_TTL=300                  # 5 minutes

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=xxx

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
```

---

## 📖 Related Documentation

- [Auth System](./auth-system.md) - JWT authentication flow
- [Orders Module](./orders.md) - Commandes utilisateur
- [Cart Module](./cart.md) - Panier shopping
- [Messages Module](./messages.md) - Messagerie interne
- [ADR-001: Supabase Direct](../architecture/001-supabase-direct.md)

---

## ✅ Acceptance Criteria

### Critères Fonctionnels

- [ ] CRUD profils utilisateurs complet
- [ ] Multi-adresses (facturation/livraison)
- [ ] Reset password sécurisé (email tokens)
- [ ] Dashboard utilisateur avec stats
- [ ] Admin : recherche, filtres, gestion niveaux
- [ ] RGPD : suppression compte, export données
- [ ] Sessions JWT + cache Redis
- [ ] Email notifications (bienvenue, reset password)

### Critères Techniques

- [ ] Password hashing bcrypt (salt rounds=10)
- [ ] JWT tokens sécurisés (1h expiration)
- [ ] Validation Zod sur tous DTOs
- [ ] Tests unitaires ≥ 80% coverage
- [ ] Tests intégration ≥ 60% coverage
- [ ] Indexes PostgreSQL créés
- [ ] Cache Redis fonctionnel (5 min TTL)
- [ ] Rate limiting actif

### Critères Performance

- [ ] GET /api/users/profile < 150ms (p95)
- [ ] PUT /api/users/profile < 200ms (p95)
- [ ] GET /api/users/dashboard < 300ms (p95)
- [ ] GET /api/users (admin) < 400ms (p95)
- [ ] POST /api/users/password/reset < 500ms (p95)

### Critères Sécurité

- [ ] Password min 8 chars (1 maj, 1 min, 1 chiffre, 1 spécial)
- [ ] JWT secret fort (env variable)
- [ ] Reset tokens expiration 1h
- [ ] Rate limiting login (5 tentatives/15min)
- [ ] RGPD anonymisation données
- [ ] Sessions révocables (Redis)

---

## 🐛 Known Issues

1. **AuthModule circular dependency** : Résolu avec `forwardRef()`
2. **Email async** : Pas de retry logic (BullMQ future)
3. **Cache invalidation** : Manuelle (event-driven future)

---

## 🔮 Future Enhancements

1. **OAuth integration** : Google, Facebook login
2. **Two-factor authentication** : 2FA via SMS/authenticator app
3. **Email verification** : Token confirmation email
4. **KYC verification** : B2B entreprise verification (SIRET, KBIS)
5. **Programme fidélité** : Points, récompenses
6. **Wishlist** : Liste favoris produits
7. **Multi-langues** : i18n profils
8. **Session management** : Dashboard sessions actives
9. **Activity log** : Audit trail actions utilisateur
10. **BullMQ queue** : Email async avec retry

---

**Version:** 1.0.0  
**Last Updated:** 2025-11-18  
**Status:** ✅ Implemented (Production)  
**Maintainer:** Backend Team

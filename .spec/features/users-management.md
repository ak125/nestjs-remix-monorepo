---
title: "users management"
status: draft
version: 1.0.0
---

# Feature: Users Management System

**Version:** 1.0.0  
**Status:** implemented  
**Last Updated:** 2024-11-14  
**Owner:** Development Team

---

## 📋 Vue d'Ensemble

Système complet de gestion des utilisateurs (clients + staff) avec profils, adresses multiples, préférences, authentification et opérations administratives. Supporte **59,114 utilisateurs** en production avec architecture évolutive basée sur Supabase.

### Objectifs

- ✅ **CRUD utilisateurs** : Création, lecture, mise à jour, suppression
- ✅ **Gestion profils** : Informations personnelles, préférences, historique
- ✅ **Adresses multiples** : Facturation (1) + Livraisons (N)
- ✅ **Authentification intégrée** : JWT tokens, sessions Redis
- ✅ **Administration** : Dashboard, recherche, filtres, exports
- ✅ **RGPD** : Suppression compte, export données

### Métriques Production

| Métrique | Valeur | Détails |
|----------|--------|---------|
| **Utilisateurs totaux** | 59,114 | Table `cst_customer` |
| **Utilisateurs actifs** | ~45,000 | Connexion < 90 jours |
| **Staff/Admin** | ~150 | Niveaux 7-9 |
| **Adresses facturation** | 58,500+ | Table `___xtr_customer_billing_address` |
| **Adresses livraison** | 125,000+ | Table `___xtr_customer_delivery_address` (avg 2.1/user) |
| **Temps réponse p95** | 85ms | Profil utilisateur complet |
| **Cache hit rate** | 92% | Redis (sessions + profiles) |

---

## 🏗️ Architecture

### Pattern SupabaseBaseService

```typescript
@Injectable()
export class UsersFinalService extends SupabaseBaseService {
  constructor(
    configService: ConfigService,
    private readonly userDataService: UserDataConsolidatedService,
    private readonly cacheService: CacheService,
  ) {
    super(configService);
  }
}
```

**Avantages :**
- Accès direct Supabase (pas de Prisma ORM)
- Performance : 24ms vs 58ms
- Type safety : Types générés depuis DB schema
- Cohérence : Pattern identique sur 16 services

### Stack Technique

- **Backend** : NestJS 10, TypeScript 5
- **Database** : Supabase PostgreSQL (accès direct SDK)
- **Cache** : Redis (sessions JWT + profiles)
- **Validation** : Zod schemas
- **Auth** : JWT Bearer (15min + 7 days refresh)
- **Email** : MailService (confirmation, reset password)

### Tables Database

**Table principale : `cst_customer`**
```sql
CREATE TABLE cst_customer (
  cst_id SERIAL PRIMARY KEY,
  cst_email VARCHAR(255) UNIQUE NOT NULL,
  cst_password TEXT NOT NULL,
  cst_lastname VARCHAR(100),
  cst_firstname VARCHAR(100),
  cst_phone VARCHAR(20),
  cst_mobile VARCHAR(20),
  cst_level INT DEFAULT 0, -- 0=guest, 1-6=client, 7-9=admin
  cst_status BOOLEAN DEFAULT true, -- Actif/Inactif
  cst_type VARCHAR(20) DEFAULT 'customer', -- customer, pro, staff
  cst_language VARCHAR(5) DEFAULT 'fr',
  cst_newsletter BOOLEAN DEFAULT false,
  cst_created_at TIMESTAMP DEFAULT NOW(),
  cst_updated_at TIMESTAMP DEFAULT NOW(),
  cst_last_login TIMESTAMP,
  -- RGPD
  cst_gdpr_consent BOOLEAN DEFAULT false,
  cst_gdpr_consent_date TIMESTAMP,
  -- Stats
  cst_total_orders INT DEFAULT 0,
  cst_total_spent DECIMAL(10,2) DEFAULT 0,
  -- Divers
  cst_company VARCHAR(255),
  cst_siret VARCHAR(14),
  cst_tva_intra VARCHAR(20),
  cst_notes TEXT
);
```

**Table adresse facturation : `___xtr_customer_billing_address`**
```sql
CREATE TABLE ___xtr_customer_billing_address (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES cst_customer(cst_id),
  firstname VARCHAR(100),
  lastname VARCHAR(100),
  company VARCHAR(255),
  address1 VARCHAR(255) NOT NULL,
  address2 VARCHAR(255),
  postal_code VARCHAR(10) NOT NULL,
  city VARCHAR(100) NOT NULL,
  country VARCHAR(3) DEFAULT 'FR',
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id) -- 1 seule adresse facturation par client
);
```

**Table adresses livraison : `___xtr_customer_delivery_address`**
```sql
CREATE TABLE ___xtr_customer_delivery_address (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES cst_customer(cst_id),
  label VARCHAR(50) DEFAULT 'Adresse', -- Ex: "Maison", "Bureau"
  firstname VARCHAR(100),
  lastname VARCHAR(100),
  company VARCHAR(255),
  address1 VARCHAR(255) NOT NULL,
  address2 VARCHAR(255),
  postal_code VARCHAR(10) NOT NULL,
  city VARCHAR(100) NOT NULL,
  country VARCHAR(3) DEFAULT 'FR',
  phone VARCHAR(20),
  is_default BOOLEAN DEFAULT false, -- Adresse par défaut
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_customer_default (customer_id, is_default)
);
```

---

## 🎯 Fonctionnalités

### 1. CRUD Utilisateurs

#### Création Utilisateur (POST /api/users)

**Admin uniquement**

```typescript
// DTO Zod
const CreateUserSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères'),
  firstname: z.string().min(2).max(100),
  lastname: z.string().min(2).max(100),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/).optional(),
  mobile: z.string().regex(/^\+?[0-9]{10,15}$/).optional(),
  level: z.number().int().min(0).max(9).default(1),
  type: z.enum(['customer', 'pro', 'staff']).default('customer'),
  language: z.string().length(2).default('fr'),
  newsletter: z.boolean().default(false),
  company: z.string().max(255).optional(),
  siret: z.string().length(14).optional(),
  tvaIntra: z.string().max(20).optional(),
});
```

**Validations business :**
- Email unique (vérification DB)
- Password : min 8 chars, 1 majuscule, 1 chiffre, 1 spécial
- SIRET si `type='pro'`
- Level cohérent avec type (staff = 7-9)

**Actions automatiques :**
1. Hash password (bcrypt, 12 rounds)
2. Génération token confirmation email
3. Envoi email bienvenue
4. Création adresse facturation vide
5. Log audit (admin action)

#### Lecture Utilisateur (GET /api/users/:id)

**Response complète :**
```typescript
interface UserResponse {
  id: number;
  email: string;
  firstname: string;
  lastname: string;
  phone?: string;
  mobile?: string;
  level: number;
  status: boolean;
  type: 'customer' | 'pro' | 'staff';
  language: string;
  newsletter: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  gdprConsent: boolean;
  gdprConsentDate?: Date;
  // Stats
  totalOrders: number;
  totalSpent: number;
  // Pro
  company?: string;
  siret?: string;
  tvaIntra?: string;
  // Adresses (optionnel selon query param ?include=addresses)
  billingAddress?: BillingAddress;
  deliveryAddresses?: DeliveryAddress[];
}
```

**Cache strategy :**
- TTL : 15 minutes
- Key : `user:${userId}:profile`
- Invalidation : Mise à jour profil, commande, paiement

#### Mise à jour Utilisateur (PUT /api/users/:id)

**Champs modifiables (client) :**
- firstname, lastname
- phone, mobile
- language
- newsletter
- company (si pro)

**Champs modifiables (admin uniquement) :**
- level, type, status
- siret, tvaIntra
- notes

**Règles :**
- Email non modifiable (sécurité)
- Password via endpoint dédié `/api/password/change`
- Level change → Vérification permissions cohérentes
- Status false → Soft delete (conserve données RGPD)

#### Suppression Utilisateur (DELETE /api/users/:id)

**Soft delete (défaut) :**
```typescript
UPDATE cst_customer SET
  cst_status = false,
  cst_updated_at = NOW(),
  cst_notes = CONCAT(cst_notes, '[DELETED ', NOW(), ']')
WHERE cst_id = :id;
```

**Hard delete (RGPD explicite) :**
```typescript
// Suppression cascade
DELETE FROM ___xtr_customer_delivery_address WHERE customer_id = :id;
DELETE FROM ___xtr_customer_billing_address WHERE customer_id = :id;
DELETE FROM cst_customer_sessions WHERE customer_id = :id;
DELETE FROM cst_customer WHERE cst_id = :id;
```

**Contraintes :**
- Impossible si commandes en cours (status < 5)
- Possible si toutes commandes terminées (archivées)
- Admin peut forcer avec `?force=true`

---

### 2. Gestion Profils

#### Profil Utilisateur (GET /api/users/profile)

**Authentification requise** (JWT)

Retourne profil complet utilisateur connecté :
- Informations personnelles
- Adresses (facturation + livraisons)
- Statistiques (commandes, CA)
- Préférences (langue, newsletter)

**Inclusions optionnelles :**
- `?include=orders` : 10 dernières commandes
- `?include=addresses` : Toutes adresses
- `?include=wishlist` : Liste souhaits
- `?include=reviews` : Avis produits

#### Dashboard Utilisateur (GET /api/users/dashboard)

**Métriques calculées :**
```typescript
interface DashboardData {
  user: UserSummary;
  orders: {
    total: number;
    pending: number;
    completed: number;
    cancelled: number;
    totalSpent: number;
    averageBasket: number;
    lastOrder?: Order;
  };
  cart: {
    itemsCount: number;
    total: number;
  };
  wishlist: {
    itemsCount: number;
  };
  reviews: {
    count: number;
    averageRating: number;
  };
  addresses: {
    billing?: BillingAddress;
    deliveryCount: number;
    deliveryDefault?: DeliveryAddress;
  };
  notifications: Notification[];
  recommendations: Product[];
}
```

**Cache :**
- TTL : 5 minutes
- Invalidation : Commande, paiement, ajout panier

---

### 3. Adresses Multiples

#### Architecture Adresses

**1 adresse facturation** (unique par client)
- Utilisée pour facture/comptabilité
- Peut être différente des livraisons
- Modification via `POST /api/addresses/billing` (upsert)

**N adresses livraison** (illimité)
- Label personnalisé ("Maison", "Bureau", "Parents")
- 1 adresse par défaut (flag `is_default`)
- CRUD complet via `/api/addresses/delivery/*`

#### Endpoints Adresses

**Toutes adresses (GET /api/addresses)**
```json
{
  "billingAddress": {
    "id": 123,
    "firstname": "Jean",
    "lastname": "Dupont",
    "address1": "15 rue de la Paix",
    "postalCode": "75001",
    "city": "Paris",
    "country": "FR",
    "phone": "+33612345678"
  },
  "deliveryAddresses": [
    {
      "id": 456,
      "label": "Maison",
      "firstname": "Jean",
      "lastname": "Dupont",
      "address1": "42 avenue des Champs",
      "postalCode": "75008",
      "city": "Paris",
      "country": "FR",
      "phone": "+33612345678",
      "isDefault": true
    },
    {
      "id": 457,
      "label": "Bureau",
      "firstname": "Jean",
      "lastname": "Dupont",
      "company": "ACME Corp",
      "address1": "10 rue du Commerce",
      "postalCode": "92100",
      "city": "Boulogne-Billancourt",
      "country": "FR",
      "phone": "+33612345678",
      "isDefault": false
    }
  ],
  "defaultDeliveryAddress": { /* adresse id=456 */ }
}
```

**Créer adresse livraison (POST /api/addresses/delivery)**
```typescript
const CreateDeliveryAddressSchema = z.object({
  label: z.string().min(1).max(50).default('Adresse'),
  firstname: z.string().min(2).max(100),
  lastname: z.string().min(2).max(100),
  company: z.string().max(255).optional(),
  address1: z.string().min(1).max(255),
  address2: z.string().max(255).optional(),
  postalCode: z.string().regex(/^\d{5}$/), // France uniquement
  city: z.string().min(2).max(100),
  country: z.string().length(2).default('FR'),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/),
  isDefault: z.boolean().default(false),
});
```

**Règles métier :**
- Si `isDefault=true` → Retirer défaut des autres adresses
- Minimum 1 adresse livraison (impossible de supprimer la dernière)
- Validation CP français (5 chiffres)
- Validation téléphone (format international accepté)

**Définir adresse par défaut (PATCH /api/addresses/delivery/:id/set-default)**
- Retire `is_default=false` sur toutes autres adresses
- Set `is_default=true` sur adresse ciblée
- Utilisée automatiquement au checkout si non spécifié

---

### 4. Administration

#### Liste Utilisateurs (GET /api/users)

**Filtres disponibles :**
```typescript
interface UserFilters {
  search?: string; // Email, nom, prénom
  status?: boolean; // Actif/Inactif
  type?: 'customer' | 'pro' | 'staff';
  level?: number; // 0-9
  city?: string;
  country?: string;
  hasOrders?: boolean; // A commandé au moins 1 fois
  newsletter?: boolean;
  // Dates
  createdAfter?: Date;
  createdBefore?: Date;
  lastLoginAfter?: Date;
  lastLoginBefore?: Date;
  // Tri
  sortBy?: 'email' | 'lastname' | 'createdAt' | 'lastLogin' | 'totalSpent';
  sortOrder?: 'asc' | 'desc';
  // Pagination
  page?: number; // Défaut: 1
  limit?: number; // Défaut: 20, max: 100
}
```

**Response paginée :**
```typescript
interface UserListResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    customersCount: number;
    proCount: number;
    staffCount: number;
  };
}
```

#### Recherche Utilisateurs (GET /api/users/search)

**Recherche full-text :**
- Email (exact + partiel)
- Nom, prénom (fuzzy matching)
- Téléphone (format normalisé)
- SIRET (pros uniquement)
- Adresses (ville, CP)

**Algorithme :**
```sql
SELECT * FROM cst_customer
WHERE
  LOWER(cst_email) LIKE LOWER(:search) OR
  LOWER(CONCAT(cst_firstname, ' ', cst_lastname)) LIKE LOWER(:search) OR
  cst_phone LIKE :search OR
  cst_siret = :search OR
  cst_id::text = :search
ORDER BY
  CASE
    WHEN cst_email = :search THEN 1 -- Exact match email
    WHEN cst_id::text = :search THEN 2 -- Exact match ID
    ELSE 3
  END,
  cst_lastname ASC
LIMIT 50;
```

#### Statistiques Globales (GET /api/users/stats)

**Métriques calculées :**
```typescript
interface UsersStats {
  total: number;
  active: number;
  inactive: number;
  byType: {
    customer: number;
    pro: number;
    staff: number;
  };
  byLevel: Record<number, number>; // 0-9
  growth: {
    today: number;
    week: number;
    month: number;
    year: number;
  };
  engagement: {
    withOrders: number;
    withoutOrders: number;
    percentageOrdered: number;
  };
  geographic: {
    byCountry: Record<string, number>;
    topCities: Array<{ city: string; count: number }>;
  };
  newsletter: {
    subscribed: number;
    unsubscribed: number;
    percentageSubscribed: number;
  };
}
```

**Performance :**
- Calcul à la demande (non caché)
- Query optimisée avec indexes
- Durée : ~200ms pour 59k users

#### Statistiques Utilisateur (GET /api/users/:id/stats)

**Métriques individuelles :**
```typescript
interface UserStats {
  userId: number;
  orders: {
    total: number;
    completed: number;
    cancelled: number;
    pending: number;
    totalSpent: number;
    averageBasket: number;
    firstOrder?: Date;
    lastOrder?: Date;
  };
  products: {
    totalPurchased: number;
    uniqueProducts: number;
    topCategories: Array<{ category: string; count: number }>;
    topBrands: Array<{ brand: string; count: number }>;
  };
  engagement: {
    accountAge: number; // jours
    lastLogin?: Date;
    loginCount: number;
    cartAbandonments: number;
  };
  reviews: {
    count: number;
    averageRating: number;
  };
  addresses: {
    billingComplete: boolean;
    deliveryCount: number;
  };
}
```

#### Réactivation Compte (POST /api/users/:id/reactivate)

**Cas d'usage :**
- Compte désactivé (status=false)
- Suspension temporaire
- Annulation suppression RGPD (< 30 jours)

**Actions :**
```typescript
UPDATE cst_customer SET
  cst_status = true,
  cst_updated_at = NOW(),
  cst_notes = CONCAT(cst_notes, '[REACTIVATED ', NOW(), ' by admin]')
WHERE cst_id = :id;
```

**Email notification** : "Votre compte a été réactivé"

#### Export Utilisateurs (POST /api/users/export)

**Formats supportés :**
- CSV (défaut)
- Excel (XLSX)
- JSON

**Champs exportés :**
- ID, Email, Nom, Prénom
- Téléphone, Mobile
- Type, Level, Status
- Date création, dernière connexion
- Total commandes, CA total
- Ville, Pays
- Newsletter

**Limites :**
- Max 10,000 users par export
- Filtres applicables
- Génération asynchrone si > 1,000 users
- Download link envoyé par email

---

### 5. Gestion Mots de Passe

#### Changement Password (POST /api/password/change)

**Authentifié uniquement**

```typescript
const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password actuel requis'),
  newPassword: z.string()
    .min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Au moins 1 majuscule')
    .regex(/[0-9]/, 'Au moins 1 chiffre')
    .regex(/[^A-Za-z0-9]/, 'Au moins 1 caractère spécial'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});
```

**Validations :**
1. Vérifier `currentPassword` correct (bcrypt compare)
2. Valider `newPassword` != `currentPassword`
3. Hash `newPassword` (bcrypt, 12 rounds)
4. Update DB + invalidation session
5. Email confirmation

**Sécurité :**
- Rate limiting : 5 tentatives / 15 minutes
- Logout automatique après changement
- Historique passwords (empêche réutilisation 5 derniers)

#### Demande Reset Password (POST /api/password/request-reset)

**Public (non authentifié)**

```typescript
const RequestResetSchema = z.object({
  email: z.string().email('Email invalide'),
});
```

**Flux :**
1. Vérifier email existe dans DB
2. Générer token reset (UUID v4, TTL 1h)
3. Stocker token dans `password_reset_tokens`
4. Envoyer email avec lien reset
5. Retour `200 OK` même si email inexistant (sécurité)

**Email template :**
```
Sujet: Réinitialisation de votre mot de passe

Bonjour,

Vous avez demandé la réinitialisation de votre mot de passe.

Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :
https://app.com/reset-password?token=abc123...

Ce lien expire dans 1 heure.

Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.

Cordialement,
L'équipe Support
```

#### Reset Password (POST /api/password/reset)

**Public (non authentifié)**

```typescript
const ResetPasswordSchema = z.object({
  token: z.string().uuid('Token invalide'),
  newPassword: z.string()
    .min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Au moins 1 majuscule')
    .regex(/[0-9]/, 'Au moins 1 chiffre')
    .regex(/[^A-Za-z0-9]/, 'Au moins 1 caractère spécial'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});
```

**Validations :**
1. Token existe et non expiré (< 1h)
2. Token non déjà utilisé
3. Hash `newPassword`
4. Update password DB
5. Marquer token comme utilisé
6. Invalidate toutes sessions user
7. Email confirmation

**Table `password_reset_tokens` :**
```sql
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES cst_customer(cst_id),
  token UUID UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  ip_address INET,
  user_agent TEXT
);
```

---

### 6. Sessions & Authentification

#### Sessions JWT

**Access Token (15 minutes) :**
```json
{
  "sub": "123", // userId
  "email": "user@example.com",
  "level": 1,
  "type": "customer",
  "iat": 1699999999,
  "exp": 1700000899
}
```

**Refresh Token (7 jours) :**
```json
{
  "sub": "123",
  "type": "refresh",
  "iat": 1699999999,
  "exp": 1700604799
}
```

**Stockage Redis :**
```typescript
// Session active
Key: `session:${userId}:${sessionId}`
Value: {
  userId: number;
  email: string;
  level: number;
  type: string;
  createdAt: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
}
TTL: 7 jours
```

**Refresh Token Flow :**
1. Client envoie `refreshToken` expiré
2. Vérifier token signature
3. Vérifier session existe dans Redis
4. Générer nouveau `accessToken` (15min)
5. Renouveler `refreshToken` (7 jours)
6. Update `lastActivity` dans Redis

#### Multi-sessions

**Support** : Oui (illimité)

Un utilisateur peut avoir plusieurs sessions actives simultanées :
- Desktop + Mobile
- Plusieurs navigateurs
- Plusieurs devices

**Gestion sessions :**
- Liste sessions : `GET /api/users/profile/sessions`
- Révoquer session : `DELETE /api/users/profile/sessions/:sessionId`
- Révoquer toutes : `DELETE /api/users/profile/sessions`

---

## 📡 API Endpoints

### Endpoints Client (Authentifié)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/users/profile` | Profil complet utilisateur connecté | JWT |
| PUT | `/api/users/profile` | Mettre à jour son profil | JWT |
| GET | `/api/users/dashboard` | Dashboard avec métriques | JWT |
| GET | `/api/addresses` | Toutes adresses (facturation + livraisons) | JWT |
| GET | `/api/addresses/billing` | Adresse facturation | JWT |
| POST | `/api/addresses/billing` | Créer/Modifier adresse facturation | JWT |
| GET | `/api/addresses/delivery` | Liste adresses livraison | JWT |
| GET | `/api/addresses/delivery/default` | Adresse livraison par défaut | JWT |
| POST | `/api/addresses/delivery` | Créer adresse livraison | JWT |
| PATCH | `/api/addresses/delivery/:id` | Modifier adresse livraison | JWT |
| DELETE | `/api/addresses/delivery/:id` | Supprimer adresse livraison | JWT |
| PATCH | `/api/addresses/delivery/:id/set-default` | Définir adresse par défaut | JWT |
| POST | `/api/password/change` | Changer son mot de passe | JWT |
| GET | `/api/users/:userId/shipments` | Mes expéditions (`:userId` = compte de la session, sinon 404) | JWT |
| GET | `/api/users/:userId/shipments/stats` | Stats expéditions (`:userId` = compte de la session, sinon 404) | JWT |

### Endpoints Admin

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/users` | Liste utilisateurs (filtres, pagination) | JWT + Admin |
| GET | `/api/users/stats` | Statistiques globales | JWT + Admin |
| GET | `/api/users/search` | Recherche utilisateurs | JWT + Admin |
| GET | `/api/users/:id` | Détails utilisateur spécifique | JWT + Admin |
| GET | `/api/users/:id/stats` | Stats utilisateur individuel | JWT + Admin |
| POST | `/api/users` | Créer utilisateur | JWT + Admin |
| PUT | `/api/users/:id` | Mettre à jour utilisateur | JWT + Admin |
| DELETE | `/api/users/:id` | Supprimer utilisateur (soft/hard) | JWT + Admin |
| POST | `/api/users/:id/reactivate` | Réactiver compte | JWT + Admin |
| PUT | `/api/users/:id/password` | Reset password admin | JWT + Admin |
| POST | `/api/users/export` | Export CSV/Excel/JSON | JWT + Admin |

### Endpoints Publics

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/users/test` | Health check | None |
| POST | `/api/password/request-reset` | Demander reset password | None |
| POST | `/api/password/reset` | Reset password avec token | None |
| POST | `/api/password/cleanup-tokens` | Nettoyage tokens expirés | None |

---

## 🔐 Sécurité

### Authentification

**JWT Bearer Token :**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Guards NestJS :**
```typescript
@UseGuards(AuthenticatedGuard) // JWT valide requis
@UseGuards(AuthenticatedGuard, IsAdminGuard) // JWT + Admin level ≥ 7
```

### Niveaux d'Accès

| Level | Rôle | Permissions |
|-------|------|-------------|
| 0 | Guest | Lecture seule produits |
| 1-6 | Client | CRUD profil/adresses, commandes |
| 7 | Support | Lecture tous users, support tickets |
| 8 | Manager | Modification users, stats avancées |
| 9 | Super Admin | Toutes opérations + exports |

### Rate Limiting

**Endpoints sensibles :**
- `/api/password/change` : 5 / 15min
- `/api/password/request-reset` : 3 / 1h
- `/api/users` (search) : 30 / 1min
- `/api/users` (list) : 60 / 1min

**Implémentation :**
```typescript
@Throttle(5, 900) // 5 requêtes / 15min (900s)
async changePassword() { ... }
```

### Validation Données

**Zod Schemas :**
- Email : Format valide + unicité DB
- Password : 8+ chars, majuscule, chiffre, spécial
- Téléphone : Regex international
- CP : 5 chiffres (France)
- SIRET : 14 chiffres (pros)

**Sanitization :**
- HTML tags stripped
- SQL injection prevention (Supabase parameterized queries)
- XSS prevention (input encoding)

### RGPD Compliance

**Consentement :**
- Checkbox explicite à l'inscription
- Date enregistrée (`cst_gdpr_consent_date`)
- Révocable à tout moment

**Droit à l'oubli :**
- Suppression compte : Hard delete après 30 jours
- Export données : Format JSON complet
- Anonymisation : Remplace données par `[DELETED]`

**Données conservées (légal) :**
- Factures : 10 ans (obligation comptable)
- Logs audit : 1 an (sécurité)
- Commandes terminées : Anonymisées après 2 ans

---

## 🧪 Tests & Validation

### Tests Unitaires

**Services testés :**
```bash
users-final.service.spec.ts        # 95% coverage
addresses.service.spec.ts          # 92% coverage
password.service.spec.ts           # 98% coverage
profile.service.spec.ts            # 90% coverage
admin.service.spec.ts              # 88% coverage
```

**Scénarios critiques :**
- ✅ Création user avec email duplicate (409 Conflict)
- ✅ Login avec mauvais password (401 Unauthorized)
- ✅ Changement password avec current incorrect (400 Bad Request)
- ✅ Reset password avec token expiré (400 Bad Request)
- ✅ Suppression user avec commandes en cours (400 Bad Request)
- ✅ Définir adresse défaut retire autres défauts
- ✅ Impossible supprimer dernière adresse livraison

### Tests Intégration

**E2E Flow complet :**
1. Inscription user → Email confirmation
2. Login → JWT tokens générés
3. Update profil → Cache invalidé
4. Créer adresses → Facturation + 2 livraisons
5. Passer commande → Adresse défaut utilisée
6. Reset password → Token + email
7. Suppression compte → Soft delete

### Validation Production

**Monitoring :**
- Temps réponse endpoints : p50, p95, p99
- Taux erreur 4xx/5xx
- Cache hit rate Redis
- Nombre sessions actives
- Nombre users créés/jour

**Alertes :**
- Temps réponse > 500ms (p95)
- Taux erreur > 1%
- Cache hit < 85%
- Spike création users (détection fraude)

---

## 📊 Performance

### Métriques Cibles

| Endpoint | p50 | p95 | p99 |
|----------|-----|-----|-----|
| GET /profile | 25ms | 85ms | 150ms |
| PUT /profile | 40ms | 120ms | 200ms |
| GET /dashboard | 50ms | 150ms | 300ms |
| GET /users (list) | 60ms | 180ms | 350ms |
| POST /users (create) | 80ms | 200ms | 400ms |

### Optimisations

**Cache Redis :**
- Profil utilisateur : TTL 15min
- Dashboard : TTL 5min
- Sessions JWT : TTL 7 jours
- Stats globales : Non caché (calcul temps réel)

**Database Indexes :**
```sql
CREATE INDEX idx_customer_email ON cst_customer(cst_email);
CREATE INDEX idx_customer_status ON cst_customer(cst_status);
CREATE INDEX idx_customer_type ON cst_customer(cst_type);
CREATE INDEX idx_customer_level ON cst_customer(cst_level);
CREATE INDEX idx_customer_created ON cst_customer(cst_created_at);
CREATE INDEX idx_customer_last_login ON cst_customer(cst_last_login);

CREATE INDEX idx_billing_customer ON ___xtr_customer_billing_address(customer_id);
CREATE INDEX idx_delivery_customer ON ___xtr_customer_delivery_address(customer_id);
CREATE INDEX idx_delivery_default ON ___xtr_customer_delivery_address(customer_id, is_default);
```

**Query Optimization :**
- Pagination limitée à 100 results
- Filtres indexés
- Joins évités (Supabase RLS)
- Select colonnes spécifiques (no `SELECT *`)

---

## 🔄 Migrations & Évolutions

### Migration Legacy

**Tables anciennes → nouvelles :**
```sql
-- Ancienne: customer_legacy
-- Nouvelle: cst_customer

INSERT INTO cst_customer (
  cst_email, cst_password, cst_firstname, cst_lastname,
  cst_phone, cst_created_at, cst_status
)
SELECT
  email, password_hash, first_name, last_name,
  phone, created_date, is_active
FROM customer_legacy
WHERE migrated = false;
```

**Validation post-migration :**
- ✅ Tous emails uniques
- ✅ Tous passwords hashed (bcrypt)
- ✅ Adresses facturation créées
- ✅ Au moins 1 adresse livraison par user

### Évolutions Prévues

**Q1 2025 :**
- [ ] OAuth2 (Google, Apple, Facebook)
- [ ] 2FA (TOTP, SMS)
- [ ] Gestion entreprises multi-utilisateurs
- [ ] Délégation commandes (assistants)

**Q2 2025 :**
- [ ] Programme fidélité (points)
- [ ] Parrainage clients
- [ ] Abonnements récurrents
- [ ] API publique (developers)

---

## 🔗 Dépendances & Intégrations

### Modules NestJS

**Imports :**
- `DatabaseModule` : UserDataConsolidatedService
- `CacheModule` : Redis sessions + profils
- `AuthModule` : JWT guards (forwardRef pour éviter circular)
- `MessagesModule` : Notifications internes
- `JwtModule` : Token generation/validation

**Exports :**
- `UsersFinalService` : Utilisé par Auth, Orders, Payments
- `AddressesService` : Utilisé par Orders, Cart
- `ProfileService` : Utilisé par Dashboard, Stats
- `PasswordService` : Utilisé par Auth, Admin

### Services Externes

**Email :**
- Provider : MailService
- Templates : Handlebars
- Emails : Confirmation, reset password, notifications

**Storage :**
- Avatars : Supabase Storage (bucket `avatars`)
- Documents : Supabase Storage (bucket `documents`)

---

## 📚 Documentation Connexe

### Specs Liées

- [Authentication System](./auth-system.md) - JWT, guards, sessions
- [Order Management](./order-management.md) - Lien users → commandes
- [Payment & Cart](./payment-cart-system.md) - Lien users → paiements

### ADRs

- [ADR-001: Supabase Direct Access](../architecture/001-supabase-direct.md)
- [ADR-004: State Management Frontend](../architecture/004-state-management-frontend.md)

### Types

- [User Schema Types](../types/user.schema.md) - À créer (Zod schemas)
- [Address Schema Types](../types/address.schema.md) - À créer

---

## ✅ Checklist Implémentation

### Backend ✅

- [x] UsersFinalService (SupabaseBaseService)
- [x] AddressesService (facturation + livraison)
- [x] ProfileService (dashboard, stats)
- [x] PasswordService (change, reset)
- [x] AdminService (search, export)
- [x] UsersFinalController (CRUD + admin)
- [x] AddressesController (CRUD adresses)
- [x] PasswordController (change, reset)
- [x] Zod schemas (user.dto, addresses.dto, passwords.dto)
- [x] JWT guards (Authenticated, IsAdmin)
- [x] Cache Redis (sessions, profils)
- [x] Email templates (confirmation, reset)

### Frontend

- [ ] Page `/profile` (vue + édition profil)
- [ ] Page `/dashboard` (métriques utilisateur)
- [ ] Page `/addresses` (gestion adresses)
- [ ] Page `/account/password` (changement password)
- [ ] Page `/reset-password` (reset avec token)
- [ ] Composants adresses (AddressCard, AddressForm)
- [ ] Forms Zod validation (react-hook-form)
- [ ] Admin: `/admin/users` (liste, filtres)
- [ ] Admin: `/admin/users/:id` (détails, édition)

### Tests

- [x] Tests unitaires services (90%+ coverage)
- [ ] Tests E2E Playwright (flows complets)
- [ ] Tests performance (load testing)

### Documentation

- [x] Feature spec (ce document)
- [ ] Type schema spec (user.schema.md)
- [ ] API OpenAPI spec (users-api.yaml)
- [ ] README utilisateur (guide utilisateur)

---

**Version:** 1.0.0  
**Dernière mise à jour:** 2024-11-14  
**Auteur:** Development Team  
**Status:** ✅ Implémenté (Backend complet, Frontend partiel)

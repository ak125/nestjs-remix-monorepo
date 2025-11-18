# Module Admin - Spécification Technique

## 1. Vue d'ensemble

### Description
Module d'administration complet pour la gestion du back-office e-commerce. Fournit des outils de gestion pour les stocks, les utilisateurs, les produits, les commandes, et les rapports analytics avec contrôle d'accès RBAC (Role-Based Access Control).

### Objectifs
- **Gestion des stocks** : Dashboard temps réel, mouvements, alertes, réservations
- **Gestion des utilisateurs** : Administration customers/staff, statistiques, activation/désactivation
- **Gestion des produits** : Vue admin enrichie, recherche avancée, export, statistiques
- **Rapports analytics** : Génération de rapports personnalisés (users, orders, revenue, stock)
- **Configuration système** : Paramètres globaux, SEO monitoring, staff management
- **Sécurité RBAC** : Guards admin, authentification, niveaux d'autorisation

### Contexte technique
- **Architecture** : NestJS modulaire avec séparation controllers/services
- **Base de données** : Supabase PostgreSQL (tables `___xtr_customer`, `___xtr_staff`, `stock`, etc.)
- **Cache** : Redis pour performance (TTL: 1-5 minutes selon le type de données)
- **Authentification** : Session-based avec guards `AuthenticatedGuard` + `IsAdminGuard`
- **Documentation** : Swagger/OpenAPI intégré

---

## 2. Objectifs détaillés

### Fonctionnels
1. **Dashboard stock consolidé**
   - Vue temps réel des stocks (disponibles, réservés, rupture)
   - Alertes automatiques (stock faible, rupture)
   - Filtres avancés (fournisseur, catégorie, statut)
   - Statistiques agrégées (total produits, valeur stock, alertes)

2. **Gestion utilisateurs**
   - Liste paginée avec filtres (actifs, pro, niveau)
   - Statistiques utilisateurs (total, actifs, vérifiés, nouveaux)
   - Actions admin (activation, désactivation, mise à jour niveau)
   - Historique des actions admin

3. **Gestion produits**
   - Vue admin enrichie avec statistiques
   - Recherche avancée multi-critères
   - Export données (JSON, CSV)
   - Gestion marques et gammes

4. **Rapports analytics**
   - Rapport global (users, orders, revenue, performance)
   - Rapports spécialisés par type
   - Export multi-formats (JSON, CSV, PDF)
   - Cache intelligent pour performance

5. **Monitoring SEO**
   - Suivi pages indexées (714k pages)
   - Statistiques par type (gammes, familles, produits)
   - Alertes anomalies

### Non-fonctionnels
- **Performance** : 
  - p50: <200ms pour dashboard
  - p95: <500ms pour rapports
  - p99: <1000ms pour exports
- **Cache** : 
  - TTL: 60s (stock), 300s (analytics), 3600s (config)
  - Invalidation automatique sur mutations
- **Sécurité** :
  - RBAC strict (admin level ≥ 7)
  - Logging exhaustif des actions admin
  - CSRF protection
- **Monitoring** :
  - Health checks
  - Alertes Sentry sur erreurs critiques
  - Métriques Prometheus

---

## 3. Hors périmètre

- ❌ **Modification directe des commandes** → Utiliser `OrdersModule` (`/api/orders/admin/*`)
- ❌ **Gestion catalogue produits (familles/gammes)** → Utiliser `CatalogModule`
- ❌ **Contenu blog** → Utiliser `BlogModule`
- ❌ **Paiements** → Utiliser `PaymentsModule`
- ❌ **Interface utilisateur** → Frontend Remix séparé
- ❌ **Permissions granulaires par ressource** → Système RBAC simple par niveau

---

## 4. Architecture

### Structure du module

```
backend/src/modules/admin/
├── admin.module.ts              # Configuration module
├── controllers/
│   ├── admin.controller.ts              # Dashboard principal + health
│   ├── admin-root.controller.ts         # Routes root admin
│   ├── admin-products.controller.ts     # Gestion produits admin
│   ├── admin-seo.controller.ts          # Monitoring SEO
│   ├── admin-staff.controller.ts        # Gestion staff
│   ├── configuration.controller.ts      # Configuration système
│   ├── reporting.controller.ts          # Rapports analytics
│   ├── stock.controller.ts              # Gestion stocks CONSOLIDÉ (6 controllers → 1)
│   └── user-management.controller.ts    # Gestion utilisateurs
├── services/
│   ├── configuration.service.ts         # Configuration système
│   ├── reporting.service.ts             # Génération rapports
│   ├── stock-management.service.ts      # Gestion stocks core
│   ├── user-management.service.ts       # Gestion utilisateurs
│   └── working-stock.service.ts         # Stocks avancés (search, export)
├── guards/
│   └── admin-auth.guard.ts              # Guard admin custom
├── decorators/
│   └── admin.decorator.ts               # Décorateurs admin
├── dto/
│   └── stock.dto.ts                     # DTOs validation Zod
└── schemas/
    └── admin.schema.ts                  # Schemas validation
```

### Dépendances

```typescript
@Module({
  imports: [
    DatabaseModule,      // Supabase access
    CacheModule,         // Redis cache
    OrdersModule,        // Pour stats commandes
    StaffModule,         // Pour gestion staff
    ProductsModule,      // Pour gestion produits
    WorkerModule,        // Pour SEO monitoring scheduler
  ],
  controllers: [
    AdminController,
    StockController,
    UserManagementController,
    ReportingController,
    AdminProductsController,
    AdminSeoController,
    AdminStaffController,
    ConfigurationController,
    AdminRootController,
  ],
  providers: [
    StockManagementService,
    WorkingStockService,
    UserManagementService,
    ReportingService,
    ConfigurationService,
  ],
  exports: [
    StockManagementService,
    UserManagementService,
    ReportingService,
    ConfigurationService,
  ],
})
```

### Flux de données

```mermaid
graph TB
    A[Admin Frontend] -->|HTTP + Session| B[Admin Controllers]
    B -->|AuthenticatedGuard| C{Admin Level ≥ 7?}
    C -->|✓ Autorisé| D[Admin Services]
    C -->|✗ Refusé| E[403 Forbidden]
    D -->|Query| F[Supabase PostgreSQL]
    D -->|Cache Check| G[Redis Cache]
    G -->|Cache Miss| F
    G -->|Cache Hit| H[Response]
    F -->|Data| D
    D -->|Set Cache| G
    D -->|Response| H
    H -->|JSON| A
```

---

## 5. Modèle de données

### Tables principales

#### 1. `stock` - Gestion des stocks
```sql
CREATE TABLE stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES pieces(id),
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  available INTEGER GENERATED ALWAYS AS (quantity - reserved) STORED,
  min_stock INTEGER DEFAULT 5,
  max_stock INTEGER DEFAULT 100,
  location VARCHAR(100),
  last_restock_date TIMESTAMPTZ,
  next_restock_date TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_product ON stock(product_id);
CREATE INDEX idx_stock_available ON stock(available);
CREATE INDEX idx_stock_low ON stock(available) WHERE available <= min_stock;
```

#### 2. `stock_movements` - Historique des mouvements
```sql
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES pieces(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT', 'RETURN')),
  quantity INTEGER NOT NULL,
  reason TEXT,
  order_id UUID REFERENCES ___xtr_order(id),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_movements_product ON stock_movements(product_id, created_at DESC);
CREATE INDEX idx_movements_order ON stock_movements(order_id);
```

#### 3. `___xtr_customer` - Customers (utilisé par UserManagement)
```sql
-- Table existante, colonnes clés utilisées:
cst_id UUID PRIMARY KEY
cst_email VARCHAR(255) UNIQUE NOT NULL
cst_firstname VARCHAR(100)
cst_lastname VARCHAR(100)
cst_level INTEGER DEFAULT 1          -- Niveau utilisateur (1-10)
cst_is_active CHAR(1) DEFAULT 'Y'    -- 'Y' ou 'N'
cst_is_pro CHAR(1) DEFAULT 'N'       -- 'Y' ou 'N'
cst_email_verified CHAR(1) DEFAULT 'N'
cst_created_at TIMESTAMPTZ
cst_last_login TIMESTAMPTZ
```

#### 4. `___xtr_staff` - Staff admin
```sql
-- Table existante pour le personnel admin:
stf_id UUID PRIMARY KEY
stf_email VARCHAR(255) UNIQUE NOT NULL
stf_level INTEGER DEFAULT 1          -- Niveau admin (7+ = admin)
stf_is_active CHAR(1) DEFAULT 'Y'
stf_permissions JSONB                -- Permissions RBAC
```

### Interfaces TypeScript

```typescript
// Stock
export interface StockItem {
  id: string;
  product_id: string;
  quantity: number;
  reserved: number;
  available: number;
  min_stock: number;
  max_stock: number;
  location?: string;
  last_restock_date?: Date;
  next_restock_date?: Date;
  updated_at?: Date;
}

export interface StockMovement {
  id?: string;
  product_id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN';
  quantity: number;
  reason: string;
  order_id?: string;
  user_id: string;
  created_at?: Date;
}

// Users
export interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  level: number;
  isActive: boolean;
  isPro: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string;
  totalOrders: number;
  totalSpent: number;
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  professional: number;
  verified: number;
  newThisMonth: number;
  byLevel: Record<string, number>;
}

// Reporting
export interface ReportData {
  users: {
    total: number;
    active: number;
    professional: number;
    verified: number;
    newThisMonth: number;
  };
  orders: {
    total: number;
    completed: number;
    pending: number;
    cancelled: number;
    revenue: number;
    avgOrderValue: number;
  };
  performance: {
    conversionRate: number;
    activeUserRate: number;
    verificationRate: number;
    completionRate: number;
  };
  trends: {
    usersThisMonth: number;
    ordersThisMonth: number;
    revenueThisMonth: number;
    growthRate: number;
  };
}
```

---

## 6. API Endpoints

### 6.1 Stock Management (13 endpoints)

#### GET `/api/admin/stock/dashboard`
Dashboard consolidé des stocks avec statistiques.

**Query Parameters:**
- `search` (string, optional) - Recherche produit
- `minStock` (boolean, optional) - Filtrer stocks faibles
- `outOfStock` (boolean, optional) - Filtrer ruptures
- `supplierId` (string, optional) - Filtrer par fournisseur
- `categoryId` (string, optional) - Filtrer par catégorie
- `isActive` (boolean, optional) - Filtrer produits actifs/inactifs

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "stock-uuid",
        "product_id": "product-uuid",
        "quantity": 50,
        "reserved": 5,
        "available": 45,
        "min_stock": 10,
        "max_stock": 100,
        "location": "A-12-3",
        "last_restock_date": "2025-11-01T10:00:00Z",
        "pieces": {
          "id": "product-uuid",
          "reference": "ALT-001",
          "name": "Alternateur Bosch",
          "is_active": true
        }
      }
    ],
    "stats": {
      "totalProducts": 450,
      "lowStock": 12,
      "outOfStock": 3,
      "totalValue": 125000
    },
    "totalItems": 450
  },
  "message": "Dashboard stock récupéré avec succès"
}
```

**Performance:** p50: <150ms, p95: <400ms

---

#### PUT `/api/admin/stock/:productId`
Mettre à jour le stock d'un produit.

**Headers:** `Authorization: Bearer {token}`

**Body:**
```json
{
  "quantity": 100,
  "minStock": 15,
  "maxStock": 200,
  "location": "B-05-7",
  "nextRestockDate": "2025-12-01T00:00:00Z",
  "reason": "Réapprovisionnement fournisseur"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Stock mis à jour avec succès",
  "data": {
    "product_id": "product-uuid",
    "quantity": 100,
    "available": 95,
    "reserved": 5,
    "movement": {
      "id": "movement-uuid",
      "type": "IN",
      "quantity": 50,
      "reason": "Réapprovisionnement fournisseur"
    }
  }
}
```

**Code exemple:**
```typescript
// Service: StockManagementService.updateStock()
async updateStock(
  productId: string,
  updateData: StockUpdateData,
  userId: string,
  reason: string,
) {
  const { data: currentStock } = await this.client
    .from('stock')
    .select('*')
    .eq('product_id', productId)
    .single();

  if (!currentStock) {
    throw new BadRequestException('Produit non trouvé en stock');
  }

  // Mise à jour stock
  const { data: updatedStock, error } = await this.client
    .from('stock')
    .update({
      quantity: updateData.quantity ?? currentStock.quantity,
      min_stock: updateData.minStock ?? currentStock.min_stock,
      max_stock: updateData.maxStock ?? currentStock.max_stock,
      location: updateData.location ?? currentStock.location,
      next_restock_date: updateData.nextRestockDate,
      updated_at: new Date(),
    })
    .eq('product_id', productId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Créer mouvement si quantité changée
  if (updateData.quantity && updateData.quantity !== currentStock.quantity) {
    const movementType = updateData.quantity > currentStock.quantity ? 'IN' : 'OUT';
    const movementQty = Math.abs(updateData.quantity - currentStock.quantity);

    await this.createStockMovement({
      product_id: productId,
      type: movementType,
      quantity: movementQty,
      reason,
      user_id: userId,
    });
  }

  // Invalider cache
  await this.cacheService.del(`stock:dashboard:*`);
  await this.cacheService.del(`stock:${productId}`);

  return {
    success: true,
    data: updatedStock,
    message: 'Stock mis à jour avec succès',
  };
}
```

---

#### POST `/api/admin/stock/:productId/reserve`
Réserver du stock pour une commande.

**Body:**
```json
{
  "quantity": 2,
  "orderId": "order-uuid"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Stock réservé avec succès",
  "data": {
    "product_id": "product-uuid",
    "reserved": 7,
    "available": 43
  }
}
```

---

#### POST `/api/admin/stock/:productId/release`
Libérer du stock réservé (annulation commande).

**Response:** Identique à `/reserve`

---

#### POST `/api/admin/stock/:productId/disable`
Désactiver un produit (plus disponible à la vente).

**Body:**
```json
{
  "reason": "Produit obsolète - remplacé par ALT-002"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Produit désactivé avec succès"
}
```

---

#### GET `/api/admin/stock/:productId/movements`
Historique des mouvements de stock pour un produit.

**Query:** `limit` (number, default: 50)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "movements": [
      {
        "id": "movement-uuid",
        "product_id": "product-uuid",
        "type": "IN",
        "quantity": 50,
        "reason": "Réapprovisionnement fournisseur",
        "user_id": "admin-uuid",
        "created_at": "2025-11-15T10:30:00Z"
      },
      {
        "id": "movement-uuid-2",
        "type": "OUT",
        "quantity": 2,
        "reason": "Commande #12345",
        "order_id": "order-uuid",
        "user_id": "system",
        "created_at": "2025-11-14T15:20:00Z"
      }
    ],
    "total": 245
  }
}
```

---

#### GET `/api/admin/stock/alerts`
Alertes stock (ruptures, stocks faibles).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "outOfStock": [
      {
        "product_id": "product-uuid",
        "reference": "BRK-003",
        "name": "Plaquettes de frein",
        "available": 0,
        "reserved": 2
      }
    ],
    "lowStock": [
      {
        "product_id": "product-uuid-2",
        "reference": "FLT-012",
        "name": "Filtre à huile",
        "available": 3,
        "min_stock": 10
      }
    ],
    "counts": {
      "outOfStock": 3,
      "lowStock": 12
    }
  }
}
```

---

### 6.2 User Management (7 endpoints)

#### GET `/api/admin/users/stats`
Statistiques utilisateurs pour le dashboard.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "total": 12450,
    "active": 11230,
    "inactive": 1220,
    "professional": 340,
    "verified": 9870,
    "newThisMonth": 125,
    "byLevel": {
      "1": 8500,
      "2": 2340,
      "3": 980,
      "4": 450,
      "5": 180
    }
  },
  "timestamp": "2025-11-18T10:00:00Z"
}
```

---

#### GET `/api/admin/users`
Liste paginée des utilisateurs avec filtres.

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 25, max: 100)
- `search` (string) - Recherche email/nom
- `isActive` (boolean) - Filtrer actifs/inactifs
- `isPro` (boolean) - Filtrer professionnels
- `level` (number) - Filtrer par niveau

**Response 200:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user-uuid",
        "email": "client@example.com",
        "firstName": "Jean",
        "lastName": "Dupont",
        "phone": "+33612345678",
        "level": 2,
        "isActive": true,
        "isPro": false,
        "emailVerified": true,
        "createdAt": "2024-06-15T10:00:00Z",
        "lastLoginAt": "2025-11-17T14:30:00Z",
        "totalOrders": 12,
        "totalSpent": 2450.80
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 25,
      "total": 12450,
      "totalPages": 498
    }
  }
}
```

---

#### GET `/api/admin/users/:userId`
Détails complets d'un utilisateur.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "client@example.com",
    "firstName": "Jean",
    "lastName": "Dupont",
    "level": 2,
    "isActive": true,
    "isPro": false,
    "emailVerified": true,
    "createdAt": "2024-06-15T10:00:00Z",
    "lastLoginAt": "2025-11-17T14:30:00Z",
    "orders": {
      "total": 12,
      "completed": 11,
      "pending": 1,
      "totalSpent": 2450.80
    },
    "addresses": 2,
    "lastActivity": "2025-11-17T14:30:00Z"
  }
}
```

---

#### PATCH `/api/admin/users/:userId`
Mettre à jour un utilisateur (niveau, statut, etc.).

**Body:**
```json
{
  "level": 3,
  "isActive": true,
  "isPro": true,
  "emailVerified": true
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Utilisateur mis à jour avec succès",
  "timestamp": "2025-11-18T10:00:00Z"
}
```

**Code exemple:**
```typescript
// UserManagementService.updateUser()
async updateUser(userId: string, updates: Partial<AdminUser>) {
  const updateData: any = {};

  if (updates.level !== undefined) {
    updateData.cst_level = updates.level;
  }
  if (updates.isActive !== undefined) {
    updateData.cst_is_active = updates.isActive ? 'Y' : 'N';
  }
  if (updates.isPro !== undefined) {
    updateData.cst_is_pro = updates.isPro ? 'Y' : 'N';
  }
  if (updates.emailVerified !== undefined) {
    updateData.cst_email_verified = updates.emailVerified ? 'Y' : 'N';
  }

  const { error } = await this.client
    .from('___xtr_customer')
    .update(updateData)
    .eq('cst_id', userId);

  if (error) throw new Error(error.message);

  // Invalider cache utilisateur
  await this.cacheService.del(`user:${userId}`);
  await this.cacheService.del('admin:user-stats');

  return true;
}
```

---

#### DELETE `/api/admin/users/:userId/deactivate`
Désactiver un utilisateur.

**Body:**
```json
{
  "reason": "Comportement inapproprié"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Utilisateur désactivé avec succès"
}
```

---

#### PATCH `/api/admin/users/:userId/reactivate`
Réactiver un utilisateur désactivé.

**Response 200:**
```json
{
  "success": true,
  "message": "Utilisateur réactivé avec succès"
}
```

---

### 6.3 Products Admin (9 endpoints)

#### GET `/api/admin/products/dashboard`
Dashboard produits avec statistiques.

**Response 200:**
```json
{
  "success": true,
  "stats": {
    "totalProducts": 402345,
    "activeProducts": 398120,
    "inactiveProducts": 4225,
    "lastUpdate": "2025-11-18T10:00:00Z"
  }
}
```

---

#### GET `/api/admin/products`
Liste paginée des produits avec recherche.

**Query:** `page`, `limit`, `search`

**Response:** Liste produits avec pagination

---

#### GET `/api/admin/products/:id`
Détails d'un produit.

---

#### GET `/api/admin/products/stats/detailed`
Statistiques détaillées produits.

---

#### GET `/api/admin/products/brands`
Liste des marques.

---

#### GET `/api/admin/products/gammes`
Liste des gammes produits.

---

#### GET `/api/admin/products/search/advanced`
Recherche avancée multi-critères.

**Query:** `query`, `brand`, `category`, `minPrice`, `maxPrice`, `inStock`

---

#### GET `/api/admin/products/export`
Export des données produits.

**Query:** `format` (json|csv), `limit`

---

### 6.4 Reporting (5 endpoints)

#### GET `/api/admin/reports/analytics`
Rapport analytics global.

**Query:** `startDate`, `endDate`, `category`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 12450,
      "active": 11230,
      "professional": 340,
      "verified": 9870,
      "newThisMonth": 125
    },
    "orders": {
      "total": 45623,
      "completed": 43120,
      "pending": 1845,
      "cancelled": 658,
      "revenue": 1245678.90,
      "avgOrderValue": 28.87
    },
    "performance": {
      "conversionRate": 3.42,
      "activeUserRate": 90.2,
      "verificationRate": 79.3,
      "completionRate": 94.5
    },
    "trends": {
      "usersThisMonth": 125,
      "ordersThisMonth": 2340,
      "revenueThisMonth": 67890.50,
      "growthRate": 8.5
    }
  },
  "timestamp": "2025-11-18T10:00:00Z"
}
```

**Performance:** Cache 5 minutes, génération: p50 <300ms, p95 <800ms

---

#### POST `/api/admin/reports/generate`
Générer un rapport spécialisé.

**Body:**
```json
{
  "type": "orders",
  "filters": {
    "startDate": "2025-11-01",
    "endDate": "2025-11-30",
    "format": "csv"
  }
}
```

---

#### GET `/api/admin/reports/list`
Liste des rapports générés disponibles.

---

#### GET `/api/admin/reports/:reportId/download`
Télécharger un rapport généré.

---

#### DELETE `/api/admin/reports/:reportId`
Supprimer un rapport.

---

### 6.5 Configuration & SEO (5 endpoints)

#### GET `/api/admin/configuration`
Configuration système globale.

---

#### PUT `/api/admin/configuration`
Mettre à jour la configuration.

---

#### GET `/api/admin/seo/stats`
Statistiques SEO (pages indexées).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "total": 714234,
    "byType": {
      "gammes": 450,
      "families": 19,
      "products": 402345,
      "vehicles": 312000,
      "blog": 86
    },
    "lastUpdate": "2025-11-18T08:00:00Z"
  }
}
```

---

#### GET `/api/admin/staff`
Liste du personnel admin.

---

#### GET `/api/admin/dashboard`
Dashboard principal admin.

**Response 200:**
```json
{
  "timestamp": "2025-11-18T10:00:00Z",
  "stock": {
    "totalProducts": 50,
    "totalValue": 15000,
    "alertCount": 3
  },
  "summary": {
    "totalProducts": 50,
    "totalValue": 15000,
    "alertCount": 3,
    "status": "active"
  }
}
```

---

## 7. Sécurité

### Authentification & Autorisation

#### 1. Guards NestJS
```typescript
// AuthenticatedGuard - Vérifier session active
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return request.isAuthenticated() && !!request.user;
  }
}

// IsAdminGuard - Vérifier niveau admin ≥ 7
@Injectable()
export class IsAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // Vérifier niveau admin (staff level ≥ 7 ou customer level ≥ 8)
    const isAdmin = user?.level >= 7 || user?.isAdmin === true;
    
    if (!isAdmin) {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }
    
    return true;
  }
}
```

#### 2. Application des guards
```typescript
@Controller('api/admin')
@UseGuards(AuthenticatedGuard, IsAdminGuard)  // Appliqué à toutes les routes
export class AdminController {
  // Toutes les méthodes protégées automatiquement
}
```

### Niveaux d'autorisation

| Niveau | Rôle | Accès |
|--------|------|-------|
| 1-6 | Customer standard | ❌ Aucun accès admin |
| 7 | Admin junior | ✅ Lecture seule dashboard |
| 8 | Admin | ✅ Gestion stocks, users, produits |
| 9 | Super admin | ✅ + Configuration système, rapports |
| 10 | Root admin | ✅ Tous les droits |

### Logging des actions

```typescript
// Exemple: UserManagementController.updateUser()
@Patch('/:userId')
async updateUser(
  @Param('userId') userId: string,
  @Body() updates: any,
  @User() admin: any,
) {
  this.logger.log(
    `✏️ Admin ${admin.cst_id} (${admin.email}) met à jour utilisateur ${userId}`,
    { updates }
  );
  
  const success = await this.userManagementService.updateUser(userId, updates);
  
  // Log audit
  await this.auditLogService.log({
    action: 'USER_UPDATE',
    adminId: admin.cst_id,
    targetUserId: userId,
    changes: updates,
    timestamp: new Date(),
    ipAddress: req.ip,
  });
  
  return { success, message: 'Utilisateur mis à jour avec succès' };
}
```

### Protection CSRF

```typescript
// app.module.ts
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',  // Protection CSRF
      maxAge: 24 * 60 * 60 * 1000,  // 24h
    },
  })
);
```

### Validation des entrées

```typescript
// dto/stock.dto.ts
import { z } from 'zod';

export const UpdateStockSchema = z.object({
  quantity: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
  maxStock: z.number().int().min(0).optional(),
  location: z.string().max(100).optional(),
  nextRestockDate: z.string().datetime().optional(),
  reason: z.string().min(5).max(500),
});

export type UpdateStockDto = z.infer<typeof UpdateStockSchema>;
```

### Rate Limiting

```typescript
// Limiter les requêtes admin
@Controller('api/admin')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@UseInterceptors(RateLimitInterceptor)  // 100 req/min par admin
export class AdminController {
  // ...
}
```

---

## 8. Performance

### Objectifs de performance

| Endpoint | p50 | p95 | p99 | Cache TTL |
|----------|-----|-----|-----|-----------|
| Stock dashboard | <150ms | <400ms | <800ms | 60s |
| User stats | <100ms | <250ms | <500ms | 300s |
| Analytics report | <300ms | <800ms | <1500ms | 300s |
| Product search | <200ms | <500ms | <1000ms | 180s |
| Stock update | <250ms | <600ms | <1200ms | N/A (mutation) |

### Stratégies de cache

#### 1. Cache Redis avec TTL adaptatif
```typescript
// StockManagementService.getStockDashboard()
async getStockDashboard(filters?: StockDashboardFilters) {
  const cacheKey = `stock:dashboard:${JSON.stringify(filters || {})}`;
  
  // Vérifier cache (60s TTL)
  const cached = await this.cacheService.get(cacheKey);
  if (cached) {
    this.logger.debug('Dashboard stock depuis cache');
    return cached;
  }
  
  // Query database
  const result = await this.fetchStockDashboard(filters);
  
  // Cache 60s (stocks changent fréquemment)
  await this.cacheService.set(cacheKey, result, 60);
  
  return result;
}
```

#### 2. Invalidation sélective du cache
```typescript
// Après mutation stock
async updateStock(productId: string, updateData: any) {
  // ... mise à jour ...
  
  // Invalider caches concernés
  await this.cacheService.del(`stock:dashboard:*`);
  await this.cacheService.del(`stock:${productId}`);
  await this.cacheService.del(`stock:alerts`);
  
  return result;
}
```

#### 3. Cache analytics long (5 minutes)
```typescript
// ReportingService.generateAnalyticsReport()
const cacheKey = 'admin:analytics-report';
const cached = await this.cacheService.get<ReportData>(cacheKey);

if (cached) {
  this.logger.log('Rapport analytics depuis cache');
  return cached;
}

const reportData = await this.generateReport();

// Cache 5 minutes (analytics moins critiques)
await this.cacheService.set(cacheKey, reportData, 300);
```

### Optimisations SQL

#### 1. Index stratégiques
```sql
-- Stock lookups
CREATE INDEX idx_stock_product ON stock(product_id);
CREATE INDEX idx_stock_available ON stock(available);
CREATE INDEX idx_stock_low ON stock(available) WHERE available <= min_stock;

-- Movements history
CREATE INDEX idx_movements_product ON stock_movements(product_id, created_at DESC);
CREATE INDEX idx_movements_order ON stock_movements(order_id);

-- Users admin queries
CREATE INDEX idx_customer_level ON ___xtr_customer(cst_level);
CREATE INDEX idx_customer_active ON ___xtr_customer(cst_is_active);
CREATE INDEX idx_customer_email ON ___xtr_customer(cst_email);
```

#### 2. Requêtes optimisées avec select spécifique
```typescript
// Éviter SELECT *
const { data } = await this.client
  .from('___xtr_customer')
  .select('cst_id, cst_email, cst_firstname, cst_lastname, cst_level, cst_is_active')
  .eq('cst_is_active', 'Y')
  .order('cst_created_at', { ascending: false })
  .limit(25);
```

#### 3. Pagination efficace
```typescript
// UserManagementService.getUsers()
const offset = (filters.page - 1) * filters.limit;

const { data, count } = await this.client
  .from('___xtr_customer')
  .select('*', { count: 'exact' })
  .range(offset, offset + filters.limit - 1)
  .order('cst_created_at', { ascending: false });

return {
  users: data,
  pagination: {
    page: filters.page,
    limit: filters.limit,
    total: count,
    totalPages: Math.ceil(count / filters.limit),
  },
};
```

### Monitoring

```typescript
// Performance logging
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const request = context.switchToHttp().getRequest();
    
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        const route = request.route.path;
        
        // Log si > 1000ms
        if (duration > 1000) {
          logger.warn(`Slow request: ${route} - ${duration}ms`);
        }
        
        // Métriques Prometheus
        httpRequestDuration.labels(route, request.method).observe(duration);
      })
    );
  }
}
```

---

## 9. Tests

### Tests unitaires (Services)

```typescript
// admin/services/stock-management.service.spec.ts
describe('StockManagementService', () => {
  let service: StockManagementService;
  let cacheService: CacheService;
  let supabaseClient: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockManagementService,
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StockManagementService>(StockManagementService);
    cacheService = module.get<CacheService>(CacheService);
  });

  describe('getStockDashboard', () => {
    it('devrait retourner le dashboard depuis le cache si disponible', async () => {
      const mockDashboard = {
        success: true,
        data: { items: [], stats: {}, totalItems: 0 },
      };

      jest.spyOn(cacheService, 'get').mockResolvedValue(mockDashboard);

      const result = await service.getStockDashboard();

      expect(result).toEqual(mockDashboard);
      expect(cacheService.get).toHaveBeenCalledWith(
        expect.stringContaining('stock:dashboard:')
      );
    });

    it('devrait filtrer les stocks faibles correctement', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);

      // Mock Supabase response
      const mockStockItems = [
        { available: 5, min_stock: 10 },  // Low stock
        { available: 50, min_stock: 10 }, // OK
      ];

      const result = await service.getStockDashboard({ minStock: true });

      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].available).toBeLessThanOrEqual(10);
    });
  });

  describe('updateStock', () => {
    it('devrait créer un mouvement IN si quantité augmente', async () => {
      const productId = 'product-123';
      const updateData = { quantity: 100 };
      const userId = 'admin-456';
      const reason = 'Réapprovisionnement';

      // Mock current stock
      const currentStock = { quantity: 50, reserved: 5 };

      const result = await service.updateStock(
        productId,
        updateData,
        userId,
        reason
      );

      expect(result.success).toBe(true);
      expect(result.data.movement.type).toBe('IN');
      expect(result.data.movement.quantity).toBe(50); // 100 - 50
    });

    it('devrait invalider le cache après mise à jour', async () => {
      jest.spyOn(cacheService, 'del');

      await service.updateStock('product-123', { quantity: 100 }, 'admin', 'test');

      expect(cacheService.del).toHaveBeenCalledWith('stock:dashboard:*');
      expect(cacheService.del).toHaveBeenCalledWith('stock:product-123');
    });
  });

  describe('reserveStock', () => {
    it('devrait réserver du stock si disponible', async () => {
      const productId = 'product-123';
      const quantity = 5;
      const orderId = 'order-789';

      // Mock stock avec quantité suffisante
      const mockStock = { quantity: 50, reserved: 10, available: 40 };

      const result = await service.reserveStock(productId, quantity, orderId);

      expect(result.success).toBe(true);
      expect(result.data.reserved).toBe(15); // 10 + 5
      expect(result.data.available).toBe(35); // 40 - 5
    });

    it('devrait échouer si stock insuffisant', async () => {
      const productId = 'product-123';
      const quantity = 50;
      const orderId = 'order-789';

      // Mock stock insuffisant
      const mockStock = { quantity: 50, reserved: 40, available: 10 };

      await expect(
        service.reserveStock(productId, quantity, orderId)
      ).rejects.toThrow('Stock insuffisant');
    });
  });
});
```

### Tests d'intégration (Controllers)

```typescript
// admin/controllers/stock.controller.spec.ts
describe('StockController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AdminModule, DatabaseModule, CacheModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Authentification admin
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'AdminPass123!',
      });

    authToken = loginRes.body.accessToken;
  });

  describe('GET /api/admin/stock/dashboard', () => {
    it('devrait retourner le dashboard pour un admin authentifié', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/stock/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('stats');
      expect(response.body.data.stats).toHaveProperty('totalProducts');
    });

    it('devrait refuser l\'accès sans authentification', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/stock/dashboard')
        .expect(401);
    });

    it('devrait filtrer les stocks faibles', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/stock/dashboard?minStock=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach((item: any) => {
        expect(item.available).toBeLessThanOrEqual(item.min_stock);
      });
    });
  });

  describe('PUT /api/admin/stock/:productId', () => {
    it('devrait mettre à jour le stock avec succès', async () => {
      const productId = 'test-product-id';
      const updateData = {
        quantity: 100,
        minStock: 15,
        reason: 'Test réapprovisionnement',
      };

      const response = await request(app.getHttpServer())
        .put(`/api/admin/stock/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.quantity).toBe(100);
      expect(response.body.data.movement).toBeDefined();
    });

    it('devrait valider les données d\'entrée', async () => {
      const productId = 'test-product-id';
      const invalidData = {
        quantity: -10,  // Invalid: negative
      };

      await request(app.getHttpServer())
        .put(`/api/admin/stock/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

### Tests de charge (k6)

```javascript
// tests/load/admin-stock-dashboard.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up
    { duration: '3m', target: 10 },   // Stable
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95% < 500ms, 99% < 1s
    http_req_failed: ['rate<0.01'],  // < 1% errors
  },
};

export default function () {
  const token = 'admin-test-token';
  
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  // Test dashboard stock
  let dashboard = http.get(
    'http://localhost:3000/api/admin/stock/dashboard',
    params
  );

  check(dashboard, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has items': (r) => JSON.parse(r.body).data.items.length > 0,
  });

  sleep(1);
}
```

**Commande:** `k6 run tests/load/admin-stock-dashboard.js`

---

## 10. Dépendances

### Modules NestJS internes

```typescript
// admin.module.ts
@Module({
  imports: [
    DatabaseModule,       // Supabase client
    CacheModule,          // Redis cache
    OrdersModule,         // Stats commandes
    StaffModule,          // Gestion staff
    ProductsModule,       // Gestion produits
    WorkerModule,         // SEO monitoring scheduler
  ],
  // ...
})
```

### Packages npm

```json
{
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/swagger": "^7.1.17",
    "@supabase/supabase-js": "^2.39.0",
    "cache-manager": "^5.3.2",
    "cache-manager-redis-store": "^3.0.1",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@nestjs/testing": "^10.3.0",
    "jest": "^29.7.0",
    "supertest": "^6.3.3"
  }
}
```

### Services externes

- **Supabase PostgreSQL** : Base de données principale
- **Redis** : Cache distribué (port 6379)
- **Sentry** : Monitoring erreurs (optionnel)
- **Prometheus** : Métriques performance (optionnel)

### Variables d'environnement

```bash
# .env
DATABASE_URL=postgresql://user:pass@localhost:5432/db
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=xxx
REDIS_URL=redis://localhost:6379
SESSION_SECRET=xxx
NODE_ENV=production
```

---

## 11. Critères d'acceptation

### Fonctionnels
- ✅ **Stock dashboard** affiche stocks disponibles, réservés, alertes en temps réel
- ✅ **Mise à jour stock** crée mouvement historique + invalide cache
- ✅ **Réservation stock** vérifie disponibilité avant de réserver
- ✅ **Gestion utilisateurs** permet filtrage, pagination, mise à jour niveau/statut
- ✅ **Statistiques utilisateurs** affiche métriques précises (total, actifs, pro, nouveaux)
- ✅ **Rapports analytics** génère données agrégées (users, orders, revenue, trends)
- ✅ **Recherche produits** supporte multi-critères (nom, marque, catégorie, prix, stock)
- ✅ **Export données** génère fichiers JSON/CSV avec limite 10k lignes
- ✅ **Monitoring SEO** affiche 714k pages indexées par type

### Non-fonctionnels
- ✅ **Performance** : 95% requêtes < 500ms pour dashboard, < 800ms pour rapports
- ✅ **Cache** : Taux de hit > 70% pour dashboards fréquemment consultés
- ✅ **Sécurité** : 
  - Toutes routes protégées par `AuthenticatedGuard` + `IsAdminGuard`
  - Niveau admin ≥ 7 requis
  - CSRF protection active
  - Logging complet des actions admin
- ✅ **Disponibilité** : Uptime > 99.5%
- ✅ **Tests** :
  - Couverture > 80% pour services critiques
  - Tests e2e pour tous les endpoints principaux
  - Tests de charge validés (10 utilisateurs simultanés, p95 < 500ms)
- ✅ **Monitoring** :
  - Health check `/api/admin/health` répond en < 100ms
  - Alertes Sentry configurées pour erreurs critiques
  - Logs structurés pour audit trail

### Critères de qualité
- ✅ **Documentation Swagger** complète pour tous les endpoints
- ✅ **DTOs avec validation Zod** pour toutes les entrées
- ✅ **Gestion d'erreurs cohérente** avec messages explicites
- ✅ **Code TypeScript strict** (no-any, strict null checks)
- ✅ **Architecture modulaire** avec séparation controllers/services
- ✅ **Invalidation cache intelligente** sur mutations

---

## 12. Déploiement

### Build production

```bash
# Backend
cd backend
npm run build
npm run start:prod

# Variables d'environnement requises
DATABASE_URL=xxx
SUPABASE_URL=xxx
SUPABASE_KEY=xxx
REDIS_URL=xxx
SESSION_SECRET=xxx
NODE_ENV=production
```

### Docker

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

```yaml
# docker-compose.yml
services:
  backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
```

### Health checks

```typescript
// admin.controller.ts
@Get('health')
async getHealth() {
  try {
    const stockHealth = await this.stockService.healthCheck();
    const cacheHealth = await this.cacheService.ping();
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        stock: stockHealth,
        cache: cacheHealth,
      },
      version: '1.0.0',
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}
```

### Monitoring production

```typescript
// Sentry integration
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// Logger personnalisé
export class ProductionLogger implements LoggerService {
  log(message: string, context?: string) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      context,
      timestamp: new Date().toISOString(),
    }));
  }

  error(message: string, trace?: string, context?: string) {
    console.error(JSON.stringify({
      level: 'error',
      message,
      trace,
      context,
      timestamp: new Date().toISOString(),
    }));
    
    Sentry.captureException(new Error(message));
  }
}
```

---

## 13. Documentation associée

- [API Products Module](./products.md) - Gestion produits (référencé par AdminProductsController)
- [API Orders Module](./orders.md) - Gestion commandes (stats pour analytics)
- [API Customers Module](./customers.md) - Gestion clients (référencé par UserManagement)
- [Staff Module](../staff/README.md) - Personnel admin
- [Dashboard Module](./dashboard-module.md) - Dashboard KPIs (utilise admin data)
- [Catalog Module](./catalog-module.md) - Catalogue produits
- [Authentication Guide](../../AUTH-GUIDE.md) - Guards et RBAC
- [Cache Strategy](../../CACHE-STRATEGY.md) - Stratégies cache Redis

---

## 14. Problèmes connus

### 1. Export CSV limité à 10k lignes
**Impact:** Moyen  
**Workaround:** Utiliser filtres pour réduire le dataset ou export par batch

```typescript
// Limitation actuelle
const limit = Math.min(parseInt(limit.toString()), 10000);
```

### 2. Statistiques analytics non temps réel
**Impact:** Faible  
**Cache:** 5 minutes  
**Workaround:** Endpoint `/reports/analytics?refresh=true` force recalcul

### 3. Mouvements stock anciens non paginés
**Impact:** Faible  
**Limite:** 50 mouvements max par défaut  
**Workaround:** Utiliser `limit` query param

### 4. Recherche produits sans full-text search
**Impact:** Moyen  
**Actuel:** Simple LIKE query  
**Amélioration future:** Intégrer Meilisearch pour recherche avancée

---

## 15. Améliorations futures

### Phase 2 - Q1 2026
- [ ] **Dashboard temps réel** : WebSockets pour updates stock live
- [ ] **Permissions granulaires** : RBAC par ressource (read/write/delete)
- [ ] **Audit log complet** : Table dédiée avec historique actions admin
- [ ] **Export avancé** : Support PDF, Excel, génération asynchrone
- [ ] **Notifications admin** : Alertes email/SMS pour stocks critiques

### Phase 3 - Q2 2026
- [ ] **Analytics avancés** : Graphiques, trends, prédictions stock
- [ ] **Recherche Meilisearch** : Full-text search produits/users
- [ ] **Bulk operations** : Actions groupées (activation, mise à jour niveau)
- [ ] **API Gateway** : Rate limiting intelligent par niveau admin
- [ ] **Mobile admin app** : Application React Native pour gestion mobile

### Optimisations techniques
- [ ] **Query optimization** : Materialized views pour stats fréquentes
- [ ] **Cache warming** : Pré-cache dashboard au démarrage
- [ ] **Read replicas** : Séparation lectures/écritures Supabase
- [ ] **GraphQL API** : Alternative REST pour queries complexes
- [ ] **Event sourcing** : Historique complet changements stock

---

**Dernière mise à jour:** 2025-11-18  
**Version:** 1.0.0  
**Auteur:** Équipe Backend  
**Statut:** ✅ Production

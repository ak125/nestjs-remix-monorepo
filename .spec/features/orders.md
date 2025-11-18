---
title: "Orders Module - Backend CRUD & Workflow Management"
status: implemented
version: 3.0.0
authors: [Backend Team]
created: 2025-11-18
updated: 2025-11-18
relates-to:
  - ./order-management.md
  - ./payment-cart-system.md
  - ./shipping-management.md
  - ../architecture/001-supabase-direct.md
tags: [orders, workflow, business-logic, sav, tickets, consolidated, critical]
priority: critical
coverage:
  modules: [orders]
  routes: [/api/orders/*, /order-status/*, /order-archive/*, /api/tickets/*, /api/admin/orders/*]
  services: [OrdersService, OrderCalculationService, OrderStatusService, OrderArchiveService, TicketsService, OrderActionsService]
---

# Orders Module - Backend CRUD & Workflow Management

## 📝 Overview

Module backend **consolidé** (Phase 2 & 3 achevées) gérant le cycle de vie complet des commandes : création, workflow statuts, calculs, archivage, SAV (tickets), et actions backoffice. Architecture modulaire avec **6 services spécialisés** et **5 controllers** optimisés.

**Consolidation réalisée** :
- **Phase 2** : Services 8 → 6 (-25%), doublons éliminés -66%
- **Phase 3** : Controllers 10 → 5 (-50%), routes unifiées `/api/orders/*`

**Volume actuel** :
- **1,440 commandes** actives
- **51,509 €** de chiffre d'affaires total
- **35,76 €** panier moyen
- **50-100 commandes/jour** en moyenne

**Tables gérées** :
- `commandes` (table principale)
- `commandes_lignes` (lignes produits)
- `commandes_status_history` (historique transitions)
- `tickets` (SAV/réclamations)

## 🎯 Goals

### Objectifs Principaux

1. **Workflow automatisé** : PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
2. **CRUD performant** : Création < 500ms, lecture < 200ms
3. **Calculs précis** : Total TTC, frais port, remises, TVA
4. **Traçabilité complète** : Historique changements + audit logs
5. **SAV efficace** : Gestion tickets réclamations/retours
6. **Admin-friendly** : Actions massives, filtres multi-critères, exports

### Objectifs Secondaires

- Notifications email automatiques à chaque transition statut
- Intégration stock (réservation/libération quantités)
- Intégration shipping (tracking transporteur)
- Archivage légal 10 ans
- Exports comptables (CSV/Excel)

## 🚫 Non-Goals

- **Payment processing** : Délégué au module `payments`
- **Cart management** : Module `cart` séparé
- **Product catalog** : Module `products` séparé
- **Invoicing** : Module `invoicing` dédié (PDF generation)
- **Shipping logistics** : Module `shipping` séparé

## 🏗️ Architecture

### Services Consolidés (6)

```typescript
OrdersModule
├── OrdersService                    // CRUD principal, queries DB
├── OrderCalculationService          // Calculs totaux, TVA, frais
├── OrderStatusService               // Workflow transitions statuts
├── OrderArchiveService              // Archivage légal 10 ans
├── TicketsService                   // SAV (réclamations, retours)
└── OrderActionsService              // Actions backoffice massives
```

### Controllers Consolidés (5)

```typescript
├── OrdersController               // /api/orders/* - CRUD client + admin
├── OrderStatusController          // /order-status/* - Workflow transitions
├── OrderArchiveController         // /order-archive/* - Archivage
├── TicketsController              // /api/tickets/* - SAV
└── OrderActionsController         // /api/admin/orders/* - Actions backoffice
```

### DTOs Zod Validés

```typescript
CreateOrderDto         // Création commande (userId, items, shipping, etc.)
UpdateOrderDto         // Mise à jour partielle
ChangeStatusDto        // Transition statut (newStatus, comment, userId)
OrderFilters           // Filtres admin (status, dateFrom, dateTo, userId, etc.)
CreateTicketDto        // Création ticket SAV
UpdateTicketDto        // Mise à jour ticket
```

## 📊 Data Model

### Table `commandes` (PostgreSQL - Supabase)

```sql
CREATE TABLE commandes (
  commande_id             SERIAL PRIMARY KEY,
  commande_ref            VARCHAR(50) UNIQUE NOT NULL,         -- Ex: ORD-2025-001
  user_id                 INTEGER REFERENCES users(user_id),
  
  -- Statuts
  commande_status         VARCHAR(50) DEFAULT 'PENDING',       -- Workflow principal
  commande_payment_status VARCHAR(50) DEFAULT 'UNPAID',        -- UNPAID/PENDING/PAID/REFUNDED
  
  -- Montants
  commande_subtotal       DECIMAL(10,2) NOT NULL,              -- Sous-total HT
  commande_shipping       DECIMAL(10,2) DEFAULT 0,             -- Frais port
  commande_tax            DECIMAL(10,2) DEFAULT 0,             -- TVA
  commande_discount       DECIMAL(10,2) DEFAULT 0,             -- Remises
  commande_total          DECIMAL(10,2) NOT NULL,              -- Total TTC
  
  -- Livraison
  shipping_method         VARCHAR(50),                         -- STANDARD/EXPRESS/PICKUP
  shipping_address        JSONB,                               -- Adresse complète
  shipping_tracking       VARCHAR(100),                        -- Numéro tracking
  shipping_carrier        VARCHAR(100),                        -- Nom transporteur
  
  -- Paiement
  payment_method          VARCHAR(50),                         -- CARD/PAYPAL/WIRE_TRANSFER
  payment_transaction_id  VARCHAR(100),                        -- ID transaction Paybox
  
  -- Métadonnées
  commande_notes          TEXT,                                -- Consignes client
  commande_created_at     TIMESTAMP DEFAULT NOW(),
  commande_updated_at     TIMESTAMP DEFAULT NOW(),
  commande_delivered_at   TIMESTAMP,                           -- Date livraison effective
  
  -- Indexes performances
  INDEX idx_commandes_user (user_id),
  INDEX idx_commandes_status (commande_status),
  INDEX idx_commandes_ref (commande_ref),
  INDEX idx_commandes_created (commande_created_at)
);
```

### Table `commandes_lignes` (Lignes produits)

```sql
CREATE TABLE commandes_lignes (
  ligne_id           SERIAL PRIMARY KEY,
  commande_id        INTEGER REFERENCES commandes(commande_id) ON DELETE CASCADE,
  piece_id           INTEGER REFERENCES pieces(piece_id),
  
  -- Données figées (snapshot au moment commande)
  ligne_quantity     INTEGER NOT NULL DEFAULT 1,
  ligne_price_unit   DECIMAL(10,2) NOT NULL,                   -- Prix unitaire HT
  ligne_price_total  DECIMAL(10,2) NOT NULL,                   -- Quantité × Prix unitaire
  ligne_tax_rate     DECIMAL(5,2) DEFAULT 20.0,                -- Taux TVA (%)
  ligne_tax_amount   DECIMAL(10,2) DEFAULT 0,                  -- Montant TVA
  
  -- Métadonnées produit (dénormalisé pour historique)
  piece_name         VARCHAR(255),
  piece_ref          VARCHAR(100),
  piece_image        VARCHAR(500),
  
  INDEX idx_lignes_commande (commande_id),
  INDEX idx_lignes_piece (piece_id)
);
```

### Table `commandes_status_history` (Historique)

```sql
CREATE TABLE commandes_status_history (
  history_id          SERIAL PRIMARY KEY,
  commande_id         INTEGER REFERENCES commandes(commande_id) ON DELETE CASCADE,
  
  status_from         VARCHAR(50) NOT NULL,
  status_to           VARCHAR(50) NOT NULL,
  changed_by_user_id  INTEGER REFERENCES users(user_id),
  change_reason       TEXT,
  change_timestamp    TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_history_commande (commande_id),
  INDEX idx_history_timestamp (change_timestamp)
);
```

### Table `tickets` (SAV)

```sql
CREATE TABLE tickets (
  ticket_id           SERIAL PRIMARY KEY,
  ticket_ref          VARCHAR(50) UNIQUE NOT NULL,             -- Ex: TKT-2025-001
  commande_id         INTEGER REFERENCES commandes(commande_id),
  user_id             INTEGER REFERENCES users(user_id),
  
  ticket_type         VARCHAR(50) NOT NULL,                    -- COMPLAINT/RETURN/QUESTION
  ticket_status       VARCHAR(50) DEFAULT 'OPEN',              -- OPEN/IN_PROGRESS/RESOLVED/CLOSED
  ticket_subject      VARCHAR(255) NOT NULL,
  ticket_description  TEXT NOT NULL,
  ticket_priority     VARCHAR(50) DEFAULT 'NORMAL',            -- LOW/NORMAL/HIGH/URGENT
  
  assigned_to_user_id INTEGER REFERENCES users(user_id),
  
  ticket_created_at   TIMESTAMP DEFAULT NOW(),
  ticket_updated_at   TIMESTAMP DEFAULT NOW(),
  ticket_closed_at    TIMESTAMP,
  
  INDEX idx_tickets_commande (commande_id),
  INDEX idx_tickets_user (user_id),
  INDEX idx_tickets_status (ticket_status)
);
```

## 🔄 Workflow Statuts

### Cycle de Vie Commande

```
PENDING (En attente validation)
  ↓ Admin validation
CONFIRMED (Validée, paiement reçu)
  ↓ Début préparation
PROCESSING (En préparation)
  ↓ Expédition
SHIPPED (Expédiée, en transit)
  ↓ Réception client
DELIVERED (Livrée)

CANCELLED (Annulée) ← Possible depuis n'importe quel statut
```

### Transitions Autorisées

| From | To | Trigger | Permissions |
|------|-----|---------|-------------|
| PENDING | CONFIRMED | Admin validation | Admin level 8+ |
| PENDING | CANCELLED | Annulation admin/client | Admin level 8+ OU user propriétaire |
| CONFIRMED | PROCESSING | Début préparation | Admin level 8+ |
| CONFIRMED | CANCELLED | Annulation | Admin level 8+ |
| PROCESSING | SHIPPED | Expédition + tracking | Admin level 8+ |
| PROCESSING | CANCELLED | Annulation exceptionnelle | Admin level 9+ |
| SHIPPED | DELIVERED | Confirmation livraison | Admin level 8+ OU automatique |
| SHIPPED | CANCELLED | Annulation impossible (retour via SAV) | N/A |
| DELIVERED | N/A | État final | N/A |

### Notifications Email Automatiques

| Transition | Destinataire | Template |
|------------|--------------|----------|
| ANY → PENDING | Client | `order-created.html` |
| PENDING → CONFIRMED | Client | `order-confirmed.html` |
| CONFIRMED → PROCESSING | Client | `order-processing.html` |
| PROCESSING → SHIPPED | Client | `order-shipped.html` (avec tracking) |
| SHIPPED → DELIVERED | Client | `order-delivered.html` |
| ANY → CANCELLED | Client | `order-cancelled.html` (avec raison) |

## 🔌 API Endpoints

### OrdersController (`/api/orders`)

#### 1. POST `/api/orders` - Créer commande

**Access:** Authenticated user

**Body (Zod validated):**
```json
{
  "userId": 12345,
  "items": [
    {
      "pieceId": 789,
      "quantity": 2,
      "priceUnit": 45.99
    }
  ],
  "shippingMethod": "STANDARD",
  "shippingAddress": {
    "street": "123 Rue de la Paix",
    "city": "Paris",
    "postalCode": "75001",
    "country": "FR"
  },
  "paymentMethod": "CARD",
  "paymentTransactionId": "PAYBOX-ABC123",
  "notes": "Livrer après 18h"
}
```

**Response:**
```json
{
  "commandeId": 456,
  "commandeRef": "ORD-2025-001",
  "status": "PENDING",
  "total": 245.50,
  "message": "Commande créée avec succès"
}
```

**Logique:**
1. Valider items (produits existent, stock disponible)
2. Calculer totaux (sous-total, TVA, frais port, remises)
3. Créer ligne `commandes`
4. Créer lignes `commandes_lignes` pour chaque item
5. Réserver stock (appel `StockService.reserve()`)
6. Envoyer email confirmation
7. Créer historique initial (NULL → PENDING)

**Erreurs:**
- 400 : Validation failed (items vides, prix invalide)
- 404 : Produit inexistant
- 409 : Stock insuffisant
- 500 : Database error

---

#### 2. GET `/api/orders` - Liste commandes (Client ou Admin)

**Access:** Authenticated user

**Query Params:**
```typescript
{
  userId?: number;          // Si fourni, filtre par utilisateur
  status?: string;          // PENDING/CONFIRMED/PROCESSING/SHIPPED/DELIVERED/CANCELLED
  dateFrom?: string;        // ISO date (YYYY-MM-DD)
  dateTo?: string;          // ISO date
  page?: number;            // Défaut: 1
  limit?: number;           // Défaut: 20, max: 100
  sortBy?: string;          // created_at|updated_at|total
  sortOrder?: 'asc'|'desc'; // Défaut: desc
}
```

**Response:**
```json
{
  "orders": [
    {
      "commandeId": 456,
      "commandeRef": "ORD-2025-001",
      "userId": 12345,
      "status": "PROCESSING",
      "paymentStatus": "PAID",
      "subtotal": 200.00,
      "shipping": 10.00,
      "tax": 35.50,
      "total": 245.50,
      "shippingMethod": "STANDARD",
      "createdAt": "2025-01-14T10:00:00Z",
      "updatedAt": "2025-01-14T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 1440,
    "page": 1,
    "limit": 20,
    "totalPages": 72
  }
}
```

**Permissions:**
- Client : Voit uniquement ses commandes (`WHERE user_id = current_user.id`)
- Admin level 8+ : Voit toutes commandes, peut filtrer par userId

**Performance:** < 200ms (p95)

---

#### 3. GET `/api/orders/:id` - Détail commande

**Access:** Authenticated user (propriétaire OU admin)

**Response:**
```json
{
  "commandeId": 456,
  "commandeRef": "ORD-2025-001",
  "userId": 12345,
  "status": "PROCESSING",
  "paymentStatus": "PAID",
  
  "items": [
    {
      "ligneId": 789,
      "pieceId": 123,
      "pieceName": "Plaquettes de frein",
      "pieceRef": "FDB1234",
      "quantity": 2,
      "priceUnit": 45.99,
      "priceTotal": 91.98,
      "taxRate": 20.0,
      "taxAmount": 15.33
    }
  ],
  
  "subtotal": 200.00,
  "shipping": 10.00,
  "tax": 35.50,
  "discount": 0.00,
  "total": 245.50,
  
  "shippingMethod": "STANDARD",
  "shippingAddress": {
    "street": "123 Rue de la Paix",
    "city": "Paris",
    "postalCode": "75001",
    "country": "FR"
  },
  "shippingTracking": "FR1234567890",
  "shippingCarrier": "Colissimo",
  
  "paymentMethod": "CARD",
  "paymentTransactionId": "PAYBOX-ABC123",
  
  "notes": "Livrer après 18h",
  "createdAt": "2025-01-14T10:00:00Z",
  "updatedAt": "2025-01-14T10:30:00Z",
  "deliveredAt": null,
  
  "statusHistory": [
    {
      "statusFrom": null,
      "statusTo": "PENDING",
      "changedByUserId": 12345,
      "changeReason": "Commande créée",
      "changeTimestamp": "2025-01-14T10:00:00Z"
    },
    {
      "statusFrom": "PENDING",
      "statusTo": "CONFIRMED",
      "changedByUserId": 99,
      "changeReason": "Validation admin",
      "changeTimestamp": "2025-01-14T10:15:00Z"
    }
  ]
}
```

**Performance:** < 150ms (p95)

---

#### 4. PUT `/api/orders/:id` - Mettre à jour commande

**Access:** Admin level 8+

**Body (partial):**
```json
{
  "shippingTracking": "FR1234567890",
  "shippingCarrier": "Colissimo",
  "notes": "Note admin ajoutée"
}
```

**Response:**
```json
{
  "commandeId": 456,
  "message": "Commande mise à jour"
}
```

**Restrictions:**
- Ne peut pas modifier `userId`, `items`, `total` (données figées)
- Peut modifier métadonnées : tracking, carrier, notes

---

#### 5. DELETE `/api/orders/:id` - Supprimer commande

**Access:** Admin level 9+ uniquement

**Logique:** Soft delete (flag `deleted_at`)

**Response:**
```json
{
  "message": "Commande supprimée"
}
```

**Erreurs:**
- 403 : Permissions insuffisantes
- 409 : Commande déjà expédiée (statut SHIPPED/DELIVERED), utiliser annulation

---

### OrderStatusController (`/order-status`)

#### 6. POST `/order-status/change` - Changer statut

**Access:** Admin level 8+ OU client propriétaire (PENDING → CANCELLED uniquement)

**Body:**
```json
{
  "commandeId": 456,
  "newStatus": "CONFIRMED",
  "comment": "Paiement vérifié",
  "userId": 99
}
```

**Response:**
```json
{
  "success": true,
  "commandeId": 456,
  "oldStatus": "PENDING",
  "newStatus": "CONFIRMED",
  "message": "Statut changé avec succès"
}
```

**Validations:**
1. Vérifier transition autorisée (voir matrice transitions)
2. Vérifier permissions utilisateur
3. Si SHIPPED : numéro tracking obligatoire
4. Si CANCELLED : raison obligatoire

**Side-effects:**
- Envoyer email notification client
- Créer entrée `commandes_status_history`
- Si CONFIRMED : marquer `payment_status = PAID`
- Si CANCELLED : libérer stock réservé

**Erreurs:**
- 400 : Transition invalide
- 403 : Permissions insuffisantes
- 404 : Commande inexistante

---

#### 7. GET `/order-status/history/:commandeId` - Historique statuts

**Access:** Client propriétaire OU admin

**Response:**
```json
{
  "commandeId": 456,
  "history": [
    {
      "historyId": 1,
      "statusFrom": null,
      "statusTo": "PENDING",
      "changedByUserId": 12345,
      "changedByUsername": "Jean Dupont",
      "changeReason": "Commande créée",
      "changeTimestamp": "2025-01-14T10:00:00Z"
    }
  ]
}
```

---

### OrderArchiveController (`/order-archive`)

#### 8. POST `/order-archive/archive/:commandeId` - Archiver commande

**Access:** Admin level 9+

**Logique:**
- Déplacer commande vers table `commandes_archived`
- Conserver historique statuts
- Marquer `archived_at` timestamp
- Conformité légale 10 ans

**Response:**
```json
{
  "success": true,
  "commandeId": 456,
  "message": "Commande archivée"
}
```

---

#### 9. GET `/order-archive/list` - Liste archives

**Access:** Admin level 9+

**Query Params:** Idem GET `/api/orders` + `archivedDateFrom`, `archivedDateTo`

**Response:** Idem GET `/api/orders`

---

### TicketsController (`/api/tickets`)

#### 10. POST `/api/tickets` - Créer ticket SAV

**Access:** Authenticated user

**Body:**
```json
{
  "commandeId": 456,
  "userId": 12345,
  "type": "RETURN",
  "subject": "Produit défectueux",
  "description": "Les plaquettes de frein sont abîmées",
  "priority": "HIGH"
}
```

**Response:**
```json
{
  "ticketId": 789,
  "ticketRef": "TKT-2025-001",
  "status": "OPEN",
  "message": "Ticket créé avec succès"
}
```

**Logique:**
- Créer entrée `tickets`
- Envoyer email confirmation client
- Envoyer notification admin (si priority HIGH/URGENT)

---

#### 11. GET `/api/tickets` - Liste tickets

**Access:** Client (ses tickets) OU Admin (tous)

**Query Params:**
```typescript
{
  userId?: number;
  commandeId?: number;
  status?: string;        // OPEN/IN_PROGRESS/RESOLVED/CLOSED
  type?: string;          // COMPLAINT/RETURN/QUESTION
  page?: number;
  limit?: number;
}
```

**Response:**
```json
{
  "tickets": [
    {
      "ticketId": 789,
      "ticketRef": "TKT-2025-001",
      "commandeId": 456,
      "commandeRef": "ORD-2025-001",
      "userId": 12345,
      "type": "RETURN",
      "status": "OPEN",
      "subject": "Produit défectueux",
      "priority": "HIGH",
      "createdAt": "2025-01-14T12:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

---

#### 12. GET `/api/tickets/:id` - Détail ticket

**Access:** Client propriétaire OU Admin

**Response:**
```json
{
  "ticketId": 789,
  "ticketRef": "TKT-2025-001",
  "commandeId": 456,
  "userId": 12345,
  "type": "RETURN",
  "status": "OPEN",
  "subject": "Produit défectueux",
  "description": "Les plaquettes de frein sont abîmées",
  "priority": "HIGH",
  "assignedToUserId": 99,
  "assignedToUsername": "Support Team",
  "createdAt": "2025-01-14T12:00:00Z",
  "updatedAt": "2025-01-14T12:00:00Z",
  "closedAt": null
}
```

---

#### 13. PATCH `/api/tickets/:id` - Mettre à jour ticket

**Access:** Admin level 8+

**Body:**
```json
{
  "status": "RESOLVED",
  "assignedToUserId": 99
}
```

**Response:**
```json
{
  "ticketId": 789,
  "message": "Ticket mis à jour"
}
```

---

### OrderActionsController (`/api/admin/orders`)

#### 14. POST `/api/admin/orders/bulk-status-change` - Actions massives

**Access:** Admin level 8+

**Body:**
```json
{
  "commandeIds": [456, 457, 458],
  "newStatus": "CONFIRMED",
  "comment": "Validation en masse",
  "userId": 99
}
```

**Response:**
```json
{
  "success": true,
  "updated": 3,
  "failed": 0,
  "results": [
    { "commandeId": 456, "success": true },
    { "commandeId": 457, "success": true },
    { "commandeId": 458, "success": true }
  ]
}
```

**Logique:**
- Itérer sur chaque commandeId
- Appeler `OrderStatusService.changeStatus()` pour chaque
- Logger erreurs individuelles sans bloquer batch
- Envoyer emails notifications clients

---

#### 15. POST `/api/admin/orders/bulk-ship` - Expédition massive

**Access:** Admin level 8+

**Body:**
```json
{
  "orders": [
    {
      "commandeId": 456,
      "shippingTracking": "FR1234567890",
      "shippingCarrier": "Colissimo"
    },
    {
      "commandeId": 457,
      "shippingTracking": "FR0987654321",
      "shippingCarrier": "Chronopost"
    }
  ],
  "userId": 99
}
```

**Response:**
```json
{
  "success": true,
  "shipped": 2,
  "failed": 0
}
```

---

#### 16. GET `/api/admin/orders/stats` - Statistiques globales

**Access:** Admin level 8+

**Response:**
```json
{
  "total": 1440,
  "totalRevenue": 51509.00,
  "averageOrderValue": 35.76,
  "byStatus": {
    "PENDING": 45,
    "CONFIRMED": 120,
    "PROCESSING": 230,
    "SHIPPED": 180,
    "DELIVERED": 800,
    "CANCELLED": 65
  },
  "cancellationRate": 4.5,
  "last30DaysRevenue": [
    { "date": "2025-01-01", "revenue": 1200.00 },
    { "date": "2025-01-02", "revenue": 1500.00 }
  ]
}
```

**Cache:** Redis 1 min  
**Performance:** < 500ms (aggregates)

---

#### 17. POST `/api/admin/orders/export` - Export CSV

**Access:** Admin level 8+

**Body (filtres):**
```json
{
  "status": "DELIVERED",
  "dateFrom": "2025-01-01",
  "dateTo": "2025-01-31"
}
```

**Response:** Téléchargement fichier `orders-export-20250114.csv`

**Colonnes CSV:**
```
Ref,Client,Email,Statut,Montant,Date création,Date livraison
ORD-2025-001,Jean Dupont,jean@example.com,DELIVERED,245.50,2025-01-14 10:00,2025-01-17 14:30
```

---

## 🔒 Security

### Authentication

- **Endpoints publics** : Aucun (tous protégés)
- **Endpoints client** : JWT token, accès uniquement ses commandes
- **Endpoints admin** : JWT token + `level >= 8` (9 pour suppressions)

### Authorization Matrix

| Endpoint | Client | Admin L8+ | Admin L9+ |
|----------|--------|-----------|-----------|
| POST /orders | ✅ (ses commandes) | ✅ | ✅ |
| GET /orders | ✅ (ses commandes) | ✅ (toutes) | ✅ (toutes) |
| GET /orders/:id | ✅ (si propriétaire) | ✅ | ✅ |
| PUT /orders/:id | ❌ | ✅ | ✅ |
| DELETE /orders/:id | ❌ | ❌ | ✅ |
| POST /order-status/change | ✅ (PENDING→CANCELLED) | ✅ | ✅ |
| POST /api/tickets | ✅ | ✅ | ✅ |
| POST /api/admin/orders/* | ❌ | ✅ | ✅ |

### Validation

- **Tous les DTOs** validés avec Zod schemas
- **SQL Injection** : Protection via Supabase PostgREST
- **XSS** : Sanitization notes/comments

### Rate Limiting

- **Endpoints client** : 50 req/min/user
- **Endpoints admin** : 500 req/min/user

---

## 📈 Performance

### Objectifs

| Endpoint | Target P95 | Cache TTL |
|----------|-----------|-----------|
| POST /orders | < 500ms | N/A |
| GET /orders | < 200ms | 1 min (admin), pas de cache (client) |
| GET /orders/:id | < 150ms | 1 min |
| POST /order-status/change | < 300ms | N/A |
| GET /order-status/history | < 100ms | 5 min |
| POST /api/tickets | < 200ms | N/A |
| GET /api/admin/orders/stats | < 500ms | 1 min |
| POST /api/admin/orders/export | < 3s (max 10k orders) | N/A |

### Optimisations

1. **Indexes DB** : Sur `user_id`, `commande_status`, `commande_ref`, `commande_created_at`
2. **Cache Redis** : Stats admin (1 min TTL)
3. **Pagination obligatoire** : Max 100 commandes/page
4. **Joins optimisés** : `SELECT` colonnes spécifiques uniquement
5. **Background jobs** : Emails/notifications envoyés asynchrones

---

## 🧪 Tests

### Coverage Targets

- **Unit tests** : ≥ 80% (services)
- **Integration tests** : ≥ 60% (controllers + DB)
- **E2E tests** : Flows critiques (création → livraison)

### Tests Prioritaires

#### OrdersService

```typescript
describe('OrdersService', () => {
  it('should create order with valid items', async () => {
    const dto: CreateOrderDto = {
      userId: 12345,
      items: [{ pieceId: 789, quantity: 2, priceUnit: 45.99 }],
      shippingMethod: 'STANDARD',
      shippingAddress: { ... },
      paymentMethod: 'CARD',
      paymentTransactionId: 'ABC123'
    };
    const result = await service.create(dto);
    expect(result.commandeRef).toMatch(/^ORD-\d{4}-\d{3}$/);
    expect(result.status).toBe('PENDING');
  });

  it('should reject order with insufficient stock', async () => {
    const dto: CreateOrderDto = {
      items: [{ pieceId: 999, quantity: 1000 }] // Stock insuffisant
    };
    await expect(service.create(dto)).rejects.toThrow('Stock insuffisant');
  });
});
```

#### OrderStatusService

```typescript
describe('OrderStatusService', () => {
  it('should transition PENDING → CONFIRMED', async () => {
    const result = await service.changeStatus({
      commandeId: 456,
      newStatus: 'CONFIRMED',
      comment: 'Test',
      userId: 99
    });
    expect(result.newStatus).toBe('CONFIRMED');
  });

  it('should reject invalid transition DELIVERED → PENDING', async () => {
    await expect(service.changeStatus({
      commandeId: 456,
      newStatus: 'PENDING'
    })).rejects.toThrow('Transition invalide');
  });
});
```

---

## 📚 Dependencies

### NestJS Modules

- `@nestjs/common` - Core framework
- `@nestjs/event-emitter` - Events (status changes)
- `forwardRef()` - Circular dependency resolution (DatabaseModule)

### External Services

- `EmailService` - Notifications clients/admins
- `StockService` (via ProductsModule) - Réservation/libération stock
- `ShippingModule` - Tracking transporteur

### Database

- `@supabase/supabase-js` - Supabase client
- `SupabaseBaseService` - Classe de base

---

## 🔄 Migration Path

### From Legacy to Consolidated (Completed)

**Phase 1** : Audit services (Completed)
- ✅ Identification 8 services originaux
- ✅ Détection doublons -66%

**Phase 2** : Consolidation services (Completed)
- ✅ Fusion services similaires : 8 → 6
- ✅ Extraction logique commune : `SupabaseBaseService`

**Phase 3** : Consolidation controllers (Completed)
- ✅ Fusion endpoints redondants : 10 → 5
- ✅ Routes unifiées `/api/orders/*`

**Phase 4** : Cleanup (Completed)
- ✅ Suppression code mort
- ✅ Documentation mise à jour

---

## �� Deployment

### Environment Variables

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=orders@example.com
SMTP_PASSWORD=xxx

# API Config
NODE_ENV=production
PORT=3000
```

---

## 📖 Related Documentation

- [Order Management System](./order-management.md) - Specs frontend + UX
- [Payment Cart System](./payment-cart-system.md) - Intégration paiements
- [Shipping Management](./shipping-management.md) - Gestion livraisons
- [ADR-001: Supabase Direct](../architecture/001-supabase-direct.md)

---

## ✅ Acceptance Criteria

### Critères Fonctionnels

- [ ] Création commande automatique après paiement réussi
- [ ] Workflow statuts complet opérationnel (6 statuts)
- [ ] Historique transitions persistent dans DB
- [ ] Notifications email à chaque changement statut
- [ ] Actions massives admin fonctionnelles (validation, expédition, annulation)
- [ ] Tickets SAV CRUD complet
- [ ] Exports CSV/Excel fonctionnels
- [ ] Stats globales temps réel

### Critères Techniques

- [ ] Validation Zod sur tous les DTOs
- [ ] Tests unitaires ≥ 80% coverage
- [ ] Tests intégration ≥ 60% coverage
- [ ] Aucun warning TypeScript strict
- [ ] Indexes DB créés sur colonnes clés
- [ ] Logs structurés (Winston/NestJS Logger)

### Critères Performance

- [ ] POST /orders < 500ms (p95)
- [ ] GET /orders < 200ms (p95)
- [ ] GET /orders/:id < 150ms (p95)
- [ ] POST /order-status/change < 300ms (p95)
- [ ] GET /api/admin/orders/stats < 500ms (p95)

### Critères Sécurité

- [ ] JWT authentication sur tous endpoints
- [ ] RBAC validé (client, admin L8+, admin L9+)
- [ ] SQL injection impossible
- [ ] Rate limiting actif

---

## 🐛 Known Issues

1. **Email delays** : Notifications envoyées synchrones (ralentit API) → Migrer vers queue (BullMQ)
2. **Stats caching** : Cache Redis 1 min peut afficher données légèrement obsolètes
3. **Large exports** : Exports > 10k commandes timeout → Implémenter pagination

---

## 🔮 Future Enhancements

1. **Async notifications** : Queue BullMQ pour emails
2. **Advanced analytics** : Dashboard Grafana temps réel
3. **PDF invoices** : Génération factures automatiques
4. **Returns workflow** : Workflow retours/remboursements dédié
5. **Multi-warehouse** : Support multi-dépôts livraison

---

**Version:** 3.0.0  
**Last Updated:** 2025-11-18  
**Status:** ✅ Implemented & Consolidated  
**Maintainer:** Backend Team

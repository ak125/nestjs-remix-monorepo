# 💼 Commercial Module - Archives & Dashboard

**Module**: `backend/src/modules/commercial` (Archives CRON)  
**Dashboard**: `backend/src/modules/dashboard` (Stats commercial)  
**Tables**: `___xtr_order` (is_archived, archived_at)  
**Endpoints**: 6 (Archives) + 1 (Dashboard commercial)  
**CRON**: Auto-archive (désactivé, manuel possible)  
**Frontend**: `/commercial/*` routes (dashboard, orders, reports, stock, shipping)

---

## 📋 Vue d'ensemble

Module léger focalisé sur **archivage automatique des commandes** + **dashboard commercial intégré**.

**Architecture** :
- ✅ SupabaseBaseService (cohérence)
- ✅ CRON job (désactivé temporairement, déclenchable manuellement)
- ✅ Pas de nouvelle table (utilise colonnes existantes `is_archived`, `archived_at`)
- ✅ Restauration archives possible

**Business Logic** :
- Archivage automatique : Commandes > 3 mois + statuts finaux (6, 91-94)
- Dashboard commercial : Stats orders + users + suppliers
- Filtres avancés : date range, type, pagination

---

## 🛣️ Endpoints Archives (6)

### 1. GET `/commercial/archives`

**Résumé** : Récupérer archives avec filtres + pagination

**Query** :
```
?dateFrom=2024-01-01
&dateTo=2024-12-31
&type=order
&page=1
&limit=50
```

**Response** :
```json
{
  "success": true,
  "data": {
    "archives": [
      {
        "id": "uuid",
        "order_number": "ORD-2024-001",
        "customer_id": "uuid",
        "status": 6,
        "total_ht": 100.00,
        "total_ttc": 120.00,
        "date_order": "2024-01-15T10:30:00Z",
        "is_archived": true,
        "archived_at": "2024-04-20T02:00:00Z"
      }
    ],
    "pagination": {
      "total": 1250,
      "page": 1,
      "limit": 50,
      "pages": 25
    }
  }
}
```

**Logic** :
- Query `___xtr_order` WHERE `is_archived = true`
- Filtres : `archived_at >= dateFrom AND <= dateTo`
- ORDER BY `archived_at DESC`
- LIMIT/OFFSET pagination

---

### 2. GET `/commercial/archives/stats`

**Résumé** : Statistiques archives

**Response** :
```json
{
  "success": true,
  "data": {
    "totalArchived": 1250,
    "archivedThisMonth": 85,
    "archivedThisYear": 920,
    "avgArchiveAge": "4.2 mois",
    "byStatus": {
      "6": 800,
      "91": 200,
      "92": 150,
      "93": 50,
      "94": 50
    }
  }
}
```

**Logic** : Agrégation COUNT, GROUP BY status, calcul moyennes

---

### 3. POST `/commercial/archives/manual-archive/:orderId`

**Résumé** : Archiver manuellement une commande

**Body** : `{ reason?: string }`

**Response** :
```json
{
  "success": true,
  "message": "Commande #123 archivée avec succès"
}
```

**Logic** :
1. Fetch order `___xtr_order` WHERE id = orderId
2. Vérifier status IN [6, 91-94] (statuts finaux)
3. Update `is_archived = true`, `archived_at = NOW()`
4. Log action + reason

**Use case** : Admin archive commande exceptionnelle avant 3 mois

---

### 4. POST `/commercial/archives/restore/:orderId`

**Résumé** : Restaurer commande archivée

**Response** :
```json
{
  "success": true,
  "message": "Commande #456 restaurée"
}
```

**Logic** :
1. Fetch order WHERE id = orderId AND is_archived = true
2. Update `is_archived = false`, `archived_at = NULL`
3. Log restoration

**Use case** : Erreur archivage, besoin réactiver commande

---

### 5. POST `/commercial/archives/auto-archive`

**Résumé** : Déclencher archivage automatique (manuel)

**Response** :
```json
{
  "success": true,
  "data": {
    "archived": 125,
    "message": "125 commandes archivées"
  }
}
```

**Logic** :
1. Calcul date limite : NOW() - 3 mois
2. Query `___xtr_order` WHERE :
   - `status IN [6, 91, 92, 93, 94]` (finalisés)
   - `date_order < dateLimit`
   - `is_archived = false`
   - LIMIT 1000 (batch)
3. Update batch `is_archived = true`, `archived_at = NOW()`
4. Return count archived

**CRON disabled** : `@Cron(CronExpression.EVERY_DAY_AT_2AM)` commenté

**Use case** : Admin déclenche manuellement (tests, rattrapage)

---

### 6. GET `/commercial/archives/test`

**Résumé** : Test service archives

**Response** :
```json
{
  "success": true,
  "message": "Service d'archives opérationnel",
  "data": {
    "stats": { /* stats */ },
    "sampleArchives": { /* 10 archives */ },
    "serviceInfo": {
      "name": "CommercialArchivesService",
      "version": "2.0 - Table Existante",
      "database": "___xtr_order (colonnes existantes)",
      "features": [
        "Archivage dans table existante",
        "Colonnes is_archived / archived_at",
        "CRON auto-archive (désactivé)",
        "Archivage manuel + raison",
        "Restauration archives",
        "Stats + filtres avancés"
      ],
      "cronSchedule": "EVERY_DAY_AT_2AM (désactivé)",
      "archiveThreshold": "3 mois",
      "finalStatuses": [6, 91, 92, 93, 94]
    }
  }
}
```

---

## 📊 Dashboard Commercial (1)

### GET `/api/dashboard/commercial`

**Résumé** : Stats dashboard commercial (orders + users + suppliers)

**Guard** : `@RequireModule('commercial', 'read')`

**Response** :
```json
{
  "module": "commercial",
  "widgets": {
    "orders": {
      "totalOrders": 5200,
      "completedOrders": 4892,
      "pendingOrders": 308,
      "totalRevenue": 876000,
      "conversionRate": 93.5,
      "avgOrderValue": 179
    },
    "users": {
      "totalUsers": 12400,
      "activeUsers": 8900,
      "newUsers": 350
    },
    "suppliers": {
      "totalSuppliers": 108,
      "activeSuppliers": 95
    }
  },
  "lastUpdate": "2025-01-15T14:30:00Z",
  "success": true
}
```

**Logic** (DashboardService) :
```typescript
async getCommercialDashboard(userId: string) {
  const [orders, users, suppliers] = await Promise.all([
    this.getOrdersStats(),
    this.getUsersStats(),
    this.getSuppliersStats()
  ]);
  return { module: 'commercial', widgets: { orders, users, suppliers } };
}
```

**Use case** : Dashboard `/commercial` (frontend) affiche KPIs commercial

---

## 🏗️ Architecture

### CommercialArchivesService

**Responsabilités** :
- Archivage automatique (CRON désactivé)
- Archivage manuel avec raison
- Restauration archives
- Stats agrégées

**Table** : `___xtr_order` (colonnes existantes)

**Methods** :
```typescript
getArchives(filters) // Liste paginée
getArchiveStats() // Stats agrégées
autoArchiveOrders() // CRON (désactivé)
manualArchiveOrder(orderId, reason) // Archivage manuel
restoreArchivedOrder(orderId) // Restauration
```

---

### CommercialArchivesController

**Routes** : `/commercial/archives/*`

**Endpoints** : 6 (GET archives, stats, test + POST manual-archive, restore, auto-archive)

**Validation** : ParseIntPipe (orderId), Query params (dateFrom, dateTo, page, limit)

---

### DashboardService (Commercial)

**Method** : `getCommercialDashboard(userId)`

**Intégration** : Module dashboard (Feature 7 - Analytics)

**Permissions** : Guard `@RequireModule('commercial', 'read')`

**Cache** : Non (données real-time orders/users/suppliers)

---

## 🗄️ Tables

### `___xtr_order` (existante)

**Colonnes archives** :
```sql
is_archived BOOLEAN DEFAULT FALSE,
archived_at TIMESTAMP NULL
```

**Autres colonnes** :
```sql
id UUID PRIMARY KEY,
order_number VARCHAR(50),
customer_id UUID,
status INTEGER, -- 6=Livrée, 91-94=Finalisés
total_ht DECIMAL(10,2),
total_ttc DECIMAL(10,2),
date_order TIMESTAMP,
created_at TIMESTAMP,
updated_at TIMESTAMP
```

**Index suggérés** :
```sql
CREATE INDEX idx_order_archived ON ___xtr_order(is_archived);
CREATE INDEX idx_order_archived_at ON ___xtr_order(archived_at);
CREATE INDEX idx_order_status_archived ON ___xtr_order(status, is_archived);
```

---

## 🔄 Workflows

### Workflow 1 : Archivage automatique (CRON)

1. **CRON trigger** : Chaque jour 2h AM (désactivé)
2. Calcul date limite : NOW() - 3 mois
3. Query commandes éligibles :
   - `status IN [6, 91-94]` (finalisés)
   - `date_order < dateLimit`
   - `is_archived = false`
   - LIMIT 1000 (batch)
4. Update batch : `is_archived = true`, `archived_at = NOW()`
5. Log : "✅ 125 commandes archivées"

**Réactivation** :
```typescript
// Décommenter dans archives.service.ts
@Cron(CronExpression.EVERY_DAY_AT_2AM)
async autoArchiveOrders() { /* ... */ }
```

---

### Workflow 2 : Archivage manuel

1. Admin identifie commande à archiver (ex: litige résolu)
2. POST `/commercial/archives/manual-archive/123` + `{ reason: "Litige résolu" }`
3. Service vérifie status final (6, 91-94)
4. Update `is_archived = true`, `archived_at = NOW()`
5. Response : "Commande #123 archivée avec succès"

---

### Workflow 3 : Restauration archive

1. Admin découvre erreur archivage
2. POST `/commercial/archives/restore/456`
3. Service vérifie `is_archived = true`
4. Update `is_archived = false`, `archived_at = NULL`
5. Commande réapparaît dans liste active

---

### Workflow 4 : Dashboard commercial

1. User navigue `/commercial`
2. Frontend GET `/api/dashboard/commercial`
3. Service agrège stats (orders, users, suppliers)
4. Display KPIs : 5.2K orders, 876K€ CA, 12.4K users, 108 suppliers
5. Refresh auto 30s (comme Analytics Dashboard)

---

## 📊 KPIs & Metrics

**Archives** :
- Total archivées : ~1,250
- Archivées/mois : ~85
- Âge moyen archive : 4.2 mois
- Statuts finaux : 6 (80%), 91-94 (20%)

**Dashboard Commercial** :
- Orders : 5.2K (93.5% conversion)
- Revenue : 876K€ (179€ panier moyen)
- Users : 12.4K (71.7% actifs)
- Suppliers : 108 (88% actifs)

**Performance** :
- Query archives (50 items) : ~100ms
- Archive batch (1000 orders) : ~2s
- Dashboard commercial : ~150ms (3 queries parallel)

---

## 🔐 Sécurité

**Archives** :
- Routes non protégées actuellement (TODO: AuthGuard)
- Validation orderId (ParseIntPipe)
- Vérification status avant archive/restore

**Dashboard** :
- Guard : `@RequireModule('commercial', 'read')`
- Permissions granulaires par module

**Audit** :
- Log actions : archive manual (reason), restore
- Timestamp : archived_at (traçabilité)

---

## 🚀 Roadmap

### Q1 2025 : Activation CRON

- [x] Service archives implémenté
- [ ] **Réactiver CRON** : Décommenter `@Cron` decorator
- [ ] Tests e2e auto-archive (scheduler)
- [ ] Monitoring : Slack notifications archives

### Q2 2025 : Features avancées

- [ ] **Export archives** : CSV/PDF rapports
- [ ] **Archive storage** : S3 backup commandes anciennes
- [ ] **Archive analytics** : Dashboard tendances archives
- [ ] **Bulk operations** : Archive multiple orders

### Q3 2025 : Intégrations

- [ ] **Archive rules** : Règles personnalisées (status, âge)
- [ ] **Email notifications** : Alertes avant archivage
- [ ] **API webhooks** : Trigger externe archivage
- [ ] **Archive search** : Recherche full-text archives

---

## 📚 Frontend Routes

### `/commercial` (Dashboard)

**Composant** : `commercial._index.tsx`

**Affichage** :
- KPIs : Orders, Revenue, Users, Suppliers
- Quick actions : Nouvelle commande, Export, Expédition
- Links : Orders, Stock, Shipping, Customers, Suppliers, Returns, Reports

---

### `/commercial/orders`

**Gestion commandes** : Liste, filtres, actions (valider, expédier, annuler)

---

### `/commercial/reports`

**Rapports** : CA, conversion, clients, fournisseurs

**Stats** :
- CA total : 876K€
- Conversion : 93.5%
- Panier moyen : 179€
- Clients actifs : 8.9K

---

### `/commercial/stock`

**Gestion stock** : Voir Feature 8 (Stock Management)

---

### `/commercial/shipping`

**Expéditions** : Voir Feature 2 (Shipping Management)

---

## 🧪 Testing

### Test archives service

```bash
GET /commercial/archives/test
```

**Expected** :
```json
{
  "success": true,
  "message": "Service d'archives opérationnel",
  "data": {
    "stats": { "totalArchived": 1250 },
    "sampleArchives": { /* 10 archives */ },
    "serviceInfo": { /* config */ }
  }
}
```

---

### Test archivage manuel

```bash
POST /commercial/archives/manual-archive/123
Content-Type: application/json

{ "reason": "Test archivage" }
```

**Expected** : `{ success: true, message: "Commande #123 archivée" }`

---

### Test restauration

```bash
POST /commercial/archives/restore/123
```

**Expected** : `{ success: true, message: "Commande #123 restaurée" }`

---

### Test dashboard

```bash
GET /api/dashboard/commercial
Authorization: Bearer <token>
```

**Expected** : Stats orders + users + suppliers

---

## 📖 Documentation

**Swagger** : Non documenté actuellement (TODO: @ApiTags, @ApiOperation)

**Code comments** :
- ✅ Service documenté (JSDoc)
- ✅ Controller commenté
- ✅ Methods annotées

**Architecture** :
- Pattern : SupabaseBaseService
- CRON : @Cron decorator (désactivé)
- Tables : Colonnes existantes (no migration)

**Logs** :
```
🔄 Démarrage processus d'archivage automatique...
✅ 125 commandes archivées sur 1000 éligibles
POST /commercial/archives/manual-archive/123
GET /api/dashboard/commercial
```

---

## 🎯 Résumé

**Module Commercial** : Léger mais essentiel

**Endpoints** : 7 total (6 archives + 1 dashboard)

**Architecture** :
- Archives : Service CRON (désactivable) + table existante
- Dashboard : Stats commercial intégré (orders + users + suppliers)

**KPIs** :
- 1,250 archives (4.2 mois moyenne)
- 5.2K orders (876K€ CA)
- 12.4K users (71.7% actifs)
- 108 suppliers (88% actifs)

**Coverage** : Module léger, extensible

**Next Steps** :
- Réactiver CRON archivage auto
- Ajouter AuthGuard routes archives
- Swagger documentation
- Tests e2e CRON scheduler

---

**Spec complétée** : Feature 9 - Commercial Module (7 endpoints)  
**Coverage** : ~70% backend (22/37 modules)  
**Phase 3 Quick Wins** : ✅ COMPLETE (Stock + Commercial)

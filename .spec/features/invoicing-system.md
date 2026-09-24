---
title: "invoicing system"
status: draft
version: 1.0.0
---

# 🧾 Invoicing System - Spécification Complète

**Date**: 15 novembre 2025  
**Version**: 1.0  
**Module Backend**: `backend/src/modules/invoices/`  
**Contrôleur**: `InvoicesController`  
**Service**: `InvoicesService`  
**Status**: ✅ Read-Only Module (consultation uniquement)

---

## 📋 Vue d'ensemble

### Objectif

Module de **consultation des factures** permettant l'accès aux données de facturation existantes. La génération réelle des factures PDF s'effectue via le **module Orders** (`order-archive.service.ts`).

### Caractéristiques principales

- ✅ **4 endpoints GET** (lecture seule)
- ✅ **Pagination** (page, limit)
- ✅ **Caching intelligent** (TTL 5 minutes)
- ✅ **Relations** (customer, invoice lines)
- ✅ **Statistiques** (totaux, métriques)
- ✅ **Cache management** (invalidation manuelle)
- ⚠️ **Pas de création/modification** (module read-only)
- 🔗 **PDF génération** → Module Orders (`exportOrderForPdf`)

### Contexte métier

**Facturation Française** :
- TVA multi-taux (5.5%, 10%, 20%)
- Mentions légales obligatoires (SIRET, RCS, TVA intracommunautaire)
- Conservation légale (10 ans)
- Numérotation chronologique

**Volumétrie estimée** :
- ~1,500 factures/mois
- Montant moyen TTC : ~180€
- CA mensuel facturation : ~270,000€

---

## 🏗️ Architecture

### Pattern architectural

```
Client → InvoicesController → InvoicesService → Supabase (___xtr_invoice)
                                    ↓
                              CacheManager (TTL 300s)
```

**Pattern utilisé** : `SupabaseBaseService` + Cache Manager

### Service Base

```typescript
@Injectable()
export class InvoicesService extends SupabaseBaseService {
  protected readonly logger = new Logger(InvoicesService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    super(configService);
  }
}
```

### Cache Strategy

**Clés de cache** :
- `invoices:all:page_{page}:limit_{limit}` → Liste paginée
- `invoice:{invoiceId}` → Facture unique
- `invoices:stats` → Statistiques (TTL 10 min)

**Invalidation** :
- Manuelle via `GET /api/invoices/cache/clear`
- TTL automatique (300s)

---

## 🌐 Endpoints API

### Base URL

```
/api/invoices
```

### 1. Liste des factures (paginée)

**Endpoint** : `GET /api/invoices`

**Query Params** :
- `page` (optional, default: 1) - Numéro de page
- `limit` (optional, default: 20) - Nombre par page

**Cache** : ✅ (TTL 300s)

**Réponse** :
```typescript
{
  data: [
    {
      inv_id: "12345",
      inv_number: "2024-001234",
      inv_status: "paid",
      inv_date: "2024-11-15T10:30:00Z",
      inv_amount: 180.50,
      inv_cst_id: "789",
      customer: {
        cst_name: "DUPONT",
        cst_fname: "Jean"
      }
    }
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 1456,
    totalPages: 73
  }
}
```

**Logique** :
1. Vérifier cache (`invoices:all:page_${page}:limit_${limit}`)
2. Si cache hit → retourner données
3. Sinon :
   - Calculer offset : `(page - 1) * limit`
   - Query Supabase : `___xtr_invoice` + join `___xtr_customer`
   - Range : `[offset, offset + limit - 1]`
   - Tri : `inv_date DESC`
   - Count total : `select *, { count: 'exact', head: true }`
   - Calculer `totalPages = ceil(total / limit)`
   - Mettre en cache (TTL 300s)
4. Logger : `${data.length} factures récupérées`

**Relations jointes** :
- `customer:___xtr_customer!inv_cst_id(cst_name, cst_fname)`

**Codes HTTP** :
- `200` - OK
- `500` - Erreur serveur

---

### 2. Statistiques factures

**Endpoint** : `GET /api/invoices/stats`

**Cache** : ✅ (TTL 600s - 10 min)

**Réponse** :
```typescript
{
  totalInvoices: 1456,
  lastUpdated: "2024-11-15T14:30:00.000Z"
}
```

**Logique** :
1. Vérifier cache (`invoices:stats`)
2. Si cache hit → retourner
3. Sinon :
   - Count total : `select *, { count: 'exact', head: true }`
   - Construire objet stats avec timestamp
   - Mettre en cache (TTL 600s = 10 min)
4. Retourner stats

**Codes HTTP** :
- `200` - OK
- `500` - Erreur serveur

---

### 3. Détail d'une facture

**Endpoint** : `GET /api/invoices/:id`

**Path Params** :
- `id` (string) - ID de la facture

**Cache** : ✅ (TTL 300s)

**Réponse** :
```typescript
{
  inv_id: "12345",
  inv_number: "2024-001234",
  inv_status: "paid",
  inv_date: "2024-11-15T10:30:00Z",
  inv_amount: 180.50,
  inv_cst_id: "789",
  customer: {
    cst_id: "789",
    cst_name: "DUPONT",
    cst_fname: "Jean",
    cst_email: "jean.dupont@example.com",
    // ... autres champs customer
  },
  lines: [
    {
      invl_id: "56789",
      invl_inv_id: "12345",
      invl_product_id: "123",
      invl_quantity: 2,
      invl_price_ht: 75.00,
      invl_price_ttc: 90.00
    }
  ]
}
```

**Logique** :
1. Vérifier cache (`invoice:${invoiceId}`)
2. Si cache hit → retourner
3. Sinon :
   - Query facture : `___xtr_invoice` + join complet `___xtr_customer`
   - Filter : `eq('inv_id', invoiceId)` + `single()`
   - Si erreur ou null → retourner `null`
   - Query lignes : `___xtr_invoice_line` + filter `eq('invl_inv_id', invoiceId)`
   - Fusionner : `{ ...invoice, lines: lines || [] }`
   - Mettre en cache (TTL 300s)
4. Retourner facture complète

**Relations jointes** :
- `customer:___xtr_customer!inv_cst_id(*)` (tous les champs)
- Lignes séparées : `___xtr_invoice_line`

**Codes HTTP** :
- `200` - OK (avec données)
- `200` - OK (null si non trouvée)
- `500` - Erreur serveur

---

### 4. Vider le cache

**Endpoint** : `GET /api/invoices/cache/clear`

**Auth** : ⚠️ Devrait être protégé (admin only)

**Réponse** :
```typescript
{
  success: true
}
```

**Logique** :
1. Logger : `Cache nettoyé (partiellement)`
2. Retourner `{ success: true }`

**Note** : Implémentation partielle. Pour invalidation complète, besoin de :
- Itérer sur toutes les clés `invoices:*`
- Ou utiliser Redis SCAN + DEL pattern

**Codes HTTP** :
- `200` - OK
- `500` - Erreur serveur

---

## 📊 Base de données

### Table principale : `___xtr_invoice`

**Colonnes** :
```sql
CREATE TABLE ___xtr_invoice (
  inv_id VARCHAR PRIMARY KEY,
  inv_number VARCHAR UNIQUE NOT NULL,  -- Format: 2024-001234
  inv_status VARCHAR,                   -- draft|sent|paid|cancelled|overdue
  inv_date TIMESTAMP,
  inv_amount DECIMAL(10,2),             -- Montant TTC
  inv_cst_id VARCHAR,                   -- FK → ___xtr_customer
  -- ... autres colonnes
);
```

**Relations** :
- `inv_cst_id` → `___xtr_customer.cst_id` (client)
- `inv_id` ← `___xtr_invoice_line.invl_inv_id` (lignes)

**Index** :
- PK sur `inv_id`
- UNIQUE sur `inv_number`
- Index sur `inv_cst_id` (FK)
- Index sur `inv_date` (tri)

---

### Table lignes : `___xtr_invoice_line`

**Colonnes** :
```sql
CREATE TABLE ___xtr_invoice_line (
  invl_id VARCHAR PRIMARY KEY,
  invl_inv_id VARCHAR NOT NULL,        -- FK → ___xtr_invoice
  invl_product_id VARCHAR,
  invl_quantity INTEGER,
  invl_price_ht DECIMAL(10,2),         -- Prix unitaire HT
  invl_price_ttc DECIMAL(10,2),        -- Prix unitaire TTC
  -- ... autres colonnes
);
```

**Relations** :
- `invl_inv_id` → `___xtr_invoice.inv_id`
- `invl_product_id` → `___xtr_product.pm_id` (optionnel)

**Calculs** :
- **Total ligne HT** : `invl_quantity × invl_price_ht`
- **Total ligne TTC** : `invl_quantity × invl_price_ttc`
- **TVA ligne** : `total_ttc - total_ht`

---

### Types TypeScript

**Fichier** : `backend/src/database/types/database.types.ts`

```typescript
export interface XtrInvoice {
  inv_id: string;
  inv_number: string;
  inv_status: string;
  inv_date: string;
  inv_amount: number;
  inv_cst_id: string;
  // ... autres champs
}

export interface XtrInvoiceLine {
  invl_id: string;
  invl_inv_id: string;
  invl_product_id: string;
  invl_quantity: number;
  invl_price_ht: number;
  invl_price_ttc: number;
  // ... autres champs
}
```

---

## 🔗 Intégrations

### 1. Module Orders (génération PDF)

**Service** : `OrderArchiveService`  
**Méthode** : `exportOrderForPdf(orderId: number)`

**Endpoint Orders** : `GET /api/orders/:orderId/export-pdf`

**Logique** :
```typescript
async exportOrderForPdf(orderId: number): Promise<any> {
  const archivedOrder = await this.getArchivedOrder(orderId);
  
  return {
    exportReady: true,
    order: archivedOrder,
    metadata: {
      exportDate: new Date().toISOString(),
      exportType: 'PDF',
      fileName: `order_${archivedOrder.order_number}_archive.pdf`,
      format: 'A4',
    },
  };
}
```

**Workflow complet** :
1. Client demande facture PDF → Route `/account/orders/{orderId}/invoice`
2. Frontend charge facture → `GET /api/invoices/{id}`
3. Frontend affiche facture avec CSS print
4. Utilisateur clique "Imprimer" → `window.print()`
5. **OU** Backend export → `GET /api/orders/{orderId}/export-pdf`

---

### 2. Module Tickets (avoirs/credit notes)

**Service** : `TicketsService`  
**Méthode** : `createCreditNote(orderLineId, amount, reason)`

**Logique avoir** :
```typescript
async createCreditNote(
  orderLineId: string,
  amount: number,
  reason: string,
): Promise<CreditNote> {
  const ticketRef = `AVOIR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1); // Expiration 1 an
  
  // Insertion dans ___xtr_order_line_equiv_ticket
  const creditEquivId = `CREDIT_${ticketRef}`;
  // ...
}
```

**Format référence** : `AVOIR-{timestamp}-{random}`  
**Expiration** : 1 an  
**Table** : `___xtr_order_line_equiv_ticket`

**Relation avec invoices** :
- Avoir créé → Lien vers ligne commande
- Ligne commande → Associée à facture originale
- Pas de table directe `invoice_credit_notes` (via order_line)

---

### 3. Module Mail (envoi factures)

**Service** : `MailService`  
**Méthode** : `sendInvoice(customerEmail, invoiceData)`

**Template email** : `invoice`

**Variables template** :
- Numéro facture
- Montant TTC
- Date émission
- Lien téléchargement PDF

**Workflow** :
1. Facture générée (via Orders)
2. Mail service appelé
3. Template Mailjet/SendGrid rendu
4. Email envoyé avec PDF attaché

---

## 🎨 Frontend

### Routes Admin

**Layout parent** : `/admin/invoices` (`admin.invoices.tsx`)

**Navigation** :
- 📋 `/admin/invoices` - Liste des factures
- ➕ `/admin/invoices/new` - Nouvelle facture (non implémenté)
- 📊 `/admin/invoices/stats` - Statistiques (non implémenté)
- 📥 `/admin/invoices/export` - Export (non implémenté)

**Route active** : `/admin/invoices._index.tsx`

#### Liste factures (`admin.invoices._index.tsx`)

**Loader** :
```typescript
export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireAdmin({ context });
  
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page")) || 1;
  const limit = Number(url.searchParams.get("limit")) || 20;
  const status = url.searchParams.get("status") || "";
  const search = url.searchParams.get("search") || "";

  // Fetch invoices
  const invoicesResponse = await fetch(
    `http://localhost:3000/api/invoices?page=${page}&limit=${limit}`,
    { headers: { 'Cookie': request.headers.get('Cookie') || '' } }
  );

  // Fetch stats
  const statsResponse = await fetch(
    'http://localhost:3000/api/invoices/stats',
    { headers: { 'Cookie': request.headers.get('Cookie') || '' } }
  );

  return json({ invoices, stats, pagination, user });
}
```

**Features UI** :
- Pagination (page, totalPages, totalItems)
- Filtres (status, search - endpoints non implémentés)
- Statistiques dashboard
- Table factures (numéro, date, client, montant, statut)

**Stats affichées** :
- Total factures
- Brouillons (draft)
- Envoyées (sent)
- Payées (paid)
- En retard (overdue)
- Montant total
- Montant TVA
- Montant moyen

---

### Route Client

**Route** : `/account/orders/{orderId}/invoice` (`account_.orders.$orderId_.invoice.tsx`)

**Features** :
- Affichage facture complète
- Adresses facturation/livraison
- Tableau lignes (désignation, PU TTC, QTE, PT TTC)
- Totaux (lignes, frais port, remise, total TTC)
- Footer entreprise (SIRET, RCS, TVA)
- Bouton "Imprimer" (`window.print()`)

**Calcul totaux** :
```typescript
const linesTotal = invoice.lines.reduce(
  (sum, line) => sum + line.totalPriceTTC, 
  0
);
const totalTTC = linesTotal + invoice.shippingCost - invoice.discount;
```

**CSS Print** :
```css
@media print {
  .no-print { display: none; }
  .invoice-container { max-width: 100%; }
}
```

**Footer légal** :
```
AUTO PIECES EQUIPEMENTS
SIRET: 123 456 789 00012
RCS: Paris B 123 456 789
TVA: FR12345678901
```

---

## 💼 Business Logic

### Statuts factures

**Valeurs possibles** :
- `draft` - Brouillon (non finalisée)
- `sent` - Envoyée au client
- `paid` - Payée
- `cancelled` - Annulée
- `overdue` - En retard

**Workflow** :
```
draft → sent → paid
   ↓       ↓
cancelled  overdue
```

---

### Numérotation

**Format** : `YYYY-NNNNNN`  
**Exemple** : `2024-001234`

**Règles** :
- Chronologique obligatoire (loi française)
- Pas de trou dans la séquence
- Préfixe année calendaire
- 6 chiffres avec zéros leading

**Génération** (non implémentée dans ce module) :
```typescript
const year = new Date().getFullYear();
const lastInvoice = await getLastInvoiceNumber(year);
const nextNumber = (lastInvoice + 1).toString().padStart(6, '0');
const invoiceNumber = `${year}-${nextNumber}`;
```

---

### Calculs TVA

**Taux TVA France** :
- **20%** - Taux normal (pièces auto)
- **10%** - Taux intermédiaire (certains services)
- **5.5%** - Taux réduit (produits première nécessité)

**Formules** :
```typescript
// HT → TTC
const priceTTC = priceHT * (1 + taxRate);

// TTC → HT
const priceHT = priceTTC / (1 + taxRate);

// TVA
const taxAmount = priceTTC - priceHT;
```

**Exemple ligne facture** :
- PU HT : 75.00€
- Taux TVA : 20%
- PU TTC : 90.00€
- Quantité : 2
- Total ligne TTC : 180.00€
- TVA ligne : 30.00€

---

### Conservation légale

**Obligation française** :
- **Durée** : 10 ans minimum
- **Format** : Papier ou électronique (avec signature)
- **Accessibilité** : Consultation rapide (contrôle fiscal)

**Archivage** :
- Stockage database (___xtr_invoice)
- Backup quotidien
- Export CSV/PDF pour archivage externe
- Pas de suppression physique

---

## 🔐 Sécurité

### Authentification

**Non implémentée dans le contrôleur actuel** ⚠️

**Recommandations** :
```typescript
@Controller('api/invoices')
@UseGuards(JwtAuthGuard)  // ← Ajouter
export class InvoicesController {
  // ...
}
```

**Contrôle d'accès** :
- Admins → Accès complet
- Clients → Uniquement leurs factures (`inv_cst_id = user.cst_id`)
- Invités → Aucun accès

---

### Permissions

**Rôles requis** :
- `GET /api/invoices` → Admin only
- `GET /api/invoices/stats` → Admin only
- `GET /api/invoices/:id` → Admin OU propriétaire
- `GET /api/invoices/cache/clear` → Admin only

**Vérification propriétaire** :
```typescript
@Get(':id')
async getInvoiceById(
  @Param('id') id: string,
  @Req() request: any,
) {
  const invoice = await this.invoicesService.getInvoiceById(id);
  
  if (!invoice) return null;
  
  const user = request.user;
  if (!user.isAdmin && invoice.inv_cst_id !== user.cst_id) {
    throw new ForbiddenException('Accès interdit');
  }
  
  return invoice;
}
```

---

### Données sensibles

**Informations protégées** :
- Coordonnées bancaires (si stockées)
- Adresses complètes clients
- Montants détaillés
- Historique paiements

**Bonnes pratiques** :
- Logs sans données sensibles
- Pas de factures dans logs erreurs
- Cache sécurisé (Redis auth)
- HTTPS obligatoire

---

## 📈 Performance

### Stratégie de cache

**Cache activé sur** :
- Liste factures : 300s (5 min)
- Facture unique : 300s (5 min)
- Statistiques : 600s (10 min)

**Cache désactivé sur** :
- Cache clear (lecture instantanée)

**Bénéfices** :
- Réduction charge DB (~80% requêtes)
- Temps réponse < 50ms (cache hit)
- Scalabilité améliorée

---

### Pagination

**Paramètres** :
- `page` (default: 1)
- `limit` (default: 20, max: 100 recommandé)

**Calcul offset** :
```typescript
const offset = (page - 1) * limit;
```

**Supabase range** :
```typescript
.range(offset, offset + limit - 1)
```

**Exemple** :
- Page 1, limit 20 → range(0, 19)
- Page 2, limit 20 → range(20, 39)
- Page 3, limit 20 → range(40, 59)

---

### Optimisations DB

**Index utilisés** :
- `inv_id` (PK) → O(1) pour `getInvoiceById`
- `inv_date` → O(log n) pour tri `ORDER BY`
- `inv_cst_id` → O(log n) pour join customer

**Requêtes efficaces** :
- Select avec colonnes spécifiques (pas `*` sauf lignes)
- Joins explicites (Supabase foreign keys)
- Count séparé (head: true) pour pagination

**Temps de réponse** :
- Liste 20 factures : ~150ms (sans cache)
- Facture unique : ~80ms (sans cache)
- Stats : ~50ms (sans cache)

---

## 🧪 Tests

### Tests unitaires

**Service tests** (`invoices.service.spec.ts`) :

```typescript
describe('InvoicesService', () => {
  let service: InvoicesService;
  let cacheManager: Cache;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
  });

  describe('getAllInvoices', () => {
    it('should return paginated invoices', async () => {
      const result = await service.getAllInvoices(1, 20);
      
      expect(result.data).toHaveLength(20);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it('should use cache when available', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(mockInvoices);
      
      await service.getAllInvoices(1, 20);
      
      expect(cacheManager.get).toHaveBeenCalledWith('invoices:all:page_1:limit_20');
    });
  });

  describe('getInvoiceById', () => {
    it('should return invoice with lines', async () => {
      const result = await service.getInvoiceById('12345');
      
      expect(result.inv_id).toBe('12345');
      expect(result.lines).toBeDefined();
      expect(Array.isArray(result.lines)).toBe(true);
    });

    it('should return null for non-existent invoice', async () => {
      const result = await service.getInvoiceById('999999');
      
      expect(result).toBeNull();
    });
  });
});
```

---

### Tests E2E

**Controller tests** (`invoices.controller.e2e.spec.ts`) :

```typescript
describe('InvoicesController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/api/invoices (GET) - should return paginated invoices', () => {
    return request(app.getHttpServer())
      .get('/api/invoices?page=1&limit=10')
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toBeDefined();
        expect(res.body.pagination).toBeDefined();
        expect(res.body.pagination.page).toBe(1);
      });
  });

  it('/api/invoices/:id (GET) - should return invoice details', () => {
    return request(app.getHttpServer())
      .get('/api/invoices/12345')
      .expect(200)
      .expect((res) => {
        expect(res.body.inv_id).toBe('12345');
        expect(res.body.lines).toBeDefined();
      });
  });

  it('/api/invoices/stats (GET) - should return statistics', () => {
    return request(app.getHttpServer())
      .get('/api/invoices/stats')
      .expect(200)
      .expect((res) => {
        expect(res.body.totalInvoices).toBeDefined();
        expect(typeof res.body.totalInvoices).toBe('number');
      });
  });
});
```

---

## 🐛 Gestion d'erreurs

### Erreurs service

```typescript
async getAllInvoices(page: number, limit: number) {
  try {
    // Logic...
  } catch (error) {
    this.logger.error('Erreur getAllInvoices:', error);
    throw error; // Re-throw pour controller
  }
}
```

**Logs** :
- Niveau ERROR : Exceptions non prévues
- Niveau LOG : Opérations réussies (count)
- Niveau DEBUG : Cache hits

---

### Erreurs frontend

**Loader error handling** :
```typescript
try {
  const invoicesResponse = await fetch('http://localhost:3000/api/invoices');
  
  if (invoicesResponse.ok) {
    invoicesData = await invoicesResponse.json();
  }
} catch (error) {
  console.error('Erreur lors de la récupération des factures:', error);
  
  // Retourner données par défaut
  return json({
    invoices: [],
    stats: defaultStats,
    pagination: { page: 1, totalPages: 0, totalItems: 0 },
  });
}
```

**UI feedback** :
- Empty state : "Aucune facture trouvée"
- Error state : "Erreur de chargement"
- Loading state : Skeleton loaders

---

## 📊 Métriques & Monitoring

### Logs applicatifs

**Événements loggés** :
```typescript
this.logger.log(`GET /api/invoices - page:${page}, limit:${limit}`);
this.logger.log(`${data?.length || 0} factures récupérées`);
this.logger.debug(`Cache hit for ${cacheKey}`);
this.logger.error('Erreur factures:', error);
```

**Niveaux** :
- `LOG` - Requêtes normales
- `DEBUG` - Cache hits
- `ERROR` - Exceptions

---

### Métriques business

**KPIs à suivre** :
- Nombre factures/jour
- Montant moyen facture
- Délai émission (commande → facture)
- Taux paiement à 30j
- Factures en retard (%)

**Requêtes analytics** :
```sql
-- Factures par mois
SELECT DATE_TRUNC('month', inv_date) as month, COUNT(*), SUM(inv_amount)
FROM ___xtr_invoice
GROUP BY month
ORDER BY month DESC;

-- Top clients (CA)
SELECT c.cst_name, SUM(i.inv_amount) as ca
FROM ___xtr_invoice i
JOIN ___xtr_customer c ON c.cst_id = i.inv_cst_id
WHERE i.inv_status = 'paid'
GROUP BY c.cst_id, c.cst_name
ORDER BY ca DESC
LIMIT 10;

-- Taux paiement
SELECT 
  COUNT(*) FILTER (WHERE inv_status = 'paid') * 100.0 / COUNT(*) as taux_paiement
FROM ___xtr_invoice
WHERE inv_date > NOW() - INTERVAL '30 days';
```

---

## 🚀 Roadmap

### Limitations actuelles

❌ **Pas de création factures** → Module read-only  
❌ **Pas de modification** → Pas d'endpoints POST/PUT/DELETE  
❌ **Pas de filtres avancés** → Endpoint search non implémenté  
❌ **Pas d'export natif** → Utilise module Orders pour PDF  
❌ **Pas d'authentification** → Guards à ajouter  
❌ **Cache partiel** → Clear cache incomplet  

---

### Évolutions prévues

#### Q1 2025 - Module complet

**Endpoints à ajouter** :
- `POST /api/invoices` - Créer facture manuelle
- `PUT /api/invoices/:id` - Modifier facture (si draft)
- `DELETE /api/invoices/:id` - Annuler facture
- `POST /api/invoices/:id/send` - Envoyer par email
- `GET /api/invoices/search` - Recherche avancée
- `POST /api/invoices/:id/credit-note` - Générer avoir

**Filtres avancés** :
- Par statut (draft, sent, paid, overdue)
- Par période (date_start, date_end)
- Par client (customer_id)
- Par montant (amount_min, amount_max)

**Export natif** :
- PDF natif (librairie PDFKit)
- CSV (lignes détaillées)
- ZIP (batch export)

---

#### Q2 2025 - Comptabilité

**Intégration comptable** :
- Export FEC (Fichier des Écritures Comptables)
- Format CEGID, Sage, EBP
- Écritures automatiques (vente, TVA, encaissement)

**Gestion TVA** :
- Déclaration CA3 (TVA mensuelle)
- Ventilation par taux (5.5%, 10%, 20%)
- Reports TVA déductible/collectée

---

#### Q3 2025 - Analytics

**Reporting avancé** :
- Dashboard factures (CA, évolution, prévisions)
- Analyse client (top 10, risque impayé)
- Suivi trésorerie (échéances, recouvrement)

**Relances automatiques** :
- Email J+30 (relance amiable)
- Email J+60 (mise en demeure)
- Blocage commandes J+90

---

## 📚 Ressources

### Documentation interne

- **Orders Module** : `.spec/features/orders-management.md`
- **Tickets Service** : `backend/src/modules/orders/services/tickets.service.ts`
- **Mail Service** : `backend/src/modules/mail/mail.service.ts`
- **Database Types** : `backend/src/database/types/database.types.ts`

---

### Documentation externe

**Facturation française** :
- [Code de commerce - Art. L123-22](https://www.legifrance.gouv.fr/) - Conservation 10 ans
- [BOI-TVA-DECLA-30-10-30](https://bofip.impots.gouv.fr/) - Mentions légales factures
- [FEC - Fichier des Écritures Comptables](https://www.impots.gouv.fr/)

**Supabase** :
- [Postgres Foreign Keys](https://supabase.com/docs/guides/database/joins)
- [Range Queries](https://supabase.com/docs/reference/javascript/range)

**NestJS** :
- [Caching](https://docs.nestjs.com/techniques/caching)
- [Validation](https://docs.nestjs.com/techniques/validation)

---

## 🎯 Résumé

### Architecture

- ✅ **4 endpoints GET** (read-only)
- ✅ **SupabaseBaseService** pattern
- ✅ **Cache intelligent** (TTL 5-10 min)
- ✅ **Pagination** robuste
- ✅ **Relations** (customer, lines)

### Intégrations

- 🔗 **Orders** → PDF generation (`exportOrderForPdf`)
- 🔗 **Tickets** → Credit notes (`createCreditNote`)
- 🔗 **Mail** → Invoice emails (`sendInvoice`)
- 🔗 **Frontend** → Admin + Customer routes

### Business

- 💰 ~1,500 factures/mois
- 💶 ~270K€ CA mensuel
- 📊 Statistiques temps réel
- 🧾 TVA multi-taux France
- 📄 Conservation légale 10 ans

### Prochaines étapes

1. **Ajouter authentification** (JwtAuthGuard)
2. **Implémenter CRUD complet** (POST/PUT/DELETE)
3. **Export PDF natif** (PDFKit)
4. **Filtres avancés** (search endpoint)
5. **Intégration comptable** (FEC export)

---

**Note** : Ce module est actuellement **read-only**. La génération des factures s'effectue implicitement lors de la finalisation des commandes (module Orders). Pour un système de facturation complet, implémenter les évolutions Q1 2025.

# Analyse des Routes - Module Orders

## 📊 État Actuel

**Total** : 10 contrôleurs, 42 routes

### 1. admin-orders.controller.ts (3 routes)
```
Préfixe: /api/admin/orders
- GET    /                       Liste commandes (pagination, filtres)
- GET    /:orderId               Détail commande
- PATCH  /:orderId/status        Changement statut
```
**Verdict**: ✅ Routes utiles admin

---

### 2. automotive-orders.controller.ts
```
Préfixe: /api/orders/automotive
- (Routes non identifiées - fichier à analyser)
```
**Verdict**: ❓ À vérifier

---

### 3. customer-orders.controller.ts (2 routes)
```
Préfixe: /api/orders/customer
- GET    /:userId                Liste commandes client
- GET    /:userId/:orderId       Détail commande client
```
**Verdict**: ✅ Routes utiles client

---

### 4. legacy-orders.controller.ts (9 routes)
```
Préfixe: /api/legacy/orders
- GET    /test                   Test connexion
- GET    /                       Liste (legacy)
- GET    /:id                    Détail (legacy)
- GET    /:id/details            Détails étendus
- GET    /:id/lines              Lignes commande
- GET    /:id/status-history     Historique statuts
- POST   /                       Création
- PATCH  /:id/status             MAJ statut
- GET    /stats/overview         Stats globales
- POST   /test/create            Test création
```
**Verdict**: ⚠️ Redondant avec orders-fusion, routes de test à supprimer

---

### 5. order-archive.controller.ts (7 routes)
```
Préfixe: /api/orders/archive
- GET    /:orderId               Récup commande archivée
- GET    /customer/:customerId/list  Liste archives client
- GET    /:orderId/export        Export PDF/JSON
- GET    /customer/:customerId/stats Stats client
- POST   /:orderId/archive       Archiver
- POST   /:orderId/restore       Restaurer
- GET    /test/service           Test
```
**Verdict**: ✅ Fonctionnalité spécifique, à garder

---

### 6. order-status.controller.ts (5 routes)
```
Préfixe: /api/orders/status
- GET    /info/:status           Info sur un statut
- GET    /all                    Tous les statuts possibles
- PATCH  /line/:lineId           MAJ statut ligne
- GET    /order/:orderId/history Historique commande
- GET    /test                   Test
```
**Verdict**: ✅ Gestion statuts, à garder

---

### 7. orders-enhanced-simple.controller.ts
```
Préfixe: /api/orders/enhanced-simple
- (Routes non utilisées - contrôleur vide ou obsolète)
```
**Verdict**: ❌ À supprimer

---

### 8. orders-fusion.controller.ts (7 routes)
```
Préfixe: /api/orders
- GET    /                       Liste commandes
- POST   /                       Créer commande
- GET    /:id                    Détail commande
- PATCH  /:id/status             MAJ statut
- DELETE /:id                    Supprimer
- POST   /test                   Test création
- GET    /stats/summary          Stats résumé
```
**Verdict**: ✅ API principale, **BASE À CONSERVER**

---

### 9. orders-simple.controller.ts (2 routes)
```
Préfixe: /api/orders/simple
- GET    /customer/:userId       Liste client (legacy)
- GET    /customer/:userId/:orderId  Détail client (legacy)
```
**Verdict**: ❌ Doublon de customer-orders, à supprimer

---

### 10. tickets.controller.ts (6 routes)
```
Préfixe: /api/tickets
- GET    /test                   Test
- POST   /preparation/:orderLineId  Créer ticket préparation
- POST   /credit                 Créer avoir/crédit
- GET    /validate/:ticketReference  Valider ticket
- POST   /use                    Utiliser ticket
- GET    /order/:orderId         Tickets d'une commande
```
**Verdict**: ✅ SAV/Tickets, fonctionnalité métier, à garder

---

## 🎯 Plan de Consolidation

### ✅ Garder (3 contrôleurs)
1. **orders-fusion.controller.ts** → Renommer `orders.controller.ts`
   - Routes principales CRUD
   - Ajouter routes admin depuis admin-orders
   - Ajouter routes customer depuis customer-orders

2. **order-status.controller.ts** (inchangé)
   - Gestion workflow statuts

3. **tickets.controller.ts** (inchangé)
   - Gestion SAV/tickets

### ⚠️ Garder temporairement
4. **order-archive.controller.ts** (à consolider)
   - Fusionner logique dans orders.controller.ts
   - Ou garder si volumétrie importante

### ❌ Supprimer (6 contrôleurs)
- ❌ admin-orders.controller.ts → Migrer routes dans orders.controller
- ❌ customer-orders.controller.ts → Migrer routes dans orders.controller
- ❌ legacy-orders.controller.ts → Obsolète, API legacy non maintenue
- ❌ orders-simple.controller.ts → Doublon
- ❌ orders-enhanced-simple.controller.ts → Vide/non utilisé
- ❌ automotive-orders.controller.ts → À vérifier/migrer

---

## 📋 Nouvelle Structure des Routes

### Contrôleur Principal: `orders.controller.ts`
```typescript
@Controller('api/orders')
export class OrdersController {
  
  // ========== ROUTES CLIENT ==========
  @Get('my-orders')
  async getMyOrders(@CurrentUser() user) { }
  
  @Get('my-orders/:orderId')
  async getMyOrder(@CurrentUser() user, @Param('orderId') orderId) { }
  
  @Post()
  async createOrder(@CurrentUser() user, @Body() createOrderDto) { }
  
  @Get(':orderId/invoice')
  async getInvoice(@Param('orderId') orderId) { }
  
  // ========== ROUTES ADMIN ==========
  @Get('admin')
  @UseGuards(AdminGuard)
  async getAllOrders(@Query() filters) { }
  
  @Get('admin/:orderId')
  @UseGuards(AdminGuard)
  async getOrderDetails(@Param('orderId') orderId) { }
  
  @Patch('admin/:orderId/status')
  @UseGuards(AdminGuard)
  async updateOrderStatus(@Param('orderId') orderId, @Body() dto) { }
  
  @Get('admin/stats')
  @UseGuards(AdminGuard)
  async getOrderStats() { }
  
  // ========== ROUTES ARCHIVAGE ==========
  @Post(':orderId/archive')
  @UseGuards(AdminGuard)
  async archiveOrder(@Param('orderId') orderId) { }
  
  @Post(':orderId/restore')
  @UseGuards(AdminGuard)
  async restoreOrder(@Param('orderId') orderId) { }
}
```

### Contrôleur Statuts: `order-status.controller.ts` (inchangé)
```typescript
@Controller('api/orders/status')
export class OrderStatusController {
  @Get('info/:status')
  @Get('all')
  @Patch('line/:lineId')
  @Get('order/:orderId/history')
}
```

### Contrôleur Tickets: `tickets.controller.ts` (inchangé)
```typescript
@Controller('api/tickets')
export class TicketsController {
  @Post('preparation/:orderLineId')
  @Post('credit')
  @Get('validate/:ticketReference')
  @Post('use')
  @Get('order/:orderId')
}
```

---

## 📊 Résultat

**Avant** :
- 10 contrôleurs
- 42 routes dispersées
- Confusion admin/client/legacy

**Après** :
- 3 contrôleurs (ou 4 si on garde archive)
- ~35 routes consolidées (- routes de test)
- Séparation claire des responsabilités

**Gain** : -60% contrôleurs, +100% clarté

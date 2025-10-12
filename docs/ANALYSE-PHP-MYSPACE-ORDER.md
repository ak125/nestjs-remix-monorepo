# 📦 ANALYSE PHP - myspace.order.index.php

**Date**: 2025-10-06  
**Fichier**: `myspace.order.index.php`  
**Objectif**: Dashboard des commandes client (liste des commandes)

---

## 🎯 FONCTIONNALITÉ

**Page de gestion des commandes d'un client connecté**
- Liste toutes les commandes du client
- Affichage du statut de paiement
- Accès aux factures (commenté)
- Menu latéral de navigation

---

## 🔍 ANALYSE SQL

### Requête principale

```sql
SELECT * FROM ___XTR_ORDER 
WHERE ORD_CST_ID = $connectedclt_id 
ORDER BY ORD_DATE DESC
```

**Table**: `___xtr_order`  
**Filtre**: ID du client connecté  
**Tri**: Par date décroissante (commandes les plus récentes en premier)

### Colonnes utilisées dans le code

| Nom PHP | Colonne SQL | Type | Description |
|---------|-------------|------|-------------|
| `$commande_id_this` | `ORD_ID` | int | ID de la commande |
| `$commande_is_payed` | `ORD_IS_PAY` | '0'/'1' | Statut paiement |
| - | `ORD_DATE` | date | Date de la commande |
| - | `ORD_TOTAL_TTC` | decimal | Montant TTC |

---

## 🔗 DÉPENDANCES

### Sessions
```php
session_start();
$mailclt = $_SESSION['myaklog'];  // Email du client connecté
```

### Données client récupérées
```php
$connectedclt_id        // CST_ID
$connectedclt_mail      // CST_MAIL
$connectedclt_civ       // CST_CIVITILY
$connectedclt_nom       // CST_NAME
$connectedclt_prenom    // CST_FNAME
$connectedclt_adr       // CST_ADDRESS
$connectedclt_tel       // CST_TEL
$connectedclt_port      // CST_GSM
$connectedclt_zipcode   // CST_ZIP_CODE
$connectedclt_ville     // CST_CITY
$connectedclt_pays      // CST_COUNTRY
$connectedclt_is_pro    // CST_IS_PRO
$connectedclt_ste       // CST_RS
$connectedclt_siret     // CST_SIRET
```

**Note**: Ces données ne sont PAS affichées dans cette page, mais récupérées pour vérification de session.

---

## 🎨 AFFICHAGE

### Structure de la liste des commandes

**Colonnes affichées** :

1. **Numéro de commande** (col-2)
   - Format: `{ORD_ID}/A`
   - Badge jaune si non payée

2. **Date** (col-3)
   - Format: `dd/mm/YYYY`
   - Badge jaune si non payée

3. **Montant** (col-2)
   - Format: `{TOTAL} €`
   - Badge jaune si non payée

4. **Statut** (col-4)
   - "En attente de paiement" (si `ORD_IS_PAY = 0`)
   - "Payé" (si `ORD_IS_PAY = 1`)
   - Badge jaune si non payée

5. **Facture** (col-1)
   - Lien vers facture (actuellement désactivé/commenté)
   - "-" affiché à la place

### Message si aucune commande
```
"Vous n'avez aucune commande pour le moment."
```

### Style conditionnel
```php
<?php if($commande_is_payed==0) { echo 'newBg'; } ?>
```
**Classe `newBg`** : Fond jaune pour les commandes en attente de paiement

---

## 🔄 LOGIQUE MÉTIER

### 1. Vérification de session
```php
if(isset($_SESSION['myaklog'])) {
    // Client connecté → Afficher les commandes
} else {
    // Client non connecté → Rediriger vers login
    require_once('myspace.connect.try.php');
}
```

### 2. Récupération des commandes
```php
$query_commande = "SELECT * FROM ___XTR_ORDER 
    WHERE ORD_CST_ID = $connectedclt_id 
    ORDER BY ORD_DATE DESC";
$request_commande = $conn->query($query_commande);
```

### 3. Affichage des commandes
```php
if ($request_commande->num_rows > 0) {
    // Boucle sur les commandes
    while($result_commande = $request_commande->fetch_assoc()) {
        // Affichage de chaque commande
    }
} else {
    // Message "Aucune commande"
}
```

### 4. Lien facture (désactivé)
```php
if($commande_is_payed==1) {
    /*
    <a target="_blank" href='/client/order/{ORD_ID}'>
        <u>Facture</u>
    </a>
    */
    echo "-";  // Actuellement désactivé
}
```

---

## 📊 COMPARAISON AVEC TYPESCRIPT

### Interface TypeScript nécessaire

```typescript
interface Order {
  // Identification
  id: string;                    // ORD_ID
  customerId: string;            // ORD_CST_ID
  
  // Dates
  date: Date;                    // ORD_DATE
  createdAt?: Date;              // ORD_CREATED_AT
  
  // Montants
  totalTTC: number;              // ORD_TOTAL_TTC
  totalHT?: number;              // ORD_TOTAL_HT
  totalTVA?: number;             // ORD_TOTAL_TVA
  
  // Statut
  isPaid: boolean;               // ORD_IS_PAY ('0'/'1')
  status: 'pending' | 'paid' | 'cancelled' | 'shipped';
  
  // Informations complémentaires
  info?: string;                 // ORD_INFO
  trackingNumber?: string;       // ORD_TRACKING
  shippingMethod?: string;       // ORD_SHIPPING_METHOD
  
  // Relations
  items?: OrderItem[];           // Produits de la commande
  invoiceUrl?: string;           // Lien vers la facture
}

interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}
```

### Mapping Supabase → TypeScript

```typescript
function mapSupabaseToOrder(dbData: any): Order {
  return {
    id: String(dbData.ord_id),
    customerId: String(dbData.ord_cst_id),
    date: new Date(dbData.ord_date),
    totalTTC: parseFloat(dbData.ord_total_ttc) || 0,
    totalHT: parseFloat(dbData.ord_total_ht) || 0,
    totalTVA: parseFloat(dbData.ord_total_tva) || 0,
    isPaid: dbData.ord_is_pay === '1',
    status: dbData.ord_is_pay === '1' ? 'paid' : 'pending',
    info: dbData.ord_info || undefined,
    trackingNumber: dbData.ord_tracking || undefined,
    shippingMethod: dbData.ord_shipping_method || undefined,
  };
}
```

---

## 🆕 FONCTIONNALITÉS À IMPLÉMENTER

### Backend (NestJS)

**Service**: `OrdersConsolidatedService`

```typescript
// Récupérer les commandes d'un utilisateur
async getUserOrders(userId: string): Promise<Order[]> {
  const { data, error } = await this.supabase
    .from('___xtr_order')
    .select('*')
    .eq('ord_cst_id', userId)
    .order('ord_date', { ascending: false });
  
  if (error) throw error;
  
  return (data || []).map(mapSupabaseToOrder);
}

// Récupérer une commande spécifique
async getOrderById(orderId: string): Promise<Order> {
  const { data, error } = await this.supabase
    .from('___xtr_order')
    .select('*')
    .eq('ord_id', orderId)
    .single();
  
  if (error || !data) {
    throw new NotFoundException('Commande non trouvée');
  }
  
  return mapSupabaseToOrder(data);
}

// Récupérer les articles d'une commande
async getOrderItems(orderId: string): Promise<OrderItem[]> {
  const { data, error } = await this.supabase
    .from('___xtr_order_item')  // Nom hypothétique
    .select('*')
    .eq('oit_ord_id', orderId);
  
  if (error) throw error;
  
  return data || [];
}
```

**Contrôleur**: `OrdersConsolidatedController`

```typescript
@Get('users/:userId/orders')
@UseGuards(AuthenticatedGuard)
async getUserOrders(
  @Param('userId') userId: string,
  @Req() req: RequestWithUser
) {
  // Vérifier que l'utilisateur peut voir ces commandes
  if (req.user.id !== userId && !req.user.isAdmin) {
    throw new ForbiddenException();
  }
  
  const orders = await this.ordersService.getUserOrders(userId);
  return {
    success: true,
    data: orders,
    total: orders.length,
  };
}

@Get('orders/:orderId')
@UseGuards(AuthenticatedGuard)
async getOrder(@Param('orderId') orderId: string) {
  const order = await this.ordersService.getOrderById(orderId);
  return {
    success: true,
    data: order,
  };
}

@Get('orders/:orderId/items')
@UseGuards(AuthenticatedGuard)
async getOrderItems(@Param('orderId') orderId: string) {
  const items = await this.ordersService.getOrderItems(orderId);
  return {
    success: true,
    data: items,
    total: items.length,
  };
}
```

### Frontend (Remix)

**Route**: `frontend/app/routes/myspace.orders.tsx`

```typescript
interface LoaderData {
  orders: Order[];
  user: User;
  stats: {
    totalOrders: number;
    paidOrders: number;
    pendingOrders: number;
    totalSpent: number;
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await getSession(request.headers.get('Cookie'));
  const userId = session.get('userId');
  
  if (!userId) {
    return redirect('/login');
  }
  
  // Récupérer les commandes
  const ordersResponse = await fetch(
    `http://localhost:3000/api/users/${userId}/orders`
  );
  const ordersData = await ordersResponse.json();
  const orders = ordersData.data;
  
  // Calculer les stats
  const paidOrders = orders.filter((o: Order) => o.isPaid);
  const pendingOrders = orders.filter((o: Order) => !o.isPaid);
  const totalSpent = paidOrders.reduce(
    (sum: number, o: Order) => sum + o.totalTTC,
    0
  );
  
  return json<LoaderData>({
    orders,
    stats: {
      totalOrders: orders.length,
      paidOrders: paidOrders.length,
      pendingOrders: pendingOrders.length,
      totalSpent,
    },
  });
};

export default function MyspaceOrders() {
  const { orders, stats } = useLoaderData<typeof loader>();
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Mes commandes</h1>
      
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Payées</p>
            <p className="text-2xl font-bold text-green-600">
              {stats.paidOrders}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">En attente</p>
            <p className="text-2xl font-bold text-yellow-600">
              {stats.pendingOrders}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Total dépensé</p>
            <p className="text-2xl font-bold">
              {stats.totalSpent.toFixed(2)} €
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Liste des commandes */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left">Numéro</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-center">Facture</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <p className="text-muted-foreground">
                      Vous n'avez aucune commande pour le moment.
                    </p>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    className={cn(
                      'hover:bg-muted/50',
                      !order.isPaid && 'bg-yellow-50'
                    )}
                  >
                    <td className="px-4 py-3 font-medium">
                      {order.id}/A
                    </td>
                    <td className="px-4 py-3">
                      {new Date(order.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {order.totalTTC.toFixed(2)} €
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={order.isPaid ? 'default' : 'secondary'}
                      >
                        {order.isPaid 
                          ? 'Payé' 
                          : 'En attente de paiement'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {order.isPaid ? (
                        <Link to={`/myspace/orders/${order.id}/invoice`}>
                          <Button variant="ghost" size="sm">
                            <FileText className="w-4 h-4" />
                          </Button>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 🔗 RELATIONS AVEC AUTRES FICHIERS

### Fichiers PHP liés

1. **myspace.account.index.php** ← Page principale du compte
2. **myspace.account.menu.php** ← Menu latéral (navigation)
3. **myspace.connect.try.php** ← Formulaire de connexion (si non connecté)
4. **global.header.section.php** ← En-tête du site
5. **global.footer.section.php** ← Pied de page

### Tables Supabase nécessaires

1. **___xtr_order** ← Table principale des commandes
2. **___xtr_customer** ← Table des clients (pour vérification session)
3. **___xtr_order_item** (hypothétique) ← Articles de chaque commande
4. **___xtr_payment** (hypothétique) ← Historique des paiements

---

## 📋 CHECKLIST D'IMPLÉMENTATION

### Backend
- [ ] Créer `OrdersConsolidatedService`
- [ ] Créer `OrdersConsolidatedController`
- [ ] Créer DTO `OrderCompleteDto`
- [ ] Créer DTO `OrderItemDto`
- [ ] Implémenter `getUserOrders(userId)`
- [ ] Implémenter `getOrderById(orderId)`
- [ ] Implémenter `getOrderItems(orderId)`
- [ ] Ajouter cache Redis
- [ ] Ajouter tests unitaires

### Frontend
- [ ] Créer route `myspace.orders.tsx`
- [ ] Créer composant `OrdersList`
- [ ] Créer composant `OrderCard`
- [ ] Créer composant `OrderStatsCards`
- [ ] Implémenter filtres (payé/en attente)
- [ ] Implémenter tri (date, montant)
- [ ] Ajouter pagination si beaucoup de commandes
- [ ] Ajouter génération PDF facture

### Intégration
- [ ] Lien depuis `myspace.account.index.php` (dashboard)
- [ ] Lien depuis menu latéral
- [ ] Lien vers détail commande
- [ ] Lien vers facture (si payé)
- [ ] Tests E2E complets

---

## 🎯 DIFFÉRENCES CLÉS AVEC PHP

| Aspect | PHP | TypeScript |
|--------|-----|------------|
| **Authentification** | Session PHP (`$_SESSION`) | JWT + Session Remix |
| **Requêtes SQL** | Direct MySQL/PDO | Supabase client |
| **Affichage** | HTML + PHP inline | JSX + React |
| **Style** | Classes CSS Bootstrap | Tailwind + Shadcn/UI |
| **Routing** | Fichier direct (`myspace.order.index.php`) | Remix routes (`myspace.orders.tsx`) |
| **API** | Pas d'API (requête directe) | REST API NestJS |
| **Cache** | Aucun | Redis intégré |
| **Validation** | Manuel | Zod + TypeScript |

---

## 🚀 PROCHAINES ÉTAPES

### 1. Analyser les tables Supabase
```sql
-- Vérifier la structure de ___xtr_order
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = '___xtr_order';

-- Exemples de données
SELECT * FROM ___xtr_order LIMIT 5;
```

### 2. Créer le service Orders
```bash
cd backend/src/modules
mkdir orders
cd orders
touch orders-consolidated.service.ts
touch orders-consolidated.controller.ts
touch dto/order-complete.dto.ts
```

### 3. Créer la route frontend
```bash
cd frontend/app/routes
touch myspace.orders.tsx
```

### 4. Tester
```bash
# Backend
curl "http://localhost:3000/api/users/usr_123/orders"

# Frontend
# Naviguer vers: http://localhost:5173/myspace/orders
```

---

## 📊 STATISTIQUES

**Commandes à implémenter** :
- ✅ Liste des commandes d'un utilisateur
- ✅ Détail d'une commande
- ✅ Articles d'une commande
- ⏳ Génération PDF facture
- ⏳ Suivi de livraison
- ⏳ Annulation de commande
- ⏳ Retour produit

**Endpoints nécessaires** :
- `GET /api/users/:userId/orders` - Liste des commandes
- `GET /api/orders/:orderId` - Détail commande
- `GET /api/orders/:orderId/items` - Articles
- `GET /api/orders/:orderId/invoice` - Facture PDF
- `GET /api/orders/:orderId/tracking` - Suivi
- `POST /api/orders/:orderId/cancel` - Annuler
- `POST /api/orders/:orderId/return` - Retourner

---

**Date de création** : 2025-10-06  
**Auteur** : GitHub Copilot  
**Statut** : ✅ Analyse complète terminée

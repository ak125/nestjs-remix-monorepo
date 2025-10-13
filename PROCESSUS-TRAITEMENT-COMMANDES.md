# 📦 Processus de Traitement des Commandes - Guide Complet

> **Date :** 12 octobre 2025  
> **Objectif :** Documenter le workflow complet de traitement d'une commande  
> **Type :** Guide technique & fonctionnel

---

## 🎯 Vue d'Ensemble

### Cycle de Vie d'une Commande

```
Client → Panier → Commande → Paiement → Validation → Traitement → Expédition → Livraison
   1        2         3          4          5            6            7           8
```

---

## 📊 Statuts de Commande

### Table `___xtr_order_status`

| ID | Statut | Description | Couleur |
|----|--------|-------------|---------|
| `1` | **En attente** | Commande créée, paiement non validé | 🟡 Jaune |
| `2` | **Confirmée** | Paiement validé, en cours de préparation | 🔵 Bleu |
| `3` | **En cours** | Commande en préparation | 🟣 Violet |
| `4` | **Expédiée** | Colis envoyé au transporteur | 🟠 Orange |
| `5` | **Livrée** | Colis reçu par le client | 🟢 Vert |
| `6` | **Annulée** | Commande annulée (client ou admin) | 🔴 Rouge |

### Champs Clés

```sql
___xtr_order:
- ord_ords_id    : Statut (1-6)
- ord_is_pay     : Paiement validé ('0' ou '1')
- ord_date       : Date de création
- ord_date_pay   : Date de paiement
- ord_date_ship  : Date d'expédition
- ord_date_deliv : Date de livraison
```

---

## 🔄 Workflow Détaillé

### 📝 Étape 1 : Création de Commande

**Déclencheur :** Client valide son panier

**Service :** `legacy-order.service.ts` → `createLegacyOrder()`

```typescript
// 1. Validation client existe
const customer = await getCustomer(customerId);

// 2. Génération numéro commande
const orderNumber = await generateOrderNumber(); // ORD0001

// 3. Calcul des totaux
const totals = calculateOrderTotals(orderLines);

// 4. Insertion commande
await supabase.from('___xtr_order').insert({
  ord_id: orderNumber,
  ord_cst_id: customerId,
  ord_ords_id: '1',        // ✅ En attente
  ord_is_pay: '0',         // ❌ Non payé
  ord_date: new Date(),
  ord_total_ttc: totals.totalTtc,
  ord_total_ht: totals.totalHt,
  // ...
});

// 5. Insertion lignes commande
await supabase.from('___xtr_order_line').insert(orderLines);
```

**État BDD :**
```
___xtr_order:
  ord_id: "ORD0001"
  ord_ords_id: "1"    (En attente)
  ord_is_pay: "0"     (Non payé)
  ord_date: "2025-10-12T10:00:00Z"
```

---

### 💳 Étape 2 : Paiement

**Déclencheur :** Client clique "Payer" et choisit méthode (CB/PayPal)

#### 2.1 - Redirection Passerelle

**Service :** `payments.controller.ts` → `initiatePayment()`

```typescript
// 1. Récupérer commande
const order = await getOrderById(orderId);

// 2. Créer session paiement (Stripe/CyberPlus/PayPal)
const session = await paymentGateway.createSession({
  amount: order.totalTtc,
  currency: 'EUR',
  orderId: order.id,
  successUrl: `${baseUrl}/payment/success`,
  cancelUrl: `${baseUrl}/payment/cancel`,
});

// 3. Retourner URL redirection
return { redirectUrl: session.url };
```

**Client redirigé vers :**
- 💳 CyberPlus : `https://cyberplus.fr/payment?session=...`
- 🅿️ PayPal : `https://paypal.com/checkoutnow?token=...`

#### 2.2 - Callback Passerelle

**Webhook :** POST `/api/payments/callback`

**Service :** `payments.controller.ts` → `handlePaymentCallback()`

```typescript
// 1. Validation signature callback
if (!validateSignature(callbackData)) {
  throw new UnauthorizedException();
}

// 2. Enregistrement ic_postback (audit)
await supabase.from('ic_postback').insert({
  id_ic_postback: callbackData.transactionId,
  orderid: callbackData.orderId,
  paymentmethod: callbackData.paymentMethod, // card, paypal
  transactionid: callbackData.transactionId,
  amount: callbackData.amount,
  status: callbackData.status,              // success, failed
  datepayment: new Date(),
});

// 3. Mise à jour commande SI succès
if (callbackData.status === 'success') {
  await supabase.from('___xtr_order').update({
    ord_is_pay: '1',           // ✅ Payé
    ord_date_pay: new Date(),
    ord_ords_id: '2',          // ✅ Confirmée
  }).eq('ord_id', callbackData.orderId);

  // 4. Envoi email confirmation
  await sendOrderConfirmationEmail(order);
}
```

**État BDD après paiement réussi :**
```
___xtr_order:
  ord_id: "ORD0001"
  ord_ords_id: "2"    (Confirmée) ← Changé
  ord_is_pay: "1"     (Payé) ← Changé
  ord_date_pay: "2025-10-12T10:05:00Z" ← Nouveau

ic_postback:
  id_ic_postback: "TXN_ABC123"
  orderid: "ORD0001"
  paymentmethod: "cyberplus"
  transactionid: "TXN_ABC123"
  status: "success"
  datepayment: "2025-10-12T10:05:00Z"
```

---

### ✅ Étape 3 : Validation Admin (Optionnel)

**Interface :** `/admin/orders` → Bouton "Valider"

**Action :** `order-actions.controller.ts` → `validateOrder()`

```typescript
// 1. Vérifier paiement effectué
if (order.ord_is_pay !== '1') {
  throw new BadRequestException('Commande non payée');
}

// 2. Passer en statut "En cours"
await supabase.from('___xtr_order').update({
  ord_ords_id: '3', // En cours
}).eq('ord_id', orderId);

// 3. Créer entrée historique
await supabase.from('___xtr_order_status_history').insert({
  osh_ord_id: orderId,
  osh_ords_id: '3',
  osh_date: new Date(),
  osh_comment: 'Commande validée par admin',
});

// 4. Notification fournisseur
await notifySupplier(order);
```

**État BDD :**
```
___xtr_order:
  ord_ords_id: "3"    (En cours) ← Changé
```

---

### 📦 Étape 4 : Préparation & Expédition

**Interface :** `/admin/orders` → Bouton "Expédier"

**Action :** `order-actions.controller.ts` → `shipOrder()`

```typescript
// 1. Validation stock disponible
for (const line of orderLines) {
  const stock = await getProductStock(line.productId);
  if (stock < line.quantity) {
    throw new BadRequestException('Stock insuffisant');
  }
}

// 2. Décrémenter stock
for (const line of orderLines) {
  await decrementStock(line.productId, line.quantity);
}

// 3. Générer numéro de suivi (API transporteur)
const trackingNumber = await courierApi.createShipment({
  orderId: order.ord_id,
  address: order.deliveryAddress,
  weight: calculateWeight(orderLines),
});

// 4. Mise à jour commande
await supabase.from('___xtr_order').update({
  ord_ords_id: '4',              // Expédiée
  ord_date_ship: new Date(),
  ord_tracking: trackingNumber,
}).eq('ord_id', orderId);

// 5. Email client avec suivi
await sendShippingEmail(order, trackingNumber);
```

**État BDD :**
```
___xtr_order:
  ord_ords_id: "4"         (Expédiée) ← Changé
  ord_date_ship: "2025-10-15T14:00:00Z" ← Nouveau
  ord_tracking: "FR123456789" ← Nouveau
```

---

### 🚚 Étape 5 : Livraison

**Déclencheur :** Webhook transporteur OU scan colis par client

**Webhook :** POST `/api/orders/delivery-confirmation`

```typescript
// 1. Validation tracking number
const order = await getOrderByTracking(trackingNumber);

// 2. Mise à jour statut
await supabase.from('___xtr_order').update({
  ord_ords_id: '5',          // Livrée
  ord_date_deliv: new Date(),
}).eq('ord_id', order.ord_id);

// 3. Email satisfaction
await sendDeliveryConfirmationEmail(order);

// 4. Demande avis client (J+2)
await scheduleReviewRequest(order, 2);
```

**État BDD final :**
```
___xtr_order:
  ord_ords_id: "5"          (Livrée) ← Changé
  ord_date_deliv: "2025-10-18T16:30:00Z" ← Nouveau
```

---

## 🔄 Cas Spéciaux

### ❌ Annulation Commande

**Déclencheur :** Client ou Admin annule

**Conditions :**
- Avant expédition : Remboursement automatique
- Après expédition : Retour nécessaire

**Action :** `order-actions.controller.ts` → `cancelOrder()`

```typescript
// 1. Vérifier si expédiée
if (order.ord_ords_id === '4' || order.ord_ords_id === '5') {
  throw new BadRequestException('Commande déjà expédiée, retour requis');
}

// 2. Remettre stock
for (const line of orderLines) {
  await incrementStock(line.productId, line.quantity);
}

// 3. Remboursement si payée
if (order.ord_is_pay === '1') {
  await refundPayment(order.ord_id);
}

// 4. Mise à jour statut
await supabase.from('___xtr_order').update({
  ord_ords_id: '6',          // Annulée
  ord_cancel_date: new Date(),
  ord_cancel_reason: reason,
}).eq('ord_id', orderId);

// 5. Email confirmation annulation
await sendCancellationEmail(order);
```

---

### 🔄 Retour Produit

**Interface :** `/client/orders/:id/return`

**Workflow :**
1. Client déclare retour (formulaire + raison)
2. Admin valide retour → génère étiquette retour
3. Client renvoie colis
4. Réception → contrôle qualité
5. Remboursement si conforme

**Tables :**
```sql
___xtr_order_return:
  - ort_ord_id      : ID commande
  - ort_reason      : Raison retour
  - ort_status      : pending, approved, received, refunded
  - ort_date        : Date demande
  - ort_refund_date : Date remboursement
```

---

## 📊 Dashboard Admin - Actions Disponibles

### Page `/admin/orders`

**Filtres :**
- Tous les statuts
- En attente (ord_ords_id = 1)
- Confirmée (ord_ords_id = 2)
- En cours (ord_ords_id = 3)
- Expédiée (ord_ords_id = 4)
- Livrée (ord_ords_id = 5)
- Annulée (ord_ords_id = 6)

**Actions par statut :**

| Statut | Actions Disponibles |
|--------|---------------------|
| **En attente** | ❌ Annuler, 💬 Relancer paiement |
| **Confirmée** | ✅ Valider (→ En cours), ❌ Annuler |
| **En cours** | 📦 Expédier, ❌ Annuler |
| **Expédiée** | 🚚 Suivi colis, ↩️ Retour |
| **Livrée** | 📝 Avis client, ↩️ Retour |
| **Annulée** | 👁️ Voir détails uniquement |

---

## 🔧 Services Backend

### 1. `LegacyOrderService`
**Fichier :** `backend/src/database/services/legacy-order.service.ts`

**Méthodes principales :**
```typescript
- createLegacyOrder(data)         // Créer commande
- getOrderById(orderId)           // Récupérer commande
- getAllOrders(filters)           // Liste paginée
- updateOrderStatus(orderId, status) // Changer statut
- cancelOrder(orderId, reason)    // Annuler
- getOrderStats()                 // Statistiques
```

### 2. `PaymentsController`
**Fichier :** `backend/src/modules/payments/controllers/payments.controller.ts`

**Endpoints :**
```typescript
POST /api/payments/initiate           // Initier paiement
POST /api/payments/callback            // Callback passerelle
GET  /api/payments/:orderId/status     // Statut paiement
POST /api/payments/:orderId/refund     // Remboursement
```

### 3. `OrderActionsController`
**Fichier :** `backend/src/modules/orders/controllers/order-actions.controller.ts`

**Endpoints :**
```typescript
POST /api/orders/:id/validate         // Valider commande
POST /api/orders/:id/ship             // Expédier
POST /api/orders/:id/deliver          // Marquer livrée
POST /api/orders/:id/cancel           // Annuler
POST /api/orders/:id/return           // Retour
```

---

## 📧 Emails Automatiques

### 1. **Confirmation Commande**
**Déclencheur :** Création commande (statut 1)
**Template :** `order-created.html`
**Contenu :**
- Numéro commande
- Liste produits
- Montant total
- Lien paiement si non payé

### 2. **Confirmation Paiement**
**Déclencheur :** Paiement validé (statut 1 → 2)
**Template :** `payment-confirmed.html`
**Contenu :**
- Reçu paiement
- Méthode utilisée (CB/PayPal)
- Transaction ID
- Délai préparation

### 3. **Expédition**
**Déclencheur :** Commande expédiée (statut 4)
**Template :** `order-shipped.html`
**Contenu :**
- Numéro de suivi
- Lien tracking
- Délai livraison estimé

### 4. **Livraison**
**Déclencheur :** Colis livré (statut 5)
**Template :** `order-delivered.html`
**Contenu :**
- Confirmation livraison
- Demande avis
- Lien retour si besoin

---

## 🔍 Logs & Audit

### Table `___xtr_order_status_history`

**Traçabilité complète :**
```sql
INSERT INTO ___xtr_order_status_history (
  osh_ord_id,
  osh_ords_id,
  osh_date,
  osh_admin_id,
  osh_comment
) VALUES (
  'ORD0001',
  '2',
  NOW(),
  'adm_123',
  'Paiement validé - CyberPlus'
);
```

**Requête historique :**
```sql
SELECT 
  osh.osh_date,
  os.ords_label,
  osh.osh_comment,
  adm.adm_name
FROM ___xtr_order_status_history osh
JOIN ___xtr_order_status os ON osh.osh_ords_id = os.ords_id
LEFT JOIN ___xtr_admin adm ON osh.osh_admin_id = adm.adm_id
WHERE osh.osh_ord_id = 'ORD0001'
ORDER BY osh.osh_date ASC;
```

**Résultat :**
```
Date                 | Statut      | Commentaire                | Admin
---------------------|-------------|----------------------------|--------
2025-10-12 10:00:00 | En attente  | Commande créée             | -
2025-10-12 10:05:00 | Confirmée   | Paiement validé - CyberPlus| -
2025-10-13 09:00:00 | En cours    | Validée par admin          | John Doe
2025-10-15 14:00:00 | Expédiée    | Colis FR123456789          | John Doe
2025-10-18 16:30:00 | Livrée      | Livraison confirmée        | -
```

---

## 📱 Interface Client

### Page `/client/orders`

**Liste des commandes :**
```tsx
<OrderList>
  {orders.map(order => (
    <OrderCard>
      <Badge status={order.status} />
      <OrderNumber>{order.ord_id}</OrderNumber>
      <Date>{formatDate(order.ord_date)}</Date>
      <Total>{formatPrice(order.ord_total_ttc)}</Total>
      <Actions>
        {order.status === 'pending' && (
          <Button onClick={payOrder}>💳 Payer</Button>
        )}
        {order.status === 'shipped' && (
          <Button onClick={trackOrder}>🚚 Suivre</Button>
        )}
        {order.status === 'delivered' && (
          <Button onClick={returnOrder}>↩️ Retour</Button>
        )}
      </Actions>
    </OrderCard>
  ))}
</OrderList>
```

---

## 🎯 KPIs & Statistiques

### Dashboard Admin

**Métriques principales :**
```typescript
// Service: getOrderStats()
{
  totalOrders: 1444,
  completedOrders: 452,    // Livrées
  pendingOrders: 992,      // En attente paiement
  totalRevenue: 51493.94,
  
  // Répartition par statut
  byStatus: {
    pending: 992,
    confirmed: 120,
    processing: 85,
    shipped: 67,
    delivered: 452,
    cancelled: 28
  },
  
  // Taux de conversion
  conversionRate: 31.3,    // % commandes payées
  
  // Délai moyen
  avgProcessingTime: 2.5,  // Jours (confirmée → expédiée)
  avgDeliveryTime: 3.2,    // Jours (expédiée → livrée)
  
  // Méthodes de paiement
  paymentMethods: {
    cyberplus: 65,         // %
    paypal: 28,           // %
    bank_transfer: 7      // %
  }
}
```

---

## ✅ Checklist Traitement Commande

### Avant Validation
- [ ] Commande payée (`ord_is_pay = '1'`)
- [ ] Postback enregistré dans `ic_postback`
- [ ] Client notifié par email
- [ ] Adresses complètes (facturation + livraison)

### Avant Expédition
- [ ] Stock vérifié et réservé
- [ ] Étiquette générée
- [ ] Numéro de suivi créé
- [ ] Transporteur notifié

### Après Livraison
- [ ] Confirmation reçue (webhook transporteur)
- [ ] Email satisfaction envoyé
- [ ] Avis client demandé (J+2)
- [ ] Stock mis à jour

---

## 🔐 Sécurité & Validation

### Validation Callback Paiement
```typescript
function validatePaymentCallback(data: any, signature: string): boolean {
  // 1. Vérifier signature HMAC
  const expectedSignature = crypto
    .createHmac('sha256', process.env.PAYMENT_SECRET)
    .update(JSON.stringify(data))
    .digest('hex');
  
  if (signature !== expectedSignature) {
    throw new UnauthorizedException('Invalid signature');
  }
  
  // 2. Vérifier montant correspond
  const order = await getOrderById(data.orderId);
  if (parseFloat(data.amount) !== order.ord_total_ttc) {
    throw new BadRequestException('Amount mismatch');
  }
  
  // 3. Vérifier pas déjà traité (idempotence)
  const existingPostback = await getPostback(data.transactionId);
  if (existingPostback) {
    return false; // Déjà traité
  }
  
  return true;
}
```

---

## 📖 Ressources

### Documentation Backend
- `backend/src/database/services/legacy-order.service.ts`
- `backend/src/modules/payments/controllers/payments.controller.ts`
- `backend/src/modules/orders/controllers/order-actions.controller.ts`

### Documentation Frontend
- `frontend/app/routes/admin.orders._index.tsx`
- `frontend/app/routes/client.orders._index.tsx`
- `frontend/app/services/order.server.ts`

### Fichiers MD Connexes
- `CORRECTION-PAGINATION-PAIEMENTS.md`
- `AJOUT-METHODE-PAIEMENT-REELLE.md`
- `ANALYSE-DECALAGE-PAIEMENTS-COMMANDES.md`

---

**📦 Guide complet du processus de traitement des commandes documenté !**

**Date :** 12 octobre 2025  
**Auteur :** Documentation Technique  
**Version :** 1.0

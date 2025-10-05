# ⚠️ NOTES - Architecture Paiements à Corriger

**Date:** 2025-10-05  
**Problème:** Table `payments` n'existe pas  
**Status:** ⚠️ À corriger avant production

---

## 🚨 Problème Identifié

### Erreur Constatée
```
Error: Failed to create payment: undefined
at PaymentDataService.createPayment (payment-data.service.ts:27:15)
```

### Cause
Le module Payments essaie d'utiliser une table `payments` qui n'existe pas dans Supabase.

---

## 🗃️ Architecture Réelle des Données

### Tables Existantes

#### 1. `___XTR_ORDER` (Commandes)
```sql
___XTR_ORDER
├── ord_id (PK)              → ID commande
├── ord_cst_id (FK)          → Client
├── ord_num                  → Numéro
├── ord_date                 → Date
├── ord_status               → Statut commande
├── ord_total_ht             → Montant HT
├── ord_total_ttc            → Montant TTC
├── ord_payment_status       → Statut paiement (?)
└── ord_payment_method       → Méthode paiement (?)
```

#### 2. `ic_postback` (Callbacks bancaires)
```sql
ic_postback
├── id_ic_postback (PK)      → ID callback
├── id_com                   → ID commande
├── status                   → Statut
├── statuscode               → Code statut
├── orderid                  → Order ID
├── paymentid                → Payment ID
├── transactionid            → Transaction ID
├── amount                   → Montant
├── currency                 → Devise
├── paymentmethod            → Méthode
├── ip                       → IP client
├── ips                      → IP serveur
└── datepayment              → Date paiement
```

#### 3. `___XTR_CUSTOMER` (Clients)
```sql
___XTR_CUSTOMER
├── cst_id (PK)
├── cst_mail
├── cst_name
└── ...
```

#### 4. `___CONFIG_ADMIN` (Configuration)
```sql
___CONFIG_ADMIN
├── config paramètres système
└── ...
```

---

## 💡 Solutions Proposées

### Option A: Utiliser ___XTR_ORDER (Recommandé)

**Approche:** Les paiements sont liés directement aux commandes via `___XTR_ORDER`.

```typescript
// PaymentDataService - Version corrigée
async createPayment(paymentData: Partial<Payment>): Promise<Payment> {
  try {
    // 1. Créer/mettre à jour la commande avec infos paiement
    const { data: order, error } = await this.supabase
      .from('___xtr_order')
      .upsert({
        ord_cst_id: paymentData.userId,
        ord_num: paymentData.paymentReference,
        ord_date: new Date().toISOString(),
        ord_status: 1, // Pending
        ord_payment_status: 'pending',
        ord_payment_method: paymentData.method,
        ord_total_ttc: paymentData.amount,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create order: ${error.message}`);

    // 2. Créer entrée ic_postback pour tracking
    await this.supabase
      .from('ic_postback')
      .insert({
        id_ic_postback: paymentData.paymentReference,
        id_com: order.ord_id,
        orderid: order.ord_num,
        paymentid: paymentData.paymentReference,
        transactionid: paymentData.providerTransactionId || '',
        amount: paymentData.amount.toString(),
        currency: paymentData.currency,
        paymentmethod: paymentData.method,
        status: 'pending',
        datepayment: new Date().toISOString(),
      });

    // 3. Retourner format Payment
    return {
      id: order.ord_id,
      paymentReference: order.ord_num,
      amount: order.ord_total_ttc,
      currency: paymentData.currency || 'EUR',
      status: PaymentStatus.PENDING,
      method: paymentData.method,
      userId: order.ord_cst_id,
      orderId: order.ord_id,
      createdAt: new Date(order.ord_date),
      updatedAt: new Date(order.ord_date),
      refundedAmount: 0,
    } as Payment;
  } catch (error) {
    this.logger.error('Error creating payment:', error);
    throw error;
  }
}
```

### Option B: Créer table `payments` dédiée

**Approche:** Créer une vraie table `payments` séparée dans Supabase.

```sql
-- Migration Supabase
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_reference TEXT UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  status TEXT NOT NULL,
  method TEXT NOT NULL,
  provider_transaction_id TEXT,
  provider_reference TEXT,
  description TEXT,
  metadata JSONB,
  failure_reason TEXT,
  processed_at TIMESTAMP,
  refunded_amount DECIMAL(10,2) DEFAULT 0,
  user_id TEXT NOT NULL,
  order_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_reference ON payments(payment_reference);

-- Table transactions
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id),
  type TEXT NOT NULL, -- payment, refund, chargeback
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL,
  provider_transaction_id TEXT,
  provider_response JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Option C: Mode Hybride (Court terme)

**Approche:** Utiliser `ic_postback` comme source de vérité temporaire.

```typescript
// Version simplifiée pour démo
async createPayment(paymentData: Partial<Payment>): Promise<Payment> {
  try {
    const paymentId = PaymentHelper.generatePaymentReference();
    
    // Insérer directement dans ic_postback
    const { data, error } = await this.supabase
      .from('ic_postback')
      .insert({
        id_ic_postback: paymentId,
        orderid: paymentData.orderId || '',
        paymentid: paymentId,
        transactionid: '',
        amount: paymentData.amount.toString(),
        currency: paymentData.currency || 'EUR',
        paymentmethod: paymentData.method,
        status: 'pending',
        statuscode: '00',
        datepayment: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Retourner objet Payment
    return {
      id: data.id_ic_postback,
      paymentReference: data.paymentid,
      amount: parseFloat(data.amount),
      currency: data.currency,
      status: PaymentStatus.PENDING,
      method: paymentData.method,
      userId: paymentData.userId,
      orderId: data.orderid,
      createdAt: new Date(data.datepayment),
      updatedAt: new Date(data.datepayment),
      refundedAmount: 0,
    } as Payment;
  } catch (error) {
    this.logger.error('Error:', error);
    throw error;
  }
}
```

---

## 🎯 Recommandation

### Court Terme (Immédiat)
✅ **Option C: Mode Hybride**
- Utiliser `ic_postback` comme table principale
- Permet de tester immédiatement
- Pas de migration BDD nécessaire
- Suffisant pour POC/démo

### Moyen Terme (Production)
✅ **Option B: Table dédiée `payments`**
- Architecture propre et scalable
- Séparation des responsabilités
- Facilite audit et rapprochement
- Permet historique complet

### Long Terme
✅ **Option A + B: Hybride avec sync**
- Table `payments` comme source de vérité
- Sync avec `___XTR_ORDER` pour compatibilité
- `ic_postback` pour callbacks uniquement
- Architecture finale optimale

---

## 📋 Actions Immédiates

### 1. Corriger PaymentDataService (Quick Fix)

```bash
# Modifier payment-data.service.ts
# Implémenter Option C (mode hybride)
# Permet de tester immédiatement
```

### 2. Mettre à jour Tests

```bash
# Adapter tests pour utiliser ic_postback
# Vérifier compatibilité avec tables existantes
```

### 3. Documentation

```bash
# Documenter architecture actuelle
# Préciser migration future vers table dédiée
```

---

## 🔧 Code à Appliquer (Quick Fix)

Remplacer dans `payment-data.service.ts`:

```typescript
protected readonly tableName = 'ic_postback'; // Au lieu de 'payments'

async createPayment(paymentData: Partial<Payment>): Promise<Payment> {
  const paymentId = PaymentHelper.generatePaymentReference();
  
  const { data, error } = await this.supabase
    .from('ic_postback')
    .insert({
      id_ic_postback: paymentId,
      orderid: paymentData.orderId || '',
      paymentid: paymentId,
      amount: paymentData.amount.toString(),
      currency: paymentData.currency || 'EUR',
      paymentmethod: paymentData.method,
      status: 'pending',
      datepayment: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  return this.mapPostbackToPayment(data);
}

private mapPostbackToPayment(postback: any): Payment {
  return {
    id: postback.id_ic_postback,
    paymentReference: postback.paymentid,
    amount: parseFloat(postback.amount || '0'),
    currency: postback.currency,
    status: this.mapStatus(postback.status),
    method: postback.paymentmethod as PaymentMethod,
    userId: '', // À récupérer depuis order
    orderId: postback.orderid,
    createdAt: new Date(postback.datepayment),
    updatedAt: new Date(postback.datepayment),
    refundedAmount: 0,
  } as Payment;
}
```

---

## ⏱️ Timeline

### Immédiat (Aujourd'hui)
- ✅ Documenter problème
- 📋 Implémenter Option C (quick fix)
- 📋 Tester création paiement
- 📋 Valider callback

### Court Terme (1-2 jours)
- 📋 Créer migration Supabase (Option B)
- 📋 Implémenter table `payments` dédiée
- 📋 Migrer logique vers nouvelle table
- 📋 Tests complets

### Moyen Terme (1 semaine)
- 📋 Sync bidirectionnelle avec `___XTR_ORDER`
- 📋 Rapprochement bancaire
- 📋 Dashboard admin
- 📋 Exports comptables

---

**Statut:** ⚠️ BLOQUANT - À corriger avant merge  
**Priorité:** 🔴 HAUTE  
**Estimation:** 2-3h pour quick fix, 1-2 jours pour solution complète

---

**Créé le:** 2025-10-05  
**Dernière mise à jour:** 2025-10-05  
**Auteur:** GitHub Copilot

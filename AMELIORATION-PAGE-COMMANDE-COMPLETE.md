# ✅ Amélioration Page Détail Commande - COMPLÈTE

**Date:** 7 octobre 2025  
**Branche:** consolidation-dashboard  
**Statut:** ✅ Terminé

## 🎯 Objectif

Enrichir la page de détail de commande (`/admin/orders/:id`) avec toutes les informations nécessaires :
- ✅ Adresses de facturation et livraison
- ✅ Lignes de commande (articles commandés)
- ✅ Actions de traitement des lignes

## 📋 Modifications Effectuées

### 1. Backend - Service Legacy Order

**Fichier:** `backend/src/database/services/legacy-order.service.ts`

**Méthode enrichie:** `getOrderWithCustomer(orderId: string)`

```typescript
// Récupération de 6 entités liées :
1. ___xtr_order (commande principale)
2. ___xtr_customer (client)
3. ___xtr_customer_billing_address (adresse facturation)
4. ___xtr_customer_delivery_address (adresse livraison)
5. ___xtr_order_line (lignes de commande)
6. ___xtr_order_line_status (statuts des lignes)
```

**Enrichissement des lignes :**
```typescript
// 7. Enrichir les lignes avec leurs statuts
let enrichedOrderLines = orderLines || [];
if (enrichedOrderLines.length > 0) {
  enrichedOrderLines = await Promise.all(
    enrichedOrderLines.map(async (line) => {
      if (line.orl_orls_id) {
        const { data: lineStatus } = await this.supabase
          .from('___xtr_order_line_status')
          .select('*')
          .eq('orls_id', line.orl_orls_id)
          .single();
        return { ...line, lineStatus: lineStatus || null };
      }
      return { ...line, lineStatus: null };
    }),
  );
}
```

**Retour de données :**
```typescript
return {
  ...orderData,              // Toutes les colonnes ord_*
  customer: customer || null,           // Toutes les colonnes cst_*
  billingAddress: billingAddress || null,   // Toutes les colonnes cba_*
  deliveryAddress: deliveryAddress || null, // Toutes les colonnes cda_*
  orderLines: enrichedOrderLines,          // Toutes les colonnes orl_* + lineStatus
  statusDetails: orderStatus || null,      // Toutes les colonnes ords_*
};
```

### 2. Frontend - Page Détail Commande

**Fichier:** `frontend/app/routes/admin.orders.$id.tsx`

**Interface TypeScript mise à jour :**

```typescript
interface OrderDetails {
  ord_id: string;
  ord_cst_id: string;
  ord_date: string;
  ord_total_ttc: string;
  ord_is_pay: string;
  ord_ords_id: string;
  ord_amount_ht?: string;
  ord_shipping_fee_ttc?: string;
  ord_info?: string;
  statusDetails?: {
    ords_id: string;
    ords_named: string;
    ords_action: string;
    ords_color: string;
  };
  customer?: {
    cst_id: string;
    cst_fname: string;
    cst_name: string;
    cst_mail: string;
    cst_tel?: string;
    cst_gsm?: string;
  };
  billingAddress?: {
    cba_id: string;
    cba_name: string;
    cba_fname: string;
    cba_address: string;
    cba_zip_code: string;
    cba_city: string;
    cba_country: string;
    cba_tel?: string;
    cba_gsm?: string;
  };
  deliveryAddress?: {
    cda_id: string;
    cda_name: string;
    cda_fname: string;
    cda_address: string;
    cda_zip_code: string;
    cda_city: string;
    cda_country: string;
    cda_tel?: string;
    cda_gsm?: string;
  };
  orderLines?: Array<{
    orl_id: string;
    orl_ord_id: string;
    orl_pg_name: string;
    orl_pm_name?: string;
    orl_art_ref?: string;
    orl_art_quantity: string;
    orl_art_price_sell_unit_ttc?: string;
    orl_art_price_sell_ttc?: string;
    orl_art_price_buy_unit_ht?: string;
    orl_orls_id?: string;
    lineStatus?: {
      orls_id: string;
      orls_named: string;
      orls_color: string;
    };
  }>;
}
```

**Affichage des lignes de commande :**

```tsx
{order.orderLines.map((line, index) => (
  <div key={line.orl_id} className="border rounded-lg p-4">
    <div className="flex justify-between items-start gap-4">
      <div className="flex-1">
        <h4 className="font-medium">
          {line.orl_pg_name}
          {line.orl_pm_name && ` - ${line.orl_pm_name}`}
        </h4>
        {line.orl_art_ref && (
          <p className="text-gray-600">Réf: {line.orl_art_ref}</p>
        )}
        {line.lineStatus && (
          <Badge className={`mt-2 ${getStatusColor(line.lineStatus)}`}>
            {line.lineStatus.orls_named}
          </Badge>
        )}
      </div>
      <div className="text-right">
        <p className="font-medium">
          {line.orl_art_quantity} x {line.orl_art_price_sell_unit_ttc ? parseFloat(line.orl_art_price_sell_unit_ttc).toFixed(2) : '0.00'} €
        </p>
        <p className="text-lg font-bold">
          {line.orl_art_price_sell_ttc ? parseFloat(line.orl_art_price_sell_ttc).toFixed(2) : '0.00'} €
        </p>
      </div>
    </div>
    
    <div className="mt-4 pt-4 border-t">
      <OrderLineActions 
        orderId={parseInt(order.ord_id)} 
        line={line}
        onSuccess={() => window.location.reload()}
      />
    </div>
  </div>
))}
```

### 3. Composant Actions de Ligne

**Fichier:** `frontend/app/components/admin/OrderLineActions.tsx`

**Fonctionnalités :**

✅ **Actions selon statut :**
- Statut 1 : Reset, Annuler, PNC, PND, Disponible
- Statut 5 : Commander fournisseur
- Statuts 3/4 : Proposer équivalence
- Statut 91 : Accepter/Refuser équivalence
- Statut 92 : Valider équivalence

✅ **Endpoints API utilisés :**
```
PATCH /api/admin/orders/:orderId/lines/:lineId/status/:statusId
POST  /api/admin/orders/:orderId/lines/:lineId/order-from-supplier
POST  /api/admin/orders/:orderId/lines/:lineId/propose-equivalent
PATCH /api/admin/orders/:orderId/lines/:lineId/accept-equivalent
PATCH /api/admin/orders/:orderId/lines/:lineId/reject-equivalent
PATCH /api/admin/orders/:orderId/lines/:lineId/validate-equivalent
```

## 🗂️ Structure des Données

### API Response Structure

```json
{
  "success": true,
  "data": {
    "ord_id": "ORD-1759787157480-665",
    "ord_cst_id": "usr_1759774640723_njikmiz59",
    "ord_date": "2025-10-06T21:45:57.481Z",
    "ord_total_ttc": "161.95",
    "ord_is_pay": "0",
    "ord_ords_id": "1",
    "customer": {
      "cst_id": "usr_1759774640723_njikmiz59",
      "cst_mail": "monia123@gmail.com",
      "cst_fname": "monia",
      "cst_name": "diff"
    },
    "billingAddress": null,
    "deliveryAddress": null,
    "orderLines": [
      {
        "orl_id": "ORD-1759787157480-665-L001",
        "orl_pg_name": "Produit Test Phase 3",
        "orl_art_quantity": "2",
        "orl_art_price_sell_unit_ttc": "49.99",
        "orl_art_price_sell_ttc": "99.98",
        "orl_orls_id": null,
        "lineStatus": null
      }
    ],
    "statusDetails": {
      "ords_id": "1",
      "ords_named": "Commande en cours de traitement",
      "ords_action": "Réinitialisation",
      "ords_color": "373839"
    }
  }
}
```

## 📊 Affichage Frontend

### Sections de la page :

1. **Header** - ID commande, date, badges statut commande et paiement
2. **Informations client** - Nom, email, téléphone, ID client
3. **Adresse de facturation** - Nom complet, adresse, téléphones
4. **Adresse de livraison** - Nom complet, adresse, téléphones
5. **Résumé financier** - Montant HT, frais livraison, Total TTC, statut paiement
6. **Articles commandés** - Liste avec quantité, prix unitaire, total, statut, actions
7. **Informations supplémentaires** - Notes de commande

### Exemple de rendu :

```
┌─────────────────────────────────────────────────────┐
│ ← Retour  Commande #ORD-1759787157480-665         │
│           6 octobre 2025, 21:45                     │
│                                                     │
│ [En cours] [Non payé]                              │
└─────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────────┐
│ 👤 Client            │  │ 💳 Facturation           │
│ monia diff           │  │ Non spécifiée            │
│ monia123@gmail.com   │  │                          │
└──────────────────────┘  └──────────────────────────┘

┌──────────────────────┐  ┌──────────────────────────┐
│ 📍 Livraison         │  │ 💰 Résumé financier      │
│ Non spécifiée        │  │ Total TTC: 161.95 €      │
│                      │  │ [Non payé]               │
└──────────────────────┘  └──────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 📦 Articles commandés (2)                           │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Produit Test Phase 3                            │ │
│ │ 2 x 49.99 €                         99.98 €     │ │
│ │ ─────────────────────────────────────────────   │ │
│ │ [🔄 Reset] [❌ Annuler] [⚠️ PNC] [✅ Disponible] │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## 🧪 Tests de Vérification

### Test API Backend

```bash
curl -s "http://localhost:3000/api/legacy-orders/ORD-1759787157480-665" | jq '.'
```

**Vérifications :**
- ✅ `data.customer` présent avec cst_mail, cst_fname, cst_name
- ✅ `data.billingAddress` (null si non renseigné)
- ✅ `data.deliveryAddress` (null si non renseigné)
- ✅ `data.orderLines[]` tableau avec tous les champs orl_*
- ✅ `data.orderLines[].lineStatus` enrichi si orl_orls_id présent
- ✅ `data.statusDetails` avec statut global commande

### Test Frontend

```
URL: http://localhost:5173/admin/orders/ORD-1759787157480-665
```

**Vérifications :**
- ✅ Affichage client avec email et nom
- ✅ Sections adresses (affichées ou "Non spécifiée")
- ✅ Résumé financier avec montants
- ✅ Liste des articles avec quantités et prix
- ✅ Boutons d'action selon statut de ligne
- ✅ Modal de confirmation pour les actions

## 🔄 Workflow Actions Lignes

### Machine à états des lignes de commande

```
1 (En attente) ──┬──→ 2 (Annulée)
                 ├──→ 3 (PNC) ──→ 91 (Proposition équiv)
                 ├──→ 4 (PND) ──→ 91 (Proposition équiv)
                 └──→ 5 (Disponible) ──→ 6 (Commandée fournisseur)

91 (Prop. équiv) ──┬──→ 92 (Acceptée) ──→ 94 (Validée)
                   └──→ 93 (Refusée)

Toutes ──→ 1 (Reset)
```

## 📝 Format BDD Consolidé

### Principe : Single Source of Truth

✅ **Tous les champs en format BDD brut (ord_*, cst_*, cba_*, cda_*, orl_*)**
- Pas de transformation backend → frontend
- Pas de duplication de logique de mapping
- Cohérence garantie entre toutes les couches

### Exemple de champs :

**Commande :** `ord_id`, `ord_cst_id`, `ord_date`, `ord_total_ttc`, `ord_is_pay`, `ord_ords_id`

**Client :** `cst_id`, `cst_mail`, `cst_fname`, `cst_name`, `cst_tel`, `cst_gsm`

**Facturation :** `cba_id`, `cba_name`, `cba_fname`, `cba_address`, `cba_city`, `cba_zip_code`, `cba_country`

**Livraison :** `cda_id`, `cda_name`, `cda_fname`, `cda_address`, `cda_city`, `cda_zip_code`, `cda_country`

**Ligne :** `orl_id`, `orl_pg_name`, `orl_pm_name`, `orl_art_ref`, `orl_art_quantity`, `orl_art_price_sell_unit_ttc`, `orl_art_price_sell_ttc`, `orl_orls_id`

**Statut ligne :** `orls_id`, `orls_named`, `orls_color`

## 🎉 Résultat Final

### ✅ Fonctionnalités Complètes

1. **Affichage complet** des informations de commande
2. **Adresses** de facturation et livraison
3. **Lignes de commande** avec détails produits
4. **Statuts visuels** pour chaque ligne
5. **Actions de traitement** contextuelles selon statut
6. **Modal de confirmation** avec formulaires dynamiques
7. **Format BDD unifié** sur toutes les couches

### 🚀 Prêt pour Production

- ✅ Backend retourne toutes les données nécessaires
- ✅ Frontend affiche toutes les sections
- ✅ Actions de traitement opérationnelles
- ✅ Format consolidé cohérent
- ✅ Gestion d'erreurs robuste
- ✅ TypeScript types alignés avec BDD

## 📌 Prochaines Étapes Potentielles

1. **Historique des actions** sur les lignes
2. **Export PDF** de la commande
3. **Notifications** email lors changement statut
4. **Timeline** visuelle des événements
5. **Calculs automatiques** des marges
6. **Gestion des retours** et remboursements

---

**Documentation créée le :** 7 octobre 2025  
**Auteur :** Consolidation Dashboard Team  
**Version :** 1.0.0

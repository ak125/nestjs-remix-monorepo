# 🧾 Système de Factures et Paiements

**Date de création** : 6 octobre 2025  
**Version** : 1.0  
**Système** : Simple et unifié avec `___XTR_ORDER`

---

## 📋 Vue d'ensemble

Le système de factures utilise directement les tables **`___XTR_ORDER`** et **`___XTR_ORDER_LINE`** pour générer les documents. Pas de duplication de données, simplicité maximale.

### Principes de base

```
Commande NON payée (ORD_IS_PAY = 0) → Bon de commande
Commande PAYÉE (ORD_IS_PAY = 1)     → Facture officielle
```

---

## 🗂️ Structure des tables utilisées

### Table `___XTR_ORDER`

| Colonne | Type | Description |
|---------|------|-------------|
| `ORD_ID` | INT | ID unique de la commande/facture |
| `ORD_PARENT` | VARCHAR | ID de la commande parent (0 si commande principale) |
| `ORD_DATE` | DATETIME | Date de création de la commande |
| `ORD_DATE_PAY` | DATETIME | Date de paiement (NULL si non payé) |
| `ORD_IS_PAY` | TINYINT | 0 = Non payé, 1 = Payé |
| `ORD_CST_ID` | INT | ID du client (FK vers `___xtr_customer`) |
| `ORD_CBA_ID` | INT | ID adresse facturation |
| `ORD_CDA_ID` | INT | ID adresse livraison |
| `ORD_AMOUNT_TTC` | DECIMAL | Montant articles TTC |
| `ORD_DEPOSIT_TTC` | DECIMAL | Consigne TTC |
| `ORD_SHIPPING_FEE_TTC` | DECIMAL | Frais de port TTC |
| `ORD_TOTAL_TTC` | DECIMAL | Total général TTC |
| `ORD_INFO` | TEXT | Informations complémentaires |

### Table `___XTR_ORDER_LINE`

| Colonne | Type | Description |
|---------|------|-------------|
| `ORL_ID` | INT | ID unique de la ligne |
| `ORL_ORD_ID` | INT | ID commande (FK vers `___xtr_order`) |
| `ORL_PG_NAME` | VARCHAR | Nom du produit |
| `ORL_ART_PRICE_SELL_UNIT_TTC` | DECIMAL | Prix unitaire TTC |
| `ORL_ART_QUANTITY` | INT | Quantité |
| `ORL_ART_PRICE_SELL_TTC` | DECIMAL | Prix total ligne TTC |

---

## 🎯 Types de documents

### 1. **Bon de commande** (Non payé)
- `ORD_IS_PAY = 0`
- `ORD_PARENT = 0` (commande principale)
- Affiche : "Bon de commande n° XXX/A"
- Action : Peut procéder au paiement

### 2. **Facture** (Payée)
- `ORD_IS_PAY = 1`
- `ORD_PARENT = 0` (commande principale)
- Affiche : "Facture n° XXX/F"
- Action : Télécharger/Imprimer

### 3. **Supplément non payé**
- `ORD_IS_PAY = 0`
- `ORD_PARENT != 0` (référence commande parent)
- Affiche : "Supplément n° XXX/A (Commande parente YYY/A)"
- Action : **Formulaire de paiement Paybox/PayPal**

### 4. **Supplément payé**
- `ORD_IS_PAY = 1`
- `ORD_PARENT != 0`
- Affiche : "Facture supplément n° XXX/F"
- Action : Télécharger/Imprimer

---

## 🚀 Routes Frontend

### `/account/orders/:orderId/invoice`
**Fichier** : `frontend/app/routes/account.orders.$orderId.invoice.tsx`

**Fonctionnalités** :
- ✅ Affichage du document (bon/facture/supplément)
- ✅ Récupération des données depuis Supabase
- ✅ Vérification de sécurité (propriétaire)
- ✅ Affichage des adresses facturation/livraison
- ✅ Tableau des lignes de commande
- ✅ Calcul des totaux (sous-total, consigne, port, total TTC)
- ✅ Formulaire de paiement pour suppléments non payés
- ✅ Bouton "Imprimer" avec styles CSS print

**Loader** :
```typescript
export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  const orderId = params.orderId;
  
  // Récupère ___xtr_order avec JOINs sur :
  // - ___xtr_customer
  // - ___xtr_customer_billing_address
  // - ___xtr_customer_delivery_address
  // - ___xtr_order_line
  
  // Vérifie : ord_cst_id === user.id
  
  return json({ invoice });
}
```

**Affichage dynamique** :
```tsx
{invoice.isPaid 
  ? 'Facture n°' 
  : invoice.isSupplementOrder 
    ? 'Supplément n°'
    : 'Bon de commande n°'
}
```

---

## ⚙️ Backend Endpoints

### `POST /api/payments/proceed-supplement`
**Fichier** : `backend/src/modules/payments/controllers/payments.controller.ts`

**Description** : Initialise le paiement d'un supplément de commande

**Body** :
```json
{
  "orderId": "123",
  "paymentMethod": "PAYBOX" | "PAYPAL"
}
```

**Vérifications** :
1. ✅ Utilisateur connecté (session)
2. ✅ Commande existe
3. ✅ Commande appartient au client (`ord_cst_id === user.id`)
4. ✅ Commande non déjà payée (`ord_is_pay !== 1`)
5. ✅ C'est bien un supplément (`ord_parent !== '0'`)

**Traitement** :
1. Créer un paiement via `PaymentService.createPayment()`
2. Générer le formulaire Cyberplus (PAYBOX) ou URL PayPal
3. Retourner `redirectUrl` pour redirection

**Response** :
```json
{
  "success": true,
  "data": {
    "paymentId": "pay_xxx",
    "redirectUrl": "https://secure.paypage.com/...",
    "redirectData": { /* formulaire Cyberplus */ }
  }
}
```

---

## 🔐 Sécurité

### Vérifications au niveau frontend
- ✅ Authentification requise (`requireAuth`)
- ✅ Vérification propriétaire dans le loader
- ✅ Throw 403 si `ord_cst_id !== user.id`

### Vérifications au niveau backend
- ✅ Session utilisateur obligatoire
- ✅ Requête SQL avec `WHERE ord_cst_id = $userId`
- ✅ Vérification statut paiement avant traitement
- ✅ Logs d'audit pour tous les paiements

---

## 🎨 Affichage

### En-tête du document
```
┌─────────────────────────────────────────────┐
│  [LOGO]              │  Facture n° 123/F    │
│  AutoMecanik         │  Date: 06/10/2025    │
│                      │  Total: 299.99 €     │
└─────────────────────────────────────────────┘
```

### Adresses
```
┌─────────────────────┬─────────────────────┐
│ Facturée à :        │ Livrée à :          │
│ M. Dupont Jean      │ M. Dupont Jean      │
│ 123 rue Example     │ 456 av Livraison    │
│ 75001 Paris, France │ 75002 Paris, France │
└─────────────────────┴─────────────────────┘
```

### Tableau produits
```
┌──────────────────┬──────────┬─────┬──────────┐
│ Désignation      │ PU TTC   │ QTE │ PT TTC   │
├──────────────────┼──────────┼─────┼──────────┤
│ Filtre à huile   │ 15.90 €  │  2  │ 31.80 €  │
│ Plaquettes frein │ 89.90 €  │  1  │ 89.90 €  │
├──────────────────┴──────────┴─────┼──────────┤
│ Sous-total TTC                    │ 121.70 € │
│ Frais de port                     │  15.00 € │
│ Total TTC                         │ 136.70 € │
└───────────────────────────────────┴──────────┘
```

### Paiement (si supplément non payé)
```
┌─────────────────┬─────────────────┐
│   [PAYBOX]      │    [PAYPAL]     │
│ Carte bancaire  │     PayPal      │
│      ( )        │      ( )        │
└─────────────────┴─────────────────┘

[ Acceptation CGV ]

       [ Payer maintenant ]
```

---

## 🖨️ Impression

### CSS print optimisé
```css
@media print {
  /* Masquer navigation, boutons, etc. */
  .no-print { display: none !important; }
  
  /* Fond blanc */
  body { background: white !important; }
  
  /* Pas de padding externe */
  .invoice-page { max-width: 100% !important; }
}
```

### Bouton d'impression
```tsx
<button onClick={() => window.print()}>
  🖨️ Imprimer
</button>
```

---

## 🔄 Workflow complet

### 1. Client passe commande
```
POST /api/orders
→ Création ORD_IS_PAY = 0
→ Génération lignes dans ___xtr_order_line
```

### 2. Client consulte bon de commande
```
GET /account/orders/123/invoice
→ Affiche "Bon de commande n° 123/A"
→ Bouton "Payer maintenant" si non payé
```

### 3. Client paie
```
POST /api/payments/proceed-supplement
→ Redirection vers Cyberplus/PayPal
→ Callback de confirmation
→ UPDATE ___xtr_order SET ord_is_pay = 1, ord_date_pay = NOW()
```

### 4. Client consulte facture
```
GET /account/orders/123/invoice
→ Affiche "Facture n° 123/F"
→ Date de paiement affichée
→ Bouton "Imprimer" uniquement
```

### 5. Supplément nécessaire
```
POST /api/orders (avec ord_parent = 123)
→ Création nouvelle commande avec ORD_PARENT = 123
→ Client reçoit notification
```

### 6. Client paie supplément
```
GET /account/orders/456/invoice
→ Affiche "Supplément n° 456/A (Commande parente 123/A)"
→ Formulaire de paiement
→ Même workflow de paiement
```

---

## 📊 Différences avec ancien système PHP

### ❌ Ancien système (tables séparées)
```
backofficeplateform_facture
backofficeplateform_ligne_facture
→ Duplication des données
→ Tables supplémentaires à gérer
→ Synchronisation complexe
```

### ✅ Nouveau système (table unifiée)
```
___XTR_ORDER (ord_is_pay = 0 ou 1)
___XTR_ORDER_LINE
→ Source unique de vérité
→ Pas de duplication
→ Simple et performant
```

---

## 🐛 Résolution de problèmes

### Facture non accessible
**Symptôme** : 403 Forbidden  
**Cause** : La commande n'appartient pas au client connecté  
**Solution** : Vérifier `ord_cst_id` dans la base

### Paiement échoue
**Symptôme** : Erreur lors du POST proceed-supplement  
**Cause** : Commande déjà payée ou non-supplément  
**Solution** : Vérifier `ord_is_pay` et `ord_parent`

### Adresses vides
**Symptôme** : Champs adresse non remplis  
**Cause** : JOINs manquants ou IDs incorrects  
**Solution** : Vérifier `ord_cba_id` et `ord_cda_id` existent dans tables adresses

---

## 📝 TODO / Améliorations futures

- [ ] Génération PDF côté serveur (puppeteer/wkhtmltopdf)
- [ ] Envoi email automatique de la facture après paiement
- [ ] Numérotation séquentielle des factures par année
- [ ] Archivage des factures en PDF dans cloud storage
- [ ] API pour comptables (export CSV/Excel des factures)
- [ ] Factures d'avoir (retours/remboursements)
- [ ] Factures multi-devises
- [ ] TVA par pays (intracommunautaire)

---

## 📚 Références

- **Tables** : `/backend/prisma/schema.prisma`
- **Route invoice** : `/frontend/app/routes/account.orders.$orderId.invoice.tsx`
- **Controller payments** : `/backend/src/modules/payments/controllers/payments.controller.ts`
- **Service Cyberplus** : `/backend/src/modules/payments/services/cyberplus.service.ts`

---

**Auteur** : GitHub Copilot  
**Dernière mise à jour** : 6 octobre 2025

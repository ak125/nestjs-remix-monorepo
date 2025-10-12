# 📦 PLAN IMPLÉMENTATION GESTION RETOURS/REMBOURSEMENTS

**Date** : 12 octobre 2025  
**Statut** : En attente de validation interface unifiée  
**Permissions ajoutées** : `canReturn`, `canRefund`

---

## 🎯 OBJECTIF

Ajouter la gestion complète des retours de colis et des remboursements à l'interface unifiée `/orders`.

---

## ✅ PERMISSIONS DÉJÀ EN PLACE

### Permissions définies dans `permissions.ts`

```typescript
export interface UserPermissions {
  // ... autres permissions
  canReturn: boolean;   // Gérer les retours/SAV
  canRefund: boolean;   // Émettre des remboursements
}
```

### Distribution par niveau

| Niveau | Rôle | canReturn | canRefund |
|--------|------|-----------|-----------|
| 9 | Super Admin | ✅ | ✅ |
| 7-8 | Admin | ✅ | ✅ |
| 5-6 | Responsable | ❌ | ❌ |
| 3-4 | Commercial | ❌ | ❌ |

---

## 📋 WORKFLOW RETOURS

### 1. Demande de retour
**Statut commande** : Livrée (statut 6) ou Expédiée (statut 5)  
**Déclencheur** : Client demande un retour (SAV)

**Actions** :
1. Admin clique sur "Retour" dans la commande
2. Modal s'ouvre avec formulaire :
   - Raison du retour (défaut, non conforme, erreur, autre)
   - Description détaillée
   - Demande de remboursement immédiat ou attente réception
3. Création d'un enregistrement de retour
4. Email automatique au client avec :
   - Instructions de retour
   - Adresse de retour
   - Numéro de suivi si fourni
   - Délai de traitement

### 2. Réception du colis retourné
**Statut retour** : En cours → Reçu

**Actions** :
1. Admin reçoit le colis
2. Clique "Marquer reçu" dans le retour
3. Peut ajouter un commentaire sur l'état du produit
4. Email de confirmation au client

### 3. Remboursement
**Conditions** : Colis reçu ou remboursement immédiat autorisé

**Actions** :
1. Admin clique "Rembourser"
2. Modal avec :
   - Montant (pré-rempli avec ord_total_ttc)
   - Montant modifiable si remboursement partiel
   - Méthode : même moyen de paiement, avoir, virement
   - Raison du remboursement
3. Email au client avec détails du remboursement

---

## 🗄️ STRUCTURE BASE DE DONNÉES

### Nouvelle table : `order_returns`

```sql
CREATE TABLE order_returns (
  ret_id SERIAL PRIMARY KEY,
  ret_ord_id VARCHAR(50) NOT NULL REFERENCES orders(ord_id),
  ret_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending, received, refunded, cancelled
  ret_reason VARCHAR(100),
    -- defective, wrong_item, not_as_described, changed_mind, other
  ret_description TEXT,
  ret_requested_at TIMESTAMP DEFAULT NOW(),
  ret_received_at TIMESTAMP,
  ret_refunded_at TIMESTAMP,
  ret_tracking_number VARCHAR(100),
  ret_refund_amount DECIMAL(10,2),
  ret_refund_method VARCHAR(50),
    -- original, credit, transfer
  ret_notes TEXT,
  ret_created_by INT REFERENCES users(usr_id),
  ret_updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_order_returns_ord_id ON order_returns(ret_ord_id);
CREATE INDEX idx_order_returns_status ON order_returns(ret_status);
```

### Modification table `orders`

Ajouter un champ pour tracker les retours :

```sql
ALTER TABLE orders 
ADD COLUMN ord_has_return BOOLEAN DEFAULT FALSE,
ADD COLUMN ord_return_status VARCHAR(20);
  -- null, pending, received, refunded
```

---

## 🎨 UI - MODIFICATIONS INTERFACE

### 1. Bouton "Retour" dans le tableau

**Fichier** : `orders._index.tsx`  
**Ligne** : ~1463 (après bouton "Annuler")

```tsx
{/* Bouton Retour - Commandes livrées ou expédiées */}
{permissions.canReturn && ['5', '6'].includes(order.ord_ords_id) && (
  <button
    onClick={() => {
      setActionOrderId(order.ord_id);
      setReturnModalOpen(true);
    }}
    className="text-xs px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-1"
    title="Gérer un retour client"
  >
    <RotateCcw className="w-3 h-3" />
    Retour
  </button>
)}

{/* Bouton Rembourser - Si retour en cours ou reçu */}
{permissions.canRefund && order.ord_has_return && (
  <button
    onClick={() => {
      setActionOrderId(order.ord_id);
      setRefundModalOpen(true);
    }}
    className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-1"
    title="Émettre un remboursement"
  >
    <DollarSign className="w-3 h-3" />
    Rembourser
  </button>
)}
```

### 2. Modal Retour

**États à ajouter** :

```tsx
const [returnModalOpen, setReturnModalOpen] = useState(false);
const [returnReason, setReturnReason] = useState('');
const [returnDescription, setReturnDescription] = useState('');
const [returnTracking, setReturnTracking] = useState('');
```

**Composant Modal** :

```tsx
{/* 🔄 Modal Retour */}
{returnModalOpen && (
  <div className="modal" onClick={() => setReturnModalOpen(false)}>
    <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-orange-600" />
            Demande de retour
          </h3>
          <button 
            className="btn btn-outline btn-sm"
            onClick={() => setReturnModalOpen(false)}
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Raison du retour *
            </label>
            <select
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Sélectionner...</option>
              <option value="defective">Produit défectueux</option>
              <option value="wrong_item">Mauvais article reçu</option>
              <option value="not_as_described">Non conforme à la description</option>
              <option value="changed_mind">Changement d'avis</option>
              <option value="other">Autre</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description détaillée *
            </label>
            <textarea
              value={returnDescription}
              onChange={(e) => setReturnDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="Détaillez le problème..."
              rows={4}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Numéro de suivi retour (optionnel)
            </label>
            <input
              type="text"
              value={returnTracking}
              onChange={(e) => setReturnTracking(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="FR9876543210"
            />
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              ℹ️ Le client recevra un email avec les instructions de retour.
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleInitiateReturn}
              disabled={!returnReason || !returnDescription.trim() || isLoading}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '⏳ Création...' : '🔄 Créer le retour'}
            </button>
            <button
              onClick={() => {
                setReturnModalOpen(false);
                setReturnReason('');
                setReturnDescription('');
                setReturnTracking('');
              }}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
)}
```

### 3. Modal Remboursement

**États à ajouter** :

```tsx
const [refundModalOpen, setRefundModalOpen] = useState(false);
const [refundAmount, setRefundAmount] = useState('');
const [refundMethod, setRefundMethod] = useState('original');
const [refundReason, setRefundReason] = useState('');
```

**Composant Modal** :

```tsx
{/* 💰 Modal Remboursement */}
{refundModalOpen && (
  <div className="modal" onClick={() => setRefundModalOpen(false)}>
    <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-purple-600" />
            Émettre un remboursement
          </h3>
          <button 
            className="btn btn-outline btn-sm"
            onClick={() => setRefundModalOpen(false)}
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Montant du remboursement (€) *
            </label>
            <input
              type="number"
              step="0.01"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="0.00"
            />
            <p className="mt-1 text-xs text-gray-500">
              Montant total de la commande : {selectedOrder?.ord_total_ttc}€
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Méthode de remboursement *
            </label>
            <select
              value={refundMethod}
              onChange={(e) => setRefundMethod(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="original">Même moyen de paiement</option>
              <option value="credit">Avoir magasin</option>
              <option value="transfer">Virement bancaire</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Raison du remboursement
            </label>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="Ex: Produit retourné en bon état"
              rows={3}
            />
          </div>
          
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-sm text-purple-800">
              ⚠️ Cette action est irréversible. Le client sera notifié par email.
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleProcessRefund}
              disabled={!refundAmount || isLoading}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '⏳ Traitement...' : '💰 Confirmer le remboursement'}
            </button>
            <button
              onClick={() => {
                setRefundModalOpen(false);
                setRefundAmount('');
                setRefundMethod('original');
                setRefundReason('');
              }}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
)}
```

---

## 🔧 BACKEND - API ENDPOINTS

### 1. POST `/api/admin/orders/:orderId/return`

**Permissions** : Admin (7+), Super Admin (9)

**Body** :
```json
{
  "reason": "defective",
  "description": "Produit arrive cassé",
  "trackingNumber": "FR9876543210"
}
```

**Actions** :
1. Vérifier que la commande existe et est livrée/expédiée
2. Créer un enregistrement dans `order_returns`
3. Mettre à jour `ord_has_return = true` dans `orders`
4. Envoyer email au client avec instructions de retour
5. Logger l'action

**Response** :
```json
{
  "success": true,
  "returnId": "RET-123456",
  "message": "Retour créé et email envoyé au client"
}
```

### 2. POST `/api/admin/orders/:orderId/return/:returnId/received`

**Permissions** : Admin (7+), Super Admin (9)

**Body** :
```json
{
  "notes": "Produit reçu en bon état"
}
```

**Actions** :
1. Mettre à jour statut retour : `received`
2. Timestamp `ret_received_at`
3. Envoyer email confirmation au client
4. Logger l'action

### 3. POST `/api/admin/orders/:orderId/refund`

**Permissions** : Admin (7+), Super Admin (9)

**Body** :
```json
{
  "amount": 149.99,
  "method": "original",
  "reason": "Produit défectueux retourné"
}
```

**Actions** :
1. Vérifier permissions
2. Vérifier que le montant <= ord_total_ttc
3. Enregistrer remboursement dans `order_returns`
4. Mettre à jour statut retour : `refunded`
5. Envoyer email de confirmation remboursement
6. Logger l'action

**Response** :
```json
{
  "success": true,
  "refundId": "REF-123456",
  "amount": 149.99,
  "message": "Remboursement traité avec succès"
}
```

---

## 📧 EMAILS À CRÉER

### 1. Email demande de retour

**Template** : `return-instructions.html`

**Contenu** :
- Instructions de retour
- Adresse de retour
- Numéro de suivi si fourni
- Délai de traitement (7-14 jours)
- Contact SAV

### 2. Email confirmation réception

**Template** : `return-received.html`

**Contenu** :
- Confirmation réception du colis
- État du produit retourné
- Délai de remboursement (3-5 jours)

### 3. Email confirmation remboursement

**Template** : `refund-confirmation.html`

**Contenu** :
- Montant remboursé
- Méthode de remboursement
- Délai selon la méthode
- Référence remboursement

---

## 📊 INDICATEURS DANS LE DASHBOARD

### Nouvelle carte statistique (Admin uniquement)

```tsx
{/* Retours en cours */}
{permissions.canReturn && (
  <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-6">
    <div className="flex items-center justify-between mb-3">
      <div className="text-sm font-semibold text-orange-700 uppercase tracking-wide">
        Retours en cours
      </div>
      <div className="p-2 bg-orange-200 rounded-lg">
        <RotateCcw className="h-5 w-5 text-orange-700" />
      </div>
    </div>
    <div className="text-3xl font-bold text-orange-900">{stats.pendingReturns}</div>
    <div className="text-xs text-orange-600 mt-2">À traiter</div>
  </div>
)}
```

---

## ✅ CHECKLIST IMPLÉMENTATION

### Phase 1 : Base de données
- [ ] Créer migration pour table `order_returns`
- [ ] Créer migration pour colonnes `ord_has_return` et `ord_return_status`
- [ ] Tester migration en DEV

### Phase 2 : Backend
- [ ] Créer DTO `CreateReturnDto`, `RefundDto`
- [ ] Créer service `OrderReturnsService`
- [ ] Implémenter endpoint POST `/api/admin/orders/:orderId/return`
- [ ] Implémenter endpoint POST `/api/admin/orders/:orderId/return/:returnId/received`
- [ ] Implémenter endpoint POST `/api/admin/orders/:orderId/refund`
- [ ] Implémenter GET `/api/admin/orders/:orderId/returns` (liste retours)
- [ ] Ajouter guards de permissions
- [ ] Tests unitaires

### Phase 3 : Emails
- [ ] Créer template `return-instructions.html`
- [ ] Créer template `return-received.html`
- [ ] Créer template `refund-confirmation.html`
- [ ] Tester envoi avec Resend

### Phase 4 : Frontend
- [ ] Ajouter états retour/remboursement
- [ ] Créer modal retour
- [ ] Créer modal remboursement
- [ ] Ajouter boutons conditionnels
- [ ] Implémenter handlers
- [ ] Ajouter carte statistique "Retours en cours"
- [ ] Tests UI

### Phase 5 : Tests E2E
- [ ] Créer retour depuis commande livrée
- [ ] Vérifier email envoyé
- [ ] Marquer retour reçu
- [ ] Émettre remboursement
- [ ] Vérifier mise à jour statuts

---

## 📅 ESTIMATION

**Total** : ~8h
- Base de données : 1h
- Backend : 3h
- Emails : 1h
- Frontend : 2h
- Tests : 1h

**Priorité** : Moyenne (après validation interface unifiée)

---

## 🎯 CRITÈRES DE SUCCÈS

✅ Admin peut créer un retour depuis une commande livrée  
✅ Client reçoit email avec instructions de retour  
✅ Admin peut marquer le retour comme reçu  
✅ Admin peut émettre un remboursement (total ou partiel)  
✅ Client reçoit confirmation du remboursement  
✅ Statistiques "Retours en cours" affichées pour Admin  
✅ Commercial et Responsable ne voient pas les boutons retour/remboursement  
✅ Logs de toutes les actions de retour/remboursement  
✅ Permissions respectées côté client et serveur  

---

**Note** : Cette fonctionnalité sera implémentée APRÈS la validation complète de l'interface unifiée `/orders`.

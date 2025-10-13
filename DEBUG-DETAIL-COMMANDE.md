# 🔧 DEBUG - Problème Affichage Détail Commande

**Date** : 6 octobre 2025 - 22:00  
**Symptôme** : Clic sur "Voir le détail" → Redirection vers `/account/orders` sans afficher le détail

---

## ✅ Ce qui fonctionne

1. **Backend API** : ✅ OK
   - `GET /api/orders/ORD-1759787157480-665` retourne 200
   - Données complètes retournées
   - Logs : "Getting order ORD-1759787157480-665 for user usr_1759774640723_njikmiz59"

2. **Authentification** : ✅ OK
   - Session active
   - User deserialized correctement

3. **Routing** : ✅ OK
   - Route `/account/orders/:orderId` existe
   - Paramètre `orderId` correctement passé

---

## ❌ Problème Identifié

Le **frontend** appelle bien l'API mais ne parvient pas à afficher la page de détail.

### Hypothèses

1. **Mapping incomplet** : `getOrderDetail()` retourne `null` car certains champs sont manquants
2. **Erreur dans le composant** : Le composant React plante sur un champ undefined
3. **Redirection automatique** : Un ErrorBoundary ou un catch redirige vers la liste

---

## 🔍 Diagnostic à Faire

### 1. Vérifier la réponse de `getOrderDetail`

Ajoutons des logs dans le service frontend :

```typescript
// frontend/app/services/orders.server.ts - ligne 160
const order = response_data.data;

// ✅ AJOUT DEBUG
console.log('🔍 DEBUG order data:', JSON.stringify(order, null, 2));
console.log('🔍 DEBUG mapped id:', order.ord_id);
console.log('🔍 DEBUG mapped orderNumber:', order.ord_id || order.orderNumber);

// Mapping des données...
```

### 2. Vérifier que la condition ne retourne pas `null`

```typescript
// frontend/app/services/orders.server.ts - ligne 162
if (!response_data.success || !response_data.data) {
  console.error('❌ DEBUG: response_data manquant', response_data);
  return null; // ❌ Peut causer le problème
}
```

### 3. Vérifier les propriétés obligatoires

Le composant attend certainement :
- `order.id` ✅
- `order.orderNumber` ✅
- `order.status` ✅
- `order.createdAt` ✅
- `order.lines` ✅
- `order.shippingAddress` ⚠️ Peut-être undefined
- `order.totalTTC` ✅

---

## 🛠️ Solution Rapide

### Option 1 : Ajouter des logs de debug

```typescript
// frontend/app/routes/account.orders.$orderId.tsx - ligne 36
try {
  console.log('🔍 Fetching order:', orderId);
  
  const order = await getOrderDetail({ 
    orderId, 
    userId,
    request 
  });

  console.log('✅ Order received:', order ? 'YES' : 'NO');
  console.log('📦 Order data:', JSON.stringify(order, null, 2));

  if (!order) {
    console.error('❌ Order is null, redirecting to 404');
    throw new Response("Commande introuvable", { status: 404 });
  }

  return json({ order, user });
} catch (error) {
  console.error('❌ Error in loader:', error);
  throw new Response("Erreur lors du chargement de la commande", { status: 500 });
}
```

### Option 2 : Valeurs par défaut pour adresses

```typescript
// frontend/app/services/orders.server.ts - ligne 227
// Adresses avec valeurs par défaut
shippingAddress: order.shippingAddress || order.shipping_address || {
  firstName: order.shipping_first_name || 'N/A',
  lastName: order.shipping_last_name || 'N/A',
  address1: order.shipping_address1 || 'N/A',
  city: order.shipping_city || 'N/A',
  postalCode: order.shipping_postal_code || 'N/A',
  country: 'France',
},
```

---

## 🎯 Plan d'Action Immédiat

### Étape 1 : Vérifier les logs console navigateur
1. Ouvrir DevTools (F12)
2. Onglet Console
3. Rafraîchir la page
4. Cliquer sur "Voir le détail"
5. Noter les erreurs affichées

### Étape 2 : Vérifier les logs serveur frontend
1. Terminal où tourne le frontend
2. Chercher "Error fetching order detail" ou "Erreur lors du chargement"
3. Noter le message complet

### Étape 3 : Test API direct
```bash
# Tester que l'API retourne bien les données
curl -s -b /tmp/test_cookie2.txt "http://localhost:3000/api/orders/ORD-1759787157480-665" | jq '.data | keys'

# Vérifier les champs présents
curl -s -b /tmp/test_cookie2.txt "http://localhost:3000/api/orders/ORD-1759787157480-665" | jq '.data | {id: .ord_id, status: .ord_ords_id, date: .ord_date, total: .ord_total_ttc, lines: .lines | length}'
```

---

## 📝 Checklist Debug

- [ ] Logs console navigateur (F12)
- [ ] Logs serveur frontend (npm run dev)
- [ ] Logs serveur backend (déjà vu - ✅ OK)
- [ ] Test API direct avec curl (✅ OK)
- [ ] Vérifier `getOrderDetail` retourne bien un objet
- [ ] Vérifier que tous les champs obligatoires sont présents
- [ ] Vérifier qu'il n'y a pas d'ErrorBoundary qui catch

---

## 🔧 Corrections Possibles

### Si `getOrderDetail` retourne `null`

Problème : La condition `if (!response_data.success || !response_data.data)` est trop stricte.

**Solution** :
```typescript
// Vérifier que data existe et n'est pas vide
if (!response_data.data || !response_data.data.ord_id) {
  console.error('❌ Invalid response data:', response_data);
  return null;
}
```

### Si les adresses manquent

Problème : Le composant essaie d'accéder à `order.shippingAddress.city` qui est undefined.

**Solution** :
```typescript
// Dans le composant
{order.shippingAddress && (
  <div>
    <p>{order.shippingAddress.address1}</p>
    <p>{order.shippingAddress.city}</p>
  </div>
)}
```

### Si le statut est mal formaté

Problème : `order.status` n'est pas un nombre.

**Solution** :
```typescript
// Dans le mapping
status: parseInt(order.ord_ords_id || order.status || '1'),
```

---

## 🎓 Prochaines Étapes

1. **Vérifier les logs** (console + serveur)
2. **Identifier l'erreur exacte**
3. **Appliquer la correction appropriée**
4. **Tester à nouveau**

---

## 📞 Informations de Debug à Fournir

Si le problème persiste, fournir :
1. **Message d'erreur console navigateur** (capture d'écran)
2. **Logs serveur frontend** lors du clic
3. **URL exacte** tentée (ex: `/account/orders/ORD-...`)
4. **Comportement** : redirection immédiate ? Erreur 404 ? Erreur 500 ?

# 🧪 Tests Backend Panier avec Consignes

## Date : 14 Octobre 2025
## Branche : `hotfix/backend-consignes-mapping`

---

## ✅ Backend API Tests (curl)

### Produit de test
- **ID** : 3047339
- **Nom** : Alternateur CEVAM
- **Prix unitaire** : 168.59€ TTC
- **Consigne unitaire** : 72€ (remboursable)

### Test 1: Panier vide
```bash
curl -X GET http://localhost:3000/api/cart -b cookies.txt
```
**Résultat** : ✅ Total = 0€

### Test 2: Ajouter 2 articles
```bash
curl -X POST http://localhost:3000/api/cart/items \
  -H "Content-Type: application/json" \
  -b cookies.txt -c cookies.txt \
  -d '{"product_id": 3047339, "quantity": 2}'
```

**Réponse backend** :
```json
{
  "items": [{
    "id": "session-3047339-timestamp",
    "product_id": "3047339",
    "product_name": "Alternateur",
    "quantity": 2,
    "price": 168.59,
    "consigne_unit": 72,
    "consigne_total": 144,
    "has_consigne": true
  }],
  "totals": {
    "total_items": 2,
    "subtotal": 337.18,
    "consigne_total": 144,
    "total": 481.18
  }
}
```

**Calculs** :
- Subtotal produits : 2 × 168.59€ = **337.18€**
- Total consignes : 2 × 72€ = **144€**
- **Total TTC : 481.18€** ✅

### Test 3: Diminuer à 1 article
```bash
curl -X POST http://localhost:3000/api/cart/items \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"product_id": 3047339, "quantity": 1, "replace": true}'
```

**Résultat** : ✅
- Subtotal : 168.59€
- Consigne : 72€
- Total : 240.59€

### Test 4: Augmenter à 3 articles
```bash
curl -X POST http://localhost:3000/api/cart/items \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"product_id": 3047339, "quantity": 3, "replace": true}'
```

**Résultat** : ✅
- Subtotal : 505.77€
- Consigne : 216€
- Total : 721.77€

### Test 5: Supprimer l'article
```bash
curl -X DELETE http://localhost:3000/api/cart/items/3047339 -b cookies.txt
```

**Résultat** : ✅ Panier vide

---

## 🔴 Problèmes Frontend Identifiés

### Problème 1: CartSidebar vs Page /cart désynchronisés
**Symptôme** : Les deux affichages ne montrent pas les mêmes données.

**Causes possibles** :
1. CartSidebar utilise `useCart()` qui appelle `/cart` loader
2. Page `/cart` utilise aussi `/cart` loader
3. Mais les deux ne se rafraîchissent pas en même temps

**Solution** : 
- Les deux doivent appeler `refreshCart()` après chaque action
- Utiliser un état global (Context) ou un signal de rafraîchissement

### Problème 2: Boutons +/- dans CartSidebar ne répondent pas
**Symptôme** : Clics sur les boutons ne déclenchent aucune action.

**Causes possibles** :
1. ✅ Backend fonctionne (testé avec curl)
2. ✅ Code TypeScript correct (async/await ajoutés)
3. ❌ Peut-être un problème de propagation d'événements React
4. ❌ Peut-être que `refreshCart()` ne se déclenche pas après l'action

**Vérifications nécessaires** :
```typescript
// Dans CartSidebar.tsx ligne 110
onQuantityChange={async (qty) => {
  console.log('🔄 CartSidebar onClick:', qty);
  await updateQuantity(item.id, qty);
  console.log('✅ CartSidebar après updateQuantity');
}}
```

### Problème 3: Format de item.id
**Symptôme** : `item.id` peut être dans différents formats.

**Formats observés** :
- Backend Redis : `"session-3047339-timestamp"`
- Backend attendu : `product_id` seul = `3047339`

**Code actuel (useCart.ts lignes 168-171)** :
```typescript
const parts = itemId.split('-');
const productId = parts.length >= 2 ? parts[1] : itemId;
```

**Test requis** :
```javascript
console.log('item.id:', item.id);
// Attendu : "npZNa94JBpQD1DYfDgUZfF_qQvngxjU3-3047339-1760473743996"
// productId extrait : "3047339" ✅
```

---

## 📋 Plan d'action

### Étape 1: Ajouter des logs de debug
```typescript
// frontend/app/components/navbar/CartSidebar.tsx ligne 110
onQuantityChange={async (qty) => {
  console.log('🎯 CartSidebar - Clic bouton :', { itemId: item.id, qty });
  await updateQuantity(item.id, qty);
  console.log('🎯 CartSidebar - Après updateQuantity');
}}
```

### Étape 2: Vérifier que refreshCart() se déclenche
```typescript
// frontend/app/hooks/useCart.ts ligne 203
console.log('✅ Quantité mise à jour');
refreshCart(); // ← Vérifier que cette ligne s'exécute
console.log('🔄 refreshCart() appelé');
```

### Étape 3: Tester dans le navigateur
1. Ouvrir la console (F12)
2. Cliquer sur le bouton panier (ouvrir CartSidebar)
3. Cliquer sur bouton `+` ou `-`
4. Observer les logs dans la console

**Si aucun log n'apparaît** → Problème de propagation d'événement React
**Si logs apparaissent mais pas de rafraîchissement** → Problème avec `refreshCart()`

### Étape 4: Synchroniser CartSidebar et /cart
Option A : Utiliser un Context global
```typescript
// CartContext.tsx
export const CartContext = createContext();
```

Option B : Utiliser un signal de rafraîchissement via URL
```typescript
// Après action, recharger avec un timestamp
window.location.href = `/cart?refresh=${Date.now()}`;
```

Option C : Utiliser Remix useFetcher avec revalidation
```typescript
const fetcher = useFetcher();
fetcher.load('/cart'); // Force reload
```

---

## 🎯 État actuel (14 Oct 2025 20:30)

### ✅ Ce qui fonctionne
- Backend API `/api/cart` retourne correctement les consignes
- Backend calcule correctement : subtotal, consigne_total, total
- Opérations CRUD panier (POST, DELETE) fonctionnent
- Format des données conforme au schema

### ❌ Ce qui ne fonctionne pas
- Boutons +/- dans CartSidebar ne répondent pas aux clics
- Synchronisation entre CartSidebar et page /cart
- Rafraîchissement automatique après action

### 🔄 Prochaines actions
1. Ajouter logs debug dans CartSidebar et useCart
2. Tester dans navigateur et observer console
3. Identifier si problème = event propagation ou refreshCart()
4. Implémenter solution de synchronisation Context/Fetcher

---

## 📊 Statistiques base de données

- **Total produits** : 442,173
- **Produits avec consigne** : 46,746 (10.6%)
- **Consigne moyenne** : 32.74€
- **Consigne min** : 0.01€
- **Consigne max** : 500€

---

## 🔗 Fichiers concernés

### Backend
- ✅ `backend/src/database/services/cart-data.service.ts` (calculs consignes)
- ✅ `backend/src/modules/cart/cart.controller.ts` (API endpoints)

### Frontend
- 🟡 `frontend/app/hooks/useCart.ts` (logique panier, à debugger)
- 🟡 `frontend/app/components/navbar/CartSidebar.tsx` (boutons +/-, à debugger)
- ✅ `frontend/app/routes/cart.tsx` (page panier complète)
- ✅ `frontend/app/services/cart.server.ts` (normalisation données)

---

**Conclusion** : Le backend Phase 4 fonctionne **PARFAITEMENT**. Les problèmes sont uniquement côté **frontend React/Remix** au niveau de la gestion d'état et de la synchronisation.

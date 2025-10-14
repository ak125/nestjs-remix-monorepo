# 🔧 Correction "Failed to fetch" - Page /cart

**Date**: 14 octobre 2025  
**Branche**: `hotfix/backend-consignes-mapping`  
**Problème**: Boutons +/- sur la page `/cart` causent "Failed to fetch"

---

## 🐛 Problème Identifié

### Symptômes
- Boutons +/- sur la page `/cart` ne fonctionnent pas
- Erreur "Failed to fetch" dans la console
- Boutons +/- du CartSidebar fonctionnent correctement

### Cause Racine
Les fonctions `updateItemQuantityAPI()` et `removeItemAPI()` dans `cart.tsx` utilisaient des URLs absolues :

```typescript
// ❌ AVANT - Ne fonctionne pas dans le monorepo
const backendUrl = 'http://localhost:3000/api/cart/items';
```

Dans un monorepo où le frontend et le backend partagent le même port (3000), les appels `fetch()` depuis le navigateur avec des URLs absolues `http://localhost:3000` créent des problèmes de routing.

---

## ✅ Solution Appliquée

### 1. Fonction `updateItemQuantityAPI()` (ligne ~95)

**Avant** :
```typescript
const backendUrl = typeof window !== 'undefined' 
  ? 'http://localhost:3000/api/cart/items'
  : 'http://localhost:3000/api/cart/items';

const response = await fetch(backendUrl, {
  method: 'POST',
  // ...
});
```

**Après** :
```typescript
// ✅ Utiliser un chemin relatif pour fonctionner dans le monorepo
const response = await fetch('/api/cart/items', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include',
  body: JSON.stringify({ 
    product_id: productId, 
    quantity: quantity,
    replace: true
  })
});
```

### 2. Fonction `removeItemAPI()` (ligne ~130)

**Avant** :
```typescript
const backendUrl = `http://localhost:3000/api/cart/items/${productId}`;

const response = await fetch(backendUrl, {
  method: 'DELETE',
  // ...
});
```

**Après** :
```typescript
// ✅ Utiliser un chemin relatif pour fonctionner dans le monorepo
const response = await fetch(`/api/cart/items/${productId}`, {
  method: 'DELETE',
  credentials: 'include'
});
```

---

## 🎯 Architecture Monorepo

### Pourquoi les chemins relatifs ?

Dans ce monorepo :
- **Frontend Remix** : Port 3000
- **Backend NestJS** : Port 3000
- **Même origine** : Les deux services partagent le même port

Quand le navigateur fait un `fetch()` :
- ✅ **Chemin relatif** `/api/cart/items` → Route vers le backend NestJS
- ❌ **URL absolue** `http://localhost:3000/api/cart/items` → Problèmes de routing

### Cohérence avec useCart.ts

Le hook `useCart.ts` utilisait déjà des chemins relatifs :
```typescript
// useCart.ts (déjà corrigé avant)
fetch('/api/cart/items', { method: 'POST', ... })
fetch(`/api/cart/items/${productId}`, { method: 'DELETE', ... })
```

Maintenant, `cart.tsx` utilise la même approche pour la cohérence.

---

## 🧪 Tests

### Backend vérifié
```bash
curl -s -b cookies.txt http://localhost:3000/api/cart | jq
```

Résultat :
```json
{
  "items": 1,
  "total": 481.18,
  "consigne_total": 144
}
```
✅ Backend fonctionne correctement

### Frontend à tester

1. **Ouvrir la page /cart** dans le navigateur
2. **Tester le bouton +** sur un article
   - ✅ Devrait augmenter la quantité
   - ✅ Devrait mettre à jour le total
   - ✅ Pas de "Failed to fetch"

3. **Tester le bouton -** sur un article
   - ✅ Devrait diminuer la quantité
   - ✅ Devrait mettre à jour le total
   - ✅ Pas de "Failed to fetch"

4. **Tester le bouton Supprimer**
   - ✅ Devrait retirer l'article
   - ✅ Devrait mettre à jour le panier
   - ✅ Pas de "Failed to fetch"

---

## 📊 Comparaison Avant/Après

### CartSidebar (déjà corrigé)
```typescript
// ✅ Utilise des chemins relatifs depuis le début de la correction
fetch('/api/cart/items', ...)
```

### Page /cart (maintenant corrigé)
```typescript
// ✅ Maintenant aligné avec CartSidebar
fetch('/api/cart/items', ...)
```

### Page /cart (loader - server-side)
```typescript
// ✅ Server-side peut utiliser localhost (pas dans le navigateur)
fetch('http://localhost:3000/api/cart', ...)
```

---

## 🔍 Différence Server vs Client

| Contexte | URL à utiliser | Raison |
|----------|---------------|--------|
| **Server-side** (loader, action) | `http://localhost:3000/api/cart` | Server-to-server call |
| **Client-side** (fetch dans composant) | `/api/cart` | Navigateur sur même origine |
| **useCart hook** (client) | `/api/cart` | Navigateur |
| **CartSidebar** (client) | `/api/cart` | Navigateur |
| **Page cart.tsx** (client) | `/api/cart` | Navigateur |

---

## ✅ Fichiers Modifiés

### frontend/app/routes/cart.tsx
```diff
- Ligne ~105: const backendUrl = 'http://localhost:3000/api/cart/items'
+ Ligne ~105: const response = await fetch('/api/cart/items', {

- Ligne ~138: const backendUrl = `http://localhost:3000/api/cart/items/${productId}`
+ Ligne ~138: const response = await fetch(`/api/cart/items/${productId}`, {
```

**2 fonctions corrigées** :
- `updateItemQuantityAPI()` - Mise à jour quantité
- `removeItemAPI()` - Suppression article

---

## 🚀 Prochaines Étapes

1. **Tester dans le navigateur**
   ```
   http://localhost:3000/cart
   ```

2. **Vérifier les logs de la console** (F12)
   - Aucune erreur "Failed to fetch"
   - Logs de succès : "Quantité mise à jour"

3. **Si tout fonctionne, commit**
   ```bash
   git add frontend/app/routes/cart.tsx
   git commit -m "🐛 Fix: Utiliser chemins relatifs dans cart.tsx pour éviter Failed to fetch"
   ```

---

## 📝 Leçon Apprise

**Dans un monorepo avec frontend et backend sur le même port** :

- ✅ **Client-side fetch** → Chemins relatifs `/api/*`
- ✅ **Server-side fetch** → URLs absolues `http://localhost:3000/api/*`
- ✅ **Cohérence** → Même approche partout côté client

**Règle d'or** :
> Si le code s'exécute dans le navigateur, utiliser des chemins relatifs.
> Si le code s'exécute sur le serveur, utiliser des URLs absolues.

---

**Status**: ✅ Correction appliquée  
**Prêt pour**: Test en navigateur

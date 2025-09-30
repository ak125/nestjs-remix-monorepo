# 🛒 DIAGNOSTIC PANIER - Problème Ajout Article

**Date**: 30 septembre 2025  
**Symptôme**: Bouton "Ajouter au panier" ne fonctionne pas, panier reste à 0

---

## 🔍 TESTS EFFECTUÉS

### ✅ Test 1: API Backend (SUCCÈS)
```bash
curl -X POST "http://localhost:3000/api/cart/items" \
  -H "Content-Type: application/json" \
  -H "Cookie: session_id=test_session_123" \
  -d '{"product_id": 123, "quantity": 1}'
```

**Résultat**: HTTP 201 Created, `{"success": true, "message": "Article ajouté au panier"}`

✅ **L'API backend fonctionne parfaitement !**

---

## 🐛 PROBLÈME IDENTIFIÉ

### Code problématique dans `AddToCartButton.tsx`

```typescript
try {
  const response = await fetch('/api/cart/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: piece.id.toString(),
      quantity: quantity,
      custom_price: piece.price
    })
  });

  if (response.ok) {
    // ✅ Ça devrait marcher
  } else {
    setErrorMessage("Erreur lors de l'ajout au panier");
  }
} catch (error) {
  // ❌ PROBLÈME ICI : Mode développement FAKE le succès !
  console.log("Mode développement : simulation ajout au panier");
  setIsSuccess(true);  // ← Affiche succès SANS ajouter au panier
  onSuccess?.();
  
  setTimeout(() => {
    setIsSuccess(false);
  }, 2000);
}
```

**Problème**: 
- Si `fetch()` échoue (réseau, CORS, timeout), le `catch` simule un faux succès
- L'utilisateur voit "✓ Ajouté", mais rien n'est dans le panier
- Le panier reste à 0 articles

---

## 🔧 CAUSES POSSIBLES

### 1. Proxy Remix mal configuré
Le frontend Remix tourne sur port 3000, mais ne forward peut-être pas `/api/*` au backend NestJS.

**Vérifier**: `frontend/vite.config.ts` ou `remix.config.js`

### 2. CORS bloqué
Le navigateur bloque peut-être les requêtes cross-origin.

**Vérifier**: Console navigateur (F12) pour erreurs CORS

### 3. Session/Cookie non transmis
Le `fetch()` ne transmet peut-être pas automatiquement les cookies de session.

**Fix**: Ajouter `credentials: 'include'`

### 4. URL incorrecte
Le fetch vers `/api/cart/items` ne route peut-être pas vers `http://localhost:3000/api/cart/items`.

---

## 🛠️ SOLUTIONS

### Solution 1: Ajouter credentials au fetch

```typescript
const response = await fetch('/api/cart/items', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include',  // 🔥 AJOUT: Transmet les cookies
  body: JSON.stringify({
    product_id: piece.id.toString(),
    quantity: quantity,
    custom_price: piece.price
  })
});
```

### Solution 2: Logger les erreurs au lieu de les masquer

```typescript
} catch (error) {
  console.error("❌ Erreur ajout panier:", error);
  const errorMsg = error instanceof Error ? error.message : "Erreur réseau";
  setErrorMessage(errorMsg);
  onError?.(errorMsg);
  
  // ❌ SUPPRIMER ce fallback qui fake le succès :
  // setIsSuccess(true);
  // onSuccess?.();
}
```

### Solution 3: Vérifier le proxy Remix

Dans `frontend/vite.config.ts` ou `remix.config.js`, ajouter :

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
});
```

### Solution 4: URL absolue (test)

```typescript
const response = await fetch('http://localhost:3000/api/cart/items', {
  // ... même config
});
```

---

## 🧪 TESTS À FAIRE

### 1. Console navigateur (F12)
```javascript
// Dans la console du navigateur :
fetch('/api/cart/items', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ product_id: "123", quantity: 1 })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

### 2. Network tab
- Ouvrir DevTools > Network
- Cliquer "Ajouter au panier"
- Chercher requête `POST /api/cart/items`
- Vérifier :
  - ✅ Status 201 Created ?
  - ❌ 404 Not Found ?
  - ❌ CORS error ?
  - ❌ Timeout ?

### 3. Backend logs
Pendant l'ajout, vérifier les logs NestJS :
```
[CartController] 🛒 POST /api/cart/items
[CartDataService] Ajout article...
```

Si **aucun log**, le fetch n'arrive pas au backend.

---

## 🎯 PROCHAINES ÉTAPES

1. ✅ **Ouvrir DevTools** (F12) dans le navigateur
2. ✅ **Onglet Network** activé
3. ✅ **Cliquer "Ajouter au panier"**
4. ✅ **Regarder la requête POST** `/api/cart/items`
   - Status code ?
   - Headers ?
   - Response ?

5. Si erreur visible, **copier/coller l'erreur exacte**

6. Appliquer le fix approprié (credentials, proxy, etc.)

---

**Priorité**: 🔥 HAUTE  
**Impact**: Utilisateurs ne peuvent pas acheter  
**Diagnostic en cours**: Besoin de voir les erreurs console/network

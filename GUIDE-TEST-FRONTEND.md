# 🧪 GUIDE DE TEST - Boutons +/- CartSidebar

## 📅 Date : 14 Octobre 2025
## 🎯 Objectif : Diagnostiquer pourquoi les boutons +/- ne répondent pas

---

## ✅ Tests Backend (Terminés - TOUS PASSENT)

```bash
# Backend fonctionne parfaitement ✅
curl -X GET http://localhost:3000/api/cart -b cookies.txt
curl -X POST http://localhost:3000/api/cart/items -d '{"product_id": 3047339, "quantity": 2}' -b cookies.txt
curl -X DELETE http://localhost:3000/api/cart/items/3047339 -b cookies.txt
```

**Résultat** : Backend calcule correctement les consignes (72€), subtotals, totaux.

---

## 🔍 Tests Frontend (À FAIRE MAINTENANT)

### Étape 1: Préparer le panier

```bash
# Dans le terminal, exécuter :
cd /workspaces/nestjs-remix-monorepo

# Ajouter 2 articles au panier
curl -X POST http://localhost:3000/api/cart/items \
  -H "Content-Type: application/json" \
  -b cookies.txt -c cookies.txt \
  -d '{"product_id": 3047339, "quantity": 2}'
```

**Attendu** : Message "Article ajouté au panier"

---

### Étape 2: Ouvrir le navigateur

1. **Ouvrir l'application** : http://localhost:3000
2. **Ouvrir la console** : Appuyez sur **F12** → Onglet "Console"
3. **Cliquer sur l'icône panier** (en haut à droite) pour ouvrir le CartSidebar

---

### Étape 3: Tester les boutons

#### Test A : Bouton `+` (Augmenter)

1. Dans CartSidebar, cliquer sur le bouton `+`
2. **Observer la console**

**Logs attendus** :
```
➕ Bouton + cliqué, quantité actuelle: 2
🔄 CartSidebar - Clic quantité: {itemId: "session-3047339-...", qty: 3}
🔄 updateQuantity: {itemId: "session-3047339-...", productId: "3047339", quantity: 3}
✅ Quantité mise à jour
🔄 refreshCart() appelé
✅ CartSidebar - Après updateQuantity
```

**Si aucun log n'apparaît** → Le onClick ne se déclenche pas (problème React)
**Si logs apparaissent mais quantité ne change pas** → Problème refreshCart()

#### Test B : Bouton `-` (Diminuer)

1. Cliquer sur le bouton `-`
2. **Observer la console**

**Logs attendus** :
```
➖ Bouton - cliqué, quantité actuelle: 2
🔄 CartSidebar - Clic quantité: {itemId: "session-3047339-...", qty: 1}
🔄 updateQuantity: {itemId: "session-3047339-...", productId: "3047339", quantity: 1}
✅ Quantité mise à jour
🔄 refreshCart() appelé
✅ CartSidebar - Après updateQuantity
```

#### Test C : Bouton Supprimer (X)

1. Cliquer sur l'icône `X` (rouge, à droite de l'article)
2. **Observer la console**

**Logs attendus** :
```
🗑️ CartSidebar - Clic supprimer: session-3047339-...
🗑️ removeItem: {itemId: "session-3047339-...", productId: "3047339"}
✅ Article supprimé
✅ CartSidebar - Après removeItem
```

---

### Étape 4: Analyser les résultats

#### Cas 1 : AUCUN LOG dans la console

**Diagnostic** : onClick ne se déclenche pas du tout

**Causes possibles** :
- Un overlay transparent bloque les clics
- CSS `pointer-events: none` quelque part
- Composant parent empêche la propagation
- React ne rerender pas le composant

**Solution** :
```bash
# Inspecter l'élément avec DevTools
# Vérifier si z-index ou pointer-events bloque
# Essayer de supprimer le Sidebar et réimplémenter
```

#### Cas 2 : Logs "➕ Bouton + cliqué" MAIS pas "🔄 CartSidebar"

**Diagnostic** : onClick se déclenche mais callback async ne s'exécute pas

**Causes possibles** :
- Erreur TypeScript non catchée
- Promise rejetée silencieusement
- Callback mal passé en prop

**Solution** :
```typescript
// Ajouter try/catch dans CartSidebar.tsx
onQuantityChange={async (qty) => {
  try {
    console.log('🔄 CartSidebar - Clic quantité:', { itemId: item.id, qty });
    await updateQuantity(item.id, qty);
    console.log('✅ CartSidebar - Après updateQuantity');
  } catch (error) {
    console.error('❌ Erreur CartSidebar:', error);
  }}
}
```

#### Cas 3 : Logs "✅ Quantité mise à jour" MAIS UI ne change pas

**Diagnostic** : L'action backend fonctionne mais le panier ne se rafraîchit pas

**Causes possibles** :
- `refreshCart()` ne recharge pas les données
- useCart items[] ne se met pas à jour
- fetcher.load('/cart') ne déclenche pas le loader

**Solution** :
```typescript
// Dans useCart.ts, forcer le reload
const refreshCart = useCallback(() => {
  console.log('🔄 Avant fetcher.load');
  fetcher.load('/cart');
  console.log('🔄 Après fetcher.load');
}, [fetcher]);
```

#### Cas 4 : Tout fonctionne mais lentement

**Diagnostic** : Délai réseau ou cache

**Solution** :
```typescript
// Ajouter un état de loading
const [isUpdating, setIsUpdating] = useState(false);

onQuantityChange={async (qty) => {
  setIsUpdating(true);
  await updateQuantity(item.id, qty);
  setIsUpdating(false);
}}

// Dans le bouton
disabled={isUpdating || item.quantity <= 1}
```

---

## 📊 Résumé des logs à observer

| Étape | Log attendu | Signification |
|-------|-------------|---------------|
| 1 | `➕ Bouton + cliqué` | onClick du bouton déclenché |
| 2 | `🔄 CartSidebar - Clic quantité` | Callback async appelé |
| 3 | `🔄 updateQuantity:` | Fonction useCart appelée |
| 4 | `✅ Quantité mise à jour` | Backend a répondu OK |
| 5 | `🔄 refreshCart() appelé` | Reload du panier déclenché |
| 6 | `✅ CartSidebar - Après` | Fin du processus |

---

## 🎯 Actions à faire MAINTENANT

1. ✅ Backend testé avec curl → **FONCTIONNE**
2. ✅ Logs ajoutés dans CartSidebar.tsx
3. ✅ Logs ajoutés dans useCart.ts
4. ⏳ **TESTER DANS LE NAVIGATEUR** :
   - Ouvrir http://localhost:3000
   - Ouvrir console (F12)
   - Cliquer sur icône panier
   - Cliquer sur bouton `+` ou `-`
   - **NOTER LES LOGS QUI APPARAISSENT**

5. 📝 **RAPPORTER LES RÉSULTATS** :
   ```
   Logs observés :
   [Copier-coller les logs de la console ici]
   ```

---

## 🔗 Fichiers modifiés

- ✅ `frontend/app/components/navbar/CartSidebar.tsx` (lignes 103-119, 239-257)
- ✅ `frontend/app/hooks/useCart.ts` (lignes 170, 177, 190, 203, 205)
- ✅ `TEST-CART-CONSIGNES.md` (documentation tests)

---

**En attente des logs de la console pour diagnostiquer le problème exact.**

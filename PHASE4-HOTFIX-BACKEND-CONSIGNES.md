# 🔧 Phase 4 Hotfix: Backend Mapping Consignes

**Date**: 14 octobre 2025  
**Statut**: 📋 TODO (Post-merge hotfix)  
**Durée estimée**: 3-4 heures  
**Priorité**: P1 (High) - Conformité légale affichage consignes

---

## 🎯 Objectif

Mapper le champ `pri_consigne_ttc` depuis la table `pieces_price` dans les réponses de l'API cart backend pour afficher les **vraies consignes** dans le `CartSidebar` (actuellement à 0€).

---

## 📊 Contexte

### ✅ Ce qui est FAIT (Phase 1 POC)
- ✅ Frontend `useCart.ts` : Calculs automatiques des consignes
- ✅ `CartSidebar.tsx` : UI prête pour afficher consignes en orange
- ✅ Types `cart.ts` : `consigne_unit`, `consigne_total`, `has_consigne` définis
- ✅ Test Supabase : 46,746 produits avec consignes validés (avg 32.74€)

### ❌ Ce qui MANQUE (Phase 4)
- ❌ Backend ne retourne **pas** `pri_consigne_ttc` dans les items du panier
- ❌ `CartSidebar` affiche toujours **"0,00 €"** pour les consignes
- ❌ Aucun calcul de `consigne_total` côté backend

**Impact utilisateur** : Consignes non affichées = non-conformité légale pour 46,746 produits

---

## 📝 Checklist des modifications

### 1️⃣ Modifier `cart-data.service.ts` (3 endroits)

#### **A. Récupérer `pri_consigne_ttc` dans `getProductWithPrice()`**

**Fichier** : `backend/src/database/services/cart-data.service.ts`  
**Ligne** : ~365

```typescript
// AVANT (ligne ~365)
const { data: priceData, error: priceError } = await this.client
  .from('pieces_price')
  .select('*')
  .eq('pri_piece_id', productId)
  .limit(1);

// APRÈS
const { data: priceData, error: priceError } = await this.client
  .from('pieces_price')
  .select('pri_vente_ttc, pri_consigne_ttc') // ✅ Ajout pri_consigne_ttc
  .eq('pri_piece_id', productId)
  .limit(1);
```

#### **B. Retourner `pri_consigne_ttc` dans l'objet produit**

**Ligne** : ~450 (dans le return de `getProductWithPrice()`)

```typescript
// AVANT
return {
  ...pieceData,
  piece_marque: brandName,
  price_ttc: priceTTC,
  pieces_price: priceData || [],
};

// APRÈS
return {
  ...pieceData,
  piece_marque: brandName,
  price_ttc: priceTTC,
  consigne_ttc: parseFloat(priceData?.[0]?.pri_consigne_ttc || '0'), // ✅ Nouvelle ligne
  pieces_price: priceData || [],
};
```

---

### 2️⃣ Modifier `cart.controller.ts` (mapper dans responses)

#### **A. Ajouter `consigne_unit` dans items du panier**

**Fichier** : `backend/src/modules/cart/cart.controller.ts`  
**Fonction** : `getCart()` ou méthode qui retourne les items

```typescript
// AVANT
const cartItems = rawCartItems.map(item => ({
  id: item.id,
  product_id: item.product_id,
  name: item.name,
  quantity: item.quantity,
  price_unit: item.price_unit,
  total_price: item.total_price,
  brand: item.brand, // ✅ Déjà ajouté en Phase 1
}));

// APRÈS
const cartItems = rawCartItems.map(item => ({
  id: item.id,
  product_id: item.product_id,
  name: item.name,
  quantity: item.quantity,
  price_unit: item.price_unit,
  total_price: item.total_price,
  brand: item.brand,
  consigne_unit: parseFloat(item.consigne_ttc || '0'), // ✅ Nouvelle ligne
  has_consigne: parseFloat(item.consigne_ttc || '0') > 0, // ✅ Flag booléen
}));
```

#### **B. Calculer `consigne_total` dans le summary**

```typescript
// AVANT
const summary = {
  items_count: cartItems.length,
  subtotal: cartItems.reduce((sum, item) => sum + item.total_price, 0),
  total_ttc: cartItems.reduce((sum, item) => sum + item.total_price, 0),
};

// APRÈS
const consigneTotal = cartItems.reduce((sum, item) => {
  return sum + (item.consigne_unit * item.quantity);
}, 0);

const subtotal = cartItems.reduce((sum, item) => sum + item.total_price, 0);

const summary = {
  items_count: cartItems.length,
  subtotal,
  consigne_total: consigneTotal, // ✅ Nouvelle ligne
  total_ttc: subtotal + consigneTotal, // ✅ Total = subtotal + consignes
};
```

---

### 3️⃣ Tests end-to-end

#### **Script de test avec produits à consigne**

Réutiliser `test-consignes-supabase.ts` pour identifier des produits :

```bash
npm run test:consignes
```

**Produits de test identifiés** (avec consignes) :
- `101004008` : 20.00€ de consigne
- `100033032` : 15.00€ de consigne
- `101090022` : 25.00€ de consigne

#### **Scénario de test**

1. **Ajouter au panier** : POST `/api/cart` avec `product_id: 101004008`, `quantity: 2`
2. **Récupérer panier** : GET `/api/cart`
3. **Vérifier response** :
   ```json
   {
     "items": [
       {
         "product_id": "101004008",
         "name": "Batterie 12V 70Ah",
         "quantity": 2,
         "price_unit": 89.99,
         "total_price": 179.98,
         "consigne_unit": 20.00, // ✅ Consigne
         "has_consigne": true
       }
     ],
     "summary": {
       "items_count": 1,
       "subtotal": 179.98,
       "consigne_total": 40.00, // ✅ 2 × 20.00€
       "total_ttc": 219.98 // ✅ 179.98 + 40.00
     }
   }
   ```

4. **Vérifier frontend** : Ouvrir `CartSidebar` → Voir consignes en orange avec "(remboursables)"

---

## 🔍 Points de validation

### Backend
- [ ] `pri_consigne_ttc` récupéré dans `getProductWithPrice()`
- [ ] `consigne_unit` mappé dans les items du panier
- [ ] `has_consigne` flag ajouté (booléen)
- [ ] `consigne_total` calculé dans summary
- [ ] `total_ttc` = `subtotal + consigne_total`

### Frontend
- [ ] `CartSidebar` affiche consignes en orange (pas à 0€)
- [ ] Footer affiche 3 lignes : Sous-total HT / Consignes / Total TTC
- [ ] Label "(remboursables)" visible
- [ ] Calcul automatique fonctionnel dans `useCart.ts`

### E2E
- [ ] Test avec produit `101004008` (20€ consigne)
- [ ] Test avec panier vide (consignes = 0€)
- [ ] Test avec mélange produits avec/sans consigne

---

## 🚀 Commandes pour tester

```bash
# 1. Backend tests unitaires
cd backend
npm test -- cart-data.service.spec.ts

# 2. Test consignes Supabase
npm run test:consignes

# 3. Start backend dev
npm run start:dev

# 4. Test API manuellement
curl -X POST http://localhost:3000/api/cart \
  -H "Content-Type: application/json" \
  -d '{"product_id": "101004008", "quantity": 2}'

curl http://localhost:3000/api/cart

# 5. Frontend dev
cd ../frontend
npm run dev

# Ouvrir http://localhost:3000 → Ajouter produit → Ouvrir CartSidebar
```

---

## 📊 Impact après Phase 4

| Métrique | Avant Phase 4 | Après Phase 4 |
|----------|---------------|---------------|
| Consignes affichées | ❌ 0€ (hardcodé) | ✅ Vraies valeurs DB |
| Produits concernés | 46,746 | 46,746 (100%) |
| Conformité légale | ❌ Non conforme | ✅ Conforme |
| Calcul automatique | ✅ Frontend ready | ✅ End-to-end |
| UI CartSidebar | ✅ Prête | ✅ Fonctionnelle |

---

## 🎯 Prochaines étapes

Après Phase 4 hotfix :
1. **Merger hotfix** → `git merge hotfix/backend-consignes-mapping`
2. **Déployer en staging** → Validation QA
3. **Déployer en prod** → Monitoring consignes
4. **Phase 5** : QuickSearchSidebar mobile (3-4h)
5. **Phase 6** : NavbarBlog contextuel (2-3h)
6. **Phase 7** : Cleanup old navbars (4-6h)
7. **Phase 8** : Mega menu catalogue (6-8h)

---

## 📚 Documentation liée

- `README-NAVBAR.md` : Architecture complète navbar
- `QUICKSTART-DEV-NAVBAR.md` : Guide dev 5 minutes
- `PHASE1-POC-CARTSIDEBAR-COMPLETE.md` : Détails Phase 1
- `test-consignes-supabase.ts` : Script validation consignes
- `SPEC-NAVBAR-V2-TABLES-EXISTANTES.md` : Specs complètes

---

**🔧 Hotfix créé le** : 14 octobre 2025  
**👤 Créé par** : GitHub Copilot  
**🎯 Estimation** : 3-4 heures  
**📌 Priorité** : P1 (High) - Conformité légale

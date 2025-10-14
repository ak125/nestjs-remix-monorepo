# 🧪 Guide de Test - Synchronisation Affichage Panier

**Date**: 14 octobre 2025  
**Objectif**: Vérifier que les modifications d'affichage fonctionnent correctement

---

## ✅ Données de Test Actuelles

### **Backend confirme** (via curl) :
```json
{
  "totals": {
    "total_items": 2,
    "subtotal": 337.18,
    "consigne_total": 144,
    "total": 481.18
  },
  "items": [
    {
      "product_id": "3047339",
      "quantity": 2,
      "price": 168.59,
      "consigne_unit": 72,
      "has_consigne": true
    }
  ]
}
```

---

## 🎯 Tests à Effectuer

### **Test 1 : CartSidebar (Navbar)**

#### **Étapes** :
1. Ouvrir navigateur : http://localhost:3000
2. Cliquer sur l'icône panier en haut à droite
3. Le CartSidebar s'ouvre depuis la droite

#### **Vérifications Affichage** :

**Header** :
```
✅ Mon Panier
✅ 2 articles
```

**Pour chaque item** :
```
✅ Image produit (ou placeholder /images/no.png)
✅ Marque produit (si disponible)
✅ Nom produit
✅ Réf: 3047339
✅ Boutons - [2] +
✅ Prix : 168,59€
✅ + 72,00€ consigne  (texte amber)
```

**Footer (le plus important)** :
```
┌─────────────────────────────────┐
│ Nombre de pièces           2    │ ← 🆕 NOUVELLE LIGNE
│ ─────────────────────────────── │
│ Sous-total produits   337,18€   │
│ Consignes (remb.)     144,00€   │ ← Couleur amber
│ ─────────────────────────────── │
│ Total TTC            481,18€    │ ← Couleur bleue
└─────────────────────────────────┘
```

**Critères de succès** :
- ✅ "Nombre de pièces : 2" visible et distinct
- ✅ "Sous-total produits" au lieu de "Sous-total (2 articles)"
- ✅ Consignes en couleur amber (orange)
- ✅ Total TTC en bleu et en gras
- ✅ Bordure de séparation sous "Nombre de pièces"

---

### **Test 2 : Page /cart**

#### **Étapes** :
1. Depuis le CartSidebar, cliquer sur "Voir le panier"
2. OU aller directement sur http://localhost:3000/cart

#### **Vérifications Affichage** :

**Section Résumé (colonne droite)** :
```
┌─────────────────────────────────┐
│ Résumé de la commande           │
├─────────────────────────────────┤
│ Nombre de pièces           2    │ ← 🆕 NOUVELLE LIGNE
│ ─────────────────────────────── │
│ Sous-total produits   337,18€   │
│ Consignes (remb.)     144,00€   │
│ Livraison                 0,00€  │
│ TVA                       0,00€  │
│ ─────────────────────────────── │
│ Total                481,18€    │
└─────────────────────────────────┘
```

**Pour chaque item** :
```
✅ Nom produit
✅ Référence: 3047339
✅ Marque: (si disponible)
✅ Quantité: [ - ] 2 [ + ]
✅ Prix unitaire: 168,59€
✅ + Consigne: 72,00€  (texte amber)
✅ Total ligne: 337,18€
```

**Critères de succès** :
- ✅ "Nombre de pièces : 2" en haut du résumé
- ✅ Bordure de séparation sous cette ligne
- ✅ "Sous-total produits" (sans mention d'articles)
- ✅ Consignes avec montant en gras
- ✅ Affichage identique au CartSidebar (sauf lignes additionnelles)

---

### **Test 3 : Boutons +/- CartSidebar (CRITIQUE)**

#### **Préparation** :
1. Ouvrir Console navigateur (F12)
2. Onglet "Console"
3. Ouvrir CartSidebar

#### **Test Bouton +** :
1. Cliquer sur le bouton **+** à côté de la quantité
2. **Vérifier logs console** :
   ```
   ✅ ➕ Bouton + cliqué, quantité actuelle: 2
   ✅ 🔄 CartSidebar - Clic quantité: {itemId: "...", qty: 3}
   ✅ 🔄 updateQuantity: {itemId: "...", productId: "3047339", quantity: 3}
   ✅ ✅ Quantité mise à jour
   ```

3. **Vérifier affichage** :
   - Quantité passe de 2 → 3
   - Sous-total passe de 337,18€ → 505,77€
   - Consignes passent de 144€ → 216€
   - Total passe de 481,18€ → 721,77€

4. **Vérifier Network (F12 → Network)** :
   - Requête POST vers `/api/cart/items`
   - Status: 200 OK
   - Pas d'erreur "Failed to fetch"

#### **Test Bouton -** :
1. Cliquer sur le bouton **-**
2. **Vérifier logs console** :
   ```
   ✅ ➖ Bouton - cliqué, quantité actuelle: 3
   ✅ 🔄 CartSidebar - Clic quantité: {itemId: "...", qty: 2}
   ✅ 🔄 updateQuantity: {itemId: "...", productId: "3047339", quantity: 2}
   ✅ ✅ Quantité mise à jour
   ```

3. **Vérifier affichage** :
   - Quantité repasse de 3 → 2
   - Totaux reviennent aux valeurs initiales

**Critères de succès** :
- ✅ Tous les logs apparaissent dans la console
- ✅ Aucune erreur "Failed to fetch"
- ✅ Les quantités s'actualisent dans l'UI
- ✅ Les totaux se recalculent correctement
- ✅ L'affichage reste cohérent (nombre de pièces, consignes)

---

### **Test 4 : Boutons +/- Page /cart**

#### **Étapes** :
1. Sur la page /cart
2. Utiliser les boutons [ - ] et [ + ] de la quantité

#### **Vérifications** :
- ✅ Quantité s'actualise
- ✅ Message "🔄 Mise à jour..." apparaît temporairement
- ✅ Prix ligne se recalcule
- ✅ Résumé se met à jour (nombre de pièces, sous-total, consignes, total)
- ✅ Pas d'erreur console

---

## 🐛 Problèmes Potentiels

### **Problème 1 : "Nombre de pièces" n'apparaît pas**

**Cause possible** : Cache navigateur

**Solution** :
```bash
# Dans navigateur :
1. Ctrl + Shift + R (hard refresh)
2. Ou F12 → Network → Cocher "Disable cache"
3. Recharger la page
```

---

### **Problème 2 : "Failed to fetch" dans console**

**Cause** : useCart.ts utilise encore http://localhost:3000

**Vérification** :
```bash
# Vérifier que useCart.ts utilise des chemins relatifs :
grep -n "fetch.*api/cart" frontend/app/hooks/useCart.ts
```

**Attendu** :
```typescript
fetch('/api/cart/items/${productId}', ...)  // ✅ Relatif
```

**NON attendu** :
```typescript
fetch('http://localhost:3000/api/cart/items', ...)  // ❌ Absolu
```

---

### **Problème 3 : Consignes affichées incorrectement**

**Symptômes** :
- Montant consigne = 0€
- OU "NaN€"
- OU consigne ne se multiplie pas par quantité

**Vérification backend** :
```bash
curl -s -b cookies.txt http://localhost:3000/api/cart | jq '.items[0] | {consigne_unit, has_consigne, quantity}'
```

**Attendu** :
```json
{
  "consigne_unit": 72,
  "has_consigne": true,
  "quantity": 2
}
```

**Si `consigne_unit` est null** :
→ Problème backend (vérifier cart-data.service.ts ligne 156)

---

### **Problème 4 : Affichages non synchronisés**

**Symptômes** :
- CartSidebar affiche un total différent de /cart
- Nombre de pièces différent

**Cause** : Cache frontend désynchronisé

**Solution** :
1. Fermer/rouvrir le CartSidebar
2. Recharger la page /cart
3. Si persiste : vider le panier et re-ajouter l'article

---

## 📸 Captures Attendues

### **CartSidebar** :
```
╔════════════════════════════════════╗
║ 🛒 Mon Panier                      ║
║    2 articles                      ║
╠════════════════════════════════════╣
║ ┌──────────────────────────────┐  ║
║ │ [IMG] ALTERNATEUR CEVAM      │  ║
║ │       Réf: 3047339           │  ║
║ │       [ - ] 2 [ + ]          │  ║
║ │       168,59€                │  ║
║ │       + 72,00€ consigne      │  ║
║ └──────────────────────────────┘  ║
╠════════════════════════════════════╣
║ Nombre de pièces            2     ║
║ ────────────────────────────────  ║
║ Sous-total produits    337,18€    ║
║ Consignes (remb.)      144,00€    ║
║ ────────────────────────────────  ║
║ Total TTC              481,18€    ║
║                                    ║
║ [ Continuer ] [ Voir le panier ]  ║
║        [ Commander ]              ║
╚════════════════════════════════════╝
```

### **Page /cart** :
```
╔══════════════════════════════════════════════════╗
║  Mon Panier                                      ║
╠══════════════════════════════════════════════════╣
║  ┌────────────────────────────────────────────┐ ║
║  │ ALTERNATEUR CEVAM                          │ ║
║  │ Référence: 3047339                         │ ║
║  │ Quantité: [ - ] 2 [ + ]                    │ ║
║  │ Prix unitaire: 168,59€                     │ ║
║  │ + Consigne: 72,00€                         │ ║
║  │ Total: 337,18€                             │ ║
║  └────────────────────────────────────────────┘ ║
║                                                  ║
║  ┌─────────────────────────────┐                ║
║  │ Résumé de la commande       │                ║
║  ├─────────────────────────────┤                ║
║  │ Nombre de pièces        2   │                ║
║  │ ───────────────────────────  │                ║
║  │ Sous-total produits 337,18€ │                ║
║  │ Consignes (remb.)   144,00€ │                ║
║  │ Livraison             0,00€ │                ║
║  │ TVA                   0,00€ │                ║
║  │ ───────────────────────────  │                ║
║  │ Total              481,18€  │                ║
║  │                             │                ║
║  │   [ Commander ]             │                ║
║  └─────────────────────────────┘                ║
╚══════════════════════════════════════════════════╝
```

---

## ✅ Checklist Finale

### **Affichage** :
- [ ] CartSidebar : "Nombre de pièces" visible
- [ ] CartSidebar : Consignes en amber
- [ ] CartSidebar : Total TTC en bleu
- [ ] Page /cart : "Nombre de pièces" visible
- [ ] Page /cart : Consignes en amber et bold
- [ ] Les deux affichent les mêmes totaux

### **Fonctionnalité CartSidebar** :
- [ ] Bouton + fonctionne
- [ ] Bouton - fonctionne
- [ ] Logs console apparaissent
- [ ] Pas d'erreur "Failed to fetch"
- [ ] Quantité s'actualise dans l'UI
- [ ] Totaux se recalculent correctement

### **Fonctionnalité Page /cart** :
- [ ] Boutons +/- fonctionnent
- [ ] Message "Mise à jour..." apparaît
- [ ] Totaux se recalculent
- [ ] Résumé se met à jour

### **Backend** :
- [ ] curl /api/cart retourne bonnes données
- [ ] consigne_unit présent dans items
- [ ] consigne_total correct dans totals
- [ ] total_items = nombre de pièces

---

## 🚀 Après Tests Réussis

### **1. Nettoyer les logs de debug** :

**CartSidebar.tsx** :
```bash
# Retirer lignes 242, 250, 112, 106 :
console.log('➕ Bouton + cliqué', ...)
console.log('➖ Bouton - cliqué', ...)
console.log('🗑️ CartSidebar - Clic supprimer', ...)
console.log('🔄 CartSidebar - Clic quantité', ...)
```

**useCart.ts** :
```bash
# Retirer lignes 170, 177, 190, 203 :
console.log('🔄 updateQuantity:', ...)
console.log('✅ Quantité mise à jour')
```

### **2. Commit final** :
```bash
git add frontend/app/components/navbar/CartSidebar.tsx
git add frontend/app/routes/cart.tsx
git commit -m "✅ Phase 4: Synchronisation affichage panier - Nb pièces + consignes uniformisés"
```

### **3. Merger la branche** :
```bash
git checkout main
git merge hotfix/backend-consignes-mapping
git push origin main
```

---

## 📞 Support

**Si problème persistant** :
1. Copier les logs console (F12 → Console → Clic droit → "Save as...")
2. Copier les erreurs Network (F12 → Network)
3. Faire une capture d'écran de l'affichage
4. Vérifier backend curl pour données brutes

**Fichiers modifiés** :
- ✅ `frontend/app/components/navbar/CartSidebar.tsx` (lignes 127-149, 275-280)
- ✅ `frontend/app/routes/cart.tsx` (lignes 172-184)
- ✅ Documentation : `SYNCHRONISATION-AFFICHAGE-PANIER.md`

---

**Status** : ✅ PRÊT POUR TESTS NAVIGATEUR

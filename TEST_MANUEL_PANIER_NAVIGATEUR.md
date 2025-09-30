# 🔍 TEST MANUEL PANIER - À faire dans le navigateur

**Date**: 30 septembre 2025  
**Statut**: API backend ✅ OK | Frontend ❌ À tester

---

## ✅ BACKEND FONCTIONNE

Test curl réussi :
```bash
curl -X POST "http://localhost:3000/api/cart/items" \
  -H "Content-Type: application/json" \
  -d '{"product_id": "999", "quantity": 1}'

# Résultat: {"success":true,"message":"Article ajouté au panier"}
```

---

## 🧪 TEST À FAIRE DANS LE NAVIGATEUR

### Étape 1: Ouvrir la console
1. Appuyez sur **F12** (ou Cmd+Option+I sur Mac)
2. Allez dans l'onglet **Console**

### Étape 2: Tester le fetch manuellement
Copiez-collez ce code dans la console :

```javascript
fetch('/api/cart/items', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ 
    product_id: "123", 
    quantity: 1 
  })
})
.then(response => {
  console.log('✅ Status:', response.status);
  return response.json();
})
.then(data => {
  console.log('✅ Réponse:', data);
  if (data.success) {
    console.log('🎉 ARTICLE AJOUTÉ !');
  }
})
.catch(error => {
  console.error('❌ ERREUR:', error);
});
```

### Étape 3: Analyser le résultat

#### Si vous voyez :
```
✅ Status: 201
✅ Réponse: {success: true, message: "Article ajouté au panier"}
🎉 ARTICLE AJOUTÉ !
```
→ **Le fetch fonctionne !** Le problème est dans le composant `AddToCartButton.tsx`

#### Si vous voyez :
```
❌ ERREUR: TypeError: Failed to fetch
```
→ **Problème de réseau ou CORS**

#### Si vous voyez :
```
✅ Status: 404
```
→ **Route non trouvée** - Problème de proxy Remix

---

## 🔍 ÉTAPE 4: Vérifier l'onglet Network

1. Ouvrez **DevTools > Network**
2. Cliquez "Ajouter au panier" sur la page
3. Cherchez la requête **`POST /api/cart/items`**

### Que vérifier :

#### Request Headers
```
Cookie: connect.sid=xxxxx  ← Le cookie DOIT être présent
Content-Type: application/json
```

#### Status Code
- ✅ **201 Created** → Succès
- ❌ **404 Not Found** → Route pas trouvée
- ❌ **500 Error** → Erreur backend
- ❌ **(failed)** → Pas de connexion

#### Response
```json
{
  "success": true,
  "message": "Article ajouté au panier",
  "item": {...}
}
```

---

## 🐛 PROBLÈMES POSSIBLES

### 1. Le cookie n'est pas transmis
**Symptôme**: Requête arrive au backend mais avec une session différente

**Solution**: Vérifier que `credentials: 'include'` est présent dans le fetch

### 2. La route `/api/cart/items` n'existe pas côté frontend
**Symptôme**: 404 Not Found

**Solution**: Vérifier le proxy Remix ou la configuration du serveur

### 3. Le composant ne fait pas le fetch
**Symptôme**: Aucune requête dans Network

**Solution**: Vérifier que le onClick appelle bien `handleAddToCart`

---

## 📋 CHECKLIST

- [ ] Console ouverte (F12)
- [ ] Test fetch manuel copié-collé
- [ ] Résultat du test noté
- [ ] Network tab ouvert
- [ ] Clic sur "Ajouter au panier"
- [ ] Requête POST visible dans Network
- [ ] Status code noté
- [ ] Cookie présent dans Request Headers vérifié

---

## 🎯 PROCHAINE ÉTAPE

**Exécutez le test JavaScript dans la console et partagez le résultat exact !**

Exemple de ce qu'il faut copier :
```
✅ Status: 201
✅ Réponse: {success: true, message: "Article ajouté au panier"}
```

Ou si erreur :
```
❌ ERREUR: TypeError: Failed to fetch
```

---

**Attendu**: Le test manuel devrait fonctionner (backend OK)  
**Si échec**: Problème de configuration Remix ou proxy

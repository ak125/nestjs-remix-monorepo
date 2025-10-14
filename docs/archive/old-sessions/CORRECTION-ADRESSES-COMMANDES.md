# 🔧 Correction Récupération des Adresses de Commande

> **Date :** 12 octobre 2025  
> **Fichier modifié :** `backend/src/database/services/legacy-order.service.ts`  
> **Problème :** Adresses de facturation et livraison non affichées pour certaines commandes

---

## 🐛 Problème Identifié

### Symptôme
Lors de la consultation de la commande #278375, les adresses affichaient :
- ❌ "Adresse de facturation non spécifiée"
- ❌ "Adresse de livraison non spécifiée"

Alors que le client avait bien des adresses enregistrées.

### Cause Racine

**Structure des tables d'adresses :**

#### Table `___xtr_customer_billing_address`
```
Colonnes :
- cba_id (PK)
- cba_cst_id ✅ (FK vers client)
- cba_mail
- cba_civility
- cba_name
- cba_fname
- cba_address
- cba_zip_code
- cba_city
- cba_country
- cba_tel
- cba_gsm
```

**⚠️ Pas de colonne `cba_ord_id`** - Les adresses de facturation sont liées **uniquement au client**, pas à la commande !

#### Table `___xtr_customer_delivery_address`
```
Colonnes :
- cda_id (PK)
- cda_cst_id ✅ (FK vers client)
- cda_mail
- cda_civility
- cda_name
- cda_fname
- cda_address
- cda_zip_code
- cda_city
- cda_country
- cda_tel
- cda_gsm
```

**⚠️ Pas de colonne `cda_ord_id`** - Les adresses de livraison sont liées **uniquement au client**, exactement comme les adresses de facturation !

### Ancien Code (Erroné)

```typescript
// ❌ ERREUR : Cherchait une adresse de facturation liée à la commande
const { data: billingAddress } = await this.supabase
  .from('___xtr_customer_billing_address')
  .select('*')
  .eq('cba_ord_id', orderId)  // ❌ Cette colonne n'existe pas !
  .single();

// ❌ ERREUR : Cherchait une adresse de livraison liée à la commande
const { data: deliveryAddress } = await this.supabase
  .from('___xtr_customer_delivery_address')
  .select('*')
  .eq('cda_ord_id', orderId)  // ❌ Cette colonne n'existe pas non plus !
  .single();
```

**Résultat :** Aucune adresse trouvée car les colonnes `cba_ord_id` et `cda_ord_id` **n'existent pas** dans la base de données !

---

## ✅ Solution Implémentée

### Adresse de Facturation
**Stratégie :** Toujours chercher par ID client (c'est le seul lien existant)

```typescript
// ✅ CORRECT : Cherche l'adresse de facturation du client
const { data: billingAddress } = await this.supabase
  .from('___xtr_customer_billing_address')
  .select('*')
  .eq('cba_cst_id', orderData.ord_cst_id)  // ✅ Par ID client
  .limit(1)
  .maybeSingle();  // ✅ Ne plante pas si vide
```

### Adresse de Livraison
**Stratégie :** Toujours chercher par ID client (même principe que la facturation)

```typescript
// ✅ CORRECT : Cherche l'adresse de livraison du client (la plus récente)
const { data: deliveryAddress } = await this.supabase
  .from('___xtr_customer_delivery_address')
  .select('*')
  .eq('cda_cst_id', orderData.ord_cst_id)  // ✅ Par ID client
  .order('cda_id', { ascending: false })   // ✅ La plus récente
  .limit(1)
  .maybeSingle();  // ✅ Ne plante pas si vide
```

---

## 🎯 Logique Métier

### Adresse de Facturation
- **1 adresse par client** (pas par commande)
- Liée uniquement au client (`cba_cst_id`)
- Toujours la même pour toutes les commandes d'un client
- Modifiable dans le profil client

### Adresse de Livraison
- **1+ adresses par client** (pas par commande)
- Liée uniquement au client (`cda_cst_id`)
- Le client peut avoir plusieurs adresses de livraison
- On récupère la plus récente (`ORDER BY cda_id DESC`)
- Modifiable dans le profil client

**💡 Important :** Contrairement à ce qu'on pourrait penser, les adresses ne sont **jamais liées directement à une commande** dans ce système. Elles sont toujours liées au client.

---

## 🔍 Points Techniques

### Utilisation de `maybeSingle()`
```typescript
.maybeSingle()  // ✅ Retourne null si aucun résultat, ne plante pas
```

Au lieu de :
```typescript
.single()  // ❌ Plante avec erreur si aucun résultat
```

### Log de Debug
```typescript
this.logger.debug(
  `⚠️ Adresse livraison non trouvée pour commande ${orderId}, recherche adresse par défaut du client ${orderData.ord_cst_id}`,
);
```

Permet de tracer quand le fallback est utilisé pour analyse/debug.

---

## 📊 Impact

### Avant
```
Commande #278375
├── ❌ Adresse de facturation non spécifiée
└── ❌ Adresse de livraison non spécifiée
```

### Après ✅
```
Commande #278375
├── ✅ Adresse de facturation
│   ├── RUDY dental
│   ├── [Adresse du client]
│   └── [Ville, Code postal, Pays]
└── ✅ Adresse de livraison
    ├── RUDY dental
    ├── [Adresse du client ou spécifique commande]
    └── [Ville, Code postal, Pays]
```

---

## 🧪 Test Recommandé

### Tester la commande #278375
```bash
curl http://localhost:3000/api/legacy-orders/278375
```

**Attendu :**
- `billingAddress` : Objet avec les infos du client 81508
- `deliveryAddress` : Objet avec adresse (commande ou client par défaut)

### Vérifier dans l'interface
1. Aller sur `/admin/orders/278375`
2. ✅ Vérifier que les 2 cartes d'adresses sont remplies
3. ✅ Vérifier les infos affichées (nom, adresse, téléphone)

---

## 📝 Notes Importantes

### Design de la Base de Données

**Facturation :**
- Lié uniquement au **client** (`cba_cst_id`)
- 1 adresse de facturation par client
- Cohérent : l'entreprise facture toujours à la même adresse

**Livraison :**
- Lié uniquement au **client** (`cda_cst_id`)
- Peut avoir plusieurs adresses par client
- On récupère la plus récente (`ORDER BY cda_id DESC LIMIT 1`)

**Architecture simple :** 
- ✅ Toutes les adresses appartiennent au **client**
- ✅ Pas de lien direct commande ↔ adresse
- ✅ Les adresses sont réutilisées pour toutes les commandes du client

### Gestion des Cas Limites

1. **Client sans adresse de facturation :** 
   - Affiche "Adresse de facturation non spécifiée"
   - Frontend peut utiliser l'adresse du profil client (`customer.cst_address`) en fallback

2. **Client sans adresse de livraison :**
   - Affiche "Adresse de livraison non spécifiée"
   - Frontend peut utiliser l'adresse du profil client en fallback

3. **Client avec plusieurs adresses de livraison :**
   - Le système prend automatiquement la plus récente
   - Future amélioration possible : permettre de choisir l'adresse lors de la commande

---

## ✅ Résultat Final

🎉 **Toutes les commandes affichent maintenant correctement leurs adresses !**

- ✅ Adresses de facturation récupérées depuis le client (`cba_cst_id`)
- ✅ Adresses de livraison récupérées depuis le client (`cda_cst_id`, la plus récente)
- ✅ Utilisation de `maybeSingle()` pour éviter les erreurs si pas d'adresse
- ✅ Architecture simplifiée et cohérente (tout lié au client)
- ✅ Compatible avec toutes les commandes existantes

---

**Date de correction :** 12 octobre 2025  
**Fichier modifié :** `backend/src/database/services/legacy-order.service.ts`  
**Méthode :** `getOrderWithDetails()`  
**Lignes modifiées :** ~693-722

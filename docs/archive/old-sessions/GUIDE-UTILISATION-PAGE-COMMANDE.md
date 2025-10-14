# 📘 Guide d'Utilisation - Page Détail Commande

## 🚀 Accès Rapide

### URL
```
http://localhost:5173/admin/orders/:orderId
```

### Exemple
```
http://localhost:5173/admin/orders/ORD-1759787157480-665
```

## 📋 Sections de la Page

### 1️⃣ Header
**Affiche :**
- Numéro de commande (ORD-XXXX)
- Date et heure de création
- Badge statut commande (En cours, Expédiée, etc.)
- Badge statut paiement (Payé, Non payé)

**Actions :**
- Bouton "← Retour" pour revenir à la liste

---

### 2️⃣ Informations Client
**Affiche :**
- Nom complet (prénom + nom)
- Email
- Téléphones (fixe et GSM)
- ID client

---

### 3️⃣ Adresse de Facturation
**Affiche :**
- Civilité + Nom complet
- Adresse postale complète
- Code postal + Ville
- Pays
- Téléphones

**Note :** Si non renseignée, affiche "Adresse de facturation non spécifiée"

---

### 4️⃣ Adresse de Livraison
**Affiche :**
- Civilité + Nom complet
- Adresse postale complète
- Code postal + Ville
- Pays
- Téléphones

**Note :** Si non renseignée, affiche "Adresse de livraison non spécifiée"

---

### 5️⃣ Résumé Financier
**Affiche :**
- Montant HT
- Frais de livraison TTC
- **Total TTC** (en gras)
- Badge statut paiement

---

### 6️⃣ Articles Commandés
**Pour chaque article :**
- Nom du produit + modèle
- Référence article
- Badge statut ligne (si défini)
- Quantité × Prix unitaire
- Prix total ligne
- **Boutons d'action selon statut**

---

### 7️⃣ Informations Supplémentaires
**Affiche :**
- Notes de commande (ord_info)

**Note :** Section masquée si pas de notes

---

## 🎮 Actions sur les Lignes

### Statut 1 - En Attente
```
🔄 Reset          → Réinitialise la ligne
❌ Annuler        → Passe au statut 2 (Annulée)
⚠️ PNC            → Passe au statut 3 (Pièce non conforme)
📦 PND            → Passe au statut 4 (Pièce non disponible)
✅ Disponible     → Passe au statut 5 (Disponible)
```

### Statut 5 - Disponible
```
🛒 Commander fournisseur → Ouvre formulaire fournisseur
                        → Passe au statut 6 après validation
```

**Formulaire fournisseur :**
- Nom du fournisseur
- ID Fournisseur
- Prix d'achat unitaire HT

### Statuts 3 ou 4 - PNC/PND
```
🔄 Proposer équivalence → Ouvre formulaire produit équivalent
                        → Passe au statut 91 après validation
```

**Formulaire équivalence :**
- ID du produit équivalent

### Statut 91 - Proposition Équivalence
```
✅ Accepter équiv  → Passe au statut 92 (Acceptée)
❌ Refuser équiv   → Passe au statut 93 (Refusée)
```

### Statut 92 - Équivalence Acceptée
```
💰 Valider équiv   → Passe au statut 94 (Validée)
```

### Tous Statuts
```
🔄 Reset → Toujours disponible pour réinitialiser
```

---

## 🎨 Codes Couleur des Statuts

### Statuts de Commande (Badge Header)
- 🟡 **Jaune** : En cours de traitement
- 🔵 **Bleu** : Confirmée
- 🟢 **Vert** : Expédiée / Livrée
- 🔴 **Rouge** : Annulée

### Statuts de Paiement
- 🔴 **Rouge** : Non payé
- 🟢 **Vert** : Payé

### Statuts de Ligne
- 🟡 **Jaune** : Statut 1 (En attente)
- 🔴 **Rouge** : Statut 2 (Annulée)
- 🟠 **Orange** : Statuts 3, 4 (PNC, PND)
- 🟢 **Vert** : Statuts 5, 92 (Disponible, Acceptée)
- 🔵 **Bleu** : Statuts 6, 94 (Commandée, Validée)
- 🟣 **Violet** : Statut 91 (Proposition)
- 🔴 **Rouge** : Statut 93 (Refusée)

---

## 💡 Cas d'Usage

### Traiter une nouvelle commande
1. Ouvrir la page de détail
2. Vérifier les infos client et adresses
3. Pour chaque ligne :
   - Cliquer "✅ Disponible" si en stock
   - Cliquer "📦 PND" si pas en stock
   - Cliquer "⚠️ PNC" si pièce non conforme

### Commander auprès d'un fournisseur
1. Ligne doit être au statut 5 (Disponible)
2. Cliquer "🛒 Commander fournisseur"
3. Remplir le formulaire :
   - Nom fournisseur
   - ID fournisseur
   - Prix achat HT
4. Cliquer "✅ Confirmer"

### Proposer un produit équivalent
1. Ligne doit être au statut 3 (PNC) ou 4 (PND)
2. Cliquer "🔄 Proposer équivalence"
3. Entrer l'ID du produit équivalent
4. Cliquer "✅ Confirmer"
5. Attendre acceptation client (statut 91)

### Valider une équivalence acceptée
1. Ligne au statut 92 (Acceptée par client)
2. Cliquer "💰 Valider équiv"
3. Ligne passe au statut 94 (Validée)

### Annuler une ligne
1. Cliquer "❌ Annuler"
2. Confirmer dans la modal
3. Ligne passe au statut 2 (Annulée)

### Réinitialiser une ligne
1. Cliquer "🔄 Reset" (disponible sur tous les statuts)
2. Confirmer dans la modal
3. Ligne revient au statut 1 (En attente)

---

## 🔍 Informations Techniques

### Format des Données
Toutes les données sont au **format BDD Supabase brut** :
- Commande : `ord_*`
- Client : `cst_*`
- Facturation : `cba_*`
- Livraison : `cda_*`
- Ligne : `orl_*`
- Statut : `ords_*`, `orls_*`

### API Backend
```
GET /api/legacy-orders/:orderId
```

Retourne :
```json
{
  "success": true,
  "data": {
    "ord_id": "...",
    "customer": {...},
    "billingAddress": {...},
    "deliveryAddress": {...},
    "orderLines": [...],
    "statusDetails": {...}
  }
}
```

### Rechargement
Après chaque action, la page se recharge automatiquement pour afficher les changements.

---

## ⚠️ Notes Importantes

1. **Adresses null** : C'est normal si pas renseignées lors de la commande
2. **lineStatus null** : Normal si orl_orls_id est null (ligne sans statut défini)
3. **Actions contextuelles** : Seules les actions valides pour le statut actuel sont affichées
4. **Modal de confirmation** : Toujours confirmer avant d'appliquer une action
5. **Rechargement auto** : La page se recharge après chaque action réussie

---

## 🐛 Dépannage

### Page affiche "Commande non trouvée"
- Vérifier que l'ID de commande existe dans la base
- Vérifier que le backend est démarré sur port 3000
- Vérifier les logs backend pour les erreurs

### Adresses non affichées
- Normal si `billingAddress` ou `deliveryAddress` sont null
- Vérifier tables `___xtr_customer_billing_address` et `___xtr_customer_delivery_address`

### Boutons d'action manquants
- Vérifier le statut de la ligne (`orl_orls_id`)
- Seules les actions valides pour ce statut sont affichées
- Utiliser "🔄 Reset" pour réinitialiser

### Modal ne se ferme pas
- Vérifier la console navigateur pour erreurs
- Vérifier que le backend répond correctement
- Rafraîchir la page manuellement si nécessaire

---

## 📞 Support

Pour toute question ou problème :
1. Consulter les logs backend (terminal npm)
2. Consulter la console navigateur (F12)
3. Vérifier le fichier `AMELIORATION-PAGE-COMMANDE-COMPLETE.md`
4. Lancer le script de test : `./test-order-detail-complete.sh`

---

**Guide créé le :** 7 octobre 2025  
**Version :** 1.0.0

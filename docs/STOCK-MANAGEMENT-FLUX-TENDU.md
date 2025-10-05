# 📦 Système de Gestion de Stock - Mode Flux Tendu

## 🎯 Vue d'ensemble

Le système de gestion de stock supporte **deux modes de fonctionnement** :

### Mode UNLIMITED (Flux Tendu) ⚡ - **ACTIVÉ PAR DÉFAUT**
- Stock illimité pour tous les produits
- Pas de blocage lors de l'ajout au panier
- Réapprovisionnement automatique virtuel
- **Idéal pour démarrer rapidement** sans contraintes de stock

### Mode TRACKED (Suivi Réel) 📊
- Suivi du stock réel produit par produit
- Validation des quantités lors de l'ajout au panier
- Alertes de réapprovisionnement automatiques
- Rapports d'inventaire détaillés

---

## 🚀 Configuration Rapide

### 1. Choisir le mode de stock

Dans votre fichier `.env` :

```bash
# Mode flux tendu (recommandé pour démarrer)
STOCK_MODE=UNLIMITED

# OU Mode suivi du stock réel
STOCK_MODE=TRACKED
```

### 2. Redémarrer le serveur

```bash
cd backend
npm run dev
```

Vous verrez dans les logs :
```
🔧 StockService initialized - Mode: UNLIMITED
⚠️  MODE FLUX TENDU ACTIVÉ - Stock illimité avec réapprovisionnement automatique
```

---

## 📡 API Endpoints

### 1. Obtenir le stock d'un produit

```bash
GET /api/products/:id
```

**Réponse en mode UNLIMITED:**
```json
{
  "id": 1001,
  "piece_name": "Démarreur",
  "piece_ref": "0 001 172 628",
  "stock": {
    "available": 999,
    "reserved": 0,
    "total": 999,
    "status": "in_stock"
  }
}
```

**Réponse en mode TRACKED:**
```json
{
  "stock": {
    "available": 45,
    "reserved": 5,
    "total": 50,
    "status": "in_stock",
    "needsReorder": true,
    "reorderQuantity": 55
  }
}
```

### 2. Liste de réapprovisionnement

```bash
GET /api/products/inventory/reorder-list
```

**Réponse:**
```json
{
  "success": true,
  "count": 12,
  "items": [
    {
      "productId": 1001,
      "productName": "Démarreur",
      "currentStock": 8,
      "reorderQuantity": 92,
      "status": "high"
    },
    {
      "productId": 1002,
      "productName": "Alternateur",
      "currentStock": 0,
      "reorderQuantity": 100,
      "status": "urgent"
    }
  ]
}
```

**Statuts:**
- `urgent`: Stock = 0 (rupture)
- `high`: Stock ≤ 10 (stock faible)
- `normal`: Stock ≤ 20 (seuil de réappro)

### 3. Rapport d'inventaire global

```bash
GET /api/products/inventory/report
```

**Réponse en mode UNLIMITED:**
```json
{
  "success": true,
  "report": {
    "totalProducts": 1500,
    "inStock": 1500,
    "lowStock": 0,
    "outOfStock": 0,
    "needsReorder": 0,
    "mode": "FLUX_TENDU"
  }
}
```

**Réponse en mode TRACKED:**
```json
{
  "report": {
    "totalProducts": 1500,
    "inStock": 1420,
    "lowStock": 65,
    "outOfStock": 15,
    "needsReorder": 80,
    "mode": "SUIVI_STOCK"
  }
}
```

### 4. Simuler un réapprovisionnement

```bash
POST /api/products/inventory/restock/:id
Content-Type: application/json

{
  "quantity": 100
}
```

**Réponse:**
```json
{
  "success": true,
  "message": "Réapprovisionnement de 100 unités effectué",
  "productId": 1001
}
```

---

## 🔧 Configuration Avancée

### Seuils de stock (dans `stock.service.ts`)

```typescript
// Seuils en mode TRACKED
private readonly LOW_STOCK_THRESHOLD = 10;      // Alerte stock faible
private readonly REORDER_THRESHOLD = 20;         // Seuil de réappro
private readonly REORDER_QUANTITY = 100;         // Quantité à commander

// Configuration flux tendu
private readonly UNLIMITED_DISPLAY_STOCK = 999;  // Stock affiché
```

### Personnalisation

Modifier ces valeurs dans `/backend/src/modules/products/services/stock.service.ts` selon vos besoins.

---

## 🎯 Cas d'usage

### Scénario 1: Lancement rapide (UNLIMITED)

**Situation:** Vous lancez votre boutique et voulez éviter les blocages de stock.

**Configuration:**
```bash
STOCK_MODE=UNLIMITED
```

**Avantages:**
- ✅ Pas de contraintes de stock
- ✅ Clients peuvent commander sans limites
- ✅ Réapprovisionnement géré "à la demande"
- ✅ Focus sur les ventes, pas la logistique

**Workflow:**
1. Client commande n'importe quelle quantité → OK
2. Notification commande reçue
3. Vous approvisionnez auprès de vos fournisseurs
4. Expédition une fois la pièce reçue

### Scénario 2: Gestion rigoureuse (TRACKED)

**Situation:** Vous avez un entrepôt et voulez suivre votre inventaire.

**Configuration:**
```bash
STOCK_MODE=TRACKED
```

**Avantages:**
- ✅ Suivi précis du stock
- ✅ Alertes automatiques de réapprovisionnement
- ✅ Rapports d'inventaire en temps réel
- ✅ Prévention des surventes

**Workflow:**
1. Stock atteint 20 unités → Alerte réappro
2. Consultation de `/api/products/inventory/reorder-list`
3. Génération bon de commande fournisseur
4. Réception marchandise → Mise à jour stock
5. Rapports disponibles dans `/api/products/inventory/report`

---

## 📊 Intégration avec le Panier

### Mode UNLIMITED
```bash
# Toute quantité acceptée
POST /api/cart/items
{
  "productId": 1001,
  "quantity": 999
}
# ✅ SUCCESS - Pas de vérification de stock
```

### Mode TRACKED
```bash
# Validation du stock
POST /api/cart/items
{
  "productId": 1001,
  "quantity": 100
}

# Si stock = 50:
# ❌ ERROR 400
{
  "statusCode": 400,
  "message": "Seulement 50 unité(s) disponible(s)"
}
```

---

## 🔄 Migration UNLIMITED → TRACKED

### Étape 1: Inventaire initial

1. Faire un comptage physique de vos produits
2. Mettre à jour la base de données:

```sql
-- Exemple: Mettre à jour le stock d'un produit
UPDATE pieces_price 
SET pri_qte_cond = '50' 
WHERE pri_piece_id = 1001;
```

### Étape 2: Activer le mode TRACKED

```bash
# .env
STOCK_MODE=TRACKED
```

### Étape 3: Vérifier le rapport

```bash
curl http://localhost:3000/api/products/inventory/report
```

### Étape 4: Configurer les alertes

Surveiller régulièrement `/api/products/inventory/reorder-list` pour les réapprovisionnements.

---

## 🛠️ Maintenance

### Vérifier le mode actif

Les logs au démarrage indiquent le mode:
```
🔧 StockService initialized - Mode: UNLIMITED
⚠️  MODE FLUX TENDU ACTIVÉ
```

### Surveillance en mode TRACKED

```bash
# Produits en alerte
curl http://localhost:3000/api/products/inventory/reorder-list | jq '.count'

# Rapport complet
curl http://localhost:3000/api/products/inventory/report | jq '.report'
```

### Logs de réapprovisionnement

En mode TRACKED, le système log automatiquement:
```
🔔 ALERTE RÉAPPRO: Produit 1001 - Stock: 8 - Commander: 92 unités
```

---

## 📈 Évolution Future

### Fonctionnalités prévues

- [ ] Dashboard d'inventaire temps réel
- [ ] Export Excel des listes de réapprovisionnement
- [ ] Intégration API fournisseurs (commandes automatiques)
- [ ] Historique des mouvements de stock
- [ ] Multi-entrepôts (zones géographiques)
- [ ] Réservation de stock (durée limitée dans panier)
- [ ] Notifications email/SMS pour alertes urgentes

---

## 🤝 Support

Pour toute question sur la gestion de stock:
1. Consulter cette documentation
2. Vérifier les logs du serveur
3. Tester avec les endpoints API
4. Contacter l'équipe technique

---

**Dernière mise à jour:** 5 octobre 2025  
**Version:** 1.0.0 - Mode Flux Tendu

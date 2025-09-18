## 🔧 PLAN DE FUSION CATALOG → PRODUCTS

### ✅ ANALYSE ACTUELLE
- **Products Service** : 1631 lignes, bien structuré avec Zod
- **Catalog Service** : 881 lignes, fonctions overlaps
- **Redondances** : brands, stats, pieces, gammes

### 🎯 STRATÉGIE DE FUSION

#### **PHASE 1 : MIGRATION DES FEATURES UNIQUES**
```bash
# 1. Migrer features catalog uniques vers products
- homepage-data (catalog) → products
- home-catalog (catalog) → products  
- search avancée (catalog) → products
- brands-selector (catalog) → products

# 2. Garder le meilleur de chaque
- gammes (products) ✅ DÉJÀ OPTIMAL
- brands (products) ✅ DÉJÀ OPTIMAL  
- stats (fusionner catalog+products)
```

#### **PHASE 2 : CONSOLIDATION PROGRESSIVE**
```typescript
// 1. ProductsService devient le service unifié
// 2. Migration des méthodes catalog uniques
// 3. Suppression catalog module
// 4. Mise à jour des imports
```

#### **PHASE 3 : NETTOYAGE**
```bash
# Supprimer les fichiers catalog
rm -rf backend/src/modules/catalog/
# Mise à jour app.module.ts
# Tests de régression
```

### 🚀 COMMENCER LA FUSION

**ACTION IMMÉDIATE :**
1. Identifier les méthodes catalog **uniques et utiles**
2. Les migrer vers ProductsService  
3. Supprimer catalog module
4. Valider que tout fonctionne

**RÉSULTAT ATTENDU :**
- ✅ Un seul module products unifié
- ✅ Toutes les features préservées
- ✅ Code plus maintenable
- ✅ Performance améliorée
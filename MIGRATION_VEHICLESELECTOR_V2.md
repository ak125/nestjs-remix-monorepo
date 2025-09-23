# 🚀 GUIDE MIGRATION VehicleSelectorV2

## 📊 Avant vs Après

### ❌ AVANT : 3 composants séparés
```typescript
// VehicleSelector (home) - 453 lignes
import VehicleSelector from "../components/home/VehicleSelector";

// VehicleSelectorUnified - 454 lignes  
import VehicleSelectorUnified from "../components/vehicle/VehicleSelectorUnified";

// VehicleSelectorGamme - 389 lignes (supprimé)
```

### ✅ APRÈS : 1 composant unifié
```typescript
// VehicleSelectorV2 - 1 seul composant pour tout
import VehicleSelectorV2 from "../components/vehicle/VehicleSelectorV2";
```

## 🔄 Guide de remplacement

### 1. Page d'accueil (/_index.tsx)
```typescript
// AVANT
<VehicleSelector 
  onVehicleSelect={(vehicle) => console.log(vehicle)}
  className="mb-8"
/>

// APRÈS
<VehicleSelectorV2 
  context="homepage"
  mode="full"
  redirectOnSelect={true}
  redirectTo="vehicle-page"
  showRecommendation={true}
  variant="card"
  className="mb-8"
/>
```

### 2. Page constructeur (/constructeurs.$brand.tsx)
```typescript
// AVANT
<VehicleSelectorHome 
  selectedBrand={brandData}
  navigateOnSelect={true}
/>

// APRÈS
<VehicleSelectorV2 
  context="detail"
  mode="full"
  currentVehicle={{ brand: { id: brandData.marque_id, name: brandData.marque_name } }}
  redirectOnSelect={true}
  redirectTo="vehicle-page"
/>
```

### 3. Page détail véhicule (/constructeurs.$brand.$model.$type.tsx)
```typescript
// AVANT
<VehicleSelectorUnified 
  navigateOnSelect={true}
  compact={false}
/>

// APRÈS
<VehicleSelectorV2 
  context="detail"
  mode="compact"
  redirectOnSelect={true}
  redirectTo="vehicle-page"
/>
```

### 4. Page pièces (/pieces.$slug.tsx)
```typescript
// AVANT
<VehicleSelectorGamme
  currentGamme={{ name: data.content?.pg_name, id: data.guide?.id }}
  className="mb-8"
/>

// APRÈS
<VehicleSelectorV2 
  context="pieces"
  mode="full"
  showVinSearch={true}
  redirectOnSelect={true}
  redirectTo="search"
  variant="card"
  className="mb-8"
/>
```

## 🎯 Configurations recommandées

### Homepage (Accueil)
```typescript
<VehicleSelectorV2 
  context="homepage"
  mode="full"
  variant="card"
  showRecommendation={true}
  redirectOnSelect={true}
  redirectTo="vehicle-page"
/>
```

### Sidebar compact
```typescript
<VehicleSelectorV2 
  context="search"
  mode="compact"
  variant="minimal"
  redirectOnSelect={false}
  onVehicleSelect={(vehicle) => handleVehicleFilter(vehicle)}
/>
```

### Page pièces
```typescript
<VehicleSelectorV2 
  context="pieces"
  mode="full"
  showVinSearch={true}
  redirectOnSelect={true}
  redirectTo="search"
/>
```

## ⚡ Avantages du nouveau composant

1. **DRY** : Plus de duplication de code
2. **Flexible** : Props pour tous les cas d'usage
3. **Maintenable** : 1 seul fichier à maintenir
4. **Cohérent** : Même comportement partout
5. **Évolutif** : Nouvelles features disponibles partout

## 📋 Plan de migration

1. ✅ Créer VehicleSelectorV2
2. 🔄 Tester sur une page (/_index.tsx)
3. 🔄 Migrer progressivement les autres pages
4. 🗑️ Supprimer les anciens composants
5. 🎉 Architecture simplifiée !
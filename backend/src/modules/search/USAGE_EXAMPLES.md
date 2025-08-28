# Exemples d'utilisation du SearchService v2.0

## 🎯 API unifiée avec Meilisearch

### Recherche simple (compatible V8)

```typescript
import { SearchService } from './search.service';

// Injection du service
constructor(private readonly searchService: SearchService) {}

// Recherche basique
const results = await this.searchService.search({
  query: 'BMW X3',
  type: 'v8', // ou 'v7' pour compatibilité
  pagination: { page: 1, limit: 20 },
  options: { 
    highlight: true,
    facets: true,
    suggestions: true 
  }
});

console.log(`${results.total} résultats trouvés en ${results.executionTime}ms`);
```

### Recherche avancée avec filtres

```typescript
// Recherche avec filtres complexes
const results = await this.searchService.search({
  query: 'filtre huile',
  type: 'v8',
  filters: {
    brandId: 15, // BMW
    priceMin: 10,
    priceMax: 50,
    inStock: true,
    compatibility: {
      make: 'BMW',
      model: 'X3',
      year: 2020,
      engine: '2.0d'
    }
  },
  sort: { field: 'price', order: 'asc' },
  pagination: { page: 1, limit: 25 }
});
```

### Recherche par MINE/VIN

```typescript
// Recherche par code MINE
const vehicleInfo = await this.searchService.searchByMine('M1ABCDEF123', 'user-456');

console.log('Véhicule:', vehicleInfo.vehicle);
console.log('Pièces compatibles:', vehicleInfo.items.length);

// Recherche par VIN
const results = await this.searchService.search({
  query: 'WVWZZZ1KZ8W123456',
  type: 'vin',
  options: { facets: true }
});
```

### Recherche instantanée (auto-complétion)

```typescript
// Pour l'auto-complétion temps réel
const instantResults = await this.searchService.instantSearch('bmw x');

// Retourne :
// {
//   items: [5 produits max],
//   suggestions: ['BMW X1', 'BMW X3', 'BMW X5'],
//   total: 45
// }
```

### Fiche produit

```typescript
// Récupération d'une fiche produit complète
const productSheet = await this.searchService.getProductSheet('REF123456');

console.log('Produit:', productSheet.title);
console.log('Prix:', productSheet.price);
console.log('Stock:', productSheet.stock);
```

### Statistiques et monitoring

```typescript
// Statistiques du moteur de recherche
const stats = await this.searchService.getSearchStats();

console.log('Documents indexés:', stats.totalIndexedItems);
console.log('Stats véhicules:', stats.indices.vehicles);
console.log('Stats produits:', stats.indices.products);
console.log('Performance cache:', stats.cache);
```

### API simple pour les tests

```typescript
// Recherche simple sans configuration
const items = await this.searchService.simpleSearch('peugeot 308', 10);
console.log(`${items.length} résultats trouvés`);
```

## 🔄 Migration depuis l'ancienne API

### Avant (ancienne API)

```typescript
// Ancien système
const results = await this.search({
  query: 'BMW',
  category: 'vehicles',
  page: 1,
  limit: 20,
  filters: {}
});
```

### Après (nouvelle API)

```typescript
// Nouveau système (rétrocompatible)
const results = await this.searchService.searchLegacy({
  query: 'BMW',
  category: 'vehicles', 
  page: 1,
  limit: 20,
  filters: {}
});

// Ou mieux, utiliser la nouvelle API
const results = await this.searchService.search({
  query: 'BMW',
  type: 'v8',
  pagination: { page: 1, limit: 20 },
  options: { facets: true }
});
```

## 📊 Types de recherche disponibles

| Type | Description | Utilisation |
|------|-------------|-------------|
| `v7` | Mode compatibilité ancien | Migration progressive |
| `v8` | Mode optimisé Meilisearch | Recommandé |
| `mine` | Recherche par code MINE | Identification véhicule |
| `vin` | Recherche par VIN | Identification véhicule |
| `reference` | Recherche par référence | Pièces détachées |
| `instant` | Auto-complétion rapide | Interface utilisateur |

## ⚡ Performances attendues

- **Recherche V8** : 20-50ms
- **Recherche V7** : 50-100ms  
- **Instant Search** : 10-30ms
- **Cache hit** : 1-5ms

## 🎯 Bonnes pratiques

1. **Utilisez le cache** : Activé par défaut avec TTL adaptatif
2. **Filtrez intelligemment** : Utilisez les facettes Meilisearch
3. **Paginez les résultats** : Limite recommandée : 20-50 items
4. **Monitorer les performances** : Utilisez `getSearchStats()`
5. **Migration progressive** : Commencez par V7, passez à V8

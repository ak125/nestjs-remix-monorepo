# 🔍 Guide d'Utilisation - SearchOptimizedController

## 📋 Vue d'ensemble

Le `SearchOptimizedController` est la version **unifiée et optimisée** qui combine le meilleur des contrôleurs existants avec les nouvelles fonctionnalités enhanced. Il offre une transition progressive entre les anciennes et nouvelles fonctionnalités.

## 🚀 Fonctionnalités Principales

### ✅ **Avantages Unifiés**
- **Compatibilité descendante** : Supporte l'API existante
- **Mode Enhanced optionnel** : Nouvelles fonctionnalités via paramètre
- **Fallback automatique** : Récupération en cas d'erreur
- **Cache intelligent** : CacheInterceptor + cache custom
- **Rate limiting** : Protection contre le spam
- **Analytics intégrées** : Tracking complet
- **Documentation API** : Swagger complet

## 📖 API Reference Complète

### 1. **Recherche Principale** - `GET /api/search`

#### Paramètres Standard (Compatible Existant)
```http
GET /api/search?q=filtre+huile&page=1&limit=20
```

#### Paramètres Enhanced (Nouvelles Fonctionnalités)
```http
GET /api/search?q=filtre+huile&enhanced=true&manufacturers=bosch,mann-filter&minPrice=10&maxPrice=50&sortBy=price&sortOrder=asc&includeAlternatives=true
```

#### Réponse Standard
```json
{
  "success": true,
  "version": "standard",
  "data": {
    "results": [...],
    "filters": {...},
    "count": 25,
    "executionTime": 45
  },
  "timestamp": "2024-12-29T10:30:00Z"
}
```

#### Réponse Enhanced
```json
{
  "success": true,
  "version": "enhanced",
  "data": {
    "results": [...],
    "filters": {...},
    "count": 25,
    "totalCount": 147,
    "page": 1,
    "limit": 20,
    "suggestions": ["filtre à air", "filtre carburant"],
    "alternatives": [...],
    "searchId": "search_1234567890_abc123",
    "executionTime": 67,
    "fromCache": false
  },
  "timestamp": "2024-12-29T10:30:00Z"
}
```

### 2. **Auto-complétion** - `GET /api/search/autocomplete`

#### Standard
```http
GET /api/search/autocomplete?q=fil&limit=10
```

#### Enhanced avec Scoring
```http
GET /api/search/autocomplete?q=fil&enhanced=true&limit=10
```

#### Réponse Enhanced
```json
{
  "success": true,
  "version": "enhanced",
  "data": [
    {
      "suggestion": "filtre à huile",
      "type": "reference",
      "score": 10,
      "metadata": {...}
    },
    {
      "suggestion": "MANN-FILTER",
      "type": "brand",
      "score": 8
    }
  ],
  "timestamp": "2024-12-29T10:30:00Z"
}
```

### 3. **Recherche Avancée** - `POST /api/search/advanced`

```http
POST /api/search/advanced
Content-Type: application/json

{
  "query": "plaquettes frein",
  "enhanced": true,
  "filters": {
    "manufacturers": ["bosch", "ferodo"],
    "minPrice": 20,
    "maxPrice": 80,
    "qualities": ["OES"],
    "stars": [4, 5]
  },
  "sort": {
    "field": "price",
    "order": "asc"
  },
  "pagination": {
    "page": 1,
    "limit": 25
  }
}
```

### 4. **Recherche OEM** - `POST /api/search/oem`

```http
POST /api/search/oem
Content-Type: application/json

{
  "codes": ["1234567890", "0987654321"],
  "enhanced": true,
  "includeAlternatives": true,
  "limit": 30
}
```

### 5. **Suggestions** - `GET /api/search/suggestions`

```http
GET /api/search/suggestions?enhanced=true&category=filtration
```

### 6. **Métriques** - `GET /api/search/metrics`

```http
GET /api/search/metrics
```

#### Réponse
```json
{
  "success": true,
  "data": {
    "enhanced": {
      "totalSearches": 15420,
      "cacheHitRate": 87.5,
      "avgResponseTime": 67,
      "popularTerms": [...],
      "errorRate": 0.002
    },
    "standard": {
      "totalIndexedItems": 714000,
      "indices": {...}
    },
    "combined": {
      "timestamp": "2024-12-29T10:30:00Z",
      "servicesStatus": {
        "enhanced": true,
        "standard": true
      }
    }
  }
}
```

### 7. **Health Check** - `GET /api/search/health`

```http
GET /api/search/health
```

#### Réponse
```json
{
  "success": true,
  "status": "healthy",
  "services": {
    "enhanced": true,
    "standard": true,
    "overall": true
  },
  "responseTime": 12,
  "timestamp": "2024-12-29T10:30:00Z"
}
```

## 🔧 Exemples d'Utilisation Pratiques

### JavaScript/TypeScript Client

```typescript
class SearchClient {
  private baseUrl = '/api/search';

  // Recherche simple (compatible existant)
  async searchSimple(query: string) {
    const response = await fetch(`${this.baseUrl}?q=${encodeURIComponent(query)}`);
    return response.json();
  }

  // Recherche enhanced (nouvelles fonctionnalités)
  async searchEnhanced(query: string, options = {}) {
    const params = new URLSearchParams({
      q: query,
      enhanced: 'true',
      ...options
    });
    
    const response = await fetch(`${this.baseUrl}?${params}`);
    return response.json();
  }

  // Auto-complétion avec scoring
  async autocomplete(query: string) {
    const response = await fetch(
      `${this.baseUrl}/autocomplete?q=${encodeURIComponent(query)}&enhanced=true`
    );
    return response.json();
  }

  // Recherche avancée avec filtres
  async searchAdvanced(searchParams) {
    const response = await fetch(`${this.baseUrl}/advanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enhanced: true,
        ...searchParams
      })
    });
    return response.json();
  }

  // Recherche par codes OEM
  async searchOEM(codes: string[]) {
    const response = await fetch(`${this.baseUrl}/oem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codes,
        enhanced: true,
        includeAlternatives: true
      })
    });
    return response.json();
  }
}

// Utilisation
const client = new SearchClient();

// Recherche simple
const simpleResults = await client.searchSimple('filtre huile');

// Recherche avec filtres
const advancedResults = await client.searchEnhanced('plaquettes frein', {
  manufacturers: 'bosch,ferodo',
  minPrice: '20',
  maxPrice: '80',
  sortBy: 'price',
  sortOrder: 'asc'
});

// Auto-complétion
const suggestions = await client.autocomplete('fil');

// Recherche OEM
const oemResults = await client.searchOEM(['1234567890']);
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

export const useSearch = () => {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const search = async (query: string, enhanced = true) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: query,
        enhanced: enhanced.toString(),
        includeAlternatives: 'true',
        fuzzySearch: 'true'
      });

      const response = await fetch(`/api/search?${params}`);
      const data = await response.json();

      if (data.success) {
        setResults(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { results, loading, error, search };
};

// Composant React
export const SearchComponent = () => {
  const { results, loading, error, search } = useSearch();
  const [query, setQuery] = useState('');

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && search(query)}
        placeholder="Rechercher des pièces..."
      />
      
      {loading && <div>Recherche en cours...</div>}
      {error && <div>Erreur: {error}</div>}
      
      {results && (
        <div>
          <p>{results.count} résultats trouvés</p>
          {results.suggestions && (
            <div>
              Suggestions: {results.suggestions.join(', ')}
            </div>
          )}
          
          <div>
            {results.results.map(item => (
              <div key={item.pieceId}>
                <h3>{item.pieceName}</h3>
                <p>Réf: {item.pieceRef}</p>
                <p>Prix: {item.price.total}€</p>
                <p>Fabricant: {item.manufacturer.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
```

### Vue.js Example

```vue
<template>
  <div class="search-component">
    <input
      v-model="query"
      @keyup.enter="performSearch"
      placeholder="Rechercher des pièces..."
      class="search-input"
    />
    
    <div v-if="loading">Recherche en cours...</div>
    <div v-if="error" class="error">Erreur: {{ error }}</div>
    
    <div v-if="results" class="results">
      <p>{{ results.count }} résultats trouvés</p>
      
      <div v-if="results.suggestions" class="suggestions">
        Suggestions: 
        <span v-for="suggestion in results.suggestions" :key="suggestion">
          {{ suggestion }}
        </span>
      </div>
      
      <div class="items">
        <div v-for="item in results.results" :key="item.pieceId" class="item">
          <h3>{{ item.pieceName }}</h3>
          <p>Réf: {{ item.pieceRef }}</p>
          <p>Prix: {{ item.price.total }}€</p>
          <p>Fabricant: {{ item.manufacturer.name }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const query = ref('');
const results = ref(null);
const loading = ref(false);
const error = ref(null);

const performSearch = async () => {
  if (!query.value.trim()) return;
  
  loading.value = true;
  error.value = null;
  
  try {
    const params = new URLSearchParams({
      q: query.value,
      enhanced: 'true',
      includeAlternatives: 'true'
    });
    
    const response = await fetch(`/api/search?${params}`);
    const data = await response.json();
    
    if (data.success) {
      results.value = data.data;
    } else {
      error.value = data.error;
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};
</script>
```

## 🔄 Migration Graduelle

### Étape 1: Tester en Parallèle
```javascript
// Test comparatif standard vs enhanced
async function compareSearchModes(query) {
  const [standardResult, enhancedResult] = await Promise.all([
    fetch(`/api/search?q=${query}&enhanced=false`),
    fetch(`/api/search?q=${query}&enhanced=true`)
  ]);
  
  console.log('Standard:', await standardResult.json());
  console.log('Enhanced:', await enhancedResult.json());
}
```

### Étape 2: Migration Progressive
```javascript
// Configuration progressive
const searchConfig = {
  useEnhanced: process.env.FEATURE_ENHANCED_SEARCH === 'true',
  fallbackToStandard: true
};

async function smartSearch(query, options = {}) {
  try {
    if (searchConfig.useEnhanced) {
      return await searchEnhanced(query, options);
    }
  } catch (error) {
    if (searchConfig.fallbackToStandard) {
      console.warn('Enhanced search failed, falling back to standard');
      return await searchStandard(query, options);
    }
    throw error;
  }
}
```

## 📊 Monitoring et Métriques

### Dashboard de Monitoring
```javascript
// Récupération des métriques en temps réel
async function getRealtimeMetrics() {
  const response = await fetch('/api/search/metrics');
  const metrics = await response.json();
  
  // Affichage des KPIs
  updateDashboard({
    totalSearches: metrics.data.enhanced.totalSearches,
    cacheHitRate: metrics.data.enhanced.cacheHitRate,
    avgResponseTime: metrics.data.enhanced.avgResponseTime,
    errorRate: metrics.data.enhanced.errorRate,
    popularTerms: metrics.data.enhanced.popularTerms
  });
}

// Appel périodique
setInterval(getRealtimeMetrics, 30000); // Toutes les 30 secondes
```

### Alerting
```javascript
// Système d'alerte simple
async function checkHealthAndAlert() {
  const health = await fetch('/api/search/health').then(r => r.json());
  
  if (!health.success || health.status !== 'healthy') {
    alert('🚨 Service de recherche en dégradé !');
    console.error('Search service health check failed:', health);
  }
  
  if (health.services?.enhanced === false) {
    console.warn('⚠️ Enhanced search indisponible, fallback actif');
  }
}
```

## 🎯 Bonnes Pratiques

### 1. **Gestion des Erreurs**
```javascript
async function robustSearch(query) {
  try {
    const result = await fetch(`/api/search?q=${query}&enhanced=true`);
    const data = await result.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Search failed');
    }
    
    return data.data;
  } catch (error) {
    // Log pour debugging
    console.error('Search error:', error);
    
    // Fallback graceful
    return {
      results: [],
      count: 0,
      error: 'Recherche temporairement indisponible'
    };
  }
}
```

### 2. **Optimisation Performance**
```javascript
// Debouncing pour auto-complétion
function useSearchAutocomplete(delay = 300) {
  let timeoutId;
  
  return (query, callback) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(async () => {
      if (query.length >= 2) {
        const suggestions = await fetch(
          `/api/search/autocomplete?q=${query}&enhanced=true`
        ).then(r => r.json());
        callback(suggestions.data || []);
      }
    }, delay);
  };
}
```

### 3. **Cache Côté Client**
```javascript
class SearchCache {
  constructor(maxSize = 100, ttl = 300000) { // 5 minutes
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }
  
  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
}
```

---

**🚀 Le SearchOptimizedController est maintenant prêt pour la production !**

Il offre une transition en douceur vers les nouvelles fonctionnalités tout en maintenant la compatibilité avec l'existant. Les équipes peuvent migrer progressivement en activant le mode `enhanced=true` selon leurs besoins.
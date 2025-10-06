# 🚀 PRODUCTS MODULE - Guide de Démarrage Rapide

**Date:** 6 octobre 2025  
**Version:** 1.0  
**Audience:** Développeurs Frontend & Backend

---

## ⚡ Démarrage en 5 Minutes

### 1️⃣ Lancer le Backend

```bash
cd backend
npm run dev
```

Le serveur démarre sur `http://localhost:3000`

### 2️⃣ Tester l'API

```bash
# Santé du module
curl http://localhost:3000/api/products/debug/tables

# Liste des gammes
curl http://localhost:3000/api/products/gammes

# Rechercher un produit
curl "http://localhost:3000/api/products?search=embrayage&limit=5"
```

### 3️⃣ Premiers Produits

```bash
# Produit par ID
curl http://localhost:3000/api/products/30

# Produit par référence
curl http://localhost:3000/api/products/reference/VAL826704

# Prix du produit
curl http://localhost:3000/api/products/30/pricing?quantity=2

# Stock du produit
curl http://localhost:3000/api/products/30/stock
```

---

## 📚 Cas d'Usage Fréquents

### 🔍 Recherche de Produits

#### Par Texte Libre
```bash
curl "http://localhost:3000/api/products?search=embrayage&limit=10"
```

#### Par Gamme
```bash
# 1. Lister les gammes
curl http://localhost:3000/api/products/gammes

# 2. Produits d'une gamme
curl http://localhost:3000/api/products/gammes/5/products?limit=20
```

#### Par Véhicule
```bash
# Produits compatibles Renault Clio III 1.5 dCi 90
curl "http://localhost:3000/api/products/vehicle?marqueId=1&modeleId=42&typeId=156"
```

#### Par Référence OEM
```bash
curl http://localhost:3000/api/products/technical-data/oem/302057532R
```

---

### 💰 Tarification

#### Prix Unitaire
```bash
curl http://localhost:3000/api/products/30/pricing
```

**Réponse:**
```json
{
  "priceTTC": 242.69,
  "consigneTTC": 50.00,
  "totalTTC": 292.69,
  "formatted": {
    "integer": 292,
    "decimals": "69",
    "currency": "€"
  },
  "isExchangeStandard": true
}
```

#### Prix avec Quantité
```bash
curl "http://localhost:3000/api/products/30/pricing?quantity=5"
```

#### Prix en Lot (Bulk)
```bash
curl -X POST http://localhost:3000/api/products/bulk-pricing \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "pieceId": 30, "quantity": 2 },
      { "pieceId": 45, "quantity": 1 },
      { "pieceId": 67, "quantity": 3 }
    ]
  }'
```

---

### 📦 Gestion des Stocks

#### Consulter le Stock
```bash
curl http://localhost:3000/api/products/30/stock
```

**Réponse (Mode UNLIMITED):**
```json
{
  "available": 999,
  "reserved": 0,
  "total": 999,
  "status": "in_stock",
  "needsReorder": false
}
```

**Réponse (Mode TRACKED):**
```json
{
  "available": 15,
  "reserved": 5,
  "total": 20,
  "status": "low_stock",
  "needsReorder": true,
  "reorderQuantity": 85
}
```

#### Vérifier Disponibilité
```bash
curl "http://localhost:3000/api/products/30/stock/check?quantity=10"
```

#### Alertes Stock Faible
```bash
curl http://localhost:3000/api/products/stock/alerts
```

---

### 🔧 Données Techniques

#### Spécifications Complètes
```bash
curl http://localhost:3000/api/products/technical-data/30/specs
```

**Réponse:**
```json
{
  "piece_id": 30,
  "piece_ref": "VAL826704",
  "piece_name": "Kit d'embrayage complet",
  "technical_specs": {
    "criteria": [
      { "name": "Diamètre", "value": "240mm", "unit": "mm" },
      { "name": "Nombre de dents", "value": "24", "unit": "" },
      { "name": "Type", "value": "Kit complet", "unit": "" }
    ]
  },
  "compatibility": {
    "total_vehicles": 15,
    "vehicles": [...]
  },
  "oem_references": [
    { "brand": "Renault", "ref": "302057532R" }
  ]
}
```

#### Véhicules Compatibles
```bash
curl http://localhost:3000/api/products/technical-data/30/vehicles
```

#### Références OEM
```bash
curl http://localhost:3000/api/products/technical-data/30/oem
```

---

### 🔄 Cross-Selling

#### Produits Complémentaires
```bash
# Par gamme
curl http://localhost:3000/api/cross-selling/gamme/5?typeId=156

# Par produit
curl http://localhost:3000/api/cross-selling/product/30

# Fréquemment achetés ensemble
curl http://localhost:3000/api/cross-selling/bought-together/30
```

**Réponse:**
```json
{
  "success": true,
  "data": {
    "cross_gammes": [
      {
        "pg_id": 7,
        "pg_name": "Volant moteur",
        "pg_alias": "volant-moteur",
        "products_count": 12,
        "cross_level": 1,
        "source": "config"
      }
    ],
    "total_found": 5,
    "recommendations": [
      "Pensez au volant moteur pour un kit complet"
    ]
  }
}
```

---

### 🔍 Filtrage Avancé

#### Filtrer par Prix
```bash
curl "http://localhost:3000/api/products/filters/price?min=100&max=300"
```

#### Filtrer par Critères
```bash
curl -X POST http://localhost:3000/api/products/filters/criteria \
  -H "Content-Type: application/json" \
  -d '{
    "criteria": [
      { "name": "Diamètre", "value": "240mm" },
      { "name": "Nombre de dents", "value": "24" }
    ]
  }'
```

#### Facettes Disponibles
```bash
curl http://localhost:3000/api/products/filters/facets?gammeId=5
```

---

## 🎨 Intégration Frontend (Remix)

### Hook useProducts

```typescript
// app/hooks/useProducts.ts
import { useState, useEffect } from 'react';

interface Product {
  piece_id: number;
  piece_ref: string;
  piece_name: string;
  price?: number;
}

export function useProducts(filters?: {
  search?: string;
  gammeId?: number;
  limit?: number;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const params = new URLSearchParams();
        if (filters?.search) params.append('search', filters.search);
        if (filters?.gammeId) params.append('rangeId', filters.gammeId.toString());
        if (filters?.limit) params.append('limit', filters.limit.toString());

        const response = await fetch(`/api/products?${params}`);
        const data = await response.json();
        
        setProducts(data.data || []);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [filters?.search, filters?.gammeId, filters?.limit]);

  return { products, loading, error };
}
```

### Composant ProductCard

```typescript
// app/components/ProductCard.tsx
import { Link } from '@remix-run/react';

interface ProductCardProps {
  product: {
    piece_id: number;
    piece_ref: string;
    piece_name: string;
    piece_img?: string;
    price?: number;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link 
      to={`/products/${product.piece_id}`}
      className="border rounded-lg p-4 hover:shadow-lg transition"
    >
      {product.piece_img && (
        <img 
          src={product.piece_img} 
          alt={product.piece_name}
          className="w-full h-48 object-cover rounded"
        />
      )}
      
      <h3 className="font-semibold mt-2">{product.piece_name}</h3>
      <p className="text-sm text-gray-500">{product.piece_ref}</p>
      
      {product.price && (
        <p className="text-lg font-bold text-primary mt-2">
          {product.price.toFixed(2)} €
        </p>
      )}
      
      <button className="btn btn-primary w-full mt-4">
        Voir les détails
      </button>
    </Link>
  );
}
```

### Page Liste Produits

```typescript
// app/routes/products._index.tsx
import { json, LoaderFunction } from '@remix-run/node';
import { useLoaderData, useSearchParams } from '@remix-run/react';
import { ProductCard } from '~/components/ProductCard';

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const gammeId = url.searchParams.get('gammeId');
  
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (gammeId) params.append('rangeId', gammeId);
  params.append('limit', '20');
  
  const response = await fetch(`http://localhost:3000/api/products?${params}`);
  const data = await response.json();
  
  return json({ 
    products: data.data || [],
    total: data.total || 0
  });
};

export default function ProductsIndex() {
  const { products, total } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">
        Catalogue Produits ({total})
      </h1>
      
      {/* Barre de recherche */}
      <input
        type="search"
        placeholder="Rechercher un produit..."
        defaultValue={searchParams.get('search') || ''}
        onChange={(e) => {
          setSearchParams({ search: e.target.value });
        }}
        className="input input-bordered w-full mb-8"
      />
      
      {/* Grille produits */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((product) => (
          <ProductCard key={product.piece_id} product={product} />
        ))}
      </div>
      
      {products.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Aucun produit trouvé</p>
        </div>
      )}
    </div>
  );
}
```

### Page Détail Produit

```typescript
// app/routes/products.$id.tsx
import { json, LoaderFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

export const loader: LoaderFunction = async ({ params }) => {
  const { id } = params;
  
  // Récupérer le produit
  const productRes = await fetch(`http://localhost:3000/api/products/${id}`);
  const product = await productRes.json();
  
  // Récupérer le prix
  const pricingRes = await fetch(`http://localhost:3000/api/products/${id}/pricing`);
  const pricing = await pricingRes.json();
  
  // Récupérer le stock
  const stockRes = await fetch(`http://localhost:3000/api/products/${id}/stock`);
  const stock = await stockRes.json();
  
  // Cross-selling
  const crossRes = await fetch(`http://localhost:3000/api/cross-selling/product/${id}`);
  const crossSelling = await crossRes.json();
  
  return json({ product, pricing, stock, crossSelling });
};

export default function ProductDetail() {
  const { product, pricing, stock, crossSelling } = useLoaderData<typeof loader>();
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Image */}
        <div>
          <img 
            src={product.piece_img || '/placeholder.jpg'} 
            alt={product.piece_name}
            className="w-full rounded-lg"
          />
        </div>
        
        {/* Informations */}
        <div>
          <h1 className="text-3xl font-bold mb-2">{product.piece_name}</h1>
          <p className="text-gray-500 mb-4">Réf: {product.piece_ref}</p>
          
          {/* Prix */}
          <div className="bg-primary/10 rounded-lg p-4 mb-4">
            <p className="text-3xl font-bold text-primary">
              {pricing.formatted.integer},{pricing.formatted.decimals} {pricing.formatted.currency}
            </p>
            {pricing.isExchangeStandard && (
              <p className="text-sm text-gray-600 mt-1">
                + {pricing.consigneTTC.toFixed(2)} € de consigne
              </p>
            )}
          </div>
          
          {/* Stock */}
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <div className={`badge ${
                stock.status === 'in_stock' ? 'badge-success' :
                stock.status === 'low_stock' ? 'badge-warning' :
                'badge-error'
              }`}>
                {stock.status === 'in_stock' ? '✓ En stock' :
                 stock.status === 'low_stock' ? '⚠ Stock limité' :
                 '✗ Rupture'}
              </div>
              <span className="text-sm text-gray-500">
                {stock.available} disponible{stock.available > 1 ? 's' : ''}
              </span>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-4 mb-8">
            <button className="btn btn-primary flex-1">
              Ajouter au panier
            </button>
            <button className="btn btn-outline">
              ♡ Favoris
            </button>
          </div>
          
          {/* Description */}
          <div className="prose">
            <h2>Description</h2>
            <p>{product.piece_description}</p>
          </div>
        </div>
      </div>
      
      {/* Cross-selling */}
      {crossSelling.data?.cross_gammes?.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6">Produits complémentaires</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {crossSelling.data.cross_gammes.map((gamme) => (
              <Link 
                key={gamme.pg_id}
                to={`/products/gammes/${gamme.pg_id}`}
                className="border rounded-lg p-4 hover:shadow-lg transition"
              >
                <img 
                  src={gamme.pg_img} 
                  alt={gamme.pg_name}
                  className="w-full h-32 object-cover rounded mb-2"
                />
                <h3 className="font-semibold text-sm">{gamme.pg_name}</h3>
                <p className="text-xs text-gray-500">
                  {gamme.products_count} produits
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 🔧 Configuration

### Variables d'Environnement

```bash
# .env
STOCK_MODE=UNLIMITED          # UNLIMITED ou TRACKED
CACHE_TTL=300                 # Cache TTL en secondes (5 min)
SUPABASE_URL=...              # URL Supabase
SUPABASE_KEY=...              # Key Supabase
```

### Mode Stock

```typescript
// Mode UNLIMITED (Flux Tendu) - Recommandé
STOCK_MODE=UNLIMITED
- Stock affiché: 999
- Pas de gestion stock
- Idéal pour: Catalogue étendu, forte rotation

// Mode TRACKED (Suivi Réel)
STOCK_MODE=TRACKED
- Stock réel depuis DB
- Alertes réapprovisionnement
- Idéal pour: Produits chers, faible rotation
```

---

## 🐛 Debug & Troubleshooting

### Vérifier le Module

```bash
# Health check
curl http://localhost:3000/api/products/debug/tables

# Logs console
cd backend
npm run dev

# Rechercher dans les logs
grep "Products Module" backend/logs/*.log
```

### Erreurs Communes

#### ❌ 404 Not Found
```bash
# Vérifier que le serveur tourne
curl http://localhost:3000/health

# Vérifier les routes
curl http://localhost:3000/api/products/gammes
```

#### ❌ Pas de résultats
```bash
# Vérifier les données
curl http://localhost:3000/api/products/debug/tables

# Tester requête simple
curl http://localhost:3000/api/products?limit=1
```

#### ❌ Erreur de prix
```bash
# Vérifier table pieces_price
curl "http://localhost:3000/api/products/30/pricing"

# Logs backend
grep "PricingService" backend/logs/*.log
```

---

## 📊 Monitoring

### Métriques à Surveiller

```typescript
// Cache Hit Rate
- Objectif: > 60%
- Vérifier: Logs "cache_hit: true/false"

// Response Time
- P50: < 50ms
- P95: < 150ms
- P99: < 300ms

// Error Rate
- Objectif: < 0.1%
- Vérifier: Logs "error"
```

### Alertes à Configurer

```typescript
// 1. Stock faible (Mode TRACKED)
GET /api/products/stock/alerts

// 2. Performance dégradée
- Response time > 500ms

// 3. Erreurs API
- Error rate > 1%

// 4. Cache inefficace
- Hit rate < 50%
```

---

## 📚 Ressources

### Documentation
- 📖 [Documentation Complète](./PRODUCTS-MODULE-DOCUMENTATION.md)
- 📊 [Rapport Consolidation](./PRODUCT-CONSOLIDATION-FINAL-REPORT.md)
- ✅ [Phase 2 Complete](./PRODUCT-PHASE-2-COMPLETE.md)
- ✅ [Phase 3 Complete](./PRODUCT-PHASE-3-COMPLETE.md)

### API Reference
```bash
# Swagger (à venir)
http://localhost:3000/api/docs

# Postman Collection
/docs/postman/products-api.json
```

### Support
- 🐛 **Bugs:** Créer une issue GitHub
- 💬 **Questions:** Slack #products-module
- 📧 **Email:** dev-team@example.com

---

## ✅ Checklist de Démarrage

- [ ] Backend lancé (`npm run dev`)
- [ ] Tester API (`curl http://localhost:3000/api/products/gammes`)
- [ ] Consulter les logs (aucune erreur critique)
- [ ] Tester recherche produit
- [ ] Tester calcul prix
- [ ] Tester stock
- [ ] Intégrer dans frontend
- [ ] Configurer monitoring
- [ ] Documenter cas d'usage métier

---

**Guide créé:** 6 octobre 2025  
**Dernière mise à jour:** 6 octobre 2025  
**Version:** 1.0  

---

*"En 5 minutes, maîtrisez l'essentiel. En 1 heure, maîtrisez tout."* ⚡

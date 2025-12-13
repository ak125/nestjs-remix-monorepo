---
title: "Quick Start - API Backend E-commerce"
status: stable
version: 1.0.0
---

# 🚀 Quick Start - API Backend E-commerce

> **Guide de démarrage rapide** - Cas d'usage courants, exemples de code, tests API

**Version:** 1.0.0
**Dernière mise à jour:** 2025-11-18

---

## 📋 Table des Matières

- [Prérequis](#prérequis)
- [Configuration Environnement](#configuration-environnement)
- [Premiers Appels API](#premiers-appels-api)
- [Cas d'Usage E-commerce](#cas-dusage-e-commerce)
- [Tests & Debugging](#tests--debugging)

---

## Prérequis

### Variables d'Environnement

Créer un fichier `.env` à la racine du projet backend :

```bash
# Database
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key

# Cache
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password

# Authentication
SESSION_SECRET=your_session_secret_min_32_chars
JWT_SECRET=your_jwt_secret_min_32_chars

# Search
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=your_master_key

# Payment (Paybox)
PAYBOX_SITE=your_site_number
PAYBOX_RANG=your_rang_number
PAYBOX_CLE=your_hmac_key
PAYBOX_URL=https://preprod-tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi

# AI Providers (optionnel)
GROQ_API_KEY=your_groq_key
HUGGING_FACE_API_KEY=your_hf_key
OPENAI_API_KEY=your_openai_key
MISTRAL_API_KEY=your_mistral_key

# Analytics (optionnel)
GOOGLE_ANALYTICS_ID=G-XXXXXXX
MATOMO_SITE_ID=1
PLAUSIBLE_DOMAIN=yourdomain.com

# Environment
NODE_ENV=development
PORT=3000
```

### Installation

```bash
# Installer les dépendances
cd backend
npm install

# Lancer Redis (Docker)
docker run -d -p 6379:6379 redis:7-alpine

# Lancer Meilisearch (Docker)
docker run -d -p 7700:7700 \
  -e MEILI_MASTER_KEY=your_master_key \
  getmeili/meilisearch:v1.5

# Lancer le backend
npm run dev
```

### Vérifier l'Installation

```bash
# Health check
curl http://localhost:3000/health

# Réponse attendue:
# {"status":"ok","database":"connected","redis":"connected","meilisearch":"connected"}
```

---

## Configuration Environnement

### Postman / Insomnia Collection

Importer la collection Postman pour tester les endpoints :

```json
{
  "info": {
    "name": "Backend E-commerce API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "url": "{{base_url}}/authenticate",
            "body": {
              "mode": "raw",
              "raw": "{\"email\":\"test@example.com\",\"password\":\"password123\"}"
            }
          }
        }
      ]
    }
  ],
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:3000"
    }
  ]
}
```

### cURL Examples

**Variables globales:**
```bash
export BASE_URL="http://localhost:3000"
export API_URL="http://localhost:3000/api"
```

---

## Premiers Appels API

### 1. Authentication (Login)

```bash
# Login utilisateur
curl -X POST $BASE_URL/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' \
  -c cookies.txt

# Réponse:
{
  "user": {
    "id": 1,
    "email": "test@example.com",
    "nom": "Test",
    "prenom": "User",
    "level": 1
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "session": {
    "id": "sess_123456",
    "expires": "2025-11-25T10:00:00.000Z"
  }
}
```

**Note:** Le cookie de session est automatiquement stocké dans `cookies.txt`

### 2. Get User Profile

```bash
# Récupérer le profil (avec cookies de session)
curl -X GET $BASE_URL/profile \
  -b cookies.txt

# Réponse:
{
  "id": 1,
  "email": "test@example.com",
  "nom": "Test",
  "prenom": "User",
  "level": 1,
  "module_access": ["commercial"],
  "created_at": "2024-01-15T10:00:00.000Z"
}
```

### 3. Catalog Hierarchy

```bash
# Récupérer la hiérarchie complète (19 familles)
curl -X GET $API_URL/catalog/hierarchy

# Réponse (extrait):
{
  "families": [
    {
      "id_famille": 1,
      "nom_famille": "Filtres",
      "gammes": [
        {
          "pg_id": 101,
          "pg_nom": "Filtres à huile",
          "pg_alias": "filtre-huile",
          "products_count": 1250
        }
      ]
    }
  ],
  "total_families": 19,
  "total_gammes": 150,
  "cache_hit": true,
  "ttl": 300
}
```

### 4. Search Products

```bash
# Recherche textuelle (Meilisearch)
curl -X POST $API_URL/products/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "filtre à huile BMW",
    "limit": 10,
    "offset": 0
  }'

# Réponse:
{
  "products": [
    {
      "id": 12345,
      "name": "Filtre à huile BMW Série 3",
      "gamme": "Filtres à huile",
      "price": 15.99,
      "stock": 50,
      "compatibility": ["BMW Serie 3 E90", "BMW Serie 3 F30"]
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 10,
  "search_time_ms": 23
}
```

---

## Cas d'Usage E-commerce

### Cas 1: Ajouter un Produit au Panier

```bash
# 1. Récupérer le panier actuel
curl -X GET $API_URL/cart \
  -b cookies.txt

# Réponse:
{
  "items": [],
  "totals": {
    "subtotal": 0,
    "discount": 0,
    "shipping": 0,
    "total": 0
  },
  "promo_code": null
}

# 2. Ajouter un produit
curl -X POST $API_URL/cart/items \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "product_id": 12345,
    "quantity": 2
  }'

# Réponse:
{
  "item": {
    "id": "cart_item_1",
    "product_id": 12345,
    "name": "Filtre à huile BMW Série 3",
    "quantity": 2,
    "unit_price": 15.99,
    "total_price": 31.98
  },
  "cart": {
    "items": [...],
    "totals": {
      "subtotal": 31.98,
      "discount": 0,
      "shipping": 0,
      "total": 31.98
    }
  }
}
```

### Cas 2: Appliquer un Code Promo

```bash
# Appliquer un code promo
curl -X POST $API_URL/cart/promo \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "code": "PROMO10"
  }'

# Réponse:
{
  "promo": {
    "code": "PROMO10",
    "type": "percentage",
    "value": 10,
    "description": "10% de réduction"
  },
  "cart": {
    "items": [...],
    "totals": {
      "subtotal": 31.98,
      "discount": -3.20,
      "shipping": 0,
      "total": 28.78
    }
  }
}
```

### Cas 3: Calculer les Frais de Port

```bash
# Calculer les frais de port
curl -X GET "$API_URL/cart/shipping?address_id=1" \
  -b cookies.txt

# Réponse:
{
  "methods": [
    {
      "id": "colissimo",
      "name": "Colissimo",
      "price": 5.99,
      "estimated_days": "2-3"
    },
    {
      "id": "chronopost",
      "name": "Chronopost Express",
      "price": 12.99,
      "estimated_days": "1"
    }
  ],
  "selected": "colissimo",
  "cart": {
    "totals": {
      "subtotal": 31.98,
      "discount": -3.20,
      "shipping": 5.99,
      "total": 34.77
    }
  }
}
```

### Cas 4: Initialiser un Paiement

```bash
# Initialiser le paiement Paybox
curl -X POST $API_URL/payments/init \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "cart_id": "cart_session_123",
    "amount": 34.77,
    "currency": "EUR",
    "return_url": "https://yoursite.com/payment/success",
    "cancel_url": "https://yoursite.com/payment/cancel"
  }'

# Réponse:
{
  "payment_id": "pay_123456",
  "paybox_url": "https://preprod-tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi",
  "form_data": {
    "PBX_SITE": "1234567",
    "PBX_RANG": "01",
    "PBX_IDENTIFIANT": "123456789",
    "PBX_TOTAL": "3477",
    "PBX_DEVISE": "978",
    "PBX_CMD": "cmd_123456",
    "PBX_PORTEUR": "test@example.com",
    "PBX_RETOUR": "amount:M;ref:R;auto:A;error:E",
    "PBX_HASH": "SHA512",
    "PBX_TIME": "2025-11-18T10:30:00+01:00",
    "PBX_HMAC": "ABCDEF1234567890..."
  }
}

# Rediriger l'utilisateur vers paybox_url avec form_data
```

### Cas 5: Créer une Commande (après paiement)

```bash
# Créer la commande (appelé après callback Paybox)
curl -X POST $API_URL/orders \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "payment_id": "pay_123456",
    "shipping_address_id": 1,
    "billing_address_id": 1,
    "shipping_method": "colissimo"
  }'

# Réponse:
{
  "order": {
    "id": 98765,
    "order_number": "ORD-2025-001234",
    "status": "paid",
    "items": [
      {
        "product_id": 12345,
        "name": "Filtre à huile BMW Série 3",
        "quantity": 2,
        "unit_price": 15.99,
        "total": 31.98
      }
    ],
    "totals": {
      "subtotal": 31.98,
      "discount": -3.20,
      "shipping": 5.99,
      "total": 34.77
    },
    "payment": {
      "id": "pay_123456",
      "method": "card",
      "status": "completed"
    },
    "shipping": {
      "method": "colissimo",
      "address": {...},
      "estimated_delivery": "2025-11-22"
    },
    "created_at": "2025-11-18T10:35:00.000Z"
  },
  "invoice_url": "/api/orders/98765/invoice"
}
```

### Cas 6: Télécharger la Facture

```bash
# Télécharger la facture PDF
curl -X GET $API_URL/orders/98765/invoice \
  -b cookies.txt \
  -o invoice_98765.pdf

# Retourne un fichier PDF
```

### Cas 7: Recherche par Véhicule

```bash
# Rechercher produits compatibles avec un véhicule
curl -X POST $API_URL/products/by-vehicle \
  -H "Content-Type: application/json" \
  -d '{
    "marque": "BMW",
    "modele": "Serie 3",
    "type": "E90 320d",
    "annee": 2015,
    "gamme_id": 101
  }'

# Réponse:
{
  "products": [
    {
      "id": 12345,
      "name": "Filtre à huile Mann W 719/30",
      "compatibility": {
        "marque": "BMW",
        "modele": "Serie 3",
        "type": "E90 320d",
        "years": "2005-2012"
      },
      "price": 15.99,
      "stock": 50
    }
  ],
  "vehicle": {
    "marque": "BMW",
    "modele": "Serie 3",
    "type": "E90 320d",
    "annee": 2015
  },
  "total": 12
}
```

### Cas 8: Export Données RGPD

```bash
# Exporter toutes les données utilisateur (RGPD)
curl -X POST $API_URL/customers/gdpr/export \
  -b cookies.txt \
  -o my_data.json

# Réponse (fichier JSON):
{
  "user": {
    "id": 1,
    "email": "test@example.com",
    "nom": "Test",
    "prenom": "User",
    "created_at": "2024-01-15T10:00:00.000Z"
  },
  "addresses": [...],
  "orders": [...],
  "payments": [...],
  "cart_history": [...],
  "login_history": [...],
  "consents": [...],
  "exported_at": "2025-11-18T10:40:00.000Z"
}
```

---

## Tests & Debugging

### Tests avec Jest

```bash
# Lancer tous les tests
npm test

# Lancer tests d'un module spécifique
npm test -- products.service

# Lancer tests e2e
npm run test:e2e

# Coverage
npm run test:cov
```

### Tests Unitaires Exemple

```typescript
// products.service.spec.ts
import { Test } from '@nestjs/testing';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: mockSupabaseClient,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should search products by text', async () => {
    const result = await service.search({
      query: 'filtre à huile',
      limit: 10,
    });

    expect(result.products).toHaveLength(10);
    expect(result.total).toBeGreaterThan(0);
  });

  it('should filter by vehicle', async () => {
    const result = await service.filterByVehicle({
      marque: 'BMW',
      modele: 'Serie 3',
      type: 'E90 320d',
    });

    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products[0].compatibility).toBeDefined();
  });
});
```

### Tests E2E Exemple

```typescript
// cart.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Cart E2E', () => {
  let app: INestApplication;
  let cookies: string[];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    // Login to get session
    const loginResponse = await request(app.getHttpServer())
      .post('/authenticate')
      .send({ email: 'test@example.com', password: 'password123' });

    cookies = loginResponse.headers['set-cookie'];
  });

  it('should add item to cart', async () => {
    return request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ product_id: 12345, quantity: 2 })
      .expect(201)
      .expect((res) => {
        expect(res.body.item.quantity).toBe(2);
        expect(res.body.cart.totals.subtotal).toBeGreaterThan(0);
      });
  });

  it('should apply promo code', async () => {
    return request(app.getHttpServer())
      .post('/api/cart/promo')
      .set('Cookie', cookies)
      .send({ code: 'PROMO10' })
      .expect(200)
      .expect((res) => {
        expect(res.body.promo.code).toBe('PROMO10');
        expect(res.body.cart.totals.discount).toBeLessThan(0);
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

### Debugging Redis Cache

```bash
# Connexion Redis CLI
redis-cli -h localhost -p 6379

# Lister toutes les clés
KEYS *

# Voir une clé spécifique
GET catalog:hierarchy

# Voir le TTL d'une clé
TTL catalog:hierarchy

# Supprimer une clé
DEL catalog:hierarchy

# Supprimer toutes les clés (ATTENTION: Développement uniquement)
FLUSHALL

# Voir les stats Redis
INFO stats
```

### Debugging Meilisearch

```bash
# Health check
curl http://localhost:7700/health

# Stats index products
curl http://localhost:7700/indexes/products/stats \
  -H "Authorization: Bearer your_master_key"

# Recherche test
curl -X POST http://localhost:7700/indexes/products/search \
  -H "Authorization: Bearer your_master_key" \
  -H "Content-Type: application/json" \
  -d '{
    "q": "filtre à huile",
    "limit": 5
  }'
```

### Logs Debugging

```bash
# Logs en temps réel
npm run dev

# Logs avec niveau DEBUG
DEBUG=* npm run dev

# Logs spécifiques à un module
DEBUG=products:* npm run dev

# Logs avec Winston (production)
tail -f logs/error.log
tail -f logs/combined.log
```

### Performance Profiling

```bash
# Node.js profiling
node --prof backend/dist/main.js

# Analyser le profil
node --prof-process isolate-*.log > processed.txt

# Memory profiling
node --inspect backend/dist/main.js
# Puis ouvrir chrome://inspect
```

---

## Scripts Utiles

### Script de Test Complet

```bash
#!/bin/bash
# test-api-flow.sh - Test du flux e-commerce complet

BASE_URL="http://localhost:3000"
API_URL="$BASE_URL/api"

echo "=== 1. Login ==="
curl -X POST $BASE_URL/authenticate \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -c cookies.txt
echo ""

echo "=== 2. Search Product ==="
curl -X POST $API_URL/products/search \
  -H "Content-Type: application/json" \
  -d '{"query":"filtre à huile","limit":1}' | jq '.products[0]'
echo ""

echo "=== 3. Add to Cart ==="
curl -X POST $API_URL/cart/items \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"product_id":12345,"quantity":2}' | jq '.cart.totals'
echo ""

echo "=== 4. Apply Promo ==="
curl -X POST $API_URL/cart/promo \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"code":"PROMO10"}' | jq '.cart.totals'
echo ""

echo "=== 5. Get Cart ==="
curl -X GET $API_URL/cart \
  -b cookies.txt | jq '.totals'
echo ""

echo "✅ Test complet terminé"
```

### Script de Reset Cache

```bash
#!/bin/bash
# reset-cache.sh - Vider tous les caches

echo "Connexion à Redis..."
redis-cli -h localhost -p 6379 FLUSHALL

echo "✅ Cache Redis vidé"

echo "Réindexation Meilisearch..."
curl -X POST http://localhost:3000/api/catalog/reindex \
  -H "Authorization: Bearer admin_token"

echo "✅ Réindexation lancée"
```

---

## Documentation Complète

### Modules

- [README.md](./README.md) - Navigation principale
- [API-INDEX.md](./API-INDEX.md) - Index complet endpoints
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture détaillée

### Spécifications

- [Auth Module](./features/auth-module.md)
- [Catalog Module](./features/catalog-module.md)
- [Products Module](./features/products.md)
- [Cart Module](./features/cart.md)
- [Payments Module](./features/payments.md)
- [Orders Module](./features/orders.md)
- [Customers Module](./features/customers.md)

---

## Support

**Questions:**
- Consulter [API-INDEX.md](./API-INDEX.md) pour trouver un endpoint
- Voir [ARCHITECTURE.md](./ARCHITECTURE.md) pour comprendre les flux
- Lire la spec du module concerné pour les détails

**Bugs:**
- Créer une issue GitHub avec label `bug`
- Inclure: endpoint, payload, réponse attendue vs reçue
- Joindre logs si possible

---

**Made with ❤️ by Backend Team**  
**Quick Start v1.0.0 - 2025-11-18**

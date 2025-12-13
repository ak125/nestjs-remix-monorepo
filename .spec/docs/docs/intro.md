---
sidebar_position: 1
title: Introduction
status: stable
version: 1.0.0
---

# 🚀 Bienvenue sur la documentation Autoparts API

Documentation complète de l'**API E-commerce Pièces Automobiles** - Plateforme moderne pour la vente de pièces détachées.

## 📊 Vue d'ensemble

Notre API REST fournit un accès complet à :

- **4M+ produits** catalogués (pièces auto)
- **500K+ références** véhicules compatibles
- **Paiement sécurisé** Paybox (3D Secure)
- **Recherche ultra-rapide** Meilisearch (moins de 100ms)
- **Gestion commandes** complète (9 statuts)
- **Webhooks temps réel** (Paybox, TecDoc, transporteurs)

## 🎯 Technologies

```mermaid
graph LR
    A[Frontend Remix] -->|HTTP/JSON| B[Backend NestJS]
    B --> C[PostgreSQL Supabase]
    B --> D[Redis Cache]
    B --> E[Meilisearch]
    B --> F[Paybox Gateway]
```

**Stack technique :**
- **Backend** : NestJS 10 (TypeScript)
- **Frontend** : Remix SSR (React 18)
- **Database** : PostgreSQL (Supabase)
- **Cache** : Redis (distributed)
- **Search** : Meilisearch (4M+ docs)
- **Payment** : Paybox (HMAC-SHA512)
- **Auth** : JWT + Sessions + OAuth2

## 🚀 Démarrage rapide

### 1. Obtenir un token d'accès

```bash
POST https://api.autoparts.com/api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Réponse :**
```json
{
  "success": true,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "role": 1
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2. Faire une requête authentifiée

```bash
GET https://api.autoparts.com/api/orders
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Rechercher des produits

```bash
GET https://api.autoparts.com/api/search?q=plaquette+frein&limit=24
```

**Réponse :**
```json
{
  "success": true,
  "hits": 450,
  "products": [
    {
      "id": "PRD-001",
      "name": "Plaquettes de frein avant BOSCH",
      "price": 45.90,
      "stock": 150,
      "marque": "BOSCH"
    }
  ],
  "facets": {
    "marque": { "BOSCH": 120, "FERODO": 85 },
    "vehicule": { "Renault": 180, "Peugeot": 150 }
  }
}
```

## 📚 Sections principales

### 🔐 [Authentification](/guides/authentication)
JWT Bearer tokens, OAuth2 (Keycloak + Supabase), sessions Redis.

### 🏗️ [Architecture](/architecture/overview)
Diagrammes C4 (4 niveaux), séquences critiques, déploiement Kubernetes.

### 🔌 [API Reference](/api)
281 endpoints REST documentés avec exemples et schémas.

### 🪝 [Webhooks](/webhooks/overview)
Paybox IPN, TecDoc updates, tracking transporteurs, n8n workflows.

### 📖 [Examples](/examples/checkout-flow)
Exemples complets : checkout, paiement, recherche, webhooks.

## 🎯 Cas d'usage

### E-commerce classique
```typescript
// 1. Ajouter au panier
await fetch('/api/cart/items', {
  method: 'POST',
  body: JSON.stringify({ productId: 'PRD-001', quantity: 2 })
});

// 2. Créer commande
const order = await fetch('/api/orders', {
  method: 'POST',
  body: JSON.stringify({ cartId: 'cart-123', addressId: 'addr-456' })
});

// 3. Initialiser paiement
const payment = await fetch('/api/payments', {
  method: 'POST',
  body: JSON.stringify({ orderId: order.id, amount: 77.90 })
});

// 4. Rediriger vers Paybox
window.location.href = payment.redirectUrl;
```

### Recherche avancée
```typescript
// Recherche avec filtres
const results = await fetch('/api/search?' + new URLSearchParams({
  q: 'filtre à huile',
  facets: 'marque,vehicule',
  filters: 'marque:BOSCH AND vehicule:Renault',
  page: '1',
  limit: '24'
}));
```

### Webhooks
```typescript
// Recevoir notification Paybox
app.post('/api/paybox/callback', async (req, res) => {
  const signature = req.query.K;
  const isValid = verifyHMAC(req.query, signature);
  
  if (!isValid) {
    return res.status(403).send('Signature invalide');
  }
  
  // Traiter le paiement
  await updateOrderStatus(req.query.Ref, 'PAID');
  
  res.status(200).send('OK');
});
```

## 📊 Performance

| Métrique | Target | Actuel | Status |
|----------|--------|--------|--------|
| **Search P95** | &lt;100ms | 87ms | ✅ OK |
| **Checkout** | &lt;1s | 485ms | ✅ OK |
| **Payment IPN** | &lt;1s | 450ms | ✅ OK |
| **API Uptime** | >99.9% | 99.95% | ✅ OK |

## 🔗 Ressources

- **[OpenAPI Spec](/openapi.yaml)** - Spécification complète 281 endpoints
- **[AsyncAPI Spec](/asyncapi.yaml)** - Documentation webhooks
- **[GitHub Repo](https://github.com/ak125/nestjs-remix-monorepo)** - Code source
- **[Support](mailto:support@autoparts.com)** - Contact technique

## 🆘 Besoin d'aide ?

- 📖 [FAQ](/faq)
- 💬 [GitHub Issues](https://github.com/ak125/nestjs-remix-monorepo/issues)
- 📧 [Support Email](mailto:support@autoparts.com)
- 🔧 [Status Page](https://status.autoparts.com)

---

**Version** : 2.0.0  
**Dernière mise à jour** : 15 novembre 2025  
**Licence** : Proprietary

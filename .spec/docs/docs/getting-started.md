---
sidebar_position: 2
title: Getting Started
status: stable
version: 1.0.0
---

# 🚀 Getting Started

Ce guide vous accompagne pour commencer à utiliser l'API Autoparts en **moins de 5 minutes**.

## 📋 Prérequis

- **Compte développeur** (inscription gratuite)
- **Client HTTP** (curl, Postman, Insomnia, ou votre langage préféré)
- **Token API** (obtenu après inscription)

## 🔑 1. Créer un compte

### Option A : Interface Web (recommandé)

1. Visitez [https://autoparts.com/register](https://autoparts.com/register)
2. Remplissez le formulaire d'inscription
3. Vérifiez votre email
4. Connectez-vous sur [https://autoparts.com/dashboard](https://autoparts.com/dashboard)

### Option B : API Directe

```bash
curl -X POST https://api.autoparts.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@example.com",
    "password": "SecureP@ssw0rd123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Réponse :**
```json
{
  "success": true,
  "user": {
    "id": "user-abc123",
    "email": "developer@example.com",
    "role": 1
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## 🔐 2. Authentification

### Obtenir un access token

```bash
curl -X POST https://api.autoparts.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@example.com",
    "password": "SecureP@ssw0rd123"
  }'
```

**Réponse :**
```json
{
  "success": true,
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLWFiYzEyMyIsImVtYWlsIjoiZGV2ZWxvcGVyQGV4YW1wbGUuY29tIiwicm9sZSI6MSwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMDA5MDB9.signature",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-abc123",
    "email": "developer@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": 1
  }
}
```

### Utiliser le token

```bash
curl -X GET https://api.autoparts.com/api/users/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**⏰ Durée de vie des tokens :**
- **Access token** : 15 minutes
- **Refresh token** : 7 jours

## 🌐 URLs de développement

```
Backend API:    http://localhost:3000/api/*
Swagger UI:     http://localhost:3000/api/docs (test interactif)
Portail Docs:   http://localhost:3002 (ce portail - guides)
```

> **Architecture**: NestJS (port 3000) intègre Remix frontend + API REST.  
> Le portail Docusaurus (port 3002) fournit la documentation complète.

### Rafraîchir le token

```bash
curl -X POST https://api.autoparts.com/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

## 🧪 3. Tester l'API

### Test simple (Health Check)

```bash
curl https://api.autoparts.com/api/users/test
```

**Réponse attendue :**
```json
{
  "status": "ok",
  "message": "Users module is working!"
}
```

### Rechercher des produits (sans auth)

```bash
curl "https://api.autoparts.com/api/search?q=filtre+huile&limit=5"
```

**Réponse :**
```json
{
  "success": true,
  "hits": 1243,
  "processingTimeMs": 42,
  "products": [
    {
      "id": "PRD-001",
      "name": "Filtre à huile BOSCH F026407078",
      "reference": "F026407078",
      "ean": "3165143357354",
      "price": 8.90,
      "stock": 245,
      "marque": "BOSCH"
    }
  ],
  "facets": {
    "marque": {
      "BOSCH": 320,
      "MANN-FILTER": 280,
      "PURFLUX": 210
    }
  }
}
```

### Récupérer le profil (avec auth)

```bash
curl -X GET https://api.autoparts.com/api/users/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Réponse :**
```json
{
  "success": true,
  "data": {
    "id": "user-abc123",
    "email": "developer@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": 1,
    "createdAt": "2024-11-15T10:00:00Z",
    "addresses": []
  }
}
```

## 🛒 4. Exemple Complet : Ajouter au panier

```bash
# 1. Obtenir le token (voir section 2)
ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 2. Ajouter un produit au panier
curl -X POST https://api.autoparts.com/api/cart/items \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PRD-001",
    "quantity": 2
  }'
```

**Réponse :**
```json
{
  "success": true,
  "message": "Produit ajouté au panier",
  "cart": {
    "id": "cart-xyz789",
    "items": [
      {
        "productId": "PRD-001",
        "name": "Filtre à huile BOSCH F026407078",
        "quantity": 2,
        "price": 8.90,
        "total": 17.80
      }
    ],
    "subtotal": 17.80,
    "shipping": 5.90,
    "vat": 4.74,
    "total": 28.44
  }
}
```

## 📦 5. Environnements

### Production
```
Base URL: https://api.autoparts.com
Status: ✅ Live (99.9% uptime)
Rate Limit: 100 req/min
```

### Staging
```
Base URL: https://staging-api.autoparts.com
Status: ✅ Active (tests)
Rate Limit: 500 req/min
```

### Development
```
Base URL: http://localhost:3000
Status: 🔧 Local dev
Rate Limit: Aucune
```

## 🔧 6. Outils recommandés

### Postman Collection

Importez notre collection Postman complète :

```bash
wget https://api.autoparts.com/postman-collection.json
```

Ou utilisez ce lien : [Import dans Postman](https://www.postman.com/autoparts-api/workspace/autoparts-e-commerce)

### Swagger UI

Interface interactive pour tester l'API :

🔗 [https://api.autoparts.com/api/docs](https://api.autoparts.com/api/docs)

### SDK Officiels

```bash
# JavaScript/TypeScript
npm install @autoparts/api-client

# Python
pip install autoparts-api

# PHP
composer require autoparts/api-client
```

## 📚 Prochaines étapes

Maintenant que vous êtes configuré, explorez :

- **[Authentification avancée](/guides/authentication)** - OAuth2, SSO, 2FA
- **[API Reference](/api)** - 281 endpoints documentés
- **[Exemples](/examples/checkout-flow)** - Flows complets
- **[Webhooks](/webhooks/overview)** - Notifications temps réel

## ❓ Questions fréquentes

### Comment obtenir une clé API ?

Les clés API sont générées automatiquement lors de l'inscription. Vous pouvez les gérer depuis votre [dashboard](https://autoparts.com/dashboard/api-keys).

### Quelle est la limite de requêtes ?

- **Standard** : 100 req/min
- **Premium** : 500 req/min
- **Enterprise** : Illimité

### Comment gérer les erreurs ?

Toutes les erreurs suivent ce format :

```json
{
  "success": false,
  "error": "Unauthorized",
  "code": "UNAUTHORIZED",
  "details": "Invalid or expired token",
  "statusCode": 401
}
```

Codes HTTP standards :
- `200` : Success
- `400` : Bad Request
- `401` : Unauthorized
- `403` : Forbidden
- `404` : Not Found
- `429` : Rate Limit Exceeded
- `500` : Internal Server Error

## 🆘 Support

- 📧 **Email** : [support@autoparts.com](mailto:support@autoparts.com)
- 💬 **GitHub Issues** : [Report a bug](https://github.com/ak125/nestjs-remix-monorepo/issues)
- 📖 **Documentation** : [docs.autoparts.com](https://docs.autoparts.com)
- 🔧 **Status** : [status.autoparts.com](https://status.autoparts.com)

---

🎉 **Félicitations !** Vous êtes prêt à utiliser l'API Autoparts. Consultez les [exemples](/examples/checkout-flow) pour des cas d'usage plus avancés.

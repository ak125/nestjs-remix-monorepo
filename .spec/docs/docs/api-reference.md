---
title: "API Reference"
status: stable
version: 1.0.0
---

# 🔌 API Reference

## Documentation Interactive Swagger UI

Pour accéder à la documentation complète et interactive de l'API avec **281 endpoints**, utilisez notre interface Swagger UI intégrée.

:::tip Try it Out!
Swagger UI vous permet de **tester directement** les endpoints depuis votre navigateur avec une interface interactive.
:::

---

## 🚀 Accès Local (Développement)

Lorsque vous lancez le backend en mode développement :

```bash
npm run dev
```

L'API Reference est automatiquement disponible à :

**👉 [http://localhost:3000/api/docs](http://localhost:3000/api/docs)**

---

## 🌐 Accès Production

En production, l'API Reference Swagger est accessible à :

**👉 [https://api.autoparts.com/api/docs](https://api.autoparts.com/api/docs)**

---

## 📋 Fonctionnalités Swagger UI

### ✅ Ce que vous pouvez faire :

- **Explorer** tous les endpoints par catégorie (30 tags)
- **Tester** les requêtes avec "Try it out"
- **Voir** les schémas de réponse détaillés
- **Authentifier** avec JWT pour tester les endpoints protégés
- **Télécharger** la spécification OpenAPI 3.1.0

### 🏷️ Catégories Principales

L'API est organisée en 30 catégories :

| Catégorie | Description | Endpoints |
|-----------|-------------|-----------|
| **Auth** | Authentication & Authorization | 15+ |
| **Users** | User management | 10+ |
| **Products** | Product catalog | 20+ |
| **Orders** | Order processing | 15+ |
| **Cart** | Shopping cart | 8+ |
| **Payment** | Payment processing (Paybox, CyberPlus) | 12+ |
| **Webhooks** | Webhook management | 5+ |
| **Admin** | Administration endpoints | 30+ |
| ... | 22 autres catégories | 166+ |

---

## 🔐 Authentication

Pour tester les endpoints protégés dans Swagger UI :

1. Cliquez sur le bouton **"Authorize"** (🔓) en haut à droite
2. Entrez votre token JWT dans le champ `Bearer <token>`
3. Cliquez sur **"Authorize"**
4. Tous les endpoints utiliseront ce token automatiquement

### Obtenir un Token JWT

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

Réponse :
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600
}
```

---

## 📥 Télécharger la Spécification OpenAPI

Plusieurs formats disponibles :

### Format YAML (Recommandé)

```bash
# Local
curl http://localhost:3000/api/docs-yaml -o openapi.yaml

# Production
curl https://api.autoparts.com/api/docs-yaml -o openapi.yaml
```

### Format JSON

```bash
# Local
curl http://localhost:3000/api/docs-json -o openapi.json

# Production
curl https://api.autoparts.com/api/docs-json -o openapi.json
```

### Depuis le repository

La spécification OpenAPI est également versionnée dans le repository :

```
.spec/openapi.yaml  (1345 lignes, 281 endpoints)
```

---

## 🛠️ Utilisation avec des Outils Externes

### Postman

1. Importer la spécification OpenAPI :
   - **File** → **Import** → **Link**
   - Coller : `http://localhost:3000/api/docs-json`
2. Postman créera automatiquement une collection avec tous les endpoints

### Insomnia

1. **Application** → **Import/Export** → **Import Data**
2. Sélectionner **From URL**
3. Entrer : `http://localhost:3000/api/docs-json`

### cURL

Générer des commandes cURL directement depuis Swagger UI :
- Cliquer sur un endpoint
- Cliquer sur **"Try it out"**
- Remplir les paramètres
- Copier la commande cURL générée

---

## 📚 Documentation Complémentaire

Pour des guides conceptuels et des exemples d'intégration :

- **Guide d'Authentification** *(à venir)*
- **Exemple Checkout Flow** *(à venir)*
- [Guide Webhooks](./webhooks/overview)
- **Gestion des Erreurs** *(à venir)*

---

## ⚙️ Spécifications Techniques

- **Format** : OpenAPI 3.1.0
- **Framework** : NestJS 10 + Swagger
- **Authentication** : JWT Bearer Token
- **Rate Limiting** : 100 req/min (authentifié), 20 req/min (anonyme)
- **Versioning** : `/api/v1/*` (current), `/api/v2/*` (upcoming)

---

## 🐛 Signaler un Problème

Si vous trouvez une incohérence dans la documentation API :

1. Vérifier la version de l'API (`GET /api/version`)
2. Ouvrir une issue GitHub avec :
   - Endpoint concerné
   - Comportement attendu vs réel
   - Étapes de reproduction

---

## 🎯 Prochaines Étapes

Maintenant que vous connaissez l'API Reference :

1. **[Getting Started](./getting-started.md)** - Configuration initiale
2. **[Architecture Overview](./architecture/overview.md)** - Comprendre le stack
3. **[Webhooks Overview](./webhooks/overview.md)** - Intégrer les webhooks

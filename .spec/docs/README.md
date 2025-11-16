# 📖 Autoparts API Documentation Portal

**Portail développeur** pour la plateforme e-commerce Autoparts - Documentation complète de l'API REST.

🔗 **Live** : [https://docs.autoparts.com](https://docs.autoparts.com)

## 🚀 Démarrage Rapide

### Installation

```bash
cd .spec/docs
npm install
```

### Développement

```bash
npm start
```

Ouvre [http://localhost:3002](http://localhost:3002) automatiquement.

> **Note**: Le backend NestJS tourne sur le port 3000 (`/api/docs` pour Swagger UI).

### Build Production

```bash
npm run build
```

Génère les fichiers statiques dans `build/`.

### Déploiement

```bash
# GitHub Pages
npm run deploy

# Ou Vercel (recommandé)
vercel --prod
```

## 📚 Contenu

### 🏠 Introduction
- Vue d'ensemble de l'API
- Stack technique
- Cas d'usage

### 🚀 Getting Started
- Créer un compte développeur
- Obtenir un access token
- Premier appel API
- Environnements (dev/staging/prod)

### 📖 Guides
- **Authentication** : JWT, OAuth2, sessions
- **Pagination** : Curseur vs offset
- **Error Handling** : Codes erreur, retry logic
- **Rate Limiting** : Limites par endpoint
- **Webhooks** : IPN, callbacks, sécurité

### 🏗️ Architecture
- **Overview** : Stack technique complète
- **Diagrammes C4** : 4 niveaux (Context, Container, Component, Code)
- **Sequence Diagrams** : 6 flows critiques (checkout, auth, payment, search, cart merge, workflow)
- **Deployment** : Kubernetes, monitoring
- **Security** : Best practices, OWASP

### 🔌 API Reference
- **281 endpoints** REST documentés
- Générés depuis OpenAPI 3.1.0
- Exemples de requêtes/réponses
- Schemas Zod → JSON Schema
- Try it out avec Swagger UI

### 🪝 Webhooks
- **Paybox IPN** : Notifications paiement
- **TecDoc** : Mises à jour catalogue
- **Carriers** : Tracking colis (DHL, Chronopost, etc.)
- **n8n** : Automatisations workflows
- **CyberPlus** : Legacy payment gateway

### 📖 Examples
- **Checkout Flow** : Du panier au paiement
- **Authentication** : Login, refresh, logout
- **Search** : Recherche produits avec filtres
- **Webhooks** : Recevoir et traiter callbacks

### 🛠️ Development
- **Setup** : Installation projet
- **Testing** : Unit, E2E, webhooks
- **Deployment** : CI/CD, Kubernetes
- **Monitoring** : Prometheus, Grafana

## 🎨 Technologies

- **[Docusaurus 3](https://docusaurus.io)** - SSG React
- **[OpenAPI Plugin](https://github.com/PaloAltoNetworks/docusaurus-openapi-docs)** - Génération API docs depuis OpenAPI
- **[Mermaid](https://mermaid.js.org)** - Diagrammes
- **[Prism](https://prismjs.com)** - Code syntax highlighting
- **[Algolia](https://www.algolia.com)** - Search (optionnel)

## 📂 Structure

```
.spec/docs/
├── docs/                       # Markdown docs
│   ├── intro.md                # Page d'accueil
│   ├── getting-started.md      # Guide démarrage
│   ├── guides/                 # Guides pratiques
│   │   ├── authentication.md
│   │   ├── pagination.md
│   │   ├── error-handling.md
│   │   ├── rate-limiting.md
│   │   └── webhooks.md
│   ├── architecture/           # Docs architecture
│   │   ├── overview.md
│   │   ├── c4-diagrams.md
│   │   ├── sequence-diagrams.md
│   │   ├── deployment.md
│   │   └── security.md
│   ├── api/                    # API Reference (auto-généré)
│   ├── webhooks/               # Webhooks docs
│   │   ├── overview.md
│   │   ├── paybox.md
│   │   ├── tecdoc.md
│   │   ├── carriers.md
│   │   └── n8n.md
│   ├── examples/               # Exemples de code
│   │   ├── checkout-flow.md
│   │   ├── authentication.md
│   │   ├── search.md
│   │   └── webhooks.md
│   └── development/            # Guide développeurs
│       ├── setup.md
│       ├── testing.md
│       ├── deployment.md
│       └── monitoring.md
├── src/                        # Custom React components
│   ├── components/
│   ├── css/
│   └── pages/
├── static/                     # Assets statiques
│   ├── img/
│   ├── openapi.yaml            # OpenAPI spec
│   └── asyncapi.yaml           # AsyncAPI spec
├── docusaurus.config.js        # Configuration Docusaurus
├── sidebars.js                 # Structure sidebar
├── package.json
└── README.md
```

## 🔧 Configuration

### OpenAPI Plugin

Génère automatiquement la doc API depuis `../.spec/openapi.yaml` :

```javascript
// docusaurus.config.js
plugins: [
  [
    'docusaurus-plugin-openapi-docs',
    {
      id: 'openapi',
      docsPluginId: 'classic',
      config: {
        autoparts: {
          specPath: '../.spec/openapi.yaml',
          outputDir: 'docs/api',
          sidebarOptions: {
            groupPathsBy: 'tag',
          },
        },
      },
    },
  ],
]
```

### Algolia Search (Optionnel)

```javascript
// docusaurus.config.js
themeConfig: {
  algolia: {
    appId: 'YOUR_APP_ID',
    apiKey: 'YOUR_API_KEY',
    indexName: 'autoparts-docs',
  },
}
```

### Deployment GitHub Pages

```bash
# 1. Configurer Git
GIT_USER=ak125 npm run deploy

# 2. Ou via GitHub Actions (automatique)
# .github/workflows/deploy-docs.yml
```

## 🎨 Customisation

### Thème

Modifier `src/css/custom.css` :

```css
:root {
  --ifm-color-primary: #2e8555;
  --ifm-color-primary-dark: #29784c;
  --ifm-code-font-size: 95%;
}
```

### Logo

Remplacer `static/img/logo.svg`.

### Composants Custom

Créer dans `src/components/` :

```tsx
// src/components/ApiPlayground.tsx
export function ApiPlayground() {
  return (
    <div className="api-playground">
      <SwaggerUI url="/openapi.yaml" />
    </div>
  );
}
```

## 📊 Métriques

### Analytics

```javascript
// docusaurus.config.js
themeConfig: {
  gtag: {
    trackingID: 'G-XXXXXXXXXX',
  },
}
```

### Performance

```bash
# Lighthouse score
npm run build
npx serve build
lighthouse http://localhost:3000
```

**Targets :**
- Performance : >90
- Accessibility : >95
- SEO : >95

## 🆘 Support

### Problèmes Build

```bash
# Clear cache
npm run clear

# Reinstall
rm -rf node_modules package-lock.json
npm install
```

### Hot Reload lent

```bash
# Augmenter limite fichiers
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### OpenAPI plugin erreur

```bash
# Vérifier validité spec
npx @stoplight/spectral-cli lint ../.spec/openapi.yaml
```

## 📚 Ressources

- **Docusaurus Docs** : [https://docusaurus.io](https://docusaurus.io)
- **OpenAPI Plugin** : [https://github.com/PaloAltoNetworks/docusaurus-openapi-docs](https://github.com/PaloAltoNetworks/docusaurus-openapi-docs)
- **Mermaid** : [https://mermaid.js.org](https://mermaid.js.org)

## 📝 Changelog

### v1.0.0 (2025-11-15)
- ✅ Initial release
- ✅ 281 endpoints documentés
- ✅ Diagrammes C4 + Sequences
- ✅ Webhooks AsyncAPI
- ✅ Examples complets
- ✅ Swagger UI intégré

## 📄 License

Proprietary - © 2025 Autoparts E-commerce Platform

---

**Maintenu par** : [Architecture Team](mailto:architects@autoparts.com)  
**Dernière mise à jour** : 15 novembre 2025

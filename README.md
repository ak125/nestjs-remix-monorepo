# NestJS-Remix Monorepo

**Architecture "Zero-Latency" pour applications web haute performance**

Ce projet implémente une architecture innovante qui combine NestJS (backend) et Remix (frontend) dans un monorepo unifié, permettant une intégration directe sans latence réseau interne.

## 🚀 Architecture

### Concept "Zero-Latency"

Au lieu d'utiliser des appels HTTP classiques entre le frontend et le backend, ce projet utilise une **intégration directe** via le `RemixIntegrationService`. Les loaders et actions Remix appellent directement les services NestJS, éliminant complètement la latence réseau interne.

```typescript
// ❌ Ancienne approche (avec latence réseau)
const response = await fetch('http://localhost:3000/api/orders');

// ✅ Nouvelle approche (zero-latency)
const result = await context.remixService.integration.getOrdersForRemix();
```

### Structure du Projet

```
nestjs-remix-monorepo/
├── backend/           # API NestJS
│   ├── src/
│   │   ├── modules/   # Modules métier (Orders, Users, Cart, Payments)
│   │   ├── remix/     # Service d'intégration Remix
│   │   └── auth/      # Authentification
├── frontend/          # Application Remix
│   ├── app/
│   │   ├── routes/    # Routes Remix
│   │   └── components/# Composants UI
├── packages/          # Configurations partagées
│   ├── eslint-config/
│   └── typescript-config/
└── docs/              # Documentation
```

## 🛠️ Technologies

- **Backend:** NestJS, Supabase, TypeScript
- **Frontend:** Remix, React, TailwindCSS, shadcn/ui
- **Monorepo:** npm workspaces + Turbo
- **Base de données:** Supabase (PostgreSQL)
- **Authentification:** Sessions + JWT

## 📦 Installation

```bash
# Cloner le projet
git clone https://github.com/votre-repo/nestjs-remix-monorepo.git
cd nestjs-remix-monorepo

# Installer les dépendances
npm install

# Configuration de l'environnement
cp backend/.env.example backend/.env
# Configurer vos variables Supabase dans backend/.env
```

## 🚀 Démarrage

```bash
# Développement (lance backend + frontend simultanément)
npm run dev

# Build de production
npm run build

# Tests et vérifications
npm run typecheck
npm run lint
```

## 📁 Modules Métier

### Orders (Commandes)
- Gestion complète du cycle de vie des commandes
- Calcul automatique des frais de livraison
- Système de statuts et transitions
- Intégration avec le système de facturation

### Users (Utilisateurs)
- Authentification et autorisation
- Gestion des profils utilisateur
- Système de niveaux d'accès (admin, super-admin)
- Cache Redis pour les performances

### Cart (Panier)
- Panier persistant par utilisateur
- Calculs de prix en temps réel
- Support des variantes de produits
- API optimisée pour le frontend

### Payments (Paiements)
- Intégration avec systèmes de paiement
- Gestion des statuts de paiement
- Historique et reporting
- Sécurité renforcée

## 🎯 Avantages de l'Architecture

1. **Performance Maximale**
   - Élimination de la latence réseau interne
   - Partage direct des types TypeScript
   - Cache partagé entre frontend et backend

2. **Développement Simplifié**
   - Un seul repository pour tout le projet
   - Types partagés automatiquement
   - Debugging facilité

3. **Scalabilité**
   - Déploiement indépendant possible
   - Architecture modulaire
   - Facilité d'ajout de nouveaux modules

4. **Maintenance**
   - Code unifié et cohérent
   - Tests intégrés
   - CI/CD simplifié

## 📖 Documentation

- [Guide de Démarrage](docs/getting-started.md)
- [Architecture Détaillée](docs/architecture.md)
- [Guide de Développement](docs/development.md)
- [API Reference](docs/api-reference.md)
- [Déploiement](docs/deployment.md)

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/amazing-feature`)
3. Commit les changements (`git commit -m 'Add amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🎖️ État du Projet

- ✅ Architecture "Zero-Latency" implémentée
- ✅ Modules Orders, Users, Cart, Payments fonctionnels
- ✅ Interface d'administration complète
- ✅ Système d'authentification robuste
- ✅ Tests et TypeScript à 100%
- ✅ Documentation complète

**Status:** Production Ready 🚀

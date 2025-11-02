# 📚 Index du Workspace - Navigation Rapide

> **Workspace propre et organisé** - Mise à jour : 2 novembre 2025

## 🚀 Démarrage Rapide

```bash
# Installer les dépendances
npm install

# Démarrer en développement
npm run dev

# Backend seul (port 3001)
cd backend && npm run dev

# Frontend seul (port 5173)
cd frontend && npm run dev
```

## 📖 Documentation

### 📚 Documentation Principale
- **[README.md](./README.md)** - Documentation complète du projet
- **[docs/](./docs/)** - 129 documents organisés ([Index](./docs/README.md))

### 🎯 Guides Rapides
- **Architecture** : [docs/architecture/](./docs/architecture/)
- **Design System** : [docs/design-system/](./docs/design-system/)
- **E-commerce** : [docs/ecommerce/](./docs/ecommerce/)
- **SEO** : [docs/seo/](./docs/seo/)
- **Payment (Paybox)** : [docs/paybox/](./docs/paybox/)

## 🔧 Scripts & Outils

### 🛠️ Scripts Disponibles
- **[scripts/](./scripts/)** - 110 scripts organisés ([Index](./scripts/README.md))
- **Scripts SEO** : `scripts/seo/`
- **Scripts de test** : `scripts/testing/`
- **Scripts DB** : `scripts/database/`
- **Scripts config** : `scripts/config/`

### ⚙️ Configuration
- **[config/](./config/)** - Configurations centralisées ([Index](./config/README.md))
- **Caddy** : `config/caddy/`
- **Cron** : `config/cron/`
- **Vector/Logs** : `config/vector/`

## 🐳 Docker & Infrastructure

```bash
# Lancer Caddy (reverse proxy)
docker-compose -f docker-compose.caddy.yml up

# Lancer Vector (logs & métriques)
docker-compose -f docker-compose.vector.yml up

# Rollback config si besoin
./scripts/sync-configs.sh
```

## 🗄️ Archives

- **[archives/](./archives/)** - Fichiers archivés
  - `obsolete/` - 14 fichiers obsolètes
  - `migration-scripts/` - 42 scripts Python migration
  - `backups/` - 9 backups (credentials) 🔒
  - `reports/` - Rapports d'audit

## 📊 Structure du Projet

```
nestjs-remix-monorepo/
├── backend/          # 🔧 NestJS API (port 3001)
├── frontend/         # 🎨 Remix App (port 5173)
├── packages/         # 📦 Monorepo packages partagés
├── docs/             # 📚 Documentation (129 fichiers)
├── scripts/          # 🛠️ Scripts utilitaires (110 fichiers)
├── config/           # ⚙️ Configuration (12 fichiers)
├── archives/         # 🗄️ Archives (66 fichiers)
└── ...               # Fichiers essentiels
```

## 🔍 Recherche Rapide

```bash
# Trouver une documentation
find docs -name "*keyword*.md"

# Lister les scripts disponibles
ls scripts/*/*.sh

# Voir la structure
tree -L 2 docs config scripts archives
```

## 📝 Rapports de Nettoyage

- **[CLEANUP-SUMMARY.md](./CLEANUP-SUMMARY.md)** - Résumé rapide du nettoyage
- **[CLEANUP-REPORT.md](./CLEANUP-REPORT.md)** - Rapport détaillé complet

## 🎯 Métriques Clés

| Métrique | Valeur |
|----------|--------|
| Fichiers à la racine | 30 (-80%) |
| Documentation | 129 fichiers |
| Scripts | 110 fichiers |
| Configuration | 12 fichiers |
| Archives | 66 fichiers |
| **Total géré** | **347 fichiers** |

## 🔗 Liens Utiles

### Documentation Technique
- [Architecture](./docs/architecture/)
- [API Backend](./backend/README.md)
- [Frontend Remix](./frontend/README.md)

### Guides Opérationnels
- [Déploiement](./docs/guides/)
- [Configuration](./config/README.md)
- [Tests](./docs/testing/)

### Référence
- [Design System](./docs/design-system/)
- [SEO Strategy](./docs/seo/)
- [Payment Integration](./docs/paybox/)

## 💡 Astuces

### Navigation
- Utilisez les fichiers `README.md` dans chaque dossier pour la navigation
- Les fichiers `*-INDEX.md` et `*-SUMMARY.md` sont vos amis
- Consultez `docs/README.md` pour l'index complet de la documentation

### Développement
- Le backend écoute sur le port **3001**
- Le frontend écoute sur le port **5173**
- Les logs sont dans `./logs/`

### Sécurité
- Les `.env` de production sont dans `backend/.env`
- Les backups sont dans `archives/backups/` (exclu de Git)
- Ne jamais commiter de credentials

---

**Dernière mise à jour** : 2 novembre 2025  
**Version** : 2.0.0  
**Status** : ✅ Production Ready

🎉 **Workspace propre et professionnel !**

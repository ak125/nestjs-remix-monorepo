# ⚡ Commandes Utiles - Monorepo

Guide de référence rapide des commandes essentielles.

---

## 🚀 Démarrage

### Installation
```bash
# Installation complète
npm install

# Installation propre (nettoie avant)
rm -rf node_modules && npm install

# Installation avec cache nettoyé
npm cache clean --force && npm install
```

### Développement
```bash
# Démarrer tout (backend + frontend)
npm run dev

# Backend seul
cd backend && npm run dev

# Frontend seul
cd frontend && npm run dev

# Mode watch (auto-rebuild)
cd backend && npm run dev:watch
```

---

## 🧹 Nettoyage

### Scripts Automatisés
```bash
# Nettoyage rapide (recommandé avant commit)
./scripts/quick-cleanup.sh

# Nettoyage complet interactif
./scripts/secure-cleanup.sh

# Nettoyage des dépendances
./scripts/cleanup-dependencies.sh

# Mise à jour des package.json
./scripts/update-package-json.sh
```

### Nettoyage Manuel
```bash
# Supprimer node_modules partout
npm run clean-node-modules

# Supprimer les caches Turbo
npm run clean-turbo-cache

# Supprimer dist/
rm -rf backend/dist frontend/build

# Supprimer tsbuildinfo
find . -name "tsconfig.tsbuildinfo" -delete

# Tout nettoyer
rm -rf node_modules backend/node_modules frontend/node_modules \
       backend/dist frontend/build \
       .turbo backend/.turbo frontend/.turbo \
       *.log
```

---

## 🏗️ Build

### Production
```bash
# Build complet
npm run build

# Build backend seul
cd backend && npm run build

# Build frontend seul
cd frontend && npm run build

# Build avec vérification de types
npm run build && npm run typecheck
```

### Développement
```bash
# Build incrémental (plus rapide)
cd backend && npm run dev:compile

# Watch mode (auto-rebuild)
cd backend && npm run dev:watch
```

---

## 🧪 Tests

### Exécution
```bash
# Tous les tests
npm test

# Tests backend
cd backend && npm test

# Tests avec couverture
cd backend && npm run test:cov

# Tests en mode watch
cd backend && npm run test:watch

# Tests E2E spécifiques
cd backend && ./test-payments-e2e.sh
cd backend && ./test-cart-integration.sh
```

### Scripts de Test
```bash
# Tests structurels
cd backend && ./audit-payments-quality.sh
cd backend && ./audit-orders-quality.sh

# Tests d'intégration
cd backend && ./test-payments-integration.sh
cd backend && ./test-cart-e2e.sh

# Tests utilisateurs
cd backend && ./test-users-api.sh
```

---

## 🔍 Validation et Qualité

### TypeScript
```bash
# Vérification de types
npm run typecheck

# Vérification backend
cd backend && npm run typecheck

# Vérification frontend
cd frontend && npm run typecheck
```

### Linting
```bash
# Lint tout le projet
npm run lint

# Lint avec auto-fix
npm run lint:fix

# Lint backend
cd backend && npm run lint

# Lint frontend
cd frontend && npm run lint
```

### Formatage
```bash
# Formater tout le code
npm run format

# Vérifier le formatage
npm run format:check

# Formater backend
cd backend && npm run format
```

---

## 📦 Dépendances

### Installation
```bash
# Ajouter une dépendance à la racine
npm install <package>

# Ajouter au backend
npm install <package> -w backend

# Ajouter au frontend
npm install <package> -w frontend

# Ajouter en dev
npm install -D <package>
```

### Mise à jour
```bash
# Vérifier les mises à jour
npm outdated

# Mettre à jour toutes les dépendances mineures
npm update

# Mettre à jour une dépendance spécifique
npm update <package>

# Mettre à jour tout (y compris majeur) - ATTENTION
npx npm-check-updates -u
npm install
```

### Audit
```bash
# Audit de sécurité
npm audit

# Fix automatique
npm audit fix

# Fix force (attention aux breaking changes)
npm audit fix --force

# Vérifier les dépendances inutilisées
npx depcheck
```

---

## 🗄️ Base de Données

### Prisma
```bash
# Générer le client
cd backend && npx prisma generate

# Créer une migration
cd backend && npx prisma migrate dev --name <nom>

# Appliquer les migrations
cd backend && npx prisma migrate deploy

# Ouvrir Prisma Studio
cd backend && npx prisma studio

# Reset la DB (ATTENTION)
cd backend && npx prisma migrate reset
```

### Supabase
```bash
# Voir les tables
psql $DATABASE_URL -c "\dt"

# Exporter le schéma
pg_dump $DATABASE_URL --schema-only > schema.sql

# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

---

## 🐳 Docker

### Développement
```bash
# Démarrer tous les services
docker-compose -f docker-compose.dev.yml up

# Démarrer en arrière-plan
docker-compose -f docker-compose.dev.yml up -d

# Voir les logs
docker-compose -f docker-compose.dev.yml logs -f

# Arrêter
docker-compose -f docker-compose.dev.yml down
```

### Services Individuels
```bash
# Redis seul
docker-compose -f docker-compose.redis.yml up -d

# Meilisearch seul
docker-compose -f docker-compose.meilisearch.yml up -d

# Arrêter un service
docker-compose -f docker-compose.redis.yml down
```

### Production
```bash
# Build et démarrer
docker-compose -f docker-compose.prod.yml up -d --build

# Voir les logs
docker-compose -f docker-compose.prod.yml logs -f

# Redémarrer
docker-compose -f docker-compose.prod.yml restart

# Arrêter
docker-compose -f docker-compose.prod.yml down
```

---

## 🔎 Recherche et Debug

### Recherche dans le Code
```bash
# Rechercher un pattern
grep -r "pattern" backend/src

# Rechercher avec contexte
grep -r -C 3 "pattern" backend/src

# Rechercher des fichiers
find . -name "*.ts" -type f

# Rechercher et remplacer
find backend/src -type f -name "*.ts" -exec sed -i 's/old/new/g' {} \;
```

### Git
```bash
# Voir l'historique d'un fichier
git log --follow <file>

# Voir qui a modifié une ligne
git blame <file>

# Rechercher dans l'historique
git log --all --grep="search term"

# Voir les changements non committés
git diff

# Voir les changements staged
git diff --cached
```

---

## 📊 Monitoring et Métriques

### Logs
```bash
# Voir les logs backend en temps réel
cd backend && npm run dev | tee backend.log

# Analyser les erreurs
grep -i "error" backend.log

# Compter les requêtes
grep "Request" backend.log | wc -l
```

### Performance
```bash
# Analyser la taille des bundles
cd frontend && npm run build -- --analyze

# Mesurer le temps de build
time npm run build

# Profiler Node.js
node --prof backend/dist/main.js
```

### Healthcheck
```bash
# Vérifier le backend
curl http://localhost:3001/health

# Vérifier l'API
curl http://localhost:3001/api/health

# Vérifier Redis
redis-cli ping

# Vérifier Meilisearch
curl http://localhost:7700/health
```

---

## 🔐 Sécurité

### Audit
```bash
# Audit NPM
npm audit

# Audit avec rapport détaillé
npm audit --json > audit-report.json

# Vérifier les secrets
./scripts/security-check.sh

# Analyser les licences
npx license-checker
```

### Variables d'environnement
```bash
# Valider les variables
node -e "require('dotenv').config(); console.log(process.env)"

# Générer un secret JWT
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Générer un secret de session
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📚 Documentation

### Génération
```bash
# Générer la doc TypeDoc (si configuré)
npm run docs

# Lister tous les scripts
npm run

# Voir les dépendances
npm list

# Arbre des dépendances
npm list --depth=0
```

### Consulter
```bash
# Lire un document
cat docs/CONSOLIDATION-GUIDE.md

# Rechercher dans la doc
grep -r "keyword" docs/

# Lister tous les docs
find docs -name "*.md"
```

---

## 🚀 Déploiement

### Préparation
```bash
# Build de production
NODE_ENV=production npm run build

# Tester la build
NODE_ENV=production npm run start:prod

# Vérifier la taille
du -sh backend/dist
```

### Déploiement
```bash
# Déployer backend
cd backend && npm run start:prod

# Avec PM2
pm2 start backend/dist/main.js --name api

# Voir les logs PM2
pm2 logs api

# Redémarrer
pm2 restart api
```

---

## 🔄 Maintenance

### Quotidienne
```bash
# Pull les derniers changements
git pull

# Vérifier les updates
npm outdated

# Audit de sécurité
npm audit
```

### Hebdomadaire
```bash
# Nettoyage rapide
./scripts/quick-cleanup.sh

# Mettre à jour les dépendances
npm update

# Analyser les dépendances inutilisées
npx depcheck
```

### Mensuelle
```bash
# Nettoyage complet
./scripts/secure-cleanup.sh

# Mise à jour majeure (avec précaution)
npx npm-check-updates -u
npm install
npm test

# Vérifier les licences
npx license-checker
```

---

## 🆘 Dépannage

### Problèmes Courants
```bash
# Erreur "Cannot find module"
rm -rf node_modules && npm install

# Port déjà utilisé
lsof -ti:3001 | xargs kill -9

# Prisma client obsolète
cd backend && npx prisma generate

# Cache corrompu
npm cache clean --force && rm -rf node_modules && npm install

# Erreurs TypeScript
rm -f tsconfig.tsbuildinfo && npm run build
```

### Restauration
```bash
# Restaurer depuis un backup de nettoyage
ls -la | grep backup
cp -r .cleanup-backup-XXXXXXX/* .

# Revenir en arrière (Git)
git checkout HEAD~1 <file>
git reset --hard HEAD~1

# Stash les changements
git stash
git stash pop
```

---

## 📞 Aide

### Documentation
- Guide de consolidation: `docs/CONSOLIDATION-GUIDE.md`
- Checklist sécurité: `docs/SECURITY-CHECKLIST.md`
- Scripts: `scripts/README.md`
- Getting started: `docs/GETTING-STARTED.md`

### Commandes d'aide
```bash
# Aide NPM
npm help <command>

# Aide Git
git help <command>

# Aide Docker
docker-compose help

# Scripts disponibles
npm run
```

---

**Dernière mise à jour**: 2025-10-06  
**Version**: 1.0.0

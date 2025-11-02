# 🚀 Guide de Démarrage Développement

## Architecture du Monorepo

Ce projet utilise une **architecture monorepo unifiée** où :

- **Backend NestJS** et **Frontend Remix** tournent sur le **même processus Node.js**
- **Port unique : 3000** pour tout (API + Interface)
- **Redis** en Docker pour les sessions

```
┌─────────────────────────────────────────────┐
│  localhost:3000                              │
│  ┌─────────────┐      ┌──────────────┐      │
│  │   NestJS    │◄─────┤ Remix Express│      │
│  │   Backend   │      │   Frontend   │      │
│  │   /api/*    │      │   /*         │      │
│  └─────────────┘      └──────────────┘      │
└─────────────────────────────────────────────┘
                  │
                  ▼
        ┌──────────────────┐
        │ Redis (Docker)   │
        │ Port 6379        │
        └──────────────────┘
```

## 🎯 Démarrage Rapide

### 1️⃣ Prérequis

```bash
# Node.js 20+
node --version

# Docker (pour Redis)
docker --version

# Packages installés
npm install
```

### 2️⃣ Démarrer Redis

```bash
# Lancer Redis en Docker
docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine

# Vérifier que Redis tourne
docker ps | grep redis
```

### 3️⃣ Démarrer le Monorepo

```bash
# À la racine du projet
npm run dev

# Cette commande lance :
# - Turbo pour orchestrer le build
# - TypeScript en mode watch
# - Nodemon pour le hot-reload
# - Backend NestJS sur port 3000
# - Frontend Remix servi par le backend
```

### 4️⃣ Vérifier que tout fonctionne

```bash
# Backend API
curl http://localhost:3000/api/health

# Frontend
curl http://localhost:3000/

# Redis
docker exec redis-dev redis-cli ping
# Doit retourner: PONG
```

## 📁 Structure des Fichiers

```
nestjs-remix-monorepo/
├── backend/               # NestJS API
│   ├── src/
│   │   └── main.ts       # ⭐ Point d'entrée (sert aussi Remix)
│   └── package.json      # Scripts: dev, build, start
├── frontend/             # Remix App
│   ├── app/
│   └── package.json
├── packages/             # Packages partagés
│   └── shared-types/
├── turbo.json           # Configuration Turbo
└── package.json         # ⭐ Scripts root (npm run dev)
```

## 🔧 Commandes Principales

### Développement

```bash
# Démarrer tout (recommandé)
npm run dev

# Démarrer uniquement le backend
cd backend && npm run dev

# Rebuild complet
npm run build

# Vérification des types
npm run typecheck

# Linter
npm run lint
```

### Docker

```bash
# Redis seul (dev)
docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine

# Arrêter Redis
docker stop redis-dev

# Logs Redis
docker logs -f redis-dev

# Build image production
docker build -t nestjs-remix-monorepo .

# Lancer en mode production
docker-compose -f docker-compose.prod.yml up -d
```

### Nettoyage

```bash
# Nettoyer les node_modules
npm run clean-node-modules

# Nettoyer le cache Turbo
npm run clean-turbo-cache

# Nettoyer les conteneurs Docker
docker stop $(docker ps -q) && docker rm $(docker ps -aq)
```

## 🐛 Résolution de Problèmes

### ❌ Erreur : "Port 3000 already in use"

```bash
# Trouver le processus
lsof -i :3000

# Tuer le processus
kill -9 <PID>

# Ou redémarrer proprement
# Ctrl+C dans le terminal npm
```

### ❌ Erreur : "Port 6379 already in use"

```bash
# Vérifier les conteneurs Redis
docker ps -a | grep redis

# Arrêter tous les Redis
docker stop $(docker ps -q --filter "name=redis")

# Nettoyer
docker container prune -f

# Relancer
docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine
```

### ❌ Erreur : "Redis connection failed"

```bash
# Vérifier que Redis tourne
docker ps | grep redis

# Si non, le démarrer
docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine

# Vérifier la connexion
docker exec redis-dev redis-cli ping
```

### ❌ Erreur : "MODULE_NOT_FOUND"

```bash
# Réinstaller les dépendances
npm install

# Rebuilder
npm run build
```

## 🌍 Variables d'Environnement

### Backend (.env)

```bash
# Base de données
DATABASE_URL=postgresql://...

# Supabase
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...

# Redis
REDIS_URL=redis://localhost:6379

# Session
SESSION_SECRET=<générer avec: openssl rand -base64 32>

# Node
NODE_ENV=development
PORT=3000
```

### Sécurité

⚠️ **IMPORTANT** : Ne jamais committer les fichiers `.env` !

```bash
# Vérifier que .env est ignoré
cat .gitignore | grep .env

# Copier le template
cp .env.example .env

# Éditer avec vos valeurs
nano .env
```

## 📊 Monitoring en Dev

### Vérifier les services actifs

```bash
# Script de vérification
echo "=== SERVICES ACTIFS ==="
echo ""
echo "Backend + Frontend (port 3000):"
lsof -i :3000 | grep LISTEN || echo "❌ Non actif"
echo ""
echo "Redis (port 6379):"
docker ps --filter "name=redis" --format "✅ {{.Names}} ({{.Status}})"
echo ""
echo "=== PROCESSUS NODE ==="
ps aux | grep "dist/main.js" | grep -v grep
```

### Logs en temps réel

```bash
# Backend (dans terminal npm)
# Les logs apparaissent automatiquement

# Redis
docker logs -f redis-dev

# Docker Compose (si utilisé)
docker-compose -f docker-compose.dev.yml logs -f
```

## 🚀 Mode Production

### Build

```bash
# Build de tout le monorepo
npm run build

# Vérifier que dist/ existe
ls -la backend/dist/
```

### Déploiement Docker

```bash
# Build l'image
docker build -t nestjs-remix-monorepo:production .

# Lancer avec docker-compose
docker-compose -f docker-compose.prod.yml up -d

# Vérifier
docker ps
docker logs -f nestjs-remix-monorepo-prod
```

### Avec Caddy (Reverse Proxy)

```bash
# Lancer le monorepo + Caddy
docker-compose -f docker-compose.prod.yml -f docker-compose.caddy.yml up -d

# Vérifier
curl http://localhost:80
curl https://localhost:443
```

## 📚 Ressources

- [Documentation NestJS](https://docs.nestjs.com/)
- [Documentation Remix](https://remix.run/docs)
- [Documentation Turbo](https://turbo.build/repo/docs)
- [Guide Docker](../guides/DOCKER-SETUP.md)
- [Architecture Caddy](../caddy/CADDY-README.md)

## 🆘 Besoin d'aide ?

1. Vérifier les logs : `docker logs -f <container>`
2. Vérifier les variables d'env : `.env` correctement configuré
3. Nettoyer et rebuilder : `npm run clean-node-modules && npm install && npm run build`
4. Consulter les issues GitHub du projet

---

**Dernière mise à jour** : 2 novembre 2025

# 🚀 Démarrage Rapide - Guide Complet

## ✅ Ce qui fonctionne maintenant

Votre application NestJS + Remix est **100% opérationnelle** avec :

- ✅ Backend NestJS sur port **3000**
- ✅ Frontend Remix servi par le backend
- ✅ Redis en Docker pour les sessions/cache
- ✅ Hot reload automatique (nodemon + tsc watch)
- ✅ Panier e-commerce fonctionnel
- ✅ Catalogue véhicules avec cache optimisé

---

## 📋 Prérequis

```bash
# Node.js 20+
node --version  # v20.x.x ou supérieur

# Docker
docker --version

# Packages installés
npm install  # À la racine du monorepo
```

---

## 🎯 Démarrage en 3 étapes

### 1️⃣ Démarrer Redis

```bash
# Nettoyer les anciens conteneurs (optionnel)
docker stop $(docker ps -a -q --filter "name=redis") 2>/dev/null || true

# Démarrer Redis
docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine

# Vérifier
docker ps | grep redis
```

**Résultat attendu** :
```
redis-dev   Up X seconds   0.0.0.0:6379->6379/tcp
```

### 2️⃣ Démarrer l'application

```bash
# À la racine du projet
npm run dev
```

**Ce qui se lance** :
- 🔄 TypeScript en mode watch (compilation automatique)
- 🔄 Nodemon pour le hot-reload
- 🚀 Backend NestJS (API + Express)
- 🎨 Frontend Remix (servi par le backend)

**Résultat attendu dans les logs** :
```
✅ Redis connecté
✅ Cache Redis prêt
🚀 Serveur opérationnel sur http://localhost:3000
```

### 3️⃣ Tester l'application

```bash
# Backend API
curl http://localhost:3000/api/health

# Frontend
open http://localhost:3000

# Ou avec curl
curl http://localhost:3000
```

---

## 🔍 Vérification de l'état

### Script automatique

```bash
# Utiliser le script de vérification
./scripts/dev-status.sh
```

### Vérification manuelle

```bash
# Port 3000 (Backend + Frontend)
lsof -i :3000

# Port 6379 (Redis)
docker ps | grep redis

# Connexion Redis
docker exec redis-dev redis-cli ping
# Résultat : PONG
```

---

## 🛑 Arrêter les services

```bash
# Arrêter le backend (dans le terminal npm)
Ctrl + C

# Arrêter Redis
docker stop redis-dev

# Ou tout arrêter d'un coup
docker stop $(docker ps -q) && pkill -f "dist/main.js"
```

---

## 🐛 Résolution de Problèmes

### Problème : Redis connection refused

**Symptôme** :
```
ERROR [CacheService] ❌ Redis connection error
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution** :
```bash
# Démarrer Redis
docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine

# Le backend se reconnectera automatiquement
# Vous verrez : ✅ Connected to Redis
```

### Problème : Port 3000 already in use

**Symptôme** :
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution** :
```bash
# Trouver le processus
lsof -i :3000

# Tuer le processus
kill -9 <PID>

# Ou redémarrer proprement
pkill -f "dist/main.js" && npm run dev
```

### Problème : Module not found

**Symptôme** :
```
Error: Cannot find module '@fafa/frontend'
```

**Solution** :
```bash
# Réinstaller les dépendances
npm install

# Rebuilder
npm run build

# Relancer
npm run dev
```

### Problème : TypeScript errors

**Symptôme** :
```
error TS2307: Cannot find module...
```

**Solution** :
```bash
# Nettoyer le cache TypeScript
rm -rf backend/dist backend/tsconfig.tsbuildinfo

# Rebuilder
cd backend && npm run build

# Relancer
npm run dev
```

---

## 📊 Logs & Monitoring

### Voir les logs en temps réel

```bash
# Backend (dans le terminal npm)
# Les logs apparaissent automatiquement

# Redis
docker logs -f redis-dev

# Filtrer les erreurs uniquement
docker logs redis-dev 2>&1 | grep ERROR
```

### Logs utiles du backend

```bash
# Sessions
grep "Session" backend/logs/*.log

# Cache Redis
grep "Redis" backend/logs/*.log

# Erreurs
grep "ERROR" backend/logs/*.log
```

---

## 🎨 Fonctionnalités Actives

### ✅ E-commerce
- Catalogue véhicules (19 familles testées)
- Panier persistant (Redis)
- Gestion stock
- Prix TTC
- Cross-selling

### ✅ Performance
- Cache Redis (900s pour catalogue)
- Lazy loading
- Hot reload dev

### ✅ SEO
- Fil d'Ariane dynamique
- Meta tags optimisés
- Sitemap
- Robots.txt

---

## 🔧 Configuration

### Variables d'environnement

```bash
# Backend (.env)
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
REDIS_URL=redis://localhost:6379
SESSION_SECRET=<openssl rand -base64 32>
NODE_ENV=development
PORT=3000
```

### Architecture

```
Port 3000 (NestJS Express)
├── /api/*          → Backend NestJS
│   ├── /api/catalog      (Catalogue)
│   ├── /api/cart         (Panier)
│   ├── /api/vehicles     (Véhicules)
│   └── /api/blog         (Blog)
└── /*              → Frontend Remix
    ├── /             (Homepage)
    ├── /catalog      (Catalogue)
    └── /cart         (Panier)
```

---

## 📚 Ressources

- **Architecture complète** : `docs/architecture/DEVELOPMENT-SETUP.md`
- **Docker** : `docs/guides/DOCKER-SETUP.md`
- **Tests** : `scripts/testing/README.md`
- **Scripts utiles** : `scripts/README.md`

---

## ✅ Checklist de Démarrage

- [ ] Node.js 20+ installé
- [ ] Docker installé
- [ ] Dépendances installées (`npm install`)
- [ ] Redis démarré (`docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine`)
- [ ] Application démarrée (`npm run dev`)
- [ ] Tests passés (`curl http://localhost:3000/api/health`)
- [ ] Frontend accessible (`open http://localhost:3000`)

---

**🎉 Vous êtes prêt à développer !**

Pour toute question, consultez :
- `./scripts/dev-status.sh` - Vérifier l'état
- `./scripts/dev-start.sh` - Démarrer avec assistance
- `docs/architecture/DEVELOPMENT-SETUP.md` - Guide complet

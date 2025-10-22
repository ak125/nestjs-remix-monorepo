# 🚀 Configuration Caddy - NestJS Remix Monorepo

Guide complet pour la configuration et le déploiement de Caddy comme reverse proxy pour votre application NestJS + Remix.

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Structure des fichiers](#structure-des-fichiers)
- [Installation](#installation)
- [Configuration](#configuration)
- [Déploiement](#déploiement)
- [Gestion des redirections SEO](#gestion-des-redirections-seo)
- [Surveillance et logs](#surveillance-et-logs)
- [Dépannage](#dépannage)

---

## 🎯 Vue d'ensemble

Caddy sert de reverse proxy entre Internet et votre application monorepo, gérant :

- ✅ **Certificats SSL automatiques** (Let's Encrypt)
- ✅ **Redirections SEO 301** pour les URLs de pièces auto
- ✅ **Routing intelligent** (API → Backend, Pages → Frontend)
- ✅ **Compression** (gzip, zstd)
- ✅ **Cache optimisé** pour assets statiques
- ✅ **Headers de sécurité**
- ✅ **HTTP/3** et QUIC

## 📁 Structure des fichiers

```
.
├── Caddyfile                        # Configuration production
├── Caddyfile.dev                    # Configuration développement
├── docker-compose.caddy.yml         # Service Docker pour Caddy
├── scripts/
│   └── generate-caddy-config.sh     # Générateur de redirections
└── caddy-pieces-redirects.conf      # Redirections générées (créé auto)
```

## 🚀 Installation

### Option 1 : Avec Docker Compose (Recommandé)

```bash
# Démarrer Caddy avec le reste de l'infrastructure
docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml up -d

# Ou en développement
docker compose -f docker-compose.dev.yml -f docker-compose.caddy.yml up -d
```

### Option 2 : Installation native

#### Ubuntu/Debian
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

#### macOS
```bash
brew install caddy
```

## ⚙️ Configuration

### 1. Configuration de base

Éditez `Caddyfile` et remplacez les valeurs suivantes :

```caddyfile
# Remplacer
your-domain.com {
    # Votre email pour Let's Encrypt
    email admin@your-domain.com
    
    # ...
}

# Par exemple
pieces-auto.fr {
    email contact@pieces-auto.fr
    # ...
}
```

### 2. Adapter les noms de services

Si vos services Docker ont des noms différents, ajustez les directives `reverse_proxy` :

```caddyfile
# Backend API
handle @api {
    reverse_proxy backend:3000  # Remplacer par le nom de votre service
}

# Frontend
handle {
    reverse_proxy frontend:3000  # Remplacer par le nom de votre service
}
```

### 3. Configuration des headers de sécurité

En **production**, activez HSTS en décommentant :

```caddyfile
header {
    # Activer en production SEULEMENT
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
}
```

⚠️ **Attention** : Ne jamais activer HSTS en développement !

## 🎯 Déploiement

### Développement

```bash
# Avec Docker
docker compose -f docker-compose.dev.yml -f docker-compose.caddy.yml up -d

# Ou natif
caddy run --config Caddyfile.dev
```

Accès : http://localhost

### Production

1. **Validation de la configuration**

```bash
# Tester la configuration
caddy validate --config Caddyfile

# Ou avec Docker
docker compose -f docker-compose.caddy.yml config
```

2. **Backup de la configuration existante**

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup.$(date +%Y%m%d)
```

3. **Déploiement**

```bash
# Avec Docker
docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml up -d

# Ou natif
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

4. **Vérification**

```bash
# Status du service
sudo systemctl status caddy

# Logs en temps réel
sudo journalctl -u caddy -f

# Ou avec Docker
docker logs -f nestjs-remix-caddy
```

## 🔄 Gestion des redirections SEO

### Génération automatique

Le script génère automatiquement les règles de redirection 301 pour vos pièces auto :

```bash
# Toutes les catégories
./scripts/generate-caddy-config.sh

# Une catégorie spécifique
./scripts/generate-caddy-config.sh filtres

# Avec Docker (via profil tools)
docker compose --profile tools run caddy-config-generator
```

### Intégration dans Caddyfile

Le script génère `caddy-pieces-redirects.conf`. Intégrez-le dans votre `Caddyfile` :

```caddyfile
your-domain.com {
    # Import des redirections générées
    import /etc/caddy/redirects.conf
    
    # ... reste de la configuration
}
```

### Test des redirections

```bash
# Test manuel
curl -I "https://your-domain.com/pieces/ancien-slug/page.html"

# Devrait retourner
# HTTP/2 301
# location: https://your-domain.com/pieces/nouveau-slug
```

## 📊 Surveillance et logs

### Logs disponibles

```bash
# Logs Caddy (Docker)
docker logs nestjs-remix-caddy

# Logs détaillés dans le volume
tail -f logs/caddy/your-domain.log

# Logs natifs
sudo journalctl -u caddy -f
```

### Monitoring

```bash
# API Admin Caddy (port 2019)
curl http://localhost:2019/config/

# Métriques Prometheus (si activées)
curl http://localhost:2019/metrics
```

### Health checks

```bash
# Backend
curl http://your-domain.com/api/health

# Frontend
curl http://your-domain.com/health
```

## 🔧 Dépannage

### Problème : Certificats SSL non générés

**Symptômes** : Erreur "certificate not found"

**Solutions** :
```bash
# Vérifier les logs
docker logs nestjs-remix-caddy | grep -i "certificate"

# Vérifier les ports 80/443
sudo netstat -tulpn | grep -E ':(80|443)'

# Forcer le renouvellement
docker exec nestjs-remix-caddy caddy reload --force
```

### Problème : 502 Bad Gateway

**Symptômes** : Caddy retourne 502

**Solutions** :
```bash
# Vérifier que les services sont up
docker ps

# Tester la connectivité interne
docker exec nestjs-remix-caddy wget -O- http://monorepo_prod:3000/health

# Vérifier les logs du backend
docker logs monorepo_prod
```

### Problème : Redirections ne fonctionnent pas

**Symptômes** : Les anciennes URLs ne redirigent pas

**Solutions** :
```bash
# Régénérer les règles
./scripts/generate-caddy-config.sh

# Vérifier que le fichier est monté
docker exec nestjs-remix-caddy cat /etc/caddy/redirects.conf

# Recharger Caddy
docker exec nestjs-remix-caddy caddy reload
```

### Problème : Performance lente

**Solutions** :
```bash
# Activer le cache navigateur
# Dans Caddyfile, ajouter :
header @static {
    Cache-Control "public, max-age=31536000, immutable"
}

# Activer HTTP/3
# Déjà activé par défaut dans docker-compose.caddy.yml (port 443/udp)
```

## 📚 Ressources

- [Documentation officielle Caddy](https://caddyserver.com/docs/)
- [Exemples Caddyfile](https://github.com/caddyserver/examples)
- [Forum Caddy](https://caddy.community/)

## 🔐 Sécurité

### Checklist production

- [ ] Email Let's Encrypt configuré
- [ ] HSTS activé (après validation SSL)
- [ ] Headers de sécurité configurés
- [ ] Admin API sécurisée (localhost uniquement)
- [ ] Logs rotés automatiquement
- [ ] Backup réguliers de `/data` et `/config`

### Hardening

```caddyfile
# Dans votre Caddyfile
{
    # Désactiver l'API admin en production
    admin off
}
```

## 🚨 Support

En cas de problème :

1. Vérifiez les logs : `docker logs nestjs-remix-caddy`
2. Testez la config : `caddy validate --config Caddyfile`
3. Consultez la documentation : https://caddyserver.com/docs/
4. Ouvrez une issue sur le repo

---

**Dernière mise à jour** : 21 octobre 2025

# 🚀 Guide de Déploiement Caddy - Dev vers Production

## 📋 Situation actuelle

- ✅ **Serveur DEV** : Configuration Caddy créée et testée
- 🎯 **Objectif** : Déployer Caddy sur le serveur de PRODUCTION

---

## 🔄 Étape 1 : Préparer les fichiers sur DEV

### 1.1 Personnaliser le Caddyfile pour PRODUCTION

Éditez `/workspaces/nestjs-remix-monorepo/Caddyfile` :

```bash
# Remplacer ces valeurs :
your-domain.com          → pieces-auto.fr (votre domaine réel)
admin@your-domain.com    → contact@pieces-auto.fr (votre email)
```

**À modifier dans le Caddyfile :**

```caddyfile
{
    # Email pour certificats Let's Encrypt
    email contact@votredomaine.fr  # ← Votre vrai email
    
    # ...
}

# Votre domaine réel
votredomaine.fr {
    # ...
}

www.votredomaine.fr {
    redir https://votredomaine.fr{uri} permanent
}
```

### 1.2 Générer les redirections SEO (optionnel)

Si votre backend est démarré sur DEV :

```bash
cd /workspaces/nestjs-remix-monorepo
./scripts/generate-caddy-config.sh

# Vérifie que le fichier est créé
ls -lh caddy-pieces-redirects.conf
```

### 1.3 Créer une archive de déploiement

```bash
cd /workspaces/nestjs-remix-monorepo

# Créer un tar avec les fichiers Caddy uniquement
tar -czf caddy-deploy.tar.gz \
    Caddyfile \
    docker-compose.caddy.yml \
    caddy-pieces-redirects.conf \
    scripts/generate-caddy-config.sh \
    CADDY-README.md

# Vérifier l'archive
tar -tzf caddy-deploy.tar.gz
```

---

## 📤 Étape 2 : Transférer vers PRODUCTION

### Option A : Via SCP (recommandé)

```bash
# Depuis le serveur DEV
scp caddy-deploy.tar.gz user@serveur-prod:/tmp/

# Ou si vous utilisez une clé SSH
scp -i ~/.ssh/prod_key caddy-deploy.tar.gz user@serveur-prod:/tmp/
```

### Option B : Via Git

```bash
# Commiter les fichiers Caddy
git add Caddyfile docker-compose.caddy.yml scripts/
git commit -m "feat: Add Caddy reverse proxy configuration"
git push origin main

# Puis sur PROD :
# git pull origin main
```

### Option C : Via rsync

```bash
# Synchroniser seulement les fichiers Caddy
rsync -avz --include='Caddyfile*' \
           --include='docker-compose.caddy.yml' \
           --include='scripts/' \
           /workspaces/nestjs-remix-monorepo/ \
           user@serveur-prod:/path/to/app/
```

---

## 🖥️ Étape 3 : Sur le serveur PRODUCTION

### 3.1 Connexion au serveur PROD

```bash
ssh user@serveur-prod
cd /path/to/nestjs-remix-monorepo
```

### 3.2 Extraire les fichiers (si tar)

```bash
tar -xzf /tmp/caddy-deploy.tar.gz
```

### 3.3 Vérifier la configuration

```bash
# Vérifier que les fichiers sont présents
ls -l Caddyfile docker-compose.caddy.yml

# Afficher le Caddyfile pour vérifier
cat Caddyfile | head -30
```

### 3.4 Dernières modifications AVANT démarrage

**IMPORTANT :** Vérifiez ces points :

```bash
# 1. Votre domaine est-il correct ?
grep "your-domain.com" Caddyfile
# Si oui → REMPLACER par votre vrai domaine

# 2. Email Let's Encrypt configuré ?
grep "email" Caddyfile
# Doit contenir votre vrai email

# 3. Le service monorepo_prod existe ?
docker ps | grep monorepo
```

### 3.5 Configuration DNS ⚠️ CRITIQUE

**AVANT de démarrer Caddy**, vérifiez que votre DNS pointe vers le serveur PROD :

```bash
# Tester la résolution DNS
nslookup votredomaine.fr

# Doit retourner l'IP de votre serveur PROD
# Si non → Configurez votre DNS d'abord !
```

### 3.6 Ouvrir les ports firewall

```bash
# Ubuntu/Debian avec UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp  # HTTP/3

# Vérifier
sudo ufw status

# Ou avec iptables
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 443 -j ACCEPT
```

---

## 🚀 Étape 4 : Démarrage sur PRODUCTION

### 4.1 Vérifier que l'app est déjà up

```bash
# L'application doit tourner AVANT Caddy
docker compose -f docker-compose.prod.yml ps

# Si pas démarrée :
docker compose -f docker-compose.prod.yml up -d
```

### 4.2 Démarrer Caddy

```bash
# Démarrer Caddy en mode production
docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml up -d

# Vérifier les logs en temps réel
docker logs -f nestjs-remix-caddy
```

**Ce que vous devez voir dans les logs :**

```
✅ "certificate obtained successfully"
✅ "serving initial configuration"
```

### 4.3 Vérifier les conteneurs

```bash
# Tous les services doivent être "Up"
docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml ps

# Devrait afficher :
# nestjs-remix-caddy       Up (healthy)
# nestjs-remix-monorepo-prod   Up
# redis_prod                   Up
```

---

## ✅ Étape 5 : Tests de validation

### 5.1 Test HTTP → HTTPS redirect

```bash
# Depuis votre machine locale (pas le serveur)
curl -I http://votredomaine.fr

# Doit retourner :
# HTTP/1.1 308 Permanent Redirect
# Location: https://votredomaine.fr/
```

### 5.2 Test HTTPS avec certificat

```bash
curl -I https://votredomaine.fr

# Doit retourner :
# HTTP/2 200
# (pas d'erreur SSL)
```

### 5.3 Test du health check

```bash
curl https://votredomaine.fr/health

# Doit retourner :
# {"status":"ok","timestamp":"...","uptime":...}
```

### 5.4 Test de l'API

```bash
curl https://votredomaine.fr/api/system/health

# Doit retourner des données JSON
```

### 5.5 Test du frontend

```bash
# Ouvrir dans un navigateur
https://votredomaine.fr

# La page d'accueil Remix doit s'afficher
```

---

## 🔧 Étape 6 : Activer HSTS (Après validation)

**⚠️ ATTENTION** : N'activez HSTS qu'après avoir confirmé que HTTPS fonctionne parfaitement !

```bash
# Éditer le Caddyfile sur PROD
nano Caddyfile

# Décommenter cette ligne :
Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"

# Recharger Caddy
docker exec nestjs-remix-caddy caddy reload
```

---

## 📊 Surveillance continue

### Vérifier les logs

```bash
# Logs Caddy
docker logs -f nestjs-remix-caddy

# Logs de l'application
docker logs -f nestjs-remix-monorepo-prod

# Logs sur le filesystem
tail -f logs/caddy/*.log
```

### Vérifier les certificats

```bash
# Lister les certificats
docker exec nestjs-remix-caddy ls -la /data/caddy/certificates/

# Expiration des certificats (Let's Encrypt = 90 jours)
# Caddy renouvelle automatiquement à 30 jours
```

---

## 🚨 Dépannage

### Problème : "certificate obtain failed"

**Causes possibles :**

1. DNS ne pointe pas vers le serveur
2. Ports 80/443 fermés
3. Email invalide dans le Caddyfile

**Solutions :**

```bash
# 1. Vérifier DNS
nslookup votredomaine.fr

# 2. Vérifier ports
sudo netstat -tulpn | grep -E ':(80|443)'

# 3. Logs détaillés
docker logs nestjs-remix-caddy 2>&1 | grep -i error
```

### Problème : 502 Bad Gateway

**Causes :**

- L'application `monorepo_prod` n'est pas démarrée
- Mauvais nom de service dans Caddyfile

**Solutions :**

```bash
# Vérifier que l'app tourne
docker ps | grep monorepo_prod

# Tester la connectivité interne
docker exec nestjs-remix-caddy wget -O- http://monorepo_prod:3000/health
```

### Problème : Redirections ne marchent pas

```bash
# Vérifier que le fichier est monté
docker exec nestjs-remix-caddy cat /etc/caddy/redirects.conf

# Régénérer les redirections
./scripts/generate-caddy-config.sh

# Recharger Caddy
docker exec nestjs-remix-caddy caddy reload
```

---

## 📋 Checklist finale PRODUCTION

```
✅ DNS configuré et pointe vers le serveur PROD
✅ Ports 80/443/443udp ouverts dans le firewall  
✅ Domaine remplacé dans Caddyfile
✅ Email Let's Encrypt configuré
✅ Application monorepo_prod démarrée
✅ Caddy démarré avec certificat SSL valide
✅ HTTP redirige vers HTTPS
✅ Health check répond
✅ Frontend accessible
✅ API fonctionnelle
✅ Logs surveillés
✅ HSTS activé (après validation)
```

---

## 🔄 Workflow de mise à jour

Pour les futures mises à jour :

```bash
# 1. Sur DEV : Modifier et tester
nano Caddyfile
docker compose -f docker-compose.dev.yml -f docker-compose.caddy.yml restart caddy

# 2. Transférer vers PROD
scp Caddyfile user@serveur-prod:/path/to/app/

# 3. Sur PROD : Recharger sans downtime
docker exec nestjs-remix-caddy caddy reload

# Ou redémarrer si changement majeur
docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml restart caddy
```

---

**Bonne chance avec votre déploiement ! 🚀**

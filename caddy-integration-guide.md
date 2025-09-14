# 🔄 CONFIGURATION CADDY - MIGRATION URLS PIÈCES

**Date:** 14 septembre 2025  
**Serveur:** Caddy v2  
**Objectif:** Redirections 301 SEO pour migration URLs pièces auto  

---

## 🎯 CONFIGURATION CADDY RECOMMANDÉE

### 📋 Caddyfile Principal
```caddy
# Site principal
your-domain.com {
    # ===== REDIRECTIONS 301 PIÈCES AUTO =====
    # Générées automatiquement par le système de migration
    
    # Filtres
    redir /pieces/filtre-a-huile-7/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/filtres 301
    redir /pieces/filtre-a-air-8/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/filtres 301
    redir /pieces/filtre-d-habitacle-424/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/filtres 301
    redir /pieces/filtre-a-gasoil-9/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/filtres 301

    # Freinage
    redir /pieces/plaquettes-de-frein-15/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/freinage 301
    redir /pieces/disques-de-frein-16/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/freinage 301
    redir /pieces/etriers-de-frein-17/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/freinage 301

    # Échappement
    redir /pieces/pot-d-echappement-25/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/echappement 301
    redir /pieces/catalyseur-26/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/echappement 301
    redir /pieces/silencieux-27/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/echappement 301

    # Suspension
    redir /pieces/amortisseurs-35/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/suspension 301
    redir /pieces/ressorts-36/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/suspension 301
    redir /pieces/silent-blocs-37/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/suspension 301

    # Éclairage
    redir /pieces/ampoules-45/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/eclairage 301
    redir /pieces/phares-46/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/eclairage 301
    redir /pieces/feux-arriere-47/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/eclairage 301

    # Carrosserie
    redir /pieces/pare-chocs-55/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/carrosserie 301
    redir /pieces/retroviseurs-56/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/carrosserie 301
    redir /pieces/portieres-57/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/carrosserie 301

    # ===== REVERSE PROXY VERS REMIX =====
    # Toutes les autres requêtes vers votre app Remix
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # ===== GESTION DES ERREURS =====
    handle_errors {
        @404 {
            expression {http.error.status_code} == 404
        }
        redir @404 /404 302
    }

    # ===== LOGGING =====
    log {
        output file /var/log/caddy/pieces-redirects.log
        format console
    }

    # ===== HEADERS SÉCURITÉ =====
    header {
        X-Frame-Options DENY
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
        Permissions-Policy camera=(), microphone=(), geolocation=()
    }
}

# ===== BACK-OFFICE (vos URLs /core/) =====
admin.your-domain.com {
    # Vos règles back-office existantes...
    
    # Accès
    redir /core/accessRequest /core/get.access.php 301
    redir /core/out /core/get.out.php 301
    redir /core/denied /core/index.php?denied=err 301
    redir /core/expired /core/index.php?expired=err 301
    redir /core/suspended /core/index.php?suspended=err 301
    redir /core/welcome /core/welcome.php 301

    # SEO
    redir /core/seo /core/_seo/index.php 301
    redir /core/seo/sitemap /core/_seo/sitemap.index.php 301
    
    # Routes dynamiques SEO
    handle_path /core/seo/sitemap/* {
        rewrite * /core/_seo/{path}
    }
    
    # Autres modules...
    redir /core/expedition /core/_expedition/index.php 301
    redir /core/commercial /core/_commercial/index.php 301
    redir /core/payment /core/_payment/index.php 301
    redir /core/staff /core/_staff/index.php 301

    # Proxy vers votre backend PHP
    reverse_proxy localhost:8080
}
```

---

## 🔧 CONFIGURATION AVANCÉE CADDY

### 📊 Gestion Intelligente des Redirections
```caddy
# Configuration avec matchers avancés
your-domain.com {
    # Matcher pour anciennes URLs pièces
    @legacy_pieces {
        path_regexp pieces ^/pieces/([^/]*-\d+)/([^/]*-\d+)/([^/]*-\d+)/([^/]*-\d+)\.html$
    }
    
    # Redirection dynamique via API
    handle @legacy_pieces {
        reverse_proxy localhost:3000/api/vehicles/migration/redirect{uri} {
            header_up Host {host}
        }
    }

    # Fallback pour nouveaux URLs
    handle_path /pieces/* {
        reverse_proxy localhost:3000
    }
    
    # Autres routes...
    handle {
        reverse_proxy localhost:3000
    }
}
```

### 🚀 Configuration avec Cache
```caddy
your-domain.com {
    # Cache pour les assets statiques
    @static {
        path *.css *.js *.png *.jpg *.svg *.woff2
    }
    handle @static {
        header Cache-Control "public, max-age=31536000, immutable"
        reverse_proxy localhost:3000
    }

    # Cache pour redirections (courte durée)
    @pieces_redirects {
        path /pieces/*
        method GET
    }
    handle @pieces_redirects {
        header Cache-Control "public, max-age=3600"
        # Vos redirections ici...
    }

    # Pas de cache pour l'admin
    @admin {
        path /core/*
    }
    handle @admin {
        header Cache-Control "no-cache, no-store, must-revalidate"
        reverse_proxy localhost:8080
    }
}
```

---

## 🔧 SCRIPT GÉNÉRATEUR POUR CADDY

Créons un script qui génère automatiquement la config Caddy :

```bash
#!/bin/bash
# generate-caddy-config.sh

echo "🔄 Génération configuration Caddy..."

# En-tête du fichier
cat << 'EOF'
# 🔄 Configuration générée automatiquement - $(date)
# Redirections 301 pour migration URLs pièces auto

your-domain.com {
    # ===== REDIRECTIONS 301 PIÈCES AUTO =====
EOF

# Générer les redirections via notre API
echo "    # Filtres"
curl -s "http://localhost:3000/api/vehicles/migration/generate-caddy-rules?category=filtres" | jq -r '.rules[]'

echo "    # Freinage" 
curl -s "http://localhost:3000/api/vehicles/migration/generate-caddy-rules?category=freinage" | jq -r '.rules[]'

echo "    # Échappement"
curl -s "http://localhost:3000/api/vehicles/migration/generate-caddy-rules?category=echappement" | jq -r '.rules[]'

# ... autres catégories

# Fin du fichier
cat << 'EOF'
    
    # ===== REVERSE PROXY =====
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
EOF
```

---

## 📋 COMMANDES DE DÉPLOIEMENT CADDY

### 1. Installation et Configuration
```bash
# Backup config actuelle
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup

# Générer nouvelle config
cd /workspaces/nestjs-remix-monorepo
./scripts/generate-caddy-config.sh > caddy-pieces-redirects.conf

# Valider la configuration
caddy validate --config caddy-pieces-redirects.conf

# Appliquer la configuration
sudo cp caddy-pieces-redirects.conf /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### 2. Monitoring et Logs
```bash
# Surveiller les redirections en temps réel
tail -f /var/log/caddy/pieces-redirects.log | grep "301\|302"

# Status Caddy
sudo systemctl status caddy

# Rechargement à chaud
sudo caddy reload --config /etc/caddy/Caddyfile
```

### 3. Tests de Validation
```bash
# Test redirection spécifique
curl -I "https://your-domain.com/pieces/filtre-a-huile-7/audi-22/a7-sportback-22059/3-0-tfsi-quattro-34940.html"

# Doit retourner:
# HTTP/2 301 
# location: /pieces/audi-22/a7-sportback-22059/type-34940/filtres
```

---

## 🎯 AVANTAGES CADDY vs NGINX

### ✅ **Simplicité**
- Configuration **human-readable**
- **Automatisation SSL** Let's Encrypt  
- **Rechargement à chaud** sans interruption

### ✅ **Performance**
- **HTTP/2 natif** avec server push
- **Compression automatique** gzip/brotli
- **Cache intelligent** intégré

### ✅ **Sécurité**
- **HTTPS par défaut** obligatoire
- **Headers sécurisés** automatiques
- **Protection DDoS** basique incluse

### ✅ **Maintenance**
- **Logs structurés** JSON natif
- **Métriques Prometheus** intégrées  
- **API admin** pour monitoring

---

## 📊 EXEMPLE CONFIGURATION COMPLÈTE

```caddy
# Site principal avec redirections optimisées
your-domain.com {
    # ===== REDIRECTIONS PIECES AUTO =====
    redir /pieces/filtre-a-huile-7/* /pieces/{1}/filtres 301
    redir /pieces/filtre-a-air-8/* /pieces/{1}/filtres 301
    redir /pieces/plaquettes-de-frein-15/* /pieces/{1}/freinage 301
    # ... 20+ autres redirections

    # ===== GESTION STATIQUE =====
    handle_path /assets/* {
        root * /var/www/assets
        file_server
    }

    # ===== API BACKEND =====
    handle_path /api/* {
        reverse_proxy localhost:3000
    }

    # ===== FRONTEND REMIX =====
    handle {
        reverse_proxy localhost:3000 {
            # Headers optimisés
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-Proto {scheme}
            
            # Health check
            health_uri /health
            health_interval 30s
        }
    }

    # ===== LOGGING AVANCÉ =====
    log {
        output file /var/log/caddy/access.log {
            roll_size 100mb
            roll_keep 5
        }
        format json {
            time_format "2006-01-02T15:04:05Z07:00"
            message_key "msg"
        }
        level INFO
    }

    # ===== SÉCURITÉ =====
    header {
        X-Frame-Options SAMEORIGIN
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
        X-XSS-Protection "1; mode=block"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    }
}

# Redirection www vers apex
www.your-domain.com {
    redir https://your-domain.com{uri} permanent
}
```

---

## 🚀 DÉPLOIEMENT IMMÉDIAT

Votre configuration Caddy est **prête à déployer** ! Plus simple et plus moderne que Nginx pour vos redirections SEO.

Voulez-vous que je créé l'endpoint dans notre API pour générer automatiquement les règles Caddy ?
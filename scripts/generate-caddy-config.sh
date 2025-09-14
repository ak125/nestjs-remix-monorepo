#!/bin/bash
# 🔄 Générateur de configuration Caddy pour redirections URLs pièces
# Date: 14 septembre 2025
# Usage: ./generate-caddy-config.sh [category]

set -e

echo "🔄 Génération configuration Caddy pour redirections pièces auto..."

# Configuration
API_BASE_URL="http://localhost:3000/api/vehicles/migration"
OUTPUT_FILE="caddy-pieces-redirects.conf"
CATEGORY_FILTER="${1:-}"

# Vérifier que l'API est accessible
echo "🧪 Test de connectivité API..."
if ! curl -s "${API_BASE_URL}/stats" > /dev/null; then
    echo "❌ Erreur: API non accessible à ${API_BASE_URL}"
    echo "   Assurez-vous que le backend NestJS est démarré"
    exit 1
fi

echo "✅ API accessible"

# Construire l'URL avec filtre optionnel
CADDY_RULES_URL="${API_BASE_URL}/generate-caddy-rules"
if [ -n "$CATEGORY_FILTER" ]; then
    CADDY_RULES_URL="${CADDY_RULES_URL}?category=${CATEGORY_FILTER}"
    echo "🎯 Génération pour catégorie: ${CATEGORY_FILTER}"
else
    echo "🎯 Génération pour toutes les catégories"
fi

# Générer la configuration
echo "🔧 Génération des règles Caddy..."

# En-tête du fichier
cat > "$OUTPUT_FILE" << EOF
# 🔄 Configuration Caddy générée automatiquement
# Date: $(date '+%Y-%m-%d %H:%M:%S')
# Redirections 301 pour migration URLs pièces auto
$([ -n "$CATEGORY_FILTER" ] && echo "# Catégorie filtrée: $CATEGORY_FILTER")

your-domain.com {
    # ===== REDIRECTIONS 301 PIÈCES AUTO =====
EOF

# Récupérer et ajouter les règles
echo "📥 Récupération des règles via API..."
RESPONSE=$(curl -s "$CADDY_RULES_URL")

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de la récupération des règles"
    exit 1
fi

# Extraire les règles du JSON
echo "$RESPONSE" | jq -r '.caddy_config' >> "$OUTPUT_FILE"

# Pied de page du fichier
cat >> "$OUTPUT_FILE" << 'EOF'

    # ===== REVERSE PROXY VERS REMIX =====
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        
        # Health check
        health_uri /health
        health_interval 30s
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
        output file /var/log/caddy/pieces-redirects.log {
            roll_size 100mb
            roll_keep 5
        }
        format json {
            time_format "2006-01-02T15:04:05Z07:00"
            message_key "msg"
        }
        level INFO
    }

    # ===== HEADERS SÉCURITÉ =====
    header {
        X-Frame-Options SAMEORIGIN
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
        X-XSS-Protection "1; mode=block"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    }

    # ===== CACHE OPTIMISÉ =====
    @static {
        path *.css *.js *.png *.jpg *.svg *.woff2 *.ico
    }
    handle @static {
        header Cache-Control "public, max-age=31536000, immutable"
        reverse_proxy localhost:3000
    }
}

# Redirection www vers apex
www.your-domain.com {
    redir https://your-domain.com{uri} permanent
}
EOF

# Statistiques
RULES_COUNT=$(echo "$RESPONSE" | jq -r '.total_rules')
CATEGORY_INFO=$(echo "$RESPONSE" | jq -r '.filter')

echo ""
echo "✅ Configuration générée avec succès!"
echo "📊 Statistiques:"
echo "   - Fichier: $OUTPUT_FILE"
echo "   - Règles générées: $RULES_COUNT"
echo "   - Filtre appliqué: $CATEGORY_INFO"
echo ""

# Instructions de déploiement
echo "🚀 Instructions de déploiement:"
echo "   1. Vérifier la configuration:"
echo "      caddy validate --config $OUTPUT_FILE"
echo ""
echo "   2. Backup de la config actuelle:"
echo "      sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup"
echo ""
echo "   3. Déployer la nouvelle configuration:"
echo "      sudo cp $OUTPUT_FILE /etc/caddy/Caddyfile"
echo "      sudo systemctl reload caddy"
echo ""
echo "   4. Vérifier les logs:"
echo "      tail -f /var/log/caddy/pieces-redirects.log"
echo ""

# Test de validation optionnel
if command -v caddy > /dev/null; then
    echo "🧪 Validation de la configuration..."
    if caddy validate --config "$OUTPUT_FILE"; then
        echo "✅ Configuration Caddy valide!"
    else
        echo "❌ Configuration Caddy invalide - vérifiez les erreurs ci-dessus"
        exit 1
    fi
else
    echo "⚠️  Caddy non installé - impossible de valider la configuration"
fi

# URL de test d'exemple
echo ""
echo "🔍 Test d'exemple après déploiement:"
echo "   curl -I \"https://your-domain.com/pieces/filtre-a-huile-7/audi-22/a7-sportback-22059/3-0-tfsi-quattro-34940.html\""
echo "   (Devrait retourner: HTTP/2 301 avec location: /pieces/audi-22/a7-sportback-22059/type-34940/filtres)"

echo ""
echo "🎯 Configuration Caddy prête pour le déploiement!"
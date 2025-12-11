#!/bin/bash
# ðŸ”„ GÃ©nÃ©rateur de configuration Caddy pour redirections URLs piÃ¨ces
# Date: 14 septembre 2025
# Usage: ./generate-caddy-config.sh [category]

set -e

echo "ðŸ”„ GÃ©nÃ©ration configuration Caddy pour redirections piÃ¨ces auto..."

# Configuration
API_BASE_URL="http://localhost:3000/api/vehicles/migration"
OUTPUT_FILE="caddy-pieces-redirects.conf"
CATEGORY_FILTER="${1:-}"

# VÃ©rifier que l'API est accessible
echo "ðŸ§ª Test de connectivitÃ© API..."
if ! curl -s "${API_BASE_URL}/stats" > /dev/null; then
    echo "âŒ Erreur: API non accessible Ã  ${API_BASE_URL}"
    echo "   Assurez-vous que le backend NestJS est dÃ©marrÃ©"
    exit 1
fi

echo "âœ… API accessible"

# Construire l'URL avec filtre optionnel
CADDY_RULES_URL="${API_BASE_URL}/generate-caddy-rules"
if [ -n "$CATEGORY_FILTER" ]; then
    CADDY_RULES_URL="${CADDY_RULES_URL}?category=${CATEGORY_FILTER}"
    echo "ðŸŽ¯ GÃ©nÃ©ration pour catÃ©gorie: ${CATEGORY_FILTER}"
else
    echo "ðŸŽ¯ GÃ©nÃ©ration pour toutes les catÃ©gories"
fi

# GÃ©nÃ©rer la configuration
echo "ðŸ”§ GÃ©nÃ©ration des rÃ¨gles Caddy..."

# En-tÃªte du fichier
cat > "$OUTPUT_FILE" << EOF
# ðŸ”„ Configuration Caddy gÃ©nÃ©rÃ©e automatiquement
# Date: $(date '+%Y-%m-%d %H:%M:%S')
# Redirections 301 pour migration URLs piÃ¨ces auto
$([ -n "$CATEGORY_FILTER" ] && echo "# CatÃ©gorie filtrÃ©e: $CATEGORY_FILTER")

your-domain.com {
    # ===== REDIRECTIONS 301 PIÃˆCES AUTO =====
EOF

# RÃ©cupÃ©rer et ajouter les rÃ¨gles
echo "ðŸ“¥ RÃ©cupÃ©ration des rÃ¨gles via API..."
RESPONSE=$(curl -s "$CADDY_RULES_URL")

if [ $? -ne 0 ]; then
    echo "âŒ Erreur lors de la rÃ©cupÃ©ration des rÃ¨gles"
    exit 1
fi

# Extraire les rÃ¨gles du JSON
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

    # ===== HEADERS SÃ‰CURITÃ‰ =====
    header {
        X-Frame-Options SAMEORIGIN
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
        X-XSS-Protection "1; mode=block"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    }

    # ===== CACHE OPTIMISÃ‰ =====
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
echo "âœ… Configuration gÃ©nÃ©rÃ©e avec succÃ¨s!"
echo "ðŸ“Š Statistiques:"
echo "   - Fichier: $OUTPUT_FILE"
echo "   - RÃ¨gles gÃ©nÃ©rÃ©es: $RULES_COUNT"
echo "   - Filtre appliquÃ©: $CATEGORY_INFO"
echo ""

# Instructions de dÃ©ploiement
echo "ðŸš€ Instructions de dÃ©ploiement:"
echo "   1. VÃ©rifier la configuration:"
echo "      caddy validate --config $OUTPUT_FILE"
echo ""
echo "   2. Backup de la config actuelle:"
echo "      sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup"
echo ""
echo "   3. DÃ©ployer la nouvelle configuration:"
echo "      sudo cp $OUTPUT_FILE /etc/caddy/Caddyfile"
echo "      sudo systemctl reload caddy"
echo ""
echo "   4. VÃ©rifier les logs:"
echo "      tail -f /var/log/caddy/pieces-redirects.log"
echo ""

# Test de validation optionnel
if command -v caddy > /dev/null; then
    echo "ðŸ§ª Validation de la configuration..."
    if caddy validate --config "$OUTPUT_FILE"; then
        echo "âœ… Configuration Caddy valide!"
    else
        echo "âŒ Configuration Caddy invalide - vÃ©rifiez les erreurs ci-dessus"
        exit 1
    fi
else
    echo "âš ï¸  Caddy non installÃ© - impossible de valider la configuration"
fi

# URL de test d'exemple
echo ""
echo "ðŸ” Test d'exemple aprÃ¨s dÃ©ploiement:"
echo "   curl -I \"https://your-domain.com/pieces/filtre-a-huile-7/audi-22/a7-sportback-22059/3-0-tfsi-quattro-34940.html\""
echo "   (Devrait retourner: HTTP/2 301 avec location: /pieces/audi-22/a7-sportback-22059/type-34940/filtres)"

echo ""
echo "ðŸŽ¯ Configuration Caddy prÃªte pour le dÃ©ploiement!"
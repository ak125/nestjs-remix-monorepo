#!/bin/bash
# sync-configs.sh - Synchroniser config/ vers racine (rollback d'urgence)
# Usage: ./scripts/sync-configs.sh [--reverse]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo "ðŸ”„ sync-configs.sh - Synchronisation des configurations"
echo "=================================================="

if [[ "$1" == "--reverse" ]]; then
  echo "âš ï¸  Mode REVERSE: Copie de la racine vers config/"
  echo "   (UtilisÃ© pour sauvegarder les configs aprÃ¨s modifications manuelles)"
  echo ""
  
  # Caddy
  if [[ -f "Caddyfile" ]]; then
    cp -v Caddyfile config/caddy/
  fi
  if [[ -f "Caddyfile.dev" ]]; then
    cp -v Caddyfile.dev config/caddy/
  fi
  
  # Cron
  if [[ -f "crontab" ]]; then
    cp -v crontab config/cron/
  fi
  if [[ -f "crontab.seo-monitor" ]]; then
    cp -v crontab.seo-monitor config/cron/
  fi
  
  # Vector
  if [[ -f "vector.toml" ]]; then
    cp -v vector.toml config/vector/
  fi
  if [[ -f "loki-config.yaml" ]]; then
    cp -v loki-config.yaml config/vector/
  fi
  if [[ -f "prometheus.yml" ]]; then
    cp -v prometheus.yml config/vector/
  fi
  if [[ -f ".env.vector" ]]; then
    cp -v .env.vector config/vector/
  fi
  
  echo ""
  echo "âœ… Synchronisation REVERSE terminÃ©e (racine â†’ config/)"
  
else
  echo "ðŸ“‹ Mode NORMAL: Copie de config/ vers la racine"
  echo "   (Rollback d'urgence si docker-compose ne fonctionne pas)"
  echo ""
  
  # Caddy
  if [[ -f "config/caddy/Caddyfile" ]]; then
    cp -v config/caddy/Caddyfile .
  fi
  if [[ -f "config/caddy/Caddyfile.dev" ]]; then
    cp -v config/caddy/Caddyfile.dev .
  fi
  
  # Cron
  if [[ -f "config/cron/crontab" ]]; then
    cp -v config/cron/crontab .
  fi
  if [[ -f "config/cron/crontab.seo-monitor" ]]; then
    cp -v config/cron/crontab.seo-monitor .
  fi
  
  # Vector
  if [[ -f "config/vector/vector.toml" ]]; then
    cp -v config/vector/vector.toml .
  fi
  if [[ -f "config/vector/loki-config.yaml" ]]; then
    cp -v config/vector/loki-config.yaml .
  fi
  if [[ -f "config/vector/prometheus.yml" ]]; then
    cp -v config/vector/prometheus.yml .
  fi
  if [[ -f "config/vector/.env.vector" ]]; then
    cp -v config/vector/.env.vector .
  fi
  
  echo ""
  echo "âœ… Synchronisation NORMALE terminÃ©e (config/ â†’ racine)"
  echo "âš ï¸  Note: Les fichiers Docker-compose pointent maintenant vers config/"
  echo "   Cette commande est un rollback d'urgence uniquement!"
fi

echo ""
echo "ðŸ“Š Ã‰tat actuel:"
echo "   - Configs dans config/: $(find config -type f | wc -l) fichiers"
echo "   - Fichiers Ã  la racine: $(ls -1 | wc -l) fichiers/dossiers"

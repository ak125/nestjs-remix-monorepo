#!/bin/bash
# =============================================================================
# setup-origin-firewall.sh — Protection origine via ufw (Cloudflare-only)
# =============================================================================
# A executer sur le serveur PROD (49.12.233.2) en tant que root/sudo
#
# Principe : seules les IPs Cloudflare peuvent atteindre les ports 80/443.
# Tout le reste (scanners, bots directs) est bloque au niveau OS,
# AVANT que Caddy ne voie la requete.
#
# Googlebot passe car il transite par Cloudflare (DNS proxied).
# Le geo-blocking et le bot management sont geres par Cloudflare WAF.
#
# Source IPs Cloudflare : https://www.cloudflare.com/ips/
# Derniere mise a jour : 2026-03-23
# =============================================================================

set -euo pipefail

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verification root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Ce script doit etre execute en root (sudo)${NC}"
    exit 1
fi

# Verification dry-run
DRY_RUN="${1:-}"
if [[ "$DRY_RUN" == "--dry-run" ]]; then
    echo -e "${YELLOW}=== MODE DRY-RUN — aucune modification ===${NC}"
fi

# IPs Cloudflare IPv4 (source: https://www.cloudflare.com/ips-v4/)
CF_IPV4=(
    173.245.48.0/20
    103.21.244.0/22
    103.22.200.0/22
    103.31.4.0/22
    141.101.64.0/18
    108.162.192.0/18
    190.93.240.0/20
    188.114.96.0/20
    197.234.240.0/22
    198.41.128.0/17
    162.158.0.0/15
    104.16.0.0/13
    104.24.0.0/14
    172.64.0.0/13
    131.0.72.0/22
)

# IPs Cloudflare IPv6 (source: https://www.cloudflare.com/ips-v6/)
CF_IPV6=(
    2400:cb00::/32
    2606:4700::/32
    2803:f800::/32
    2405:b500::/32
    2405:8100::/32
    2a06:98c0::/29
    2c0f:f248::/32
)

echo -e "${GREEN}=== Setup Origin Firewall (Cloudflare-only) ===${NC}"
echo ""

# Etape 1 : Sauvegarder les regles actuelles
if [[ "$DRY_RUN" != "--dry-run" ]]; then
    BACKUP="/root/ufw-backup-$(date +%Y%m%d-%H%M%S).rules"
    ufw status verbose > "$BACKUP" 2>/dev/null || true
    echo -e "Backup regles actuelles : ${YELLOW}${BACKUP}${NC}"
fi

# Etape 2 : Regles de base
echo ""
echo "--- Regles de base ---"

run_cmd() {
    if [[ "$DRY_RUN" == "--dry-run" ]]; then
        echo -e "  ${YELLOW}[DRY-RUN]${NC} $*"
    else
        echo -e "  ${GREEN}[EXEC]${NC} $*"
        eval "$@"
    fi
}

# SSH toujours accessible (CRITIQUE — ne pas se bloquer)
run_cmd "ufw allow 22/tcp comment 'SSH'"

# Autoriser loopback et reseau Docker interne
run_cmd "ufw allow from 127.0.0.1 comment 'Loopback IPv4'"
run_cmd "ufw allow from ::1 comment 'Loopback IPv6'"
run_cmd "ufw allow from 172.16.0.0/12 comment 'Docker internal'"
run_cmd "ufw allow from 10.0.0.0/8 comment 'Private network'"

# Etape 3 : Supprimer les anciennes regles HTTP/HTTPS generiques
echo ""
echo "--- Suppression anciennes regles HTTP/HTTPS generiques ---"
# On ne peut pas supprimer proprement avec ufw, on reset les regles HTTP
# et on re-cree uniquement pour Cloudflare
run_cmd "ufw delete allow 80/tcp 2>/dev/null || true"
run_cmd "ufw delete allow 443/tcp 2>/dev/null || true"
run_cmd "ufw delete allow 'Nginx Full' 2>/dev/null || true"
run_cmd "ufw delete allow 'Apache Full' 2>/dev/null || true"

# Etape 4 : Autoriser HTTP/HTTPS uniquement depuis Cloudflare
echo ""
echo "--- Ajout regles Cloudflare IPv4 (${#CF_IPV4[@]} ranges) ---"
for cidr in "${CF_IPV4[@]}"; do
    run_cmd "ufw allow from ${cidr} to any port 80,443 proto tcp comment 'Cloudflare IPv4'"
done

echo ""
echo "--- Ajout regles Cloudflare IPv6 (${#CF_IPV6[@]} ranges) ---"
for cidr in "${CF_IPV6[@]}"; do
    run_cmd "ufw allow from ${cidr} to any port 80,443 proto tcp comment 'Cloudflare IPv6'"
done

# Etape 5 : Politique par defaut
echo ""
echo "--- Politique par defaut ---"
run_cmd "ufw default deny incoming"
run_cmd "ufw default allow outgoing"

# Etape 6 : Activer
if [[ "$DRY_RUN" != "--dry-run" ]]; then
    echo ""
    echo -e "${YELLOW}Activation de ufw...${NC}"
    ufw --force enable
    echo ""
    echo -e "${GREEN}=== Firewall actif ===${NC}"
    ufw status numbered
else
    echo ""
    echo -e "${YELLOW}=== Fin dry-run — relancer sans --dry-run pour appliquer ===${NC}"
fi

echo ""
echo "--- Verification ---"
echo "Tester depuis l'exterieur :"
echo "  curl -v https://www.automecanik.com/health    # via Cloudflare → 200"
echo "  curl -v https://49.12.233.2/health             # direct → timeout (bloque par ufw)"
echo ""
echo "Rollback si probleme :"
echo "  ufw allow 80/tcp && ufw allow 443/tcp          # re-ouvrir temporairement"
echo "  cat ${BACKUP:-/root/ufw-backup-*.rules}        # voir l'etat precedent"

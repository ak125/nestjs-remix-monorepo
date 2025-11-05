#!/bin/bash

echo "═══════════════════════════════════════════════════════════════"
echo "   RÉCUPÉRATION DE LA CONFIGURATION DU VPS"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📋 Exécutez cette commande sur le VPS pour afficher la config :"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat << 'REMOTE_SCRIPT'
cd ~/production && grep -E "^(PAYBOX_|SYSTEMPAY_|BASE_URL|FRONTEND_URL)" .env
REMOTE_SCRIPT

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Copiez-collez cette commande dans votre terminal SSH connecté au VPS :"
echo ""
echo "cd ~/production && grep -E \"^(PAYBOX_|SYSTEMPAY_|BASE_URL|FRONTEND_URL)\" .env"
echo ""
echo "═══════════════════════════════════════════════════════════════"

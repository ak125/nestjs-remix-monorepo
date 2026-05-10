#!/bin/bash
# unlock-rag-knowledge.sh
#
# ROLLBACK EMERGENCY-ONLY : restaure permissions 0775 deploy:deploy
# (état pré-MVP-0). À utiliser UNIQUEMENT si lock-rag-knowledge.sh
# déclenche un incident bloquant en prod.
#
# Cette opération annule l'enforcement L3 read-only d'ADR-046/050.
# Un incident-postmortem doit être ouvert au vault après usage :
#   governance-vault/ledger/incidents/INC-YYYY-NNN-rag-unlock.md
#
# Usage : sudo bash scripts/ops/unlock-rag-knowledge.sh
#
# Memory: feedback_no_bricolage_clean_layer.md.

set -euo pipefail

RAG_DIR="${RAG_DIR:-/opt/automecanik/rag/knowledge}"
ROLLBACK_OWNER="${ROLLBACK_OWNER:-deploy}"

if [ ! -d "$RAG_DIR" ]; then
  echo "❌ RAG_DIR introuvable : $RAG_DIR" >&2
  exit 1
fi

echo "⚠️  EMERGENCY ROLLBACK : unlock $RAG_DIR (permissions pré-MVP-0)"
echo "    Un incident-postmortem est attendu après cette opération."
echo ""

sudo chown -R "$ROLLBACK_OWNER:$ROLLBACK_OWNER" "$RAG_DIR"
sudo find "$RAG_DIR" -type d -exec chmod 775 {} +
sudo find "$RAG_DIR" -type f -exec chmod 664 {} +

echo "⚠️  rag/knowledge UNLOCKED — investiguer + relancer lock-rag-knowledge.sh ASAP."
echo "    Référence ADR-046/050. Ouvrir incident-postmortem au vault."

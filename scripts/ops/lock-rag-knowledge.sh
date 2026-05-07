#!/bin/bash
# lock-rag-knowledge.sh
#
# Verrouille le mirror L3 (`rag/knowledge/`) en mode 3-tier permissions :
#   - owner = compte sync (rag-sync) — write+read
#   - group = compte runtime backend (nestjs) — read-only
#   - other = aucun accès
#
# Implémente ADR-046 § Layer L3 RAG MIRROR read-only + ADR-050 (Phase 0 baseline).
#
# Usage : sudo bash scripts/ops/lock-rag-knowledge.sh
#
# Variables d'environnement (override possible) :
#   RAG_DIR         (default: /opt/automecanik/rag/knowledge)
#   SYNC_USER       (default: rag-sync)
#   RUNTIME_GROUP   (default: nestjs)
#
# Pré-requis (étape 0 manuelle, doc dans governance-vault/runbooks/RB-rag-sync-user-bootstrap.md) :
#   sudo useradd -r -m -s /bin/bash -c "RAG sync bot" rag-sync
#   sudo groupadd -f nestjs
#   sudo usermod -aG nestjs rag-sync
#
# Rollback : scripts/ops/unlock-rag-knowledge.sh (emergency-only).
#
# Memory: feedback_no_bricolage_clean_layer.md, feedback_branch_scope_discipline.md.

set -euo pipefail

RAG_DIR="${RAG_DIR:-/opt/automecanik/rag/knowledge}"
SYNC_USER="${SYNC_USER:-rag-sync}"
RUNTIME_GROUP="${RUNTIME_GROUP:-nestjs}"

if [ ! -d "$RAG_DIR" ]; then
  echo "❌ RAG_DIR introuvable : $RAG_DIR" >&2
  exit 1
fi

if ! id -u "$SYNC_USER" >/dev/null 2>&1; then
  echo "❌ Compte $SYNC_USER inexistant. Créer via :" >&2
  echo "   sudo useradd -r -m -s /bin/bash -c 'RAG sync bot' $SYNC_USER" >&2
  exit 2
fi

if ! getent group "$RUNTIME_GROUP" >/dev/null 2>&1; then
  echo "❌ Groupe $RUNTIME_GROUP inexistant. Créer via :" >&2
  echo "   sudo groupadd -f $RUNTIME_GROUP" >&2
  exit 3
fi

echo "▶ Lock $RAG_DIR (3-tier permissions) :"
echo "  owner=$SYNC_USER (rwx), group=$RUNTIME_GROUP (r-x), other=0"

sudo chown -R "$SYNC_USER:$RUNTIME_GROUP" "$RAG_DIR"
sudo find "$RAG_DIR" -type d -exec chmod 750 {} +
sudo find "$RAG_DIR" -type f -exec chmod 640 {} +

# Vérification
DIR_MODE=$(stat -c '%a' "$RAG_DIR")
DIR_OWNER=$(stat -c '%U:%G' "$RAG_DIR")

if [ "$DIR_MODE" = "750" ] && [ "$DIR_OWNER" = "$SYNC_USER:$RUNTIME_GROUP" ]; then
  echo "✓ rag/knowledge verrouillé : owner=$DIR_OWNER, mode=$DIR_MODE/640"
else
  echo "❌ Vérification post-lock échouée : owner=$DIR_OWNER, mode=$DIR_MODE" >&2
  exit 4
fi

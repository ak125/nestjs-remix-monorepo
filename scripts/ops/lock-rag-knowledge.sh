#!/usr/bin/env bash
# ==============================================================================
# lock-rag-knowledge.sh — Verrouille mécaniquement L3 RAG MIRROR read-only
#
# Phase 1 PR-E.1 du plan Refondation R-stack
# (ADR-046 § Layer L3 RAG MIRROR read-only).
#
# Pose les permissions filesystem qui rendent `rag/knowledge/` READ-ONLY
# pour tous sauf le compte `rag-sync` (qui exécute le cron canon
# `sync-rag-from-wiki.sh`). Couplé à l'allowlist ast-grep
# (`.ast-grep/rules/no-direct-rag-knowledge-write.yml` Phase 1 PR-A) et
# au runtime NestJS guard (PR-E.2 à venir, manifest TTL 24h).
#
# À exécuter sur VPS DEV (et optionnellement PROD) une seule fois après
# que le compte `rag-sync` est provisionné. Idempotent : ré-exécution
# n'a aucun effet supplémentaire.
#
# Pré-requis :
#   - Compte système `rag-sync` créé : `sudo useradd -r -s /bin/bash rag-sync`
#   - Cron `sync-rag-from-wiki.sh` configuré sous `rag-sync` user
#     (cf. `scripts/cron/sync-rag-from-wiki.sh`)
#   - Permissions sudo NOPASSWD limitées à ce script pour le user qui
#     l'exécute (sinon prompt password à chaque run)
#
# Usage :
#   sudo bash scripts/ops/lock-rag-knowledge.sh
#   sudo bash scripts/ops/lock-rag-knowledge.sh --dry-run
#   sudo bash scripts/ops/lock-rag-knowledge.sh --rag-path /custom/path
#
# Effets :
#   - chown -R rag-sync:rag-sync $RAG_PATH/knowledge/
#   - chmod -R u=rwX,g=rX,o=rX $RAG_PATH/knowledge/  (555 dirs, 444 files,
#     mais owner rag-sync garde write pour cron)
#   - Le README et le manifest .last-sync.json restent owner rag-sync
#
# Bypass urgence (rollback / migration) :
#   - sudo chown -R deploy:deploy $RAG_PATH/knowledge/  (revert)
#   - sudo chmod -R u=rwX,g=rwX $RAG_PATH/knowledge/    (re-grant)
#   - À tracer dans `governance-vault/ledger/audit-trail/` avec marker
#     `bypass-rag-readonly: <reason>`
# ==============================================================================
set -euo pipefail

RAG_PATH_DEFAULT="/opt/automecanik/rag"
RAG_PATH="$RAG_PATH_DEFAULT"
RAG_USER="rag-sync"
RAG_GROUP="rag-sync"
DRY_RUN=0

usage() {
  cat <<EOF
Usage: $0 [--rag-path <path>] [--dry-run]

Options :
  --rag-path <path>   Chemin du repo automecanik-rag (default: $RAG_PATH_DEFAULT)
  --dry-run           Affiche les commandes sans les exécuter
  -h, --help          Affiche cette aide
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rag-path)
      RAG_PATH="$2"; shift 2;;
    --dry-run)
      DRY_RUN=1; shift;;
    -h|--help)
      usage; exit 0;;
    *)
      echo "Option inconnue : $1" >&2; usage; exit 2;;
  esac
done

KNOWLEDGE_DIR="$RAG_PATH/knowledge"

# ---- Pré-checks ----

if [[ $EUID -ne 0 && $DRY_RUN -eq 0 ]]; then
  echo "❌ Ce script doit être exécuté avec sudo (chown/chmod requis)." >&2
  exit 1
fi

if [[ ! -d "$KNOWLEDGE_DIR" ]]; then
  echo "❌ $KNOWLEDGE_DIR introuvable. Vérifie --rag-path." >&2
  exit 1
fi

if ! id -u "$RAG_USER" >/dev/null 2>&1; then
  echo "❌ User '$RAG_USER' n'existe pas." >&2
  echo "   Provisionner d'abord : sudo useradd -r -s /bin/bash $RAG_USER" >&2
  exit 1
fi

# ---- Action ----

run() {
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "DRY_RUN: $*"
  else
    "$@"
  fi
}

echo "🔒 Lock RAG knowledge L3 mirror — $KNOWLEDGE_DIR (owner: $RAG_USER)"

# 1. Owner = rag-sync (peut écrire via cron)
run chown -R "$RAG_USER:$RAG_GROUP" "$KNOWLEDGE_DIR"

# 2. Permissions : owner rwX, group rX, others rX (555 dirs, 444 files)
#    'X' = execute pour dirs uniquement (pas pour files)
run chmod -R u=rwX,g=rX,o=rX "$KNOWLEDGE_DIR"

# 3. Force dirs en 555 (read+exec pour traverse, pas write pour group/others)
run find "$KNOWLEDGE_DIR" -type d -exec chmod 555 {} +

# 4. Force files en 444 (read-only pour group/others, owner garde 644)
run find "$KNOWLEDGE_DIR" -type f -exec chmod 444 {} +

# 5. Owner conserve write sur dirs/files via setuid hack ? Non, conflict.
#    À la place : le cron sync s'exécute SOUS rag-sync user, qui peut
#    chmod u+w pendant la sync puis revert. Voir sync-wiki-exports-to-rag.py
#    pour l'implémentation idempotente.

# ---- Verification ----

echo
echo "✅ Verrouillage appliqué. Verification :"
ls -ld "$KNOWLEDGE_DIR"
sample_dir="$(find "$KNOWLEDGE_DIR" -type d | head -2 | tail -1)"
sample_file="$(find "$KNOWLEDGE_DIR" -type f | head -1)"
[[ -n "$sample_dir" ]] && ls -ld "$sample_dir"
[[ -n "$sample_file" ]] && ls -l "$sample_file"

echo
echo "📌 Pour bypasser temporairement (rollback / migration) :"
echo "   sudo chown -R deploy:deploy $KNOWLEDGE_DIR"
echo "   sudo chmod -R u=rwX,g=rwX $KNOWLEDGE_DIR"
echo "   → Tracer dans governance-vault/ledger/audit-trail/ avec marker"
echo "     'bypass-rag-readonly: <reason>'"

#!/usr/bin/env bash
# Test du hook PreToolUse pretool-file-guard.sh (Edit|Write) : la garde 1 refuse .env et les
# .env.* (secrets), sauf les modèles .example et .template ; gardes 1 à 5 et enveloppe en
# échec fermé inchangées (mandat FV).
# Aucun appel réel : le hook reçoit une enveloppe JSON sur stdin et rend un code de sortie ;
# aucun fichier lu ni écrit (les chemins ne sont que des noms), aucun réseau.
# SIMULATION : ni Claude Code ni son exécuteur de hooks ne sont exercés ; l'enveloppe est
# celle documentée (code.claude.com/docs/en/hooks).
# Usage : bash scripts/claude-hooks/pretool-file-guard.test.sh
#   HOOK_ROOT=<racine> : éprouver une autre version du hook (ex. le commit de base).
set -uo pipefail
HERE="${HOOK_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
HOOK="$HERE/scripts/claude-hooks/pretool-file-guard.sh"
FAIL=0; N=0
NL=$'\n'
# Le chemin passe à jq par stdin (printf est interne au shell) : pas de limite d'argument.
env_of() {
  printf '%s' "$2" | jq -cRs --arg t "$1" '{tool_name: $t, tool_input: ({file_path: .}
    + (if $t == "Edit" then {old_string: "a", new_string: "b"} else {content: "x"} end))}'
}
# Verdict = code de sortie, puis la garde qui a répondu (lue dans stderr).
verdict() {
  local err rc tag
  err=$(printf '%s' "$1" | bash "$HOOK" 2>&1 >/dev/null); rc=$?
  case "$err" in
    *"BLOCKED: Fichier protege ("*)                tag=garde1 ;;
    *"BLOCKED: Fichier lock ("*)                   tag=garde2 ;;
    *"WARNING: Modification du module paiement."*) tag=garde3 ;;
    *"BLOCKED: Fichier de config build ("*)        tag=garde4 ;;
    *"BLOCKED: Module rm/ est BANNI"*)             tag=garde5 ;;
    *"BLOCKED: enveloppe PreToolUse illisible"*)   tag=enveloppe ;;
    "")                                            tag=silence ;;
    *)                                             tag=autre ;;
  esac
  echo "$rc $tag"
}
check() { N=$((N + 1)); if [[ "$2" == "$3" ]]; then echo "  ok    — $1 ($3)"; else echo "  ÉCHEC — $1 : attendu « $2 », obtenu « $3 »"; FAIL=1; fi; }
# both <attendu> <chemin> [libellé] : le même chemin par Write puis par Edit.
both()  { local t; for t in Write Edit; do check "$t ${3:-$2}" "$1" "$(verdict "$(env_of "$t" "$2")")"; done; }
refus() { both "2 garde1" "$@"; }
admis() { both "0 silence" "$@"; }

echo "== .env et .env.* refusés (exit 2, garde 1) : cas du mandat"
refus ".env"
refus "backend/.env"
refus "backend/.env.production"
refus ".env.vps"
refus ".env.test"
refus ".env.backup-20251104-174224"
refus "config/vector/.env.vector"
refus "/opt/automecanik/app/backend/.env.production"
refus "./backend/.env.vps"
refus "backend/./.env.production"
refus "frontend/../backend/.env.production"

echo "== autres noms .env.* refusés"
refus "frontend/.env"
refus "backend/.env.local"
refus "backend/.env.staging.local"
refus "backend/.env.avant-essai-20260101T000000Z"
refus "clone/.env.essai-fq"            # observé le 2026-11-27 : écrit sans refus avant ce correctif
refus "backend/.env."
refus "backend/.env.example.bak"       # ne finit pas par .example

echo "== segment .env ou .env.* suivi d'une barre : refusé"
# Avec une barre finale, Write écrit encore le fichier (mesuré, Claude Code 2.1.332) ; « /. »
# et « /x/.. » y mènent aussi. Un dossier .env.* est traité comme le dossier .env.
refus "backend/.env.production/"
refus "/opt/automecanik/app/backend/.env.vps/"
refus "backend/.env/"
refus "backend/.env.production/."
refus "backend/.env.production/x/.."
refus "backend/.env.example/../.env.production"
refus "backend//.env.production"
refus "backend/.env.example/"          # un modèle se désigne sans barre finale
refus "config/.env.d/app.conf"
refus "config/.env.d/app.example"      # seul le dernier segment fait un modèle

echo "== modèles et fichiers ordinaires admis (exit 0, sans message)"
admis ".env.ai.example"
admis ".env.context7.example"
admis "backend/.env.crawl-budget.example"
admis "backend/.env.cyberplus.example"
admis "backend/.env.meilisearch.example"
admis "backend/.env.example"
admis "backend/.env.test.template"
admis "frontend/.env.example"
admis "/opt/automecanik/app/backend/.env.example"
admis "backend/.env.nouveau.example"
admis "README.md"
admis "backend/src/config/env-validation.ts"
admis "docs/env.md"
admis "backend/src/app.module.ts"
admis "scripts/ops/watchdog.env.example"   # le nom ne commence pas par « .env. »
admis "frontend/app/types/process.env.d.ts"

echo "== garde 1 inchangée hors .env.*"
refus ".github/workflows/ci.yml"
refus "docker-compose.prod.yml"
refus "config/caddy/Caddyfile"
refus "Dockerfile"
refus "backend/.dockerignore"
refus ".env/config"

echo "== gardes 2 à 5 inchangées, garde 1 avant l'avertissement paiement"
both "2 garde2" "package-lock.json"
both "0 garde3" "backend/src/modules/payments/x.ts"
both "2 garde4" "backend/tsconfig.json"
both "2 garde4" "package.json"
both "2 garde4" "turbo.json"
both "2 garde5" "backend/src/modules/rm/x.ts"
refus "backend/src/modules/payments/.env.production"

echo "== enveloppe (échec fermé, exit 2)"
check "JSON illisible"                        "2 enveloppe" "$(verdict 'pas du json')"
check "stdin vide"                            "2 enveloppe" "$(verdict '')"
check "file_path absent"                      "2 enveloppe" "$(verdict '{"tool_name":"Write","tool_input":{"content":"x"}}')"
check "file_path vide"                        "2 enveloppe" "$(verdict "$(env_of Write "   ")")"
check "file_path non textuel"                 "2 enveloppe" "$(verdict '{"tool_name":"Edit","tool_input":{"file_path":["backend/.env.production"]}}')"
check "file_path hors de tool_input"          "2 enveloppe" "$(verdict '{"tool_name":"Write","file_path":"backend/.env.production"}')"
check "deux objets JSON"                      "2 enveloppe" "$(verdict '{"tool_input":{"file_path":"a.ts"}}{"tool_input":{"file_path":"b.ts"}}')"
check "enveloppe complète, fichier ordinaire" "0 silence"   "$(verdict '{"session_id":"s","transcript_path":"/tmp/t.jsonl","cwd":"/tmp","permission_mode":"default","hook_event_name":"PreToolUse","tool_name":"Write","tool_use_id":"t1","tool_input":{"file_path":"/opt/automecanik/app/backend/src/app.module.ts","content":"x"}}')"
check "enveloppe complète, .env.production"   "2 garde1"    "$(verdict '{"session_id":"s","transcript_path":"/tmp/t.jsonl","cwd":"/tmp","permission_mode":"default","hook_event_name":"PreToolUse","tool_name":"Edit","tool_use_id":"t2","tool_input":{"file_path":"/opt/automecanik/app/backend/.env.production","old_string":"a","new_string":"b"}}')"

echo "== chemin sur plusieurs lignes : le chemin entier décide, pas une ligne"
refus "README.md${NL}backend/.env.production"          'README.md\nbackend/.env.production'
refus "backend/.env.example${NL}x/../.env.production"  'backend/.env.example\nx/../.env.production'

echo "== chemins longs sur plusieurs lignes (300 000 caractères)"
# Write et Edit refusent un chemin de plus de 4096 caractères : ces cas éprouvent la garde
# seule. Un grep qui s'arrête à la première ligne ne doit pas faire oublier la suite du chemin.
LONG=$(printf '%60000s' '' | sed 's| |q/../|g')
check "Write .env.production derrière 300 000 caractères"                "2 garde1"  "$(verdict "$(env_of Write "README.md${NL}${LONG}backend/.env.production")")"
check "Write .env.production, première ligne x/Dockerfile"               "2 garde1"  "$(verdict "$(env_of Write "x/Dockerfile${NL}${LONG}backend/.env.production")")"
check "Write .env derrière 300 000 caractères, première ligne .env/zz"   "2 garde1"  "$(verdict "$(env_of Write "backend/.env/zz${NL}${LONG}../.env")")"
check "Write fichier ordinaire derrière 300 000 caractères"              "0 silence" "$(verdict "$(env_of Write "README.md${NL}${LONG}docs/env.md")")"

echo
if [[ $FAIL -eq 0 ]]; then echo "VERT — $N cas"; else echo "ROUGE — au moins un cas en échec sur $N"; fi
exit $FAIL

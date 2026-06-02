#!/usr/bin/env bash
# UserPromptSubmit hook — PUSH ciblé de contexte (registry-first → PUSH déterministe)
#
# But : supprimer la friction « il faut rappeler à l'agent d'aller chercher le bon
# contexte ». Détecte 1..6 domaines depuis le prompt et injecte 1 à 3 fichiers MAX
# (knowledge/ + mémoire atomique) via stdout = additional context (même mécanique
# que sessionstart-workspace-context.sh). Aucune mutation, aucun routing IA, aucun
# apprentissage, aucun effet write hors injection de contexte.
#
# Contrat de sûreté :
#   - FAIL-OPEN STRICT : toute erreur => exit 0 SANS injection (un UserPromptSubmit
#     hook ne doit JAMAIS bloquer un prompt).
#   - Allowlist de fichiers EN DUR = surface d'injection bornée (= sanitization).
#   - Caps durs : 3 fichiers · 4000 o/fichier · 9000 o total.
#   - Redaction défensive des lignes en forme de secret (allowlist déjà sans secret).
#   - Logs : domaines + basenames seulement (jamais de contenu) → /tmp, borné.
#   - Rollback : CLAUDE_HOOKS_DISABLE=1.
#
# Mapping volontairement COURT (6 domaines). NE PAS gonfler à 200 mots-clés,
# NE PAS injecter MEMORY.md entier, NE PAS créer d'orchestrateur.
# Réf : mémoire project_memory_context_architecture_20260602 (P2).

set -uo pipefail

# Rollback rapide
[ "${CLAUDE_HOOKS_DISABLE:-0}" = "1" ] && exit 0
command -v jq >/dev/null 2>&1 || exit 0

INPUT=$(cat 2>/dev/null || true)
[ -z "$INPUT" ] && exit 0
PROMPT=$(printf '%s' "$INPUT" | jq -r '.prompt // empty' 2>/dev/null || true)
[ -z "$PROMPT" ] && exit 0
P=$(printf '%s' "$PROMPT" | tr '[:upper:]' '[:lower:]')

REPO_ROOT=$(git -C "${PWD:-/opt/automecanik/app}" rev-parse --show-toplevel 2>/dev/null || echo /opt/automecanik/app)
[ -d "$REPO_ROOT/.claude" ] || REPO_ROOT=/opt/automecanik/app
KNOW="$REPO_ROOT/.claude/knowledge"
MEM="/home/deploy/.claude/projects/-opt-automecanik-app/memory"

# --- Mapping domaine -> patterns + fichiers (allowlist) -----------------------
DOMAINS=(pricing supplier seo wiki pr deployment)

pat_pricing='pricing|prix|marge|remise|tarif|achat|px_base|vente.{0,4}perte|vendre.{0,4}perte'
pat_supplier='supplier|fournisseur|districash|inoshop|\bdca\b|\bcal\b|\bsbs\b|rupture|disponib|availability|spl_id'
pat_seo='\bseo\b|indexation|indexing|\bgsc\b|canonical|noindex|sitemap|\br2\b|\br8\b|meta.?title|m[ée]ta|\bgamme'
pat_wiki='\bwiki\b|raw.?wiki|[ée]ditorial|knowledge.?bootstrap|\brag\b|contenu'
pat_pr='github|pull.?request|\bpr\b|\bmerge\b|\brebase\b|\bci\b|gh pr|workflow run'
pat_deployment='deploy|d[ée]ploie|preprod|\bprod\b|production|release|container|docker.?compose|tag v'

files_pricing="$MEM/feedback_pricing_is_economic_governance_not_engine.md $MEM/reference_supplier_remise_per_brand_per_subfamily.md $MEM/feedback_never_sell_at_loss_pricing_invariant.md"
files_supplier="$KNOW/modules/suppliers.md $MEM/project_supplier_truth_v1_20260520.md $MEM/reference_supplier_source_files_live_in_data_tecdoc.md"
files_seo="$KNOW/modules/seo-control-plane.md $MEM/feedback_seo_keywords_table_contaminated.md $MEM/feedback_no_url_changes_ever.md"
files_wiki="$KNOW/modules/rag-knowledge-bootstrap.md $MEM/feedback_seo_content_pipeline_scrape_raw_wiki_kw.md $MEM/feedback_no_rag_for_content_legacy_code_is_not_strategy.md"
files_pr="$MEM/feedback_verify_pr_checks_not_handoff_claim.md $MEM/feedback_auto_merge_beats_rebase_loop.md $MEM/feedback_branch_scope_discipline.md"
files_deployment="$MEM/deployment_topology_canonical.md $MEM/feedback_prod_deploy_tag_requires_explicit_owner_go.md $MEM/feedback_prod_tag_pin_sha_and_assert_head.md"

# --- Détection ----------------------------------------------------------------
MATCHED=()
CANDS=()
for d in "${DOMAINS[@]}"; do
  pv="pat_$d"; fv="files_$d"
  if printf '%s' "$P" | grep -qE "${!pv}"; then
    MATCHED+=("$d")
    for f in ${!fv}; do CANDS+=("$f"); done
  fi
done
[ ${#MATCHED[@]} -eq 0 ] && exit 0

# Garde "prompt trop large" : ≥4 domaines matchés = prompt méta/non-focalisé.
# Tout push mono-domaine serait arbitraire (= bruit) → ne rien injecter.
# Observable (pas un fallback silencieux) : raison tracée dans le log.
BROAD=4
if [ ${#MATCHED[@]} -ge "$BROAD" ]; then
  printf '%s [SUPPRESS too-broad %d domaines: %s]\n' \
    "$(date -Iseconds 2>/dev/null || echo now)" "${#MATCHED[@]}" "${MATCHED[*]}" \
    >> /tmp/userpromptsubmit-context.log 2>/dev/null || true
  exit 0
fi

# Dedupe (ordre préservé), garde existants, cap dur.
CAP=3
declare -A SEEN
FINAL=()
UNIQ_EXIST=0
for f in "${CANDS[@]}"; do
  [ -n "${SEEN[$f]:-}" ] && continue
  SEEN[$f]=1
  [ -f "$f" ] || continue
  UNIQ_EXIST=$((UNIQ_EXIST + 1))
  [ ${#FINAL[@]} -lt $CAP ] && FINAL+=("$f")
done
[ ${#FINAL[@]} -eq 0 ] && exit 0

# --- Assemblage ---------------------------------------------------------------
PERFILE=4000
TOTAL=9000
SECRET_RE='(superadmin2025|begin [a-z ]*private key|(secret|password|hmac|token|api_?key)[a-z0-9_]*[[:space:]]*[:=])'

OUT=/tmp/userpromptsubmit-context.out
: > "$OUT"
{
  echo "## 📎 Contexte poussé (hook UserPromptSubmit · PULL→PUSH)"
  printf '> Domaine(s): %s — %d fichier(s) injecté(s) (cap %d). Rollback: CLAUDE_HOOKS_DISABLE=1.\n' "${MATCHED[*]}" "${#FINAL[@]}" "$CAP"
  if [ "$UNIQ_EXIST" -gt "${#FINAL[@]}" ]; then
    printf '> NOTE: %d fichier(s) candidat(s) au-delà du cap %d (non injecté) — affiné le prompt si besoin.\n' "$((UNIQ_EXIST - ${#FINAL[@]}))" "$CAP"
  fi
  echo
  for f in "${FINAL[@]}"; do
    case "$f" in
      "$MEM"/*) label="[mémoire] $(basename "$f")" ;;
      *)        label="${f#$REPO_ROOT/}" ;;
    esac
    echo "### $label"
    echo '~~~'
    head -c "$PERFILE" "$f" | grep -aviE "$SECRET_RE" || true
    [ "$(wc -c < "$f")" -gt "$PERFILE" ] && printf '\n…[tronqué à %d o — Read le fichier pour le détail complet]\n' "$PERFILE"
    echo '~~~'
    echo
  done
} >> "$OUT" 2>/dev/null

# Borne totale dure.
if [ "$(wc -c < "$OUT" 2>/dev/null || echo 0)" -gt "$TOTAL" ]; then
  head -c "$TOTAL" "$OUT"
  printf '\n…[contexte tronqué à %d o total]\n' "$TOTAL"
else
  cat "$OUT"
fi

# --- Audit log sanitizé (domaines + basenames, jamais de contenu) -------------
LOG=/tmp/userpromptsubmit-context.log
{
  bn=""
  for f in "${FINAL[@]}"; do bn="$bn $(basename "$f")"; done
  printf '%s [%s]%s\n' "$(date -Iseconds 2>/dev/null || echo now)" "${MATCHED[*]}" "$bn"
} >> "$LOG" 2>/dev/null || true
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG" 2>/dev/null || echo 0)" -gt 500 ]; then
  tail -n 200 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG" 2>/dev/null || true
fi

exit 0

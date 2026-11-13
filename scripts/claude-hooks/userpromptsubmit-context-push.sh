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
#   - Sortie assemblée dans un fichier temporaire propre à l'invocation (mktemp,
#     supprimé en sortie) : deux prompts simultanés, de la même session ou de
#     sessions distinctes, ne partagent aucun tampon.
#   - Ni répertoire utilisateur ni checkout en dur : mémoire sous $HOME (même clé
#     de projet que check-memory-size.sh), repli vers le dépôt qui porte ce script.
#   - Rollback : CLAUDE_HOOKS_DISABLE=1.
#
# Dédup session-scoped (additif, content-addressed) :
#   - Problème corrigé : le hook était STATELESS et ré-injectait les MÊMES fichiers
#     à CHAQUE prompt d'un domaine donné (observé : 114× les 3 mêmes fichiers [pr]
#     dans une fenêtre). Chaque ré-injection PERSISTE dans l'historique conversation
#     → gaspillage de tokens cumulatif inutile (le contenu est déjà en contexte).
#   - Fix structurel : chaque fichier unique (clé = session_id + chemin absolu +
#     sha256 du CONTENU ACTUEL COMPLET) n'est injecté QU'UNE FOIS par session Claude
#     Code. L'identité par hash de contenu est self-correcting : un fichier modifié
#     en cours de session (nouveau hash) est correctement ré-injecté (contenu neuf
#     = utile). NON un simple « inject moins » / cap plus bas (la cause = statelessness).
#   - État : 1 fichier par session sous /tmp/upsc-dedup/<session_id>.seen (chmod 700),
#     newline-delimited « <chemin_abs> <sha256hex> ». Borné (reap 24h + trim 400→200),
#     concurrency-safe (1 fichier par session_id + flock pour l'append).
#   - OBSERVABLE (no silent fallback) : toute suppression / skip dédup est tracée dans
#     /tmp/userpromptsubmit-context.log (préfixes DEDUP-SUPPRESS / DEDUP-SKIP /
#     DEDUP-HASH-FAIL) — jamais de skip silencieux.
#   - FAIL-OPEN : session_id manquant, sha256sum absent, hash en échec, état corrompu
#     → on N'inhibe JAMAIS l'injection (au pire on ré-injecte = comportement d'avant),
#     jamais d'exit non-zéro, jamais de blocage du prompt.
#   - Rollback : CLAUDE_HOOKS_DISABLE=1 court-circuite AVANT tout code dédup.
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

# Strip des blocs de contexte injectés par le harness (fichier ouvert IDE,
# sélection IDE, system-reminders) AVANT le matching domaine. Sans ça, le seul
# nom d'un fichier ouvert (ex. dynamic-seo-v4-*.test.ts) matche \bseo\b et
# déclenche une injection hors-sujet : le champ .prompt inclut le contexte IDE,
# pas seulement le texte tapé. GNU sed range-delete (blocs sur lignes propres).
# Fail-open strict : sed en échec => on garde le prompt brut (comportement d'avant).
PROMPT_STRIPPED=$(printf '%s' "$PROMPT" | sed -E \
  -e '/<ide_opened_file>/,/<\/ide_opened_file>/d' \
  -e '/<ide_selection>/,/<\/ide_selection>/d' \
  -e '/<system-reminder>/,/<\/system-reminder>/d' 2>/dev/null) \
  && PROMPT="$PROMPT_STRIPPED"
# Si après strip il ne reste que du contexte (aucun texte utilisateur), ne rien matcher.
PROMPT="$(printf '%s' "$PROMPT" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' 2>/dev/null)"
[ -z "$PROMPT" ] && exit 0

# --- Dédup session : parse session_id + reap croisé (TOUCH-POINT A) ------------
# Parse uniquement ici (la dédup proprement dite s'active plus bas, après le calcul
# de FINAL[]). Le reap est best-effort, tourne au plus une fois par prompt, ne bloque
# jamais. LOG hoisté ici pour que la branche dédup puisse logger (re-défini à
# l'identique plus bas dans le bloc audit — réassignation idempotente, diff minimal).
SID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null || true)
SID_SAFE=$(printf '%s' "$SID" | tr -c 'A-Za-z0-9_.-' '_' | cut -c1-128)
DEDUP_DIR=/tmp/upsc-dedup
LOG=/tmp/userpromptsubmit-context.log
find "$DEDUP_DIR" -maxdepth 1 -type f \( -name '*.seen' -o -name '*.lock' \) -mmin +1440 -delete 2>/dev/null || true

P=$(printf '%s' "$PROMPT" | tr '[:upper:]' '[:lower:]')

# Repli : le dépôt qui porte ce script (scripts/claude-hooks/ → racine).
SCRIPT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)
REPO_ROOT=$(git -C "${PWD:-$SCRIPT_ROOT}" rev-parse --show-toplevel 2>/dev/null || echo "$SCRIPT_ROOT")
[ -d "$REPO_ROOT/.claude" ] || REPO_ROOT="$SCRIPT_ROOT"
KNOW="$REPO_ROOT/.claude/knowledge"
MEM="${HOME:-}/.claude/projects/-opt-automecanik-app/memory"

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

# Dedupe (ordre préservé) et garde des existants. Le cap s'applique APRÈS la dédup
# de session : un candidat déjà injecté ne doit pas occuper une place du cap et
# masquer les suivants, jamais injectés.
CAP=3
declare -A SEEN
EXIST=()
for f in "${CANDS[@]}"; do
  [ -n "${SEEN[$f]:-}" ] && continue
  SEEN[$f]=1
  [ -f "$f" ] && EXIST+=("$f")
done
[ ${#EXIST[@]} -eq 0 ] && exit 0

# --- Dédup session-scoped content-hash (TOUCH-POINT B) ------------------------
# Tourne APRÈS la garde too-broad (≥4) et le dedupe per-prompt + existence, AVANT
# le cap. Réduit EXIST[] aux candidats jamais injectés cette session (FRESH[]) et
# retient l'empreinte de chacun ; seuls ceux retenus sous le cap sont stagés dans
# NEW_TUPLES[] (enregistrés plus bas APRÈS émission stdout, touch-point C).
declare -A HASH
FRESH=("${EXIST[@]}")
if [ -z "$SID" ]; then
  # contrainte #7 : session_id manquant => fail-open = comportement d'aujourd'hui,
  # mais OBSERVABLE.
  printf '%s [DEDUP-SKIP no-session-id domaines: %s]\n' \
    "$(date -Iseconds 2>/dev/null || echo now)" "${MATCHED[*]}" >> "$LOG" 2>/dev/null || true
elif ! command -v sha256sum >/dev/null 2>&1; then
  printf '%s [DEDUP-SKIP no-sha256sum]\n' \
    "$(date -Iseconds 2>/dev/null || echo now)" >> "$LOG" 2>/dev/null || true
elif ! { mkdir -p -m 700 "$DEDUP_DIR" 2>/dev/null; [ -d "$DEDUP_DIR" ] && [ ! -L "$DEDUP_DIR" ] && [ -O "$DEDUP_DIR" ]; }; then
  # Dossier d'état sous /tmp : s'il est un lien ou appartient à un autre compte, l'état
  # .seen/.lock/.tmp y serait écrit sous son contrôle. Pas de dédup (= injection, fail-open).
  printf '%s [DEDUP-SKIP unsafe-state-dir]\n' \
    "$(date -Iseconds 2>/dev/null || echo now)" >> "$LOG" 2>/dev/null || true
else
  chmod 700 "$DEDUP_DIR" 2>/dev/null || true
  STATE="$DEDUP_DIR/${SID_SAFE}.seen"
  FRESH=()
  SUPPRESSED_BN=""
  for f in "${EXIST[@]}"; do
    chash=$(sha256sum "$f" 2>/dev/null | cut -d' ' -f1)
    if [ -z "$chash" ]; then
      # échec de hash => fail vers l'injection, ne JAMAIS supprimer sur erreur.
      FRESH+=("$f")
      printf '%s [DEDUP-HASH-FAIL %s]\n' \
        "$(date -Iseconds 2>/dev/null || echo now)" "$(basename "$f")" >> "$LOG" 2>/dev/null || true
      continue
    fi
    if [ -f "$STATE" ] && grep -Fxq "$f $chash" "$STATE" 2>/dev/null; then
      SUPPRESSED_BN="$SUPPRESSED_BN $(basename "$f")"      # déjà injecté cette session
    else
      FRESH+=("$f")
      HASH[$f]=$chash
    fi
  done
  # observabilité : logger toute suppression (contrainte #2, no silent fallback).
  if [ -n "$SUPPRESSED_BN" ]; then
    printf '%s [DEDUP-SUPPRESS sid=%s domaines: %s]%s\n' \
      "$(date -Iseconds 2>/dev/null || echo now)" "${SID_SAFE:0:8}" "${MATCHED[*]}" "$SUPPRESSED_BN" \
      >> "$LOG" 2>/dev/null || true
  fi
fi
# tous les candidats déjà injectés cette session => rien de neuf => exit clean
# (le régime permanent du 114×-repeat).
[ ${#FRESH[@]} -eq 0 ] && exit 0

# Cap dur sur les candidats neufs ; UNIQ_EXIST compte ceux en attente pour la NOTE.
UNIQ_EXIST=${#FRESH[@]}
FINAL=("${FRESH[@]:0:$CAP}")
NEW_TUPLES=()                                              # stage pour record-après-émission
for f in "${FINAL[@]}"; do
  [ -n "${HASH[$f]:-}" ] && NEW_TUPLES+=("$f ${HASH[$f]}")
done

# --- Assemblage ---------------------------------------------------------------
PERFILE=4000
TOTAL=9000
SECRET_RE='(superadmin2025|begin [a-z ]*private key|(secret|password|hmac|token|api_?key)[a-z0-9_]*[[:space:]]*[:=])'

# Tampon propre à l'invocation (jamais un fichier partagé : un prompt concurrent
# le tronquerait ou y ajouterait son contexte entre l'écriture et la lecture).
if ! OUT=$(mktemp "${TMPDIR:-/tmp}/userpromptsubmit-context.XXXXXX" 2>/dev/null); then
  printf '%s [SKIP mktemp-fail domaines: %s]\n' \
    "$(date -Iseconds 2>/dev/null || echo now)" "${MATCHED[*]}" >> "$LOG" 2>/dev/null || true
  exit 0
fi
trap 'rm -f "$OUT"' EXIT
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
    # SECRET_RE = redaction ; second filtre = drop des lignes-déchet des stubs
    # knowledge auto-générés (commentaires HTML + placeholders "à rédiger/compléter")
    # — on garde le contenu AUTO-GENERATED utile (exports/providers/fichiers).
    head -c "$PERFILE" "$f" | grep -aviE "$SECRET_RE" \
      | grep -avE '^[[:space:]]*<!--|Section à rédiger|À compléter' || true
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

# --- Dédup session : record-après-émission (TOUCH-POINT C) --------------------
# L'enregistrement n'a lieu QU'APRÈS que stdout a été émis, donc un crash en cours
# d'émission ne marque jamais à tort un fichier comme injecté.
if [ ${#NEW_TUPLES[@]} -gt 0 ] && [ -n "${STATE:-}" ]; then
  if command -v flock >/dev/null 2>&1; then
    ( flock -w 2 9 || exit 0; printf '%s\n' "${NEW_TUPLES[@]}" >> "$STATE"; ) 9>"$STATE.lock" 2>/dev/null || true
  else
    printf '%s\n' "${NEW_TUPLES[@]}" >> "$STATE" 2>/dev/null || true   # append court ~atomique; ligne dup inoffensive
  fi
  # borne per-session : reprend l'idiome de rotation du log d'audit (lignes plus bas).
  if [ -f "$STATE" ] && [ "$(wc -l < "$STATE" 2>/dev/null || echo 0)" -gt 400 ]; then
    if command -v flock >/dev/null 2>&1; then
      ( flock -w 2 9 || exit 0; tail -n 200 "$STATE" > "$STATE.tmp" 2>/dev/null && mv "$STATE.tmp" "$STATE"; ) 9>"$STATE.lock" 2>/dev/null || true
    else
      tail -n 200 "$STATE" > "$STATE.tmp" 2>/dev/null && mv "$STATE.tmp" "$STATE" 2>/dev/null || true
    fi
  fi
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

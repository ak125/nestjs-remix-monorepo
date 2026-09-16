#!/usr/bin/env bash
# ==============================================================================
# verify-after-upgrade.sh — rejoue la baseline après une fenêtre de maintenance,
#                           compare, et livre le verdict par mail
#
# POURQUOI
#   Une baseline capturée avant une coupure ne vaut que si quelqu'un la rejoue
#   après. Entre les deux il y a une nuit, de la fatigue, et l'envie de conclure
#   « ça a l'air d'aller » en regardant une page d'accueil. Ce script remplace
#   cette impression par un diff.
#
# CE QU'IL FAIT
#   1. exige la photo AVANT — et s'arrête si elle manque. Une vérification qui
#      s'exécute sans référence ne vérifie rien : elle produit exactement les
#      mêmes symptômes qu'une vérification réussie (canon guardrails : « une
#      garde correcte exécutée au mauvais moment produit les mêmes symptômes
#      qu'une garde défectueuse »).
#   2. rejoue scripts/baseline.sql du skill live-evidence-sweep, en lecture seule
#      stricte (--single-transaction + set transaction read only)
#   3. diffe AVANT/APRÈS
#   4. ajoute les contrôles qui n'ont de sens qu'APRÈS : index invalides,
#      contraintes NOT VALID, statistiques reconstruites, durées des jobs pg_cron
#      (un run à exactement 60,0 s = le plafond du rôle, pas une coïncidence),
#      et le plan du prédicat chaud comparé au plan de référence archivé
#   5. écrit un rapport markdown horodaté et l'envoie via analysis-report-mail.sh
#
# CE QU'IL NE COUVRE PAS — et le rapport le dit à votre place
#   - le plan INTERNE des fonctions plpgsql : EXPLAIN ne le voit pas. Le
#     détecteur est auto_explain (armé à 10 s sur ce projet), donc postgres_logs.
#   - l'état des sauvegardes et le PITR : le jeton de management est révoqué,
#     seul le tableau de bord fait foi.
#   - tout ce qui met plus d'une heure à se manifester.
#
# SORTIE
#   0 = aucun écart · 2 = écarts détectés (rapport envoyé) · 1 = erreur technique
#
# Usage :
#   set -a; . backend/.env; set +a
#   MAIL_TO=owner@example.com scripts/ops/verify-after-upgrade.sh
#   scripts/ops/verify-after-upgrade.sh --check          # n'envoie aucun mail
#   BASELINE_DIR=/chemin/autre scripts/ops/verify-after-upgrade.sh
# ==============================================================================
set -uo pipefail

SCRIPT_NAME="verify-after-upgrade"
log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [${SCRIPT_NAME}] $*" >&2; }

CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1
[ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ] && { sed -n '2,40p' "$0"; exit 0; }

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
SWEEP="$REPO/.claude/skills/live-evidence-sweep/scripts/sweep-psql.sh"
BASELINE_SQL="$REPO/.claude/skills/live-evidence-sweep/scripts/baseline.sql"
MAILER="$HERE/analysis-report-mail.sh"

BASELINE_DIR="${BASELINE_DIR:-/opt/automecanik/backups/upgrade-pg-2026-09-17}"
AVANT="${AVANT:-$BASELINE_DIR/baseline-avant-upgrade.txt}"
PLAN_REF="${PLAN_REF:-$BASELINE_DIR/plan-reference-avant-upgrade.txt}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
APRES="$BASELINE_DIR/baseline-apres-upgrade-$STAMP.txt"
RAPPORT="$BASELINE_DIR/verification-apres-upgrade-$STAMP.md"

# --- Gardes : sans référence, on ne vérifie rien ------------------------------
[ -x "$SWEEP" ]        || { log "FATAL: verrou lecture seule introuvable — $SWEEP"; exit 1; }
[ -r "$BASELINE_SQL" ] || { log "FATAL: baseline.sql introuvable — $BASELINE_SQL"; exit 1; }
[ -r "$AVANT" ]        || { log "FATAL: photo AVANT absente — $AVANT. Sans elle il n'y a rien à comparer, et un rapport « conforme » serait un mensonge. Arrêt."; exit 1; }
[ -s "$AVANT" ]        || { log "FATAL: photo AVANT vide — $AVANT. Arrêt."; exit 1; }

log "référence : $AVANT ($(wc -l < "$AVANT") lignes)"

# --- 1. Rejouer la baseline ---------------------------------------------------
if ! "$SWEEP" -f "$BASELINE_SQL" > "$APRES" 2>&1; then
  log "ERROR: rejeu de la baseline échoué — voir $APRES"
  head -20 "$APRES" >&2
  exit 1
fi
log "photo APRÈS écrite : $APRES ($(wc -l < "$APRES") lignes)"

# Comparer les MESURES, pas le protocole psql. Les échos de transaction (SET,
# BEGIN, COMMIT) et de \pset diffèrent selon que la baseline est lancée seule ou
# à travers le verrou lecture seule : testé le 2026-09-16 sur une base
# inchangée, ils produisaient 5 écarts fantômes. Un compteur d'écarts dont la
# valeur normale n'est pas zéro apprend au lecteur à l'ignorer.
normaliser() { grep -vxE '[[:space:]]*(SET|BEGIN|COMMIT|ROLLBACK|START TRANSACTION)[[:space:]]*|Border style is .*|Title is .*' "$1"; }
NORM_AVANT="$(mktemp)"; NORM_APRES="$(mktemp)"; POST="$(mktemp)"
trap 'rm -f "$POST" "$NORM_AVANT" "$NORM_APRES"' EXIT
normaliser "$AVANT" > "$NORM_AVANT"
normaliser "$APRES" > "$NORM_APRES"
# --label : sans lui, l'en-tête du diff affiche les noms des fichiers temporaires,
# illisibles dans un rapport lu des mois plus tard.
DIFF="$(diff -u --label "AVANT  $(basename "$AVANT")" --label "APRES  $(basename "$APRES")" "$NORM_AVANT" "$NORM_APRES" || true)"
NB_ECARTS="$(printf '%s\n' "$DIFF" | grep -cE '^[-+][^-+]' || true)"

# --- 2. Contrôles qui n'ont de sens qu'après ----------------------------------
"$SWEEP" \
  -c "select 'index_invalides' as controle, count(*)::text as valeur from pg_index where not indisvalid" \
  -c "select 'index_invalide_nom', coalesce(string_agg(indexrelid::regclass::text, ', '), 'aucun') from pg_index where not indisvalid" \
  -c "select 'contraintes_not_valid', count(*)::text from pg_constraint where not convalidated" \
  -c "select 'cron_actifs', count(*)::text from cron.job where active" \
  -c "select 'timeout_role_postgres', coalesce(array_to_string(rolconfig, ','), 'aucun') from pg_roles where rolname='postgres'" \
  -c "select 'stats_'||c.relname as controle, count(s.attname)::text as valeur from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_stats s on s.schemaname='public' and s.tablename=c.relname where n.nspname='public' and c.relname in ('pieces_relation_type','pieces','pieces_ref_search','pieces_relation_criteria') group by 1 order by 1" \
  -c "select 'jobs_cron_tues_au_plafond' as controle, count(*)::text as valeur from cron.job_run_details where start_time > now() - interval '1 hour' and round(extract(epoch from (end_time-start_time))::numeric,1) between 59.5 and 60.5" \
  -c "select jobid, status, round(extract(epoch from (end_time-start_time))::numeric,1) as duree_s, left(coalesce(return_message,''),60) as message from cron.job_run_details where start_time > now() - interval '1 hour' order by start_time desc limit 15" \
  -c "select 'empreinte_get_soft_404_alternatives' as controle, md5(pg_get_functiondef(p.oid)) as valeur from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_soft_404_alternatives'" \
  -c "explain select * from pieces_relation_type where rtp_type_id = 19052 and rtp_pg_id = 402" \
  > "$POST" 2>&1 || log "ATTENTION: une partie des contrôles post-fenêtre a échoué — le rapport le montrera"

# Un seq scan sur le prédicat chaud = la régression que la fenêtre pouvait produire.
SEQSCAN="non"
grep -qiE 'Seq Scan on pieces_relation_type' "$POST" && SEQSCAN="OUI — REGRESSION DE PLAN"

VERSION_APRES="$(grep -oE 'PostgreSQL [0-9]+\.[0-9]+' "$APRES" | head -1)"
VERSION_AVANT="$(grep -oE 'PostgreSQL [0-9]+\.[0-9]+' "$AVANT" | head -1)"

# --- 3. Rapport ---------------------------------------------------------------
{
  echo "# Vérification après fenêtre de maintenance — $(date -u +%Y-%m-%d\ %H:%M)Z"
  echo
  echo "Version avant : \`${VERSION_AVANT:-inconnue}\` — après : \`${VERSION_APRES:-inconnue}\`"
  echo "Écarts de baseline : **${NB_ECARTS}** ligne(s). Régression de plan sur le prédicat chaud : **${SEQSCAN}**."
  echo
  if [ "$NB_ECARTS" -eq 0 ] && [ "$SEQSCAN" = "non" ]; then
    echo "Aucun écart sur les 18 compteurs structurels, et le prédicat chaud garde son parcours d'index."
  else
    echo "**Des écarts existent. Ils ne sont pas tous anormaux** — un changement de version en est un,"
    echo "attendu. Lire le diff avant de conclure dans un sens ou dans l'autre."
  fi
  echo
  echo "## Diff de la baseline (avant → après)"
  echo
  echo '```diff'
  if [ -n "$DIFF" ]; then printf '%s\n' "$DIFF"; else echo "(aucun écart)"; fi
  echo '```'
  echo
  echo "## Contrôles propres à l'après-fenêtre"
  echo
  echo '```'
  cat "$POST"
  echo '```'
  echo
  echo "Repères attendus, mesurés avant la fenêtre : index invalides = 1"
  echo "(\`idx_pieces_ref_search_piece_id_kind\`) · contraintes NOT VALID = 7 · jobs pg_cron actifs = 18."
  echo "Une ligne \`stats_*\` à 0 signifie que les statistiques d'une grosse table n'ont pas été"
  echo "reconstruites : un \`ANALYZE\` est alors nécessaire. Un job pg_cron à exactement 60,0 s n'est"
  echo "pas une coïncidence, c'est le \`statement_timeout\` du rôle \`postgres\`."
  echo
  echo "## Plan de référence archivé, pour comparaison"
  echo
  echo '```'
  if [ -r "$PLAN_REF" ]; then cat "$PLAN_REF"; else echo "(absent : $PLAN_REF)"; fi
  echo '```'
  echo
  echo "## Ce que cette vérification NE couvre PAS"
  echo
  echo "- **Le plan interne des fonctions plpgsql.** \`EXPLAIN\` sur un appel ne rend qu'un"
  echo "  \`Function Scan\`. Le détecteur d'une régression interne est \`auto_explain\`, armé à 10 s :"
  echo "  chercher les plans dans \`postgres_logs\`."
  echo "- **L'état des sauvegardes et le PITR.** Le jeton de management est révoqué (401) ; seul le"
  echo "  tableau de bord Supabase fait foi."
  echo "- **Tout ce qui met plus d'une heure à se manifester.** Les durées des jobs pg_cron ne"
  echo "  couvrent que la dernière heure ; relancer ce script demain donnera un second point."
  echo
  echo "Émis par \`scripts/ops/${SCRIPT_NAME}.sh\`. Photos : \`$(basename "$AVANT")\` → \`$(basename "$APRES")\`."
} > "$RAPPORT"

log "rapport écrit : $RAPPORT"

# --- 4. Livraison -------------------------------------------------------------
if [ "$CHECK_ONLY" -eq 1 ]; then
  log "--check : aucun envoi. Écarts = ${NB_ECARTS}, seq scan = ${SEQSCAN}"
else
  if [ -x "$MAILER" ]; then
    "$MAILER" "$RAPPORT" || log "ERROR: envoi du rapport échoué (le rapport reste sur disque)"
  else
    log "ATTENTION: expéditeur introuvable ($MAILER) — rapport non envoyé, il reste sur disque"
  fi
fi

if [ "$NB_ECARTS" -gt 0 ] || [ "$SEQSCAN" != "non" ]; then exit 2; fi
exit 0

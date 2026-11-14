#!/usr/bin/env bash
# Test de rag-knowledge-backup.sh sur des dossiers FIXTURE jetables (jamais rag/ ni backups/ réels).
#
# Cas couverts : archive du jour créée, lisible et contenant knowledge/ ; archive ancienne retirée
# et archive récente conservée ; dossier source absent (error, aucune archive, aucune purge) ;
# verrou RAG tenu (error, aucune archive, aucune purge) ; tar en échec sur un fichier illisible
# (error, aucun fichier temporaire, aucune purge). Chaque cas vérifie l'état enregistré pour le
# hook SessionStart (cron_report).
#
# Usage : bash rag-knowledge-backup.test.sh
#         RAG_BACKUP_SCRIPT=/chemin/autre-version.sh bash rag-knowledge-backup.test.sh
# Dépendances : flock, jq, tar, gzip. Ne pas lancer en root (le cas « fichier illisible » exige
# qu'un chmod 000 empêche la lecture).
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="${RAG_BACKUP_SCRIPT:-$HERE/rag-knowledge-backup.sh}"
command -v jq >/dev/null 2>&1 || { echo "ÉCHEC — jq absent : test impossible"; exit 2; }
[ "$(id -u)" != 0 ] || { echo "ÉCHEC — lancé en root : le cas « fichier illisible » ne peut rien prouver"; exit 2; }
FIX="$(mktemp -d "${TMPDIR:-/tmp}/rag-backup-test.XXXXXX")"
FAIL=0
trap 'chmod -R u+rwX "$FIX" 2>/dev/null; rm -rf "$FIX"' EXIT

check() { # check <description> <attendu> <obtenu>
  if [[ "$2" == "$3" ]]; then echo "  ok    — $1 ($3)"; else echo "  ÉCHEC — $1 : attendu « $2 », obtenu « $3 »"; FAIL=1; fi
}

# --- Isolation : aucun dossier, verrou ni état réels ---
unset XDG_STATE_HOME CRON_REPORT_MAX_AGE_S RAG_BACKUP_KEEP_DAYS
export AUTOMECANIK_RAG_PATH="$FIX/rag" RAG_BACKUP_DIR="$FIX/backups" RAG_GLOBAL_LOCK="$FIX/rag-global.lock"
export CRON_STATE_DIR="$FIX/state" TMPDIR="$FIX/tmp" RAG_BACKUP_LOCK_WAIT_S=1
mkdir -p "$TMPDIR" "$FIX/rag/knowledge/gammes" "$FIX/backups"
echo "contenu" > "$FIX/rag/knowledge/gammes/disque.md"
STATE="$FIX/state/rag-knowledge-backup.json"
TODAY="$FIX/backups/rag-knowledge-$(date +%Y%m%d).tar.gz"
OLD="$FIX/backups/rag-knowledge-20200101.tar.gz"
RECENT="$FIX/backups/rag-knowledge-20200102.tar.gz"

reset_backups() {
  rm -f "$FIX"/backups/rag-knowledge-*.tar.gz "$FIX"/backups/.rag-knowledge-tmp.* "$STATE"
  echo ancien > "$OLD";   touch -d '10 days ago' "$OLD"
  echo recent > "$RECENT"; touch -d '2 days ago' "$RECENT"
}
run() { bash "$SCRIPT" >"$FIX/out.log" 2>&1; echo $?; }
present() { [ -e "$1" ] && echo oui || echo non; }
tmp_left() { find "$FIX/backups" -name '.rag-knowledge-tmp.*' | wc -l | tr -d ' '; }

echo "▶ passage nominal"
reset_backups
check "code de sortie" 0 "$(run)"
check "archive du jour créée" oui "$(present "$TODAY")"
check "archive lisible" 0 "$(gzip -t "$TODAY" 2>/dev/null; echo $?)"
check "archive réservée au propriétaire" 600 "$(stat -c %a "$TODAY")"
check "archive contient knowledge/gammes/disque.md" 1 "$(tar tzf "$TODAY" | grep -cx 'knowledge/gammes/disque.md')"
check "archive de 10 jours retirée" non "$(present "$OLD")"
check "archive de 2 jours conservée" oui "$(present "$RECENT")"
check "aucun fichier temporaire" 0 "$(tmp_left)"
check "état enregistré" ok "$(jq -r .status "$STATE")"
check "cadence déclarée" 93600 "$(jq -r .max_age_s "$STATE")"
check "métrique pruned" 1 "$(jq -r .metrics.pruned "$STATE")"
check "métrique kept" 2 "$(jq -r .metrics.kept "$STATE")"

echo "▶ dossier source absent"
reset_backups
mv "$FIX/rag/knowledge" "$FIX/rag/knowledge.off"
check "code de sortie" 2 "$(run)"
mv "$FIX/rag/knowledge.off" "$FIX/rag/knowledge"
check "aucune archive du jour" non "$(present "$TODAY")"
check "aucune purge (archive de 10 jours conservée)" oui "$(present "$OLD")"
check "état enregistré" error "$(jq -r .status "$STATE")"
check "résumé nomme le dossier absent" 1 "$(jq -r .summary "$STATE" | grep -c 'dossier source absent')"

echo "▶ verrou RAG tenu par une autre opération"
reset_backups
exec 9>"$RAG_GLOBAL_LOCK"; flock -n 9
check "code de sortie" 3 "$(run)"
exec 9>&-
check "aucune archive du jour" non "$(present "$TODAY")"
check "aucune purge" oui "$(present "$OLD")"
check "état enregistré" error "$(jq -r .status "$STATE")"
check "résumé nomme le verrou" 1 "$(jq -r .summary "$STATE" | grep -c 'verrou RAG')"

echo "▶ tar en échec (fichier illisible)"
reset_backups
echo secret > "$FIX/rag/knowledge/gammes/illisible.md"; chmod 000 "$FIX/rag/knowledge/gammes/illisible.md"
check "code de sortie" 4 "$(run)"
chmod 644 "$FIX/rag/knowledge/gammes/illisible.md"
check "aucune archive du jour" non "$(present "$TODAY")"
check "aucun fichier temporaire" 0 "$(tmp_left)"
check "aucune purge" oui "$(present "$OLD")"
check "état enregistré" error "$(jq -r .status "$STATE")"
check "résumé cite tar" 1 "$(jq -r .summary "$STATE" | grep -c '^échec à l.étape archive.*tar : ')"

echo "▶ alerte vue par le hook SessionStart"
HOOK="$HERE/../claude-hooks/sessionstart-workspace-context.sh"
if [ -f "$HOOK" ]; then
  check "le hook signale l'échec" 1 "$(bash "$HOOK" </dev/null 2>/dev/null | grep -c 'cron rag-knowledge-backup : ÉCHEC')"
else
  echo "  ÉCHEC — hook introuvable : $HOOK"; FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then echo "RÉSULTAT : tous les cas passent"; else echo "RÉSULTAT : ÉCHEC"; fi
exit "$FAIL"

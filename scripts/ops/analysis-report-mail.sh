#!/usr/bin/env bash
# ==============================================================================
# analysis-report-mail.sh — livre un compte-rendu d'analyse dans la boîte owner
#
# POURQUOI
#   Un rapport qui ne vit que dans audit/ ou dans le scrollback d'une session
#   n'est lu par personne. Le skill live-evidence-sweep produit un compte-rendu ;
#   ce script le met en forme et le livre, pour que la boucle « balayage →
#   analyse → décision » ne dépende plus de la présence de l'owner devant un
#   terminal au bon moment.
#
# CE QU'IL FAIT
#   1. lit le rapport markdown passé en argument
#   2. sujet  = titre H1 du rapport + date du jour (UTC)
#   3. corps  = tout ce qui précède le marqueur <!-- MAIL-CUT --> ; à défaut,
#               les MAIL_BODY_LINES (défaut 120) premières lignes. Le découpage
#               est explicite et versionné dans le rapport lui-même : le corps
#               du mail est donc une décision de l'auteur du rapport, pas une
#               troncature aveugle de ce script.
#   4. pièce jointe = le rapport intégral (le corps n'est qu'un aperçu)
#   5. dédup sur le sha256 du CONTENU : relancer sur un rapport inchangé ne
#      renvoie rien. C'est la même leçon que PREV-1 (mémoire : une cooldown
#      purement temporelle ré-alerte sur les mêmes lignes dès son expiration) —
#      ici, contenu identique ⇒ silence ; rapport modifié ⇒ envoi immédiat.
#
# CE QU'IL NE FAIT PAS
#   Il ne produit aucune analyse et ne corrige rien. Il transporte. La
#   production du rapport appartient au skill live-evidence-sweep, la
#   correction à ses PR — séparation volontaire : un transporteur qui déciderait
#   du contenu serait une seconde source de vérité.
#
# ENV (fourni par l'appelant — backend/.env ou /etc/default/<script>)
#   GMAIL_CLIENT_ID GMAIL_CLIENT_SECRET GMAIL_REFRESH_TOKEN GMAIL_USER_EMAIL
#   MAIL_TO (ou ALERT_EMAIL_TO) — destinataire
#   MAIL_BODY_LINES  (défaut 120)
#   STATE_DIR        (défaut /var/tmp)
#
# Exit : 0 = envoyé OU no-op (contenu déjà livré) · 1 = erreur technique
#
# Usage :
#   set -a; . backend/.env; set +a
#   MAIL_TO=owner@example.com scripts/ops/analysis-report-mail.sh audit/rapport.md
#   scripts/ops/analysis-report-mail.sh audit/rapport.md --check   # n'envoie rien
#   scripts/ops/analysis-report-mail.sh audit/rapport.md --force   # ignore la dédup
# ==============================================================================
set -uo pipefail

SCRIPT_NAME="analysis-report-mail"
log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [${SCRIPT_NAME}] $*" >&2; }

REPORT=""
CHECK_ONLY=0
FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --check) CHECK_ONLY=1; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help) sed -n '2,45p' "$0"; exit 0 ;;
    -*) log "ERROR: option inconnue $1"; exit 1 ;;
    *) REPORT="$1"; shift ;;
  esac
done

[ -n "$REPORT" ] || { log "ERROR: chemin du rapport manquant"; exit 1; }
[ -r "$REPORT" ] || { log "ERROR: rapport illisible — $REPORT"; exit 1; }

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SENDER="$HERE/../monitoring/lib/send-gmail.sh"
[ -x "$SENDER" ] || { log "ERROR: expéditeur introuvable ou non exécutable — $SENDER"; exit 1; }

MAIL_BODY_LINES="${MAIL_BODY_LINES:-120}"
STATE_DIR="${STATE_DIR:-/var/tmp}"

# --- Sujet : titre H1 du rapport, sinon nom de fichier -----------------------
TITLE=$(grep -m1 '^# ' "$REPORT" | sed 's/^# *//' | cut -c1-120)
[ -n "$TITLE" ] || TITLE="$(basename "$REPORT")"
TODAY=$(date -u +%Y-%m-%d)
# Le contrat de sortie du skill met déjà la date dans le H1 ; ne pas la répéter.
case "$TITLE" in
  *[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*) SUBJECT="[MassDoc] ${TITLE}" ;;
  *) SUBJECT="[MassDoc] ${TITLE} — ${TODAY}" ;;
esac

# --- Dédup sur le contenu ----------------------------------------------------
CONTENT_HASH=$(sha256sum "$REPORT" | cut -d' ' -f1)
STATE_FILE="${STATE_DIR}/${SCRIPT_NAME}.$(basename "$REPORT" | tr -c 'A-Za-z0-9._-' '_').last"
if [ "$FORCE" -eq 0 ] && [ -r "$STATE_FILE" ] && [ "$(cat "$STATE_FILE")" = "$CONTENT_HASH" ]; then
  log "no-op : contenu identique au dernier envoi (sha256 ${CONTENT_HASH:0:12}…)"
  exit 0
fi

# --- Corps : jusqu'au marqueur, sinon les N premières lignes -----------------
if grep -q '^<!-- MAIL-CUT -->' "$REPORT"; then
  EXCERPT=$(sed '/^<!-- MAIL-CUT -->/,$d' "$REPORT")
  CUT_NOTE="Aperçu jusqu'au marqueur MAIL-CUT du rapport."
else
  EXCERPT=$(head -n "$MAIL_BODY_LINES" "$REPORT")
  TOTAL_LINES=$(wc -l < "$REPORT")
  if [ "$TOTAL_LINES" -gt "$MAIL_BODY_LINES" ]; then
    CUT_NOTE="Aperçu : ${MAIL_BODY_LINES} premières lignes sur ${TOTAL_LINES}."
  else
    CUT_NOTE="Rapport intégral ci-dessus (${TOTAL_LINES} lignes)."
  fi
fi

BODY=$(cat <<EOF
${EXCERPT}

---
${CUT_NOTE}
Rapport complet en pièce jointe : $(basename "$REPORT")
Source : ${REPORT} · sha256 ${CONTENT_HASH}
Émis par scripts/ops/${SCRIPT_NAME}.sh — ce script transporte, il n'analyse ni ne corrige.
EOF
)

if [ "$CHECK_ONLY" -eq 1 ]; then
  log "--check : aucun envoi"
  log "  sujet       : ${SUBJECT}"
  log "  destinataire: ${MAIL_TO:-${ALERT_EMAIL_TO:-<non défini>}}"
  log "  corps       : $(printf '%s' "$BODY" | wc -l) lignes / $(printf '%s' "$BODY" | wc -c) octets"
  log "  pièce jointe: ${REPORT} ($(stat -c %s "$REPORT") octets)"
  log "  dédup       : sha256 ${CONTENT_HASH:0:12}… (état ${STATE_FILE})"
  exit 0
fi

RESULT=$(printf '%s\n' "$BODY" | SUBJECT="$SUBJECT" "$SENDER" --attach "$REPORT" 2>&1) || {
  log "ERROR: envoi échoué — ${RESULT}"
  exit 1
}

echo "$CONTENT_HASH" > "$STATE_FILE"
log "envoyé à ${MAIL_TO:-$ALERT_EMAIL_TO} — ${SUBJECT}"
exit 0

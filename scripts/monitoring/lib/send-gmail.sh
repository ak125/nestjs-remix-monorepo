#!/usr/bin/env bash
# ==============================================================================
# send-gmail.sh — envoi d'un mail via Gmail SMTP OAuth2 (python3 stdlib, zéro dép.)
#
# POURQUOI CE FICHIER EXISTE
#   Le bloc « OAuth2 refresh → SMTP XOAUTH2 » était recopié à l'identique dans
#   check-payment-tunnel.sh (PREV-1) puis dans check-error-logs-5xx.sh (PREV-2),
#   qui le signale lui-même en commentaire (« identique à PREV-1 »). Le troisième
#   appelant (analysis-report-mail.sh) déclenche la rule-of-three du canon : on
#   extrait au lieu de recopier une troisième fois.
#
#   Les deux scripts d'alerte existants ne sont PAS migrés ici : ce sont des
#   gardes vivantes (dont le détecteur de rupture du tunnel de paiement), leur
#   réécriture est un changement de blast radius qui mérite sa propre PR et sa
#   propre preuve d'envoi. Ce fichier est la surface canonique pour tout NOUVEL
#   appelant ; la migration des deux anciens est un follow-up assumé, pas un oubli.
#
# CONTRAT
#   corps du message : sur stdin (text/plain, UTF-8)
#   sujet            : $SUBJECT
#   destinataire     : $MAIL_TO (défaut : $ALERT_EMAIL_TO)
#   expéditeur       : $EMAIL_FROM (défaut : $GMAIL_USER_EMAIL)
#   identifiants     : GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN
#                      / GMAIL_USER_EMAIL — fournis par l'appelant (backend/.env
#                      ou /etc/default/<script>), JAMAIS lus par ce fichier.
#
#   Option --attach <fichier> : joint le fichier (text/markdown si .md, sinon
#   application/octet-stream). Gmail refuse au-delà de ~25 Mo ; on borne à 10 Mo
#   pour échouer côté script avec un message lisible plutôt que sur un 552 SMTP.
#
# SORTIE
#   stdout « OK » + exit 0 en cas de succès.
#   exit 1 + « ERROR_<phase>:<détail> » sinon. Aucun secret n'est imprimé : les
#   messages d'erreur OAuth sont tronqués à 300 caractères et ne contiennent que
#   la réponse du serveur Google (code + description), jamais les identifiants.
#
# Usage :
#   printf '%s\n' "corps" | SUBJECT="sujet" MAIL_TO="a@b.c" send-gmail.sh
#   send-gmail.sh --attach rapport.md < corps.txt
# ==============================================================================
set -uo pipefail

ATTACH=""
while [ $# -gt 0 ]; do
  case "$1" in
    --attach) ATTACH="${2:?--attach exige un chemin}"; shift 2 ;;
    -h|--help) sed -n '2,45p' "$0"; exit 0 ;;
    *) echo "ERROR_USAGE:option inconnue $1" >&2; exit 1 ;;
  esac
done

: "${GMAIL_CLIENT_ID:?GMAIL_CLIENT_ID manquant}"
: "${GMAIL_CLIENT_SECRET:?GMAIL_CLIENT_SECRET manquant}"
: "${GMAIL_REFRESH_TOKEN:?GMAIL_REFRESH_TOKEN manquant}"
: "${GMAIL_USER_EMAIL:?GMAIL_USER_EMAIL manquant}"
: "${SUBJECT:?SUBJECT manquant}"

MAIL_TO="${MAIL_TO:-${ALERT_EMAIL_TO:-}}"
[ -n "$MAIL_TO" ] || { echo "ERROR_USAGE:MAIL_TO (ou ALERT_EMAIL_TO) manquant" >&2; exit 1; }
EMAIL_FROM="${EMAIL_FROM:-$GMAIL_USER_EMAIL}"

if [ -n "$ATTACH" ]; then
  [ -r "$ATTACH" ] || { echo "ERROR_ATTACH:fichier illisible $ATTACH" >&2; exit 1; }
  ATTACH_SIZE=$(stat -c %s "$ATTACH")
  if [ "$ATTACH_SIZE" -gt 10485760 ]; then
    echo "ERROR_ATTACH:pièce jointe ${ATTACH_SIZE} octets > 10 Mo" >&2; exit 1
  fi
fi

BODY_TEXT=$(cat)

SEND_RESULT=$(
  SUBJECT="$SUBJECT" EMAIL_FROM="$EMAIL_FROM" MAIL_TO="$MAIL_TO" \
  BODY_TEXT="$BODY_TEXT" ATTACH="$ATTACH" \
  GMAIL_CLIENT_ID="$GMAIL_CLIENT_ID" GMAIL_CLIENT_SECRET="$GMAIL_CLIENT_SECRET" \
  GMAIL_REFRESH_TOKEN="$GMAIL_REFRESH_TOKEN" GMAIL_USER_EMAIL="$GMAIL_USER_EMAIL" \
  python3 <<'PYEOF' 2>&1
import base64, json, mimetypes, os, pathlib, smtplib, sys, urllib.error, urllib.parse, urllib.request
from email.message import EmailMessage

try:
    token_req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=urllib.parse.urlencode({
            "client_id": os.environ["GMAIL_CLIENT_ID"],
            "client_secret": os.environ["GMAIL_CLIENT_SECRET"],
            "refresh_token": os.environ["GMAIL_REFRESH_TOKEN"],
            "grant_type": "refresh_token",
        }).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(token_req, timeout=10) as r:
        access_token = json.loads(r.read())["access_token"]
except urllib.error.HTTPError as e:
    print(f"ERROR_OAUTH:HTTP{e.code}:{e.read().decode('utf-8', errors='replace')[:300]}")
    sys.exit(1)
except Exception as e:
    print(f"ERROR_OAUTH:{type(e).__name__}:{e}")
    sys.exit(1)

msg = EmailMessage()
msg["From"] = os.environ["EMAIL_FROM"]
msg["To"] = os.environ["MAIL_TO"]
msg["Subject"] = os.environ["SUBJECT"]
msg.set_content(os.environ["BODY_TEXT"])

attach = os.environ.get("ATTACH", "")
if attach:
    p = pathlib.Path(attach)
    guessed, _ = mimetypes.guess_type(p.name)
    maintype, subtype = (guessed.split("/", 1) if guessed else ("application", "octet-stream"))
    if p.suffix == ".md":
        maintype, subtype = "text", "markdown"
    msg.add_attachment(p.read_bytes(), maintype=maintype, subtype=subtype, filename=p.name)

try:
    auth_str = f"user={os.environ['GMAIL_USER_EMAIL']}\x01auth=Bearer {access_token}\x01\x01"
    auth_b64 = base64.b64encode(auth_str.encode()).decode()
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=30) as s:
        s.ehlo(); s.starttls(); s.ehlo()
        code, resp = s.docmd("AUTH", f"XOAUTH2 {auth_b64}")
        if code != 235:
            print(f"ERROR_SMTP_AUTH:{code}:{resp.decode('utf-8', errors='replace')[:200]}")
            sys.exit(1)
        s.send_message(msg)
    print("OK")
except smtplib.SMTPException as e:
    print(f"ERROR_SMTP:{type(e).__name__}:{e}")
    sys.exit(1)
except Exception as e:
    print(f"ERROR_SEND:{type(e).__name__}:{e}")
    sys.exit(1)
PYEOF
) || { echo "$SEND_RESULT" >&2; exit 1; }

if [ "$SEND_RESULT" != "OK" ]; then
  echo "$SEND_RESULT" >&2
  exit 1
fi
echo "OK"

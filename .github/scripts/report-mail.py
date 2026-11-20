#!/usr/bin/env python3
"""report-mail.py — short plain-text mail through Gmail SMTP, OAuth2 XOAUTH2.

Complément au mandat AM (décision 67, 2026-11-16). Same protocol and same variable
names as the inline senders of scripts/monitoring/check-payment-tunnel.sh and
check-error-logs-5xx.sh (refresh token → access token → SMTP STARTTLS + XOAUTH2,
python3 stdlib only). This is the third user of that protocol; the two host scripts
are NOT changed here (they are installed on the PROD host, ADR-130 D3.4).

    REPORT_MAIL_SUBJECT="…" python3 report-mail.py <body_file>

Environment (names only, never printed): GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET,
GMAIL_REFRESH_TOKEN, GMAIL_USER_EMAIL, ALERT_EMAIL_TO, EMAIL_FROM, REPORT_MAIL_SUBJECT.

Output, one line, safe for a PUBLIC run log (no address, no token, no server text):
    OK                          mail accepted by the SMTP server     (exit 0)
    INDISPONIBLE:<VAR,VAR>      variables missing                    (exit 2)
    ERREUR:<étape>:<type>       OAuth or SMTP failure                (exit 1)
"""
import base64
import json
import os
import smtplib
import sys
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage

NEEDED = ("GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN",
          "GMAIL_USER_EMAIL", "ALERT_EMAIL_TO", "EMAIL_FROM", "REPORT_MAIL_SUBJECT")


def main() -> int:
    missing = [n for n in NEEDED if not os.environ.get(n)]
    if missing:
        print("INDISPONIBLE:" + ",".join(missing))
        return 2
    if len(sys.argv) != 2 or not os.path.isfile(sys.argv[1]):
        print("ERREUR:corps:fichier_absent")
        return 1
    with open(sys.argv[1], encoding="utf-8") as fh:
        body = fh.read()

    # 1. refresh token → access token
    try:
        req = urllib.request.Request(
            "https://oauth2.googleapis.com/token",
            data=urllib.parse.urlencode({
                "client_id": os.environ["GMAIL_CLIENT_ID"],
                "client_secret": os.environ["GMAIL_CLIENT_SECRET"],
                "refresh_token": os.environ["GMAIL_REFRESH_TOKEN"],
                "grant_type": "refresh_token",
            }).encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            access_token = json.loads(resp.read())["access_token"]
    except urllib.error.HTTPError as exc:
        print(f"ERREUR:oauth:HTTP{exc.code}")
        return 1
    except Exception as exc:  # noqa: BLE001 — reported by type only
        print(f"ERREUR:oauth:{type(exc).__name__}")
        return 1

    # 2. message
    msg = EmailMessage()
    msg["From"] = os.environ["EMAIL_FROM"]
    msg["To"] = os.environ["ALERT_EMAIL_TO"]
    msg["Subject"] = os.environ["REPORT_MAIL_SUBJECT"]
    msg.set_content(body)

    # 3. SMTP STARTTLS + XOAUTH2
    try:
        user = os.environ["GMAIL_USER_EMAIL"]
        auth = base64.b64encode(f"user={user}\x01auth=Bearer {access_token}\x01\x01".encode()).decode()
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            code, _ = smtp.docmd("AUTH", f"XOAUTH2 {auth}")
            if code != 235:
                print(f"ERREUR:smtp_auth:{code}")
                return 1
            smtp.send_message(msg)
    except Exception as exc:  # noqa: BLE001 — reported by type only
        print(f"ERREUR:smtp:{type(exc).__name__}")
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())

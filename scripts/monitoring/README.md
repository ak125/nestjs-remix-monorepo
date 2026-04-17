# Monitoring scripts

Scripts d'observabilité active et alerting métier. Pensés pour être appelés par cron/systemd sur le host prod, **zéro dépendance système hors Python3 + curl** (tous deux présents par défaut sur Ubuntu).

## `check-payment-tunnel.sh` (PREV-1)

Détecte la rupture du tunnel de paiement Paybox en temps quasi-réel. Alerte par email Gmail OAuth2.

### Contexte

Incident 2026-03-20 → 2026-04-14 : 14 commandes bloquées, **25 jours avant détection** via monitoring externe tiers. Ce script garantit une détection en **moins de 2h** en cas de récidive.

Détails : [`.spec/reports/incident-2026-04-14-payments-sev1.md`](../../.spec/reports/incident-2026-04-14-payments-sev1.md) (3 bugs cumulés identifiés).

### Architecture

Aucune dépendance système lourde :

```
cron (15min)
   │
   ▼
check-payment-tunnel.sh
   │
   ├── curl POST ──► Supabase PostgREST /rpc/check_payment_tunnel_health
   │                 (auth: service_role_key, SECURITY DEFINER côté DB)
   │                 Retourne {orders_count, paid_count, last_paid_at}
   │
   ├── règle : orders >= MIN_ORDERS_THRESHOLD AND paid == 0 → alerte
   │
   └── alerte → python3 (stdlib) :
       1. POST https://oauth2.googleapis.com/token (refresh → access_token)
       2. SMTP smtp.gmail.com:587 STARTTLS + XOAUTH2 (code 235)
       3. EmailMessage RFC5322 à ALERT_EMAIL_TO
```

Anti-spam : ne ré-alerte pas avant `DEDUP_WINDOW_MIN` minutes (défaut 60).

### Règle d'alerte

```
alerte si (orders_count >= MIN_ORDERS_THRESHOLD)
       ET (paid_count == 0)
       ET (pas d'alerte envoyée depuis DEDUP_WINDOW_MIN minutes)
```

Défauts :
- `WINDOW_HOURS=2`
- `MIN_ORDERS_THRESHOLD=2` (évite faux positifs sur site peu fréquenté nuit/WE)
- `DEDUP_WINDOW_MIN=60`

### Env vars requises

| Variable | Source | Usage |
|---|---|---|
| `SUPABASE_URL` | `backend/.env` | PostgREST endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | `backend/.env` | Auth Bearer PostgREST |
| `GMAIL_CLIENT_ID` | `backend/.env` | OAuth2 client ID |
| `GMAIL_CLIENT_SECRET` | `backend/.env` | OAuth2 secret |
| `GMAIL_REFRESH_TOKEN` | `backend/.env` | OAuth2 refresh token |
| `GMAIL_USER_EMAIL` | `backend/.env` | Gmail account (ex: `contact@automecanik.com`) |
| `ALERT_EMAIL_TO` | *à définir* | Destinataire alerte |
| `EMAIL_FROM` | *à définir* | Format: `Automecanik <contact@automecanik.com>` (doit matcher `GMAIL_USER_EMAIL` ou être un alias Gmail valide) |

Optionnelles :

| Variable | Défaut | Usage |
|---|---|---|
| `WINDOW_HOURS` | `2` | Fenêtre d'observation (heures) |
| `MIN_ORDERS_THRESHOLD` | `2` | Nb min commandes pour déclencher |
| `DEDUP_WINDOW_MIN` | `60` | Minutes avant ré-alerte |
| `DEDUP_CACHE` | `/var/tmp/check-payment-tunnel.last-alert` | Fichier dedup |

### Installation prod (host `49.12.233.2`)

```bash
# 1. Le script est déjà dans le repo git (après CI deploy de main)
#    Path canonique : /home/deploy/actions-runner/_work/.../scripts/monitoring/
#    Copier vers path stable (hors workdir du runner qui peut être wipé) :
RUNNER_REPO=/home/deploy/actions-runner/_work/nestjs-remix-monorepo/nestjs-remix-monorepo
sudo install -m 755 "$RUNNER_REPO/scripts/monitoring/check-payment-tunnel.sh" /usr/local/bin/

# 2. Fichier env (readable par root uniquement, les secrets viennent du backend/.env)
sudo tee /etc/default/check-payment-tunnel >/dev/null <<EOF
SUPABASE_URL=https://cxpojprgwgubzjyqzmoq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<copy_from_backend/.env>
GMAIL_CLIENT_ID=<copy>
GMAIL_CLIENT_SECRET=<copy>
GMAIL_REFRESH_TOKEN=<copy>
GMAIL_USER_EMAIL=contact@automecanik.com
ALERT_EMAIL_TO=contact@automecanik.com
EMAIL_FROM=Automecanik Alerts <contact@automecanik.com>
EOF
sudo chmod 600 /etc/default/check-payment-tunnel
sudo chown root:root /etc/default/check-payment-tunnel

# 3. Test manuel AVANT d'activer le cron
sudo -E bash -c 'set -a; . /etc/default/check-payment-tunnel; set +a; /usr/local/bin/check-payment-tunnel.sh'
echo "Exit code attendu : 0 (tunnel sain) ou 1 (erreur)"

# 4. Activer le cron (tous les 15 min)
sudo tee /etc/cron.d/check-payment-tunnel >/dev/null <<'EOF'
MAILTO=contact@automecanik.com
*/15 * * * * root set -a; . /etc/default/check-payment-tunnel; set +a; /usr/local/bin/check-payment-tunnel.sh >> /var/log/check-payment-tunnel.log 2>&1
EOF
sudo chmod 644 /etc/cron.d/check-payment-tunnel

# 5. Valider que le cron log
sudo tail -f /var/log/check-payment-tunnel.log
# Attendre 15 min max, tu dois voir une ligne INFO avec orders/paid counts
```

### Test de l'alerte (optionnel, volontaire)

Pour forcer une alerte et vérifier que l'email arrive :

```bash
sudo -E bash -c '
  set -a; . /etc/default/check-payment-tunnel; set +a
  # threshold=0 + paid=0 = alerte forcée
  # cache dédié pour ne pas polluer le dedup prod
  DEDUP_CACHE=/tmp/test-alert.cache MIN_ORDERS_THRESHOLD=0 /usr/local/bin/check-payment-tunnel.sh
'
# exit code 2 = alert sent. Vérifier inbox ALERT_EMAIL_TO.
rm /tmp/test-alert.cache  # cleanup
```

### Exit codes

| Code | Signification | Action cron |
|---|---|---|
| `0` | OK (tunnel sain ou signal insuffisant) | rien |
| `1` | Erreur technique (API down, env manquant, OAuth fail) | `MAILTO` du cron reçoit stderr |
| `2` | Alerte envoyée (dedup activé 60 min) | rien |

### Dépannage

**`ERROR: RPC HTTP 401`** → `SUPABASE_SERVICE_ROLE_KEY` invalide/expiré. Vérifier rotation récente.

**`ERROR_OAUTH:HTTP400:invalid_grant`** → `GMAIL_REFRESH_TOKEN` révoqué ou expiré (>6 mois inactif). Re-générer le refresh token via [admin.google.com OAuth Playground](https://developers.google.com/oauthplayground/) avec scope `https://mail.google.com/`.

**`ERROR_SMTP_AUTH:535`** → XOAUTH2 rejeté. Causes possibles : Less secure apps désactivé (doit l'être pour OAuth2), 2FA requis, compte avec alertes sécurité. Vérifier [myaccount.google.com/security](https://myaccount.google.com/security).

**Email pas reçu** → vérifier les spams. Le `FROM` doit matcher un alias valide de `GMAIL_USER_EMAIL`.

### Monitoring du script lui-même (meta)

Le script pourrait lui-même être cassé (OAuth expiré, Supabase down) sans que personne le sache. Deux parades :

1. **`MAILTO=` dans le cron** : tout `exit 1` (erreur technique) déclenche un mail du daemon cron → détection passive de script cassé.
2. **External probe** (UptimeRobot/BetterUptime) : ping externe toutes les 30min vers un endpoint healthcheck dédié qui vérifie que `/var/log/check-payment-tunnel.log` a eu une entry récente.

Le #2 est idéal mais requiert un endpoint backend dédié. À inclure dans PREV-2 (canary E2E CI) ou ADR futur.

---

## RPC Supabase associée

Le script consomme [`check_payment_tunnel_health(p_window_hours int)`](../../backend/supabase/migrations/20260417_add_check_payment_tunnel_health_rpc.sql).

Test direct en SQL :
```sql
SELECT * FROM check_payment_tunnel_health();    -- défaut 2h
SELECT * FROM check_payment_tunnel_health(24);  -- 24h
SELECT * FROM check_payment_tunnel_health(168); -- 7 jours
```

Retourne : `orders_count`, `paid_count`, `last_paid_at` (timestamp text ISO).

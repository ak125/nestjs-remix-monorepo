# Monitoring scripts

Scripts d'observabilité active et alerting métier. Indépendants de tout serveur d'application — pensés pour être appelés par cron ou systemd timers directement sur le host prod.

## `check-payment-tunnel.sh` (PREV-1)

Détecte la rupture du tunnel de paiement Paybox en temps quasi-réel.

### Contexte

Incident 2026-03-20 → 2026-04-14 : 14 commandes bloquées, 25 jours avant détection via monitoring externe tiers. Voir [`.spec/reports/incident-2026-04-14-payments-sev1.md`](../../.spec/reports/incident-2026-04-14-payments-sev1.md).

### Règle d'alerte

Alerte Slack si, sur une fenêtre de `WINDOW_HOURS` (défaut 2h) :
- `COUNT(___xtr_order) >= MIN_ORDERS_THRESHOLD` (défaut 2)
- **ET** `COUNT(___xtr_order WHERE ord_is_pay = '1') == 0`

Anti-spam : ne ré-alerte pas avant `DEDUP_WINDOW_MIN` (défaut 60 min).

### Installation prod (49.12.233.2)

```bash
# 1. Copier le script (via git pull ou rsync)
cd /opt/automecanik/app && git pull
ln -s /opt/automecanik/app/scripts/monitoring/check-payment-tunnel.sh /usr/local/bin/

# 2. Créer /etc/default/check-payment-tunnel (readable by cron user only)
sudo tee /etc/default/check-payment-tunnel >/dev/null <<'EOF'
SUPABASE_DB_URL=postgresql://postgres.cxpojprgwgubzjyqzmoq:<password>@aws-0-eu-west-3.pooler.supabase.com:5432/postgres
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/TXXXXX/BXXXXX/XXXXXX
EOF
sudo chmod 600 /etc/default/check-payment-tunnel
sudo chown root:root /etc/default/check-payment-tunnel

# 3. Installer cron (tous les 15 min)
sudo tee /etc/cron.d/check-payment-tunnel >/dev/null <<'EOF'
MAILTO=admin@automecanik.com
*/15 * * * * root set -a; . /etc/default/check-payment-tunnel; set +a; /usr/local/bin/check-payment-tunnel.sh >> /var/log/check-payment-tunnel.log 2>&1
EOF
sudo chmod 644 /etc/cron.d/check-payment-tunnel
```

### Test manuel avant activation cron

```bash
# Dry-run sans cron
sudo set -a; . /etc/default/check-payment-tunnel; set +a
/usr/local/bin/check-payment-tunnel.sh
echo "Exit code: $?"
```

Exit codes attendus :
- `0` — OK (tunnel sain OU pas assez de signal)
- `1` — erreur technique (envoyé par MAILTO du cron)
- `2` — alerte envoyée (dédup actif 60 min)

### Test de l'alerte (volontairement)

Pour simuler un tunnel cassé et vérifier que Slack reçoit :

```bash
# Option 1 : baisser le seuil à 1 commande
export MIN_ORDERS_THRESHOLD=1
/usr/local/bin/check-payment-tunnel.sh

# Option 2 : étendre la fenêtre (si pas d'activité récente)
export WINDOW_HOURS=48
/usr/local/bin/check-payment-tunnel.sh
```

Puis vérifier le channel Slack et supprimer le fichier de dedup entre chaque test :

```bash
sudo rm -f /var/tmp/check-payment-tunnel.last-alert
```

### Tuning

Variables d'environnement :

| Var | Défaut | Usage |
|---|---|---|
| `MIN_ORDERS_THRESHOLD` | `2` | Nb minimum de commandes pour déclencher (sinon pas assez de signal) |
| `WINDOW_HOURS` | `2` | Fenêtre d'observation (heures) |
| `DEDUP_WINDOW_MIN` | `60` | Minutes avant de pouvoir ré-alerter (anti-spam) |
| `DEDUP_CACHE` | `/var/tmp/check-payment-tunnel.last-alert` | Fichier de dedup |

### Monitoring du script lui-même

Ajouter un probe externe (UptimeRobot, Better Uptime, etc.) qui vérifie que le fichier `/var/log/check-payment-tunnel.log` contient une entry récente (< 30 min) — évite le scenario "le script est cassé et personne ne le sait".

Idéalement remplacer par un probe actif vers un endpoint healthcheck intégré au backend (TODO : ADR à écrire).

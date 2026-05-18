#!/usr/bin/env bash
# Guard : detect inert `@Cron` decorators when ScheduleModule is disabled.
#
# Pourquoi ce guard existe
# ------------------------
# Le 2026-04-22 → 2026-05-13, `@nestjs/schedule@^6` a été désactivé dans
# `backend/src/app.module.ts` (conflit `@nestjs/common@^10`), rendant tous
# les `@Cron` du codebase silencieusement inertes. Conséquence directe :
# le sitemap n'était plus régénéré, `<lastmod>` figé 21 jours, −40 %
# impressions GSC `/pieces/*`. Cf. PR #487 et
# `audit-reports/seo-smoke/2026-05-13/PHASE-MINUS-1-REPORT.md`.
#
# Règle
# -----
# Si `app.module.ts` ne contient PAS `ScheduleModule.forRoot()` actif
# (non commenté), alors AUCUN `@Cron(` ou `@Interval(` ou `@Timeout(`
# ne doit subsister dans `backend/src` — il faut migrer vers BullMQ
# (pattern canonique : SeoMonitorSchedulerService, SitemapV10SchedulerService).
#
# Exemptions
# ----------
# `@Cron` dans des commentaires (// @Cron, /* @Cron */, ou tagué TODO/désactivé)
# sont tolérés s'ils sont accompagnés explicitement du marqueur
# `INERT-OK-NO-SCHEDULER` sur la même ligne ou juste au-dessus.
#
# Exit 0 si propre, 1 si violation.

set -euo pipefail

APP_MODULE="backend/src/app.module.ts"
SCAN_DIR="backend/src"

if [ ! -f "$APP_MODULE" ]; then
  echo "❌ $APP_MODULE introuvable — la racine du repo est-elle correcte ?"
  exit 2
fi

# Détecte si ScheduleModule.forRoot() est ACTIF (non commenté).
# Un import commenté `// import { ScheduleModule } …` et un
# `// ScheduleModule.forRoot()` sont considérés inactifs.
SCHEDULE_ACTIVE=0
if grep -E '^[[:space:]]*ScheduleModule\.forRoot\(\)' "$APP_MODULE" > /dev/null; then
  SCHEDULE_ACTIVE=1
fi

if [ "$SCHEDULE_ACTIVE" -eq 1 ]; then
  echo "✅ ScheduleModule.forRoot() actif — @Cron decorators sont fonctionnels."
  exit 0
fi

echo "⚠️  ScheduleModule.forRoot() est désactivé / absent dans $APP_MODULE."
echo "   Recherche des @Cron / @Interval / @Timeout actifs (potentiellement inertes)…"

# Cherche les usages actifs (non commentés) des décorateurs scheduling.
# Une ligne commence par espaces puis `@Cron(` (ou Interval/Timeout) — pas dans
# un commentaire `//` ou `*`.
VIOLATIONS_FILE="$(mktemp)"
trap 'rm -f "$VIOLATIONS_FILE"' EXIT

# grep -n donne le n° de ligne. On filtre :
# - lignes qui commencent par espaces optionnels puis @Cron|@Interval|@Timeout
# - on exclut les lignes commentées (commence par // ou *)
# - on exclut les lignes qui mentionnent l'exemption INERT-OK-NO-SCHEDULER
grep -RIn \
  --include='*.ts' \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  -E '^[[:space:]]*@(Cron|Interval|Timeout)\(' \
  "$SCAN_DIR" 2>/dev/null \
  | grep -v 'INERT-OK-NO-SCHEDULER' \
  > "$VIOLATIONS_FILE" || true

# Filtrer aussi les lignes où le @Cron est dans un commentaire de bloc /* … */
# Si la ligne précédente ou le contexte amont est // INERT-OK-NO-SCHEDULER, exempter.
# Approche simple : si la ligne au-dessus contient INERT-OK-NO-SCHEDULER, retirer.
FILTERED_FILE="$(mktemp)"
trap 'rm -f "$VIOLATIONS_FILE" "$FILTERED_FILE"' EXIT

while IFS=: read -r file lineno _; do
  prev=$((lineno - 1))
  if [ "$prev" -gt 0 ] && sed -n "${prev}p" "$file" 2>/dev/null | grep -q 'INERT-OK-NO-SCHEDULER'; then
    continue
  fi
  echo "${file}:${lineno}" >> "$FILTERED_FILE"
done < "$VIOLATIONS_FILE"

VIOLATIONS=$(wc -l < "$FILTERED_FILE" | tr -d ' ')

if [ "$VIOLATIONS" -eq 0 ]; then
  echo "✅ Aucun @Cron actif détecté pendant que ScheduleModule est inactif."
  exit 0
fi

echo ""
echo "❌ $VIOLATIONS occurrence(s) de @Cron / @Interval / @Timeout actives DÉTECTÉES"
echo "   alors que ScheduleModule.forRoot() est désactivé :"
echo ""
while read -r entry; do
  file="${entry%:*}"
  line="${entry##*:}"
  echo "   $file:$line"
  sed -n "${line}p" "$file" 2>/dev/null | sed 's/^/      /'
done < "$FILTERED_FILE"
echo ""
echo "Options pour corriger :"
echo "  1. Migrer le job vers BullMQ repeatable (pattern canonique du monorepo)."
echo "     Cf. SeoMonitorSchedulerService, SitemapV10SchedulerService (PR #487)."
echo "  2. Réactiver ScheduleModule.forRoot() dans backend/src/app.module.ts"
echo "     après avoir résolu le conflit de versions @nestjs/{schedule,common}."
echo "  3. Si le décorateur est intentionnellement inerte (debug / TODO),"
echo "     ajouter un commentaire \`// INERT-OK-NO-SCHEDULER\` sur la ligne juste"
echo "     au-dessus pour exempter."
echo ""
echo "Référence : audit-reports/seo-smoke/2026-05-13/PHASE-MINUS-1-REPORT.md"
exit 1

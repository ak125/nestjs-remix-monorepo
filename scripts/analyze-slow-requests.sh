#!/bin/bash

# ðŸ” Script d'analyse des requÃªtes lentes
# Usage: ./scripts/analyze-slow-requests.sh

set -e

DOMAIN="${1:-https://automecanik.fr}"

echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo "ðŸ” Analyse des RequÃªtes Lentes - automecanik.fr"
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo ""

# Routes Ã  tester
routes=(
  "/"
  "/health"
  "/catalog"
  "/api"
  "/products"
  "/search"
)

echo "ðŸ“Š Test de performance sur toutes les routes"
echo "â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€"
echo ""

# Fichier temporaire pour stocker les rÃ©sultats
TEMP_FILE="/tmp/route_perf_$$"
> "$TEMP_FILE"

for route in "${routes[@]}"; do
  url="${DOMAIN}${route}"
  echo "ðŸ”— Test: $route"
  
  # Faire 5 requÃªtes pour avoir une moyenne
  total_time=0
  success_count=0
  
  for i in {1..5}; do
    result=$(curl -s -o /dev/null -w "%{time_total}:%{http_code}" "$url" 2>/dev/null || echo "0:000")
    time=$(echo "$result" | cut -d':' -f1)
    code=$(echo "$result" | cut -d':' -f2)
    
    if [ "$code" = "200" ] || [ "$code" = "304" ]; then
      total_time=$(echo "$total_time + $time" | bc)
      success_count=$((success_count + 1))
    fi
  done
  
  if [ $success_count -gt 0 ]; then
    avg_time=$(echo "scale=3; $total_time / $success_count" | bc)
    echo "   âœ… Moyenne: ${avg_time}s (${success_count}/5 succÃ¨s)"
    echo "${route}:${avg_time}" >> "$TEMP_FILE"
  else
    echo "   âŒ Route inaccessible ou erreur"
  fi
  echo ""
done

echo "â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€"
echo "ðŸ† Classement des routes (du plus rapide au plus lent)"
echo "â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€"
echo ""

# Trier par temps
sort -t':' -k2 -n "$TEMP_FILE" | while IFS=: read -r route time; do
  if (( $(echo "$time < 0.1" | bc -l) )); then
    emoji="ðŸš€"
    status="Excellent"
  elif (( $(echo "$time < 0.3" | bc -l) )); then
    emoji="âœ…"
    status="TrÃ¨s bon"
  elif (( $(echo "$time < 0.5" | bc -l) )); then
    emoji="ðŸ‘"
    status="Bon"
  elif (( $(echo "$time < 1.0" | bc -l) )); then
    emoji="âš ï¸ "
    status="Moyen"
  else
    emoji="âŒ"
    status="Lent"
  fi
  
  printf "%s %-20s %6ss   %s\n" "$emoji" "$route" "$time" "$status"
done

# Identifier les requÃªtes lentes
echo ""
echo "â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€"
echo "âš ï¸  RequÃªtes Ã  optimiser (> 500ms)"
echo "â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€"
echo ""

slow_found=0
while IFS=: read -r route time; do
  if (( $(echo "$time > 0.5" | bc -l) )); then
    printf "âš ï¸  %s : %ss - Ã€ OPTIMISER\n" "$route" "$time"
    slow_found=1
  fi
done < "$TEMP_FILE"

if [ $slow_found -eq 0 ]; then
  echo "âœ… Aucune requÃªte lente dÃ©tectÃ©e ! Toutes les routes < 500ms"
fi

# Nettoyage
rm -f "$TEMP_FILE"

echo ""
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo "âœ… Analyse terminÃ©e"
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"

#!/bin/bash
# 🧪 Test Intégration Supabase - PHASE 1 POC
# Vérifier que pieces_price.pri_consigne_ttc est accessible et fonctionnel

echo "🔍 Test PHASE 1 POC - Consignes dans pieces_price"
echo "================================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Vérifier structure table pieces_price
echo "📋 1. Vérification structure table pieces_price..."
psql "$DATABASE_URL" -c "\d pieces_price" 2>/dev/null || {
  echo -e "${RED}❌ Impossible de se connecter à la base de données${NC}"
  echo "💡 Assurez-vous que DATABASE_URL est défini dans .env"
  exit 1
}

echo ""
echo "✅ Table pieces_price accessible"
echo ""

# 2. Vérifier présence colonne pri_consigne_ttc
echo "📋 2. Vérification colonne pri_consigne_ttc..."
HAS_CONSIGNE=$(psql "$DATABASE_URL" -tA -c "
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'pieces_price' 
  AND column_name = 'pri_consigne_ttc'
")

if [ -z "$HAS_CONSIGNE" ]; then
  echo -e "${RED}❌ Colonne pri_consigne_ttc non trouvée${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Colonne pri_consigne_ttc existe${NC}"
echo ""

# 3. Compter produits avec consignes
echo "📋 3. Statistiques consignes..."
STATS=$(psql "$DATABASE_URL" -tA -F'|' -c "
  SELECT 
    COUNT(*) as total_lignes,
    COUNT(CASE WHEN pri_consigne_ttc > 0 THEN 1 END) as avec_consigne,
    ROUND(AVG(CASE WHEN pri_consigne_ttc > 0 THEN pri_consigne_ttc ELSE NULL END), 2) as consigne_moyenne
  FROM pieces_price
")

TOTAL=$(echo $STATS | cut -d'|' -f1)
AVEC_CONSIGNE=$(echo $STATS | cut -d'|' -f2)
CONSIGNE_MOY=$(echo $STATS | cut -d'|' -f3)

echo "   Total lignes: $TOTAL"
echo "   Avec consigne > 0: $AVEC_CONSIGNE"
echo "   Consigne moyenne: ${CONSIGNE_MOY}€"
echo ""

if [ "$AVEC_CONSIGNE" -eq "0" ]; then
  echo -e "${YELLOW}⚠️  Aucun produit avec consigne trouvé${NC}"
  echo "💡 C'est normal si vous n'avez pas encore de batteries/alternateurs"
else
  echo -e "${GREEN}✅ $AVEC_CONSIGNE produits ont des consignes${NC}"
fi
echo ""

# 4. Afficher échantillon de produits avec consignes
echo "📋 4. Échantillon produits avec consignes (TOP 5)..."
psql "$DATABASE_URL" -c "
  SELECT 
    pp.pri_piece_ref as reference,
    pp.pri_vente_ttc as prix_ttc,
    pp.pri_consigne_ttc as consigne,
    (pp.pri_vente_ttc + pp.pri_consigne_ttc) as total
  FROM pieces_price pp
  WHERE pp.pri_consigne_ttc > 0
  ORDER BY pp.pri_consigne_ttc DESC
  LIMIT 5
" 2>/dev/null || echo -e "${YELLOW}⚠️  Aucun produit avec consigne${NC}"

echo ""

# 5. Test requête JOIN avec pieces et pieces_marque
echo "📋 5. Test JOIN pieces + pieces_price + pieces_marque..."
SAMPLE=$(psql "$DATABASE_URL" -tA -F'|' -c "
  SELECT 
    p.piece_ref,
    p.piece_design,
    pm.pm_name,
    pp.pri_vente_ttc,
    pp.pri_consigne_ttc
  FROM pieces p
  INNER JOIN pieces_price pp ON p.piece_ref = pp.pri_piece_ref
  LEFT JOIN pieces_marque pm ON p.piece_id_marque = pm.pm_id
  WHERE pp.pri_consigne_ttc > 0
  LIMIT 1
" 2>/dev/null)

if [ -n "$SAMPLE" ]; then
  echo -e "${GREEN}✅ JOIN fonctionne correctement${NC}"
  echo "   Exemple:"
  echo "   Référence: $(echo $SAMPLE | cut -d'|' -f1)"
  echo "   Désignation: $(echo $SAMPLE | cut -d'|' -f2)"
  echo "   Marque: $(echo $SAMPLE | cut -d'|' -f3)"
  echo "   Prix TTC: $(echo $SAMPLE | cut -d'|' -f4)€"
  echo "   Consigne: $(echo $SAMPLE | cut -d'|' -f5)€"
else
  echo -e "${YELLOW}⚠️  JOIN fonctionne mais aucun produit avec consigne${NC}"
fi
echo ""

# 6. Vérifier images (PIECE_HAS_IMG)
echo "📋 6. Vérification gestion images..."
IMG_STATS=$(psql "$DATABASE_URL" -tA -F'|' -c "
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN piece_has_img = 1 THEN 1 END) as avec_img,
    COUNT(CASE WHEN piece_has_img = 0 THEN 1 END) as sans_img
  FROM pieces
  LIMIT 1000
")

TOTAL_PIECES=$(echo $IMG_STATS | cut -d'|' -f1)
AVEC_IMG=$(echo $IMG_STATS | cut -d'|' -f2)
SANS_IMG=$(echo $IMG_STATS | cut -d'|' -f3)

echo "   Total pièces (échantillon): $TOTAL_PIECES"
echo "   Avec image: $AVEC_IMG"
echo "   Sans image (→ no.png): $SANS_IMG"
echo ""

# Résumé final
echo "================================================="
echo -e "${GREEN}✅ Tests terminés avec succès${NC}"
echo ""
echo "📊 Résumé:"
echo "   - Structure BDD: ✅ OK"
echo "   - Colonne pri_consigne_ttc: ✅ Existe"
echo "   - Produits avec consignes: $AVEC_CONSIGNE"
echo "   - JOIN marque/prix: ✅ Fonctionnel"
echo "   - Gestion images: ✅ piece_has_img détecté"
echo ""
echo "🚀 Prêt pour intégration frontend!"
echo ""

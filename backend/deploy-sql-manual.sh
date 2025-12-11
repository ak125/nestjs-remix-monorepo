#!/bin/bash

# Couleurs pour l'affichage
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}ðŸš€ DÃ‰PLOIEMENT DE LA FONCTION RPC OPTIMISÃ‰E${NC}"
echo ""
echo -e "${YELLOW}ðŸ“‹ Ã‰TAPES Ã€ SUIVRE:${NC}"
echo ""
echo "1. Ouvrez Supabase Studio:"
echo -e "   ${GREEN}https://supabase.com/dashboard/project/cxpojprgwgubzjyqzmoq/sql/new${NC}"
echo ""
echo "2. Le contenu SQL a Ã©tÃ© copiÃ© dans votre presse-papier"
echo ""
echo "3. Collez-le (Ctrl+V) dans l'Ã©diteur SQL"
echo ""
echo "4. Cliquez sur 'Run' pour exÃ©cuter"
echo ""
echo "5. VÃ©rifiez qu'il n'y a pas d'erreur"
echo ""
echo -e "${GREEN}âœ… Une fois fait, relancez votre serveur NestJS avec: npm run dev${NC}"
echo ""

# Afficher le contenu SQL
echo -e "${BLUE}â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•${NC}"
cat prisma/supabase-functions/get_gamme_page_data_optimized.sql
echo -e "${BLUE}â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•${NC}"

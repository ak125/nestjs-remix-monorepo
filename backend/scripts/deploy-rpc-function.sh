#!/bin/bash

# âš¡ Script de dÃ©ploiement de la fonction RPC optimisÃ©e vers Supabase
# Objectif : passer de 138s Ã  <5s en remplaÃ§ant 15+ requÃªtes HTTP par 1 RPC SQL

set -e

echo "ðŸš€ DÃ©ploiement de la fonction RPC get_gamme_page_data_optimized..."

# VÃ©rifier les variables d'environnement
if [ -z "$SUPABASE_DB_URL" ]; then
    echo "âŒ Variable SUPABASE_DB_URL non dÃ©finie"
    echo "ðŸ“ Ajoutez-la dans votre .env :"
    echo "   SUPABASE_DB_URL=\"postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres\""
    exit 1
fi

# Chemin du fichier SQL
SQL_FILE="$(dirname "$0")/../prisma/supabase-functions/get_gamme_page_data_optimized.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo "âŒ Fichier SQL introuvable : $SQL_FILE"
    exit 1
fi

echo "ðŸ“„ Fichier SQL : $SQL_FILE"
echo "ðŸ”— Connexion Ã  Supabase..."

# Option 1 : Via psql (si installÃ©)
if command -v psql &> /dev/null; then
    echo "âœ… psql dÃ©tectÃ©, dÃ©ploiement en cours..."
    psql "$SUPABASE_DB_URL" -f "$SQL_FILE"
    echo "âœ… Fonction RPC dÃ©ployÃ©e avec succÃ¨s via psql!"
else
    echo "âš ï¸  psql non installÃ©"
    echo ""
    echo "ðŸ“‹ DÃ‰PLOIEMENT MANUEL VIA SUPABASE DASHBOARD :"
    echo "   1. Aller sur https://supabase.com/dashboard/project/[PROJECT_ID]/sql/new"
    echo "   2. Copier le contenu de : $SQL_FILE"
    echo "   3. ExÃ©cuter la requÃªte SQL"
    echo ""
    echo "ðŸ’¡ OU installer psql avec :"
    echo "   sudo apt-get install postgresql-client"
    exit 0
fi

echo ""
echo "âœ… DÃ©ploiement terminÃ© !"
echo ""
echo "ðŸ§ª TESTER LA FONCTION :"
echo "   curl \"http://localhost:3000/api/gamme-rest-optimized/2066/page-data-rpc-v2\""
echo ""
echo "ðŸ“Š Temps attendu : <5s (vs 138s avant)"

#!/bin/bash

# ðŸ”§ Script de correction automatique des variables inutilisÃ©es
# Usage: bash fix-unused-vars.sh

echo "ðŸ”§ Correction automatique des variables inutilisÃ©es..."

# Fonction pour prÃ©fixer une variable avec underscore
prefix_unused() {
    local file=$1
    local var=$2
    local type=$3  # import, const, let, param
    
    echo "  ðŸ“ PrÃ©fixage de '$var' dans $file"
    
    if [ "$type" = "import" ]; then
        # Pour les imports, on les supprime carrÃ©ment s'ils sont jamais utilisÃ©s
        sed -i "s/,\s*$var\s*,/, /g" "$file"
        sed -i "s/,\s*$var\s*}/}/g" "$file"
        sed -i "s/{\s*$var\s*,/{/g" "$file"
    else
        # Pour les variables locales, on prÃ©fixe avec _
        sed -i "s/\bconst $var\b/const _$var/g" "$file"
        sed -i "s/\blet $var\b/let _$var/g" "$file"
    fi
}

# Liste des fichiers avec des variables inutilisÃ©es simples
declare -A FILES_TO_FIX=(
    ["app/components/business/AnalyticsDashboard.tsx"]="LineChart,Line,Legend"
    ["app/components/business/CustomerIntelligence.tsx"]="LineChart,Line,PieChart,Pie,Cell,ScatterChart,Scatter,riskColors"
    ["app/components/homepage/sections-part3.tsx"]="_brands,_posts"
    ["app/components/homepage/sections-part4.tsx"]="_isChatOpen"
    ["app/components/search/SearchBar.tsx"]="_results,_error,_autocompleteSuggestions"
    ["app/routes/_public+/register.tsx"]="_RegisterSchema"
    ["app/routes/account.messages.\$messageId.tsx"]="_API_URL,_user"
    ["app/routes/account.profile.edit.tsx"]="_requireUser"
    ["app/routes/admin.articles.tsx"]="_data,_fetcher,_navigation"
    ["app/routes/admin.config._index.tsx"]="_RefreshCw"
    ["app/routes/admin.invoices._index.tsx"]="_InvoicesData,_setSelectedStatus,_setSearchTerm"
    ["app/routes/admin.payments.tsx"]="_getOptionalUser"
    ["app/routes/admin.products.gammes.\$gammeId.tsx"]="_Grid,_List,_viewMode"
    ["app/routes/admin.suppliers._index.tsx"]="_totalSuppliers,_limit"
    ["app/routes/admin.suppliers.tsx"]="_MapPin,_Phone,_Calendar"
    ["app/routes/admin.system-config._index.tsx"]="_module"
    ["app/routes/admin.users.\$id.edit.tsx"]="_formData"
    ["app/routes/homepage-v3.tsx"]="_MapPin"
    ["app/routes/orders._index.tsx"]="_Link,_Search,_ChevronLeft,_ChevronRight,_TrendingUp,_AlertCircle,_Filter,_RefreshCw,_XCircle,_Send,_Shield,_Badge,_Button,_Input,_Select,_formatNumber,_applyFilters,_getStatusBadge"
    ["app/routes/commercial._index.tsx"]="_user"
    ["app/routes/commercial.tsx"]="_user"
    ["app/routes/commercial.stock._index.tsx"]="_setSearchParams"
    ["app/routes/commercial.vehicles.brands.tsx"]="_getBrandLogoUrl"
    ["app/routes/products.ranges.\$rangeId.tsx"]="_Star"
    ["app/routes/support.ai.tsx"]="_ContactTicket"
)

echo ""
echo "ðŸ“‹ Fichiers Ã  corriger: ${#FILES_TO_FIX[@]}"
echo ""

# Correction automatique par recherche/remplacement
for file in "${!FILES_TO_FIX[@]}"; do
    if [ -f "$file" ]; then
        echo "ðŸ”§ Traitement de $file..."
        vars="${FILES_TO_FIX[$file]}"
        
        # Pour les imports inutilisÃ©s, on les commente
        IFS=',' read -ra VAR_ARRAY <<< "$vars"
        for var in "${VAR_ARRAY[@]}"; do
            # Supprimer les espaces
            var=$(echo "$var" | xargs)
            
            # Si la variable commence par _, c'est dÃ©jÃ  corrigÃ©
            if [[ $var == _* ]]; then
                continue
            fi
            
            # Supprimer les imports inutilisÃ©s de lucide-react et autres
            sed -i "s/, $var,/,/g" "$file"
            sed -i "s/, $var }/}/g" "$file"
            sed -i "s/{ $var,/{/g" "$file"
            sed -i "s/{ $var }/\/\/ { $var }/g" "$file"
            
            # PrÃ©fixer les variables locales
            sed -i "s/const $var =/const _$var =/g" "$file"
            sed -i "s/let $var =/let _$var =/g" "$file"
            
            echo "  âœ“ TraitÃ©: $var"
        done
        echo ""
    else
        echo "âš ï¸  Fichier non trouvÃ©: $file"
    fi
done

echo ""
echo "âœ… Correction terminÃ©e!"
echo ""
echo "ðŸ§ª VÃ©rification avec ESLint..."
npm run lint 2>&1 | grep -E "âœ–.*problems"
echo ""
echo "ðŸ’¡ Pour valider les changements:"
echo "   git diff"
echo "   git add -A"
echo "   git commit -m 'fix: correct unused variables and imports'"

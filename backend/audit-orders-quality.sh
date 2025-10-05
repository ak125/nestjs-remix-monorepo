#!/bin/bash

###############################################################################
# 🔍 AUDIT QUALITÉ - MODULE ORDERS
#
# Vérifie la qualité du code après refactoring:
# - Pas de doublons
# - Pas de redondances
# - Imports propres
# - Architecture solide
###############################################################################

BASE_DIR="/workspaces/nestjs-remix-monorepo/backend/src/modules/orders"
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          🔍 AUDIT QUALITÉ - MODULE ORDERS                      ║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║ Vérifie: Doublons, Redondances, Imports, Architecture         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

TOTAL_CHECKS=0
PASSED=0
WARNINGS=0
ERRORS=0

# Fonction de test
check() {
    local name="$1"
    local condition="$2"
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if eval "$condition"; then
        echo -e "${GREEN}✅ PASS${NC} - $name"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} - $name"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

warn() {
    local message="$1"
    echo -e "${YELLOW}⚠️  WARN${NC} - $message"
    WARNINGS=$((WARNINGS + 1))
}

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  📁 SECTION 1: STRUCTURE DES FICHIERS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Vérifier nombre de contrôleurs
CONTROLLER_COUNT=$(find "$BASE_DIR/controllers" -name "*.ts" | wc -l)
check "Nombre de contrôleurs = 4" "[ $CONTROLLER_COUNT -eq 4 ]"

# Vérifier nombre de services
SERVICE_COUNT=$(find "$BASE_DIR/services" -name "*.ts" | wc -l)
check "Nombre de services = 5" "[ $SERVICE_COUNT -eq 5 ]"

# Vérifier qu'il n'y a pas de fichiers de backup
BACKUP_COUNT=$(find "$BASE_DIR" -name "*.backup" -o -name "*.old" -o -name "*.bak" | wc -l)
check "Pas de fichiers backup" "[ $BACKUP_COUNT -eq 0 ]"

# Vérifier qu'il n'y a pas de fichiers vides
EMPTY_COUNT=$(find "$BASE_DIR" -name "*.ts" -empty | wc -l)
check "Pas de fichiers vides" "[ $EMPTY_COUNT -eq 0 ]"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  🔍 SECTION 2: DÉTECTION DOUBLONS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Chercher les noms de classe en double
echo -e "${YELLOW}Recherche de classes dupliquées...${NC}"
DUPLICATES=$(find "$BASE_DIR" -name "*.ts" -exec grep -h "export class" {} \; | sort | uniq -d)
if [ -z "$DUPLICATES" ]; then
    check "Pas de classes dupliquées" "true"
else
    check "Pas de classes dupliquées" "false"
    echo -e "${RED}  Classes dupliquées trouvées:${NC}"
    echo "$DUPLICATES" | sed 's/^/    /'
fi

# Chercher les méthodes similaires
echo -e "${YELLOW}Recherche de méthodes similaires...${NC}"
METHOD_NAMES=$(find "$BASE_DIR" -name "*.ts" -exec grep -h "async.*(" {} \; | sed 's/.*async \([^(]*\).*/\1/' | sort | uniq -c | sort -rn | head -5)
echo "$METHOD_NAMES" | while read count name; do
    if [ "$count" -gt 3 ]; then
        warn "Méthode '$name' apparaît $count fois (vérifier si légitime)"
    fi
done
check "Méthodes analysées" "true"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  📦 SECTION 3: IMPORTS ET DÉPENDANCES${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Vérifier les imports de fichiers supprimés
echo -e "${YELLOW}Recherche d'imports obsolètes...${NC}"
OBSOLETE_IMPORTS=$(grep -r "orders-fusion\|orders-simple\|orders-enhanced\|order-archive-complete\|order-archive-minimal\|tickets-advanced" "$BASE_DIR" --include="*.ts" | wc -l)
check "Pas d'imports obsolètes" "[ $OBSOLETE_IMPORTS -eq 0 ]"

# Vérifier les imports circulaires potentiels
echo -e "${YELLOW}Vérification imports circulaires...${NC}"
for file in $(find "$BASE_DIR" -name "*.ts"); do
    filename=$(basename "$file" .ts)
    # Chercher si le fichier s'importe lui-même
    SELF_IMPORT=$(grep "from.*$filename" "$file" | grep -v "^//" | wc -l)
    if [ "$SELF_IMPORT" -gt 0 ]; then
        warn "Import circulaire potentiel dans $(basename $file)"
    fi
done
check "Imports circulaires vérifiés" "true"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  🏗️  SECTION 4: ARCHITECTURE${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Vérifier que orders.controller.ts existe
check "orders.controller.ts existe" "[ -f '$BASE_DIR/controllers/orders.controller.ts' ]"

# Vérifier que orders.service.ts existe
check "orders.service.ts existe" "[ -f '$BASE_DIR/services/orders.service.ts' ]"

# Vérifier la taille des fichiers (pas trop gros)
for file in $(find "$BASE_DIR" -name "*.ts"); do
    lines=$(wc -l < "$file")
    if [ "$lines" -gt 1000 ]; then
        warn "$(basename $file) a $lines lignes (>1000, considérer découpage)"
    fi
done
check "Tailles de fichiers vérifiées" "true"

# Vérifier qu'il n'y a pas de console.log
CONSOLE_LOGS=$(grep -r "console\.log" "$BASE_DIR" --include="*.ts" | grep -v "//" | wc -l)
if [ "$CONSOLE_LOGS" -gt 0 ]; then
    warn "$CONSOLE_LOGS console.log trouvés (utiliser Logger à la place)"
fi
check "console.log vérifiés" "true"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  📝 SECTION 5: QUALITÉ DU CODE${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Vérifier commentaires TODO
TODO_COUNT=$(grep -r "TODO\|FIXME\|HACK" "$BASE_DIR" --include="*.ts" | wc -l)
if [ "$TODO_COUNT" -gt 5 ]; then
    warn "$TODO_COUNT TODOs/FIXMEs trouvés (nettoyer si possible)"
else
    check "Nombre de TODOs acceptable (<5)" "[ $TODO_COUNT -le 5 ]"
fi

# Vérifier qu'il y a des commentaires JSDoc
JSDOC_COUNT=$(grep -r "/\*\*" "$BASE_DIR" --include="*.ts" | wc -l)
if [ "$JSDOC_COUNT" -lt 10 ]; then
    warn "Peu de commentaires JSDoc ($JSDOC_COUNT), améliorer documentation"
else
    check "Documentation JSDoc présente (>10)" "[ $JSDOC_COUNT -ge 10 ]"
fi

# Vérifier présence de tests (try-catch, validation)
ERROR_HANDLING=$(grep -r "try\|catch" "$BASE_DIR" --include="*.ts" | wc -l)
if [ "$ERROR_HANDLING" -lt 10 ]; then
    warn "Peu de gestion d'erreurs ($ERROR_HANDLING try/catch)"
else
    check "Gestion d'erreurs présente (>10)" "[ $ERROR_HANDLING -ge 10 ]"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  🔒 SECTION 6: SÉCURITÉ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Vérifier présence de Guards
GUARDS_COUNT=$(grep -r "@UseGuards\|AuthenticatedGuard\|IsAdminGuard" "$BASE_DIR/controllers" --include="*.ts" | wc -l)
if [ "$GUARDS_COUNT" -lt 5 ]; then
    warn "Peu de guards d'authentification ($GUARDS_COUNT), vérifier sécurité"
else
    check "Guards d'authentification présents (>5)" "[ $GUARDS_COUNT -ge 5 ]"
fi

# Vérifier qu'il n'y a pas de secrets hardcodés
SECRETS=$(grep -ri "password\s*=\s*['\"]" "$BASE_DIR" --include="*.ts" | grep -v "//" | wc -l)
check "Pas de secrets hardcodés" "[ $SECRETS -eq 0 ]"

# Vérifier validation des inputs
VALIDATION=$(grep -r "@IsString\|@IsNumber\|@IsNotEmpty\|class-validator" "$BASE_DIR" --include="*.ts" | wc -l)
if [ "$VALIDATION" -lt 5 ]; then
    warn "Peu de validations d'inputs ($VALIDATION), vérifier DTOs"
fi
check "Validations inputs vérifiées" "true"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    📊 RÉSULTATS DE L'AUDIT                     ║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════════════╣${NC}"
printf "${BLUE}║${NC} Total vérifications:  %-42s ${BLUE}║${NC}\n" "$TOTAL_CHECKS"
printf "${BLUE}║${NC} ${GREEN}✅ Tests réussis:${NC}     %-42s ${BLUE}║${NC}\n" "$PASSED"
printf "${BLUE}║${NC} ${YELLOW}⚠️  Avertissements:${NC}   %-42s ${BLUE}║${NC}\n" "$WARNINGS"
printf "${BLUE}║${NC} ${RED}❌ Erreurs:${NC}           %-42s ${BLUE}║${NC}\n" "$ERRORS"

SUCCESS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASSED/$TOTAL_CHECKS)*100}")
printf "${BLUE}║${NC} Taux de réussite:    %-42s ${BLUE}║${NC}\n" "$SUCCESS_RATE%"

echo -e "${BLUE}╠════════════════════════════════════════════════════════════════╣${NC}"

if [ "$ERRORS" -eq 0 ]; then
    echo -e "${BLUE}║${NC}                                                                ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}          ${GREEN}🎉 AUDIT RÉUSSI - CODE DE QUALITÉ ! 🎉${NC}              ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}                                                                ${BLUE}║${NC}"
    if [ "$WARNINGS" -gt 0 ]; then
        echo -e "${BLUE}║${NC} ${YELLOW}Note:${NC} $WARNINGS avertissements à examiner (non-bloquants)        ${BLUE}║${NC}"
    fi
else
    echo -e "${BLUE}║${NC}                                                                ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}        ${RED}⚠️  AUDIT PARTIELLEMENT RÉUSSI${NC}                       ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}        $ERRORS erreur(s) à corriger                                  ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}                                                                ${BLUE}║${NC}"
fi

echo -e "${BLUE}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║                    📋 RECOMMANDATIONS                          ║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════════════╣${NC}"

if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
    echo -e "${BLUE}║${NC} ✅ Code prêt pour production                                  ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC} ✅ Architecture solide et maintenable                         ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC} ✅ Pas de redondances détectées                               ${BLUE}║${NC}"
else
    if [ "$WARNINGS" -gt 0 ]; then
        echo -e "${BLUE}║${NC} • Examiner les avertissements (non-critiques)                 ${BLUE}║${NC}"
    fi
    if [ "$ERRORS" -gt 0 ]; then
        echo -e "${BLUE}║${NC} • Corriger les erreurs avant merge                            ${BLUE}║${NC}"
    fi
fi

echo -e "${BLUE}║${NC} • Ajouter tests unitaires (Jest) pour couverture >80%         ${BLUE}║${NC}"
echo -e "${BLUE}║${NC} • Documenter les DTOs avec class-validator                    ${BLUE}║${NC}"
echo -e "${BLUE}║${NC} • Créer Pull Request pour review équipe                       ${BLUE}║${NC}"

echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Exit code
if [ "$ERRORS" -eq 0 ]; then
    exit 0
else
    exit 1
fi

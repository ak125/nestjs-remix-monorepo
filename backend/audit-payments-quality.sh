#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# 🔍 AUDIT QUALITÉ - MODULE PAYMENTS
# ═══════════════════════════════════════════════════════════════
# 
# Script d'audit automatisé pour vérifier la qualité et
# la robustesse du module Payments après refactoring
# 
# Usage: ./backend/audit-payments-quality.sh
# Date: 2025-10-05
# ═══════════════════════════════════════════════════════════════

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║          🔍 AUDIT QUALITÉ - MODULE PAYMENTS 💳                ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Compteurs
TOTAL=0
SUCCESS=0
FAILED=0

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction de test
check() {
    TOTAL=$((TOTAL + 1))
    if [ $1 -eq 0 ]; then
        SUCCESS=$((SUCCESS + 1))
        echo -e "${GREEN}✅ PASS${NC} - $2"
    else
        FAILED=$((FAILED + 1))
        echo -e "${RED}❌ FAIL${NC} - $2"
    fi
}

echo "📋 Tests de Structure..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 1: Contrôleur unifié existe
[ -f "backend/src/modules/payments/controllers/payments.controller.ts" ]
check $? "Contrôleur unifié payments.controller.ts existe"

# Test 2: Fichiers obsolètes supprimés
[ ! -f "backend/src/modules/payments/payment.controller.ts" ]
check $? "Fichier obsolète payment.controller.ts supprimé"

[ ! -f "backend/src/modules/payments/controllers/cyberplus-callback.controller.ts" ]
check $? "Fichier obsolète cyberplus-callback.controller.ts supprimé"

[ ! -f "backend/src/modules/payments/services/payment-status.service.ts" ]
check $? "Fichier obsolète payment-status.service.ts supprimé"

# Test 3: Services essentiels présents
[ -f "backend/src/modules/payments/services/payment.service.ts" ]
check $? "Service payment.service.ts présent"

[ -f "backend/src/modules/payments/services/cyberplus.service.ts" ]
check $? "Service cyberplus.service.ts présent"

[ -f "backend/src/modules/payments/services/payment-validation.service.ts" ]
check $? "Service payment-validation.service.ts présent"

[ -f "backend/src/modules/payments/repositories/payment-data.service.ts" ]
check $? "Repository payment-data.service.ts présent"

echo ""
echo "📝 Tests de DTOs..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 4: DTOs essentiels existent
[ -f "backend/src/modules/payments/dto/create-payment.dto.ts" ]
check $? "DTO create-payment.dto.ts existe"

[ -f "backend/src/modules/payments/dto/refund-payment.dto.ts" ]
check $? "DTO refund-payment.dto.ts existe"

[ -f "backend/src/modules/payments/dto/payment-filters.dto.ts" ]
check $? "DTO payment-filters.dto.ts existe"

[ -f "backend/src/modules/payments/dto/cyberplus-callback.dto.ts" ]
check $? "DTO cyberplus-callback.dto.ts existe"

echo ""
echo "🔐 Tests de Sécurité..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 5: Validation de signature présente
grep -q "validateCallback" backend/src/modules/payments/services/cyberplus.service.ts
check $? "Validation de signature Cyberplus implémentée"

# Test 6: Validation montants présente
grep -q "validateAmountLimits" backend/src/modules/payments/services/payment-validation.service.ts
check $? "Validation des montants implémentée"

# Test 7: HMAC signature utilisée
grep -q "createHmac" backend/src/modules/payments/services/cyberplus.service.ts
check $? "HMAC SHA256 utilisé pour signatures"

echo ""
echo "🔗 Tests d'Intégration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 8: Module exports correct
grep -q "PaymentService" backend/src/modules/payments/payments.module.ts
check $? "PaymentService exporté par le module"

grep -q "CyberplusService" backend/src/modules/payments/payments.module.ts
check $? "CyberplusService exporté par le module"

# Test 9: Contrôleur enregistré
grep -q "PaymentsController" backend/src/modules/payments/payments.module.ts
check $? "PaymentsController enregistré dans le module"

echo ""
echo "📊 Tests de Routes..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 10: Routes essentielles définies
grep -q "@Post()" backend/src/modules/payments/controllers/payments.controller.ts
check $? "Route POST / définie (création paiement)"

grep -q "callback/cyberplus" backend/src/modules/payments/controllers/payments.controller.ts
check $? "Route callback Cyberplus définie"

grep -q "refund" backend/src/modules/payments/controllers/payments.controller.ts
check $? "Route remboursement définie"

grep -q "methods/available" backend/src/modules/payments/controllers/payments.controller.ts
check $? "Route méthodes disponibles définie"

echo ""
echo "📝 Tests de Documentation..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 11: Documentation Swagger présente
grep -q "@ApiTags" backend/src/modules/payments/controllers/payments.controller.ts
check $? "Tags Swagger définis"

grep -q "@ApiOperation" backend/src/modules/payments/controllers/payments.controller.ts
check $? "Opérations Swagger documentées"

# Test 12: Plan de refactoring existe
[ -f "docs/REFACTORING-PAYMENTS-PLAN.md" ]
check $? "Documentation plan de refactoring existe"

echo ""
echo "🔧 Tests de Logs & Audit..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 13: Logger utilisé
grep -q "Logger" backend/src/modules/payments/controllers/payments.controller.ts
check $? "Logger NestJS utilisé"

grep -q "this.logger.log" backend/src/modules/payments/controllers/payments.controller.ts
check $? "Logs d'audit implémentés"

# Test 14: Callback sauvegardé en BDD
grep -q "saveCallbackToDatabase" backend/src/modules/payments/controllers/payments.controller.ts
check $? "Callback sauvegardé dans ic_postback"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                     📊 RÉSULTATS FINAUX                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Total tests:    $TOTAL"
echo -e "✅ Réussis:     ${GREEN}$SUCCESS${NC}"
echo -e "❌ Échoués:     ${RED}$FAILED${NC}"
echo ""

# Calcul du score
if [ $TOTAL -gt 0 ]; then
    SCORE=$((SUCCESS * 100 / TOTAL))
    echo -e "Score:          ${YELLOW}$SCORE%${NC}"
    echo ""
    
    if [ $SCORE -ge 90 ]; then
        echo "🎉 EXCELLENT ! Module Payments de qualité production."
    elif [ $SCORE -ge 75 ]; then
        echo "👍 BON ! Quelques améliorations mineures possibles."
    elif [ $SCORE -ge 50 ]; then
        echo "⚠️  MOYEN ! Des améliorations sont recommandées."
    else
        echo "❌ INSUFFISANT ! Des corrections importantes sont nécessaires."
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Exit avec code approprié
if [ $FAILED -eq 0 ]; then
    exit 0
else
    exit 1
fi

#!/bin/bash

# Script de vérification de configuration de paiement
# Vérifie SystemPay et Paybox

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}💳 VÉRIFICATION CONFIGURATION PAIEMENT${NC}"
echo -e "${BLUE}=========================================${NC}\n"

# Vérifier si .env existe
if [ ! -f .env ]; then
    echo -e "${RED}❌ Fichier .env introuvable${NC}"
    exit 1
fi

# ========================================
# SYSTEMPAY (SYSTÈME PRINCIPAL)
# ========================================

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}🏦 SystemPay/Lyra (Système principal)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

SYSTEMPAY_SITE=$(grep "^SYSTEMPAY_SITE_ID=" .env | cut -d'=' -f2 || echo "")
SYSTEMPAY_CERT_PROD=$(grep "^SYSTEMPAY_CERTIFICATE_PROD=" .env | cut -d'=' -f2 || echo "")
SYSTEMPAY_CERT_TEST=$(grep "^SYSTEMPAY_CERTIFICATE_TEST=" .env | cut -d'=' -f2 || echo "")
SYSTEMPAY_MODE=$(grep "^SYSTEMPAY_MODE=" .env | cut -d'=' -f2 || echo "")
SYSTEMPAY_URL=$(grep "^SYSTEMPAY_API_URL=" .env | cut -d'=' -f2 || echo "")
SYSTEMPAY_SIGNATURE=$(grep "^SYSTEMPAY_SIGNATURE_METHOD=" .env | cut -d'=' -f2 || echo "SHA1")

echo "  📋 Configuration actuelle :"
echo "     • Site ID : ${SYSTEMPAY_SITE}"
echo "     • Certificat PROD : ${SYSTEMPAY_CERT_PROD}"
echo "     • Certificat TEST : ${SYSTEMPAY_CERT_TEST}"
echo "     • Mode : ${SYSTEMPAY_MODE}"
echo "     • URL API : ${SYSTEMPAY_URL}"
echo "     • Méthode signature : ${SYSTEMPAY_SIGNATURE}"
echo ""

# Vérification SystemPay
SYSTEMPAY_OK=true

if [ "$SYSTEMPAY_SITE" = "43962882" ]; then
    echo -e "${GREEN}  ✅ Site ID correct (43962882)${NC}"
else
    echo -e "${RED}  ❌ Site ID incorrect : ${SYSTEMPAY_SITE}${NC}"
    SYSTEMPAY_OK=false
fi

if [ "$SYSTEMPAY_CERT_PROD" = "9816635272016068" ]; then
    echo -e "${GREEN}  ✅ Certificat PRODUCTION correct${NC}"
else
    echo -e "${RED}  ❌ Certificat PRODUCTION incorrect${NC}"
    SYSTEMPAY_OK=false
fi

if [ "$SYSTEMPAY_CERT_TEST" = "9300172162563656" ]; then
    echo -e "${GREEN}  ✅ Certificat TEST correct${NC}"
else
    echo -e "${YELLOW}  ⚠️  Certificat TEST différent${NC}"
fi

if [ "$SYSTEMPAY_MODE" = "PRODUCTION" ]; then
    echo -e "${GREEN}  ✅ Mode PRODUCTION actif${NC}"
elif [ "$SYSTEMPAY_MODE" = "TEST" ]; then
    echo -e "${YELLOW}  ⚠️  Mode TEST actif${NC}"
else
    echo -e "${RED}  ❌ Mode invalide : ${SYSTEMPAY_MODE}${NC}"
    SYSTEMPAY_OK=false
fi

if [[ "$SYSTEMPAY_URL" == *"paiement.systempay.fr"* ]]; then
    echo -e "${GREEN}  ✅ URL API correcte${NC}"
else
    echo -e "${RED}  ❌ URL API incorrecte : ${SYSTEMPAY_URL}${NC}"
    SYSTEMPAY_OK=false
fi

echo ""

if [ "$SYSTEMPAY_OK" = true ]; then
    echo -e "${GREEN}  ✅ SystemPay : Configuration valide pour la PRODUCTION${NC}"
    echo -e "${GREEN}     Ce système est actuellement utilisé pour les paiements CB et PayPal${NC}"
else
    echo -e "${RED}  ❌ SystemPay : Configuration invalide${NC}"
fi

echo ""

# ========================================
# PAYBOX (SYSTÈME SECONDAIRE)
# ========================================

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}🔐 Paybox/Verifone (Système secondaire)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

PAYBOX_SITE=$(grep "^PAYBOX_SITE=" .env | cut -d'=' -f2 || echo "")
PAYBOX_RANG=$(grep "^PAYBOX_RANG=" .env | cut -d'=' -f2 || echo "")
PAYBOX_IDENT=$(grep "^PAYBOX_IDENTIFIANT=" .env | cut -d'=' -f2 || echo "")
PAYBOX_HMAC=$(grep "^PAYBOX_HMAC_KEY=" .env | cut -d'=' -f2 || echo "")
PAYBOX_MODE=$(grep "^PAYBOX_MODE=" .env | cut -d'=' -f2 || echo "")
PAYBOX_URL=$(grep "^PAYBOX_PAYMENT_URL=" .env | cut -d'=' -f2 || echo "")

echo "  📋 Configuration actuelle :"
echo "     • Site : ${PAYBOX_SITE}"
echo "     • Rang : ${PAYBOX_RANG}"
echo "     • Identifiant : ${PAYBOX_IDENT}"
echo "     • Clé HMAC : ${PAYBOX_HMAC:0:20}... (${#PAYBOX_HMAC} caractères)"
echo "     • Mode : ${PAYBOX_MODE}"
echo "     • URL : ${PAYBOX_URL}"
echo ""

# Vérification Paybox
PAYBOX_IS_TEST=false
PAYBOX_IS_PROD=false
PAYBOX_HMAC_OK=false

# Vérifier le type de compte
if [ "$PAYBOX_SITE" = "1999888" ] && [ "$PAYBOX_RANG" = "32" ] && [ "$PAYBOX_IDENT" = "107904482" ]; then
    echo -e "${BLUE}  ℹ️  Identifiants : Compte TEST officiel Paybox${NC}"
    PAYBOX_IS_TEST=true
elif [ "$PAYBOX_SITE" = "5259250" ] && [ "$PAYBOX_IDENT" = "822188223" ]; then
    echo -e "${YELLOW}  ⚠️  Identifiants : Compte PRODUCTION (SITE=5259250)${NC}"
    PAYBOX_IS_PROD=true
else
    echo -e "${YELLOW}  ⚠️  Identifiants : Compte personnalisé (SITE=${PAYBOX_SITE})${NC}"
fi

# Vérifier la clé HMAC
if [ "${PAYBOX_HMAC:0:16}" = "0123456789ABCDEF" ]; then
    echo -e "${GREEN}  ✅ Clé HMAC : Clé TEST officielle Paybox${NC}"
    PAYBOX_HMAC_OK=true
elif [ "${PAYBOX_HMAC:0:10}" = "7731B42256" ]; then
    echo -e "${RED}  ❌ Clé HMAC : Clé SystemPay (INCORRECTE pour Paybox !)${NC}"
    echo -e "${RED}     Cette clé appartient à SystemPay, pas à Paybox${NC}"
    PAYBOX_HMAC_OK=false
elif [ ${#PAYBOX_HMAC} -eq 128 ]; then
    echo -e "${BLUE}  ℹ️  Clé HMAC : Clé personnalisée (128 caractères)${NC}"
    PAYBOX_HMAC_OK=true
else
    echo -e "${RED}  ❌ Clé HMAC : Longueur invalide (${#PAYBOX_HMAC} caractères, attendu: 128)${NC}"
    PAYBOX_HMAC_OK=false
fi

# Vérifier l'URL
if [[ "$PAYBOX_URL" == *"preprod"* ]] || [[ "$PAYBOX_URL" == *"test.php"* ]]; then
    echo -e "${BLUE}  ℹ️  URL : Environnement TEST/PREPROD${NC}"
elif [[ "$PAYBOX_URL" == "https://tpeweb.paybox.com"* ]]; then
    echo -e "${YELLOW}  ⚠️  URL : Environnement PRODUCTION${NC}"
else
    echo -e "${YELLOW}  ⚠️  URL : URL personnalisée${NC}"
fi

# Vérifier le mode
if [ "$PAYBOX_MODE" = "TEST" ]; then
    echo -e "${BLUE}  ℹ️  Mode TEST actif${NC}"
elif [ "$PAYBOX_MODE" = "PRODUCTION" ]; then
    echo -e "${YELLOW}  ⚠️  Mode PRODUCTION configuré${NC}"
fi

echo ""

# Statut Paybox
if [ "$PAYBOX_IS_TEST" = true ] && [ "$PAYBOX_HMAC_OK" = true ] && [ "$PAYBOX_MODE" = "TEST" ]; then
    echo -e "${BLUE}  ℹ️  Paybox : Configuration TEST valide (compte de test officiel)${NC}"
    echo -e "${BLUE}     ⚠️  Ce système n'est PAS utilisé en production${NC}"
    echo -e "${BLUE}     ⚠️  Votre système principal est SystemPay${NC}"
elif [ "$PAYBOX_IS_PROD" = true ] && [ "$PAYBOX_HMAC_OK" = false ]; then
    echo -e "${RED}  ❌ Paybox : Configuration PRODUCTION invalide${NC}"
    echo -e "${RED}     Raison : Clé HMAC incorrecte (clé SystemPay détectée)${NC}"
    echo -e "${YELLOW}     Solution : Obtenir la vraie clé HMAC Paybox ou utiliser identifiants TEST${NC}"
else
    echo -e "${YELLOW}  ⚠️  Paybox : Configuration personnalisée${NC}"
fi

echo ""

# ========================================
# RÉSUMÉ GLOBAL
# ========================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 RÉSUMÉ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

if [ "$SYSTEMPAY_OK" = true ]; then
    echo -e "${GREEN}✅ Système de paiement PRINCIPAL : SystemPay/Lyra${NC}"
    echo -e "${GREEN}   • Configuration valide pour la PRODUCTION${NC}"
    echo -e "${GREEN}   • Utilisé pour les paiements CB et PayPal${NC}"
    echo ""
else
    echo -e "${RED}❌ Système de paiement PRINCIPAL : SystemPay/Lyra${NC}"
    echo -e "${RED}   • Configuration invalide${NC}"
    echo -e "${RED}   • Vérifier les paramètres SystemPay${NC}"
    echo ""
fi

if [ "$PAYBOX_IS_TEST" = true ] && [ "$PAYBOX_HMAC_OK" = true ]; then
    echo -e "${BLUE}ℹ️  Système SECONDAIRE : Paybox/Verifone (Mode TEST)${NC}"
    echo -e "${BLUE}   • Configuration TEST valide${NC}"
    echo -e "${BLUE}   • Non utilisé en production${NC}"
    echo ""
elif [ "$PAYBOX_IS_PROD" = true ]; then
    echo -e "${YELLOW}⚠️  Système SECONDAIRE : Paybox/Verifone${NC}"
    echo -e "${YELLOW}   • Configuration PRODUCTION détectée${NC}"
    if [ "$PAYBOX_HMAC_OK" = false ]; then
        echo -e "${RED}   • ❌ Clé HMAC incorrecte (clé SystemPay utilisée par erreur)${NC}"
        echo -e "${YELLOW}   • Solution : Obtenir la vraie clé HMAC Paybox auprès de Verifone${NC}"
    fi
    echo ""
fi

# ========================================
# RECOMMANDATIONS
# ========================================

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}💡 RECOMMANDATIONS${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

if [ "$SYSTEMPAY_OK" = true ]; then
    echo -e "${GREEN}✅ Votre configuration SystemPay est opérationnelle${NC}"
    echo -e "   → Aucune action requise pour SystemPay\n"
fi

if [ "$PAYBOX_IS_PROD" = true ] && [ "$PAYBOX_HMAC_OK" = false ]; then
    echo -e "${YELLOW}⚠️  Configuration Paybox invalide détectée${NC}"
    echo -e "   Vous avez deux options :\n"
    echo -e "   ${BLUE}Option 1 : Désactiver Paybox (recommandé si non utilisé)${NC}"
    echo -e "     → Paybox est déjà en mode TEST, aucune action requise\n"
    echo -e "   ${BLUE}Option 2 : Activer Paybox en production${NC}"
    echo -e "     1. Contactez Paybox/Verifone :"
    echo -e "        📧 support@paybox.com"
    echo -e "        ☎️  +33 (0)5 56 49 39 00"
    echo -e "     2. Demandez votre clé HMAC PRODUCTION Paybox"
    echo -e "     3. Mettez à jour PAYBOX_HMAC_KEY dans .env\n"
fi

echo -e "${BLUE}📄 Documentation complète :${NC}"
echo -e "   • SYSTEME-PAIEMENT-ACTUEL.md"
echo -e "   • PAYBOX-PRODUCTION-SETUP.md\n"

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}Vérification terminée${NC}"
echo -e "${BLUE}=========================================${NC}"

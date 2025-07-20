#!/bin/bash

# ========================================
# SCRIPT MAÎTRE - TESTS CURL COMPLETS
# ========================================
# Exécute tous les tests pour le module de paiements

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

API_BASE="http://localhost:3000"

log_header() {
    echo -e "${BOLD}${CYAN}$1${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Fonction pour vérifier l'existence d'un script
check_script() {
    local script_path="$1"
    local script_name="$2"
    
    if [ -f "$script_path" ]; then
        log_success "Script trouvé: $script_name"
        return 0
    else
        log_error "Script manquant: $script_name ($script_path)"
        return 1
    fi
}

# Fonction pour exécuter un script de test
run_test_script() {
    local script_path="$1"
    local script_name="$2"
    local start_time end_time duration
    
    echo ""
    log_header "========================================"
    log_header "🚀 EXÉCUTION: $script_name"
    log_header "========================================"
    
    start_time=$(date +%s)
    
    if [ -f "$script_path" ]; then
        chmod +x "$script_path"
        if bash "$script_path"; then
            end_time=$(date +%s)
            duration=$((end_time - start_time))
            log_success "$script_name terminé avec succès (${duration}s)"
            return 0
        else
            end_time=$(date +%s)
            duration=$((end_time - start_time))
            log_error "$script_name a échoué (${duration}s)"
            return 1
        fi
    else
        log_error "Script non trouvé: $script_path"
        return 1
    fi
}

# Fonction pour vérifier la disponibilité du serveur
check_server() {
    log_info "Vérification de la disponibilité du serveur..."
    
    # Test de base
    if curl -s "$API_BASE/health" >/dev/null 2>&1; then
        log_success "Serveur accessible sur $API_BASE"
    elif curl -s "$API_BASE" >/dev/null 2>&1; then
        log_success "Serveur accessible sur $API_BASE (pas de /health)"
    else
        log_error "Serveur non accessible sur $API_BASE"
        log_warning "Démarrez le serveur avec: npm run dev"
        return 1
    fi
    
    # Test spécifique API payments
    if curl -s "$API_BASE/api/payments/stats" >/dev/null 2>&1; then
        log_success "API payments accessible"
    else
        log_warning "API payments non accessible - certains tests pourraient échouer"
    fi
    
    return 0
}

# Menu interactif
show_menu() {
    echo ""
    log_header "========================================"
    log_header "🧪 TESTS CURL - MODULE PAIEMENTS LEGACY"
    log_header "========================================"
    echo ""
    echo "Choisissez les tests à exécuter:"
    echo ""
    echo "1) 🔧 Tests fonctionnels complets"
    echo "2) 🔒 Tests de sécurité"
    echo "3) ⚡ Tests de performance"
    echo "4) 🎬 Tests de scénarios métier"
    echo "5) 🚀 TOUS LES TESTS (recommandé)"
    echo "6) ❓ Informations système"
    echo "0) 🚪 Quitter"
    echo ""
    echo -n "Votre choix [0-6]: "
}

# Informations système
show_system_info() {
    log_header "========================================"
    log_header "📋 INFORMATIONS SYSTÈME"
    log_header "========================================"
    
    echo "🌐 URL de base: $API_BASE"
    echo "📁 Répertoire: $(pwd)"
    echo "⏰ Date: $(date)"
    echo "👤 Utilisateur: $(whoami)"
    echo "💻 OS: $(uname -s)"
    
    echo ""
    log_info "📦 Scripts de test disponibles:"
    check_script "test-payments-complete.sh" "Tests fonctionnels"
    check_script "test-payments-security.sh" "Tests de sécurité"
    check_script "test-payments-performance.sh" "Tests de performance"
    check_script "test-payments-scenarios.sh" "Tests de scénarios"
    
    echo ""
    log_info "🔧 Outils système:"
    
    # Vérifier curl
    if command -v curl &> /dev/null; then
        curl_version=$(curl --version | head -n1)
        log_success "curl: $curl_version"
    else
        log_error "curl non installé"
    fi
    
    # Vérifier jq
    if command -v jq &> /dev/null; then
        jq_version=$(jq --version)
        log_success "jq: $jq_version"
    else
        log_warning "jq non installé (optionnel pour le formatage JSON)"
    fi
    
    # Vérifier bc
    if command -v bc &> /dev/null; then
        log_success "bc: installé (pour calculs de performance)"
    else
        log_warning "bc non installé (optionnel pour calculs avancés)"
    fi
    
    echo ""
    check_server
}

# Exécution de tous les tests
run_all_tests() {
    local total_start_time total_end_time total_duration
    local tests_passed=0 tests_failed=0
    
    total_start_time=$(date +%s)
    
    log_header "🚀 EXÉCUTION DE TOUS LES TESTS"
    log_info "Cela peut prendre plusieurs minutes..."
    
    # Vérifier le serveur avant de commencer
    if ! check_server; then
        log_error "Serveur non accessible - arrêt des tests"
        return 1
    fi
    
    # Tests fonctionnels
    if run_test_script "test-payments-complete.sh" "Tests fonctionnels"; then
        ((tests_passed++))
    else
        ((tests_failed++))
    fi
    
    # Pause entre les tests
    log_info "Pause de 3 secondes..."
    sleep 3
    
    # Tests de sécurité
    if run_test_script "test-payments-security.sh" "Tests de sécurité"; then
        ((tests_passed++))
    else
        ((tests_failed++))
    fi
    
    # Pause entre les tests
    log_info "Pause de 3 secondes..."
    sleep 3
    
    # Tests de performance
    if run_test_script "test-payments-performance.sh" "Tests de performance"; then
        ((tests_passed++))
    else
        ((tests_failed++))
    fi
    
    # Pause entre les tests
    log_info "Pause de 3 secondes..."
    sleep 3
    
    # Tests de scénarios
    if run_test_script "test-payments-scenarios.sh" "Tests de scénarios métier"; then
        ((tests_passed++))
    else
        ((tests_failed++))
    fi
    
    total_end_time=$(date +%s)
    total_duration=$((total_end_time - total_start_time))
    
    # Rapport final
    echo ""
    log_header "========================================"
    log_header "📊 RAPPORT FINAL DES TESTS"
    log_header "========================================"
    
    echo "⏱️  Durée totale: ${total_duration} secondes"
    echo "✅ Tests réussis: $tests_passed"
    echo "❌ Tests échoués: $tests_failed"
    echo "📊 Total: $((tests_passed + tests_failed)) suites de tests"
    
    if [ $tests_failed -eq 0 ]; then
        echo ""
        log_success "🎉 TOUS LES TESTS ONT RÉUSSI !"
        log_info "Le module de paiements est entièrement fonctionnel"
    else
        echo ""
        log_error "⚠️  CERTAINS TESTS ONT ÉCHOUÉ"
        log_warning "Vérifiez les logs ci-dessus pour les détails"
    fi
    
    echo ""
    log_info "💾 Les données de test sont persistées dans PostgreSQL"
    log_info "🔍 Vérifiez l'interface admin: $API_BASE/admin/payment"
    log_header "========================================"
}

# Boucle principale
main() {
    # Vérifier qu'on est dans le bon répertoire
    if [ ! -f "package.json" ]; then
        log_error "Exécutez ce script depuis le répertoire nestjs-remix-monorepo"
        exit 1
    fi
    
    while true; do
        show_menu
        read -r choice
        
        case $choice in
            1)
                check_server && run_test_script "test-payments-complete.sh" "Tests fonctionnels"
                ;;
            2)
                check_server && run_test_script "test-payments-security.sh" "Tests de sécurité"
                ;;
            3)
                check_server && run_test_script "test-payments-performance.sh" "Tests de performance"
                ;;
            4)
                check_server && run_test_script "test-payments-scenarios.sh" "Tests de scénarios métier"
                ;;
            5)
                run_all_tests
                ;;
            6)
                show_system_info
                ;;
            0)
                echo ""
                log_success "Au revoir ! 👋"
                exit 0
                ;;
            *)
                log_warning "Choix invalide. Veuillez choisir entre 0 et 6."
                ;;
        esac
        
        echo ""
        echo -n "Appuyez sur Entrée pour continuer..."
        read -r
    done
}

# Vérification des prérequis
check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    if ! command -v curl &> /dev/null; then
        log_error "curl n'est pas installé"
        echo "Installation sur Ubuntu/Debian: sudo apt-get install curl"
        echo "Installation sur macOS: brew install curl"
        exit 1
    fi
    
    log_success "curl est installé"
    
    # Créer les scripts s'ils n'existent pas
    if [ ! -f "test-payments-complete.sh" ] || [ ! -f "test-payments-security.sh" ] || 
       [ ! -f "test-payments-performance.sh" ] || [ ! -f "test-payments-scenarios.sh" ]; then
        log_warning "Certains scripts de test sont manquants"
        log_info "Assurez-vous que tous les scripts sont présents dans le répertoire"
    fi
}

# Point d'entrée
echo ""
log_header "🧪 LANCEUR DE TESTS - MODULE PAIEMENTS LEGACY"
log_info "Initialisation..."

check_prerequisites
main

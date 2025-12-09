#!/bin/bash

# ðŸ”„ SCRIPT DE DÃ‰PLOIEMENT - MIGRATION URLs PIÃˆCES
# 
# Script automatisÃ© pour dÃ©ployer le systÃ¨me de redirection 301
# et configurer les redirections pour tous les vÃ©hicules
#
# Version: 1.0.0
# Date: 2025-09-14
# Auteur: SEO Migration Team

set -e  # ArrÃªt en cas d'erreur

# ====================================
# ðŸŽ¯ CONFIGURATION
# ====================================

BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
API_ENDPOINT="${BACKEND_URL}/api/vehicles/migration"

# Couleurs pour l'affichage
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Compteurs
TOTAL_VEHICLES=0
SUCCESSFUL_MIGRATIONS=0
FAILED_MIGRATIONS=0

# ====================================
# ðŸ› ï¸ FONCTIONS UTILITAIRES
# ====================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Test de connectivitÃ© backend
test_backend_connection() {
    log_info "Test de connexion au backend: $BACKEND_URL"
    
    if curl -s --max-time 10 "$BACKEND_URL/health" > /dev/null 2>&1; then
        log_success "Backend accessible"
        return 0
    else
        log_error "Backend non accessible Ã  $BACKEND_URL"
        log_error "VÃ©rifiez que le service backend est dÃ©marrÃ©"
        return 1
    fi
}

# Test du service de migration
test_migration_service() {
    log_info "Test du service de migration..."
    
    # Test avec une URL d'exemple
    local test_url="pieces%2Ffiltre-a-huile-7%2Faudi-22%2Fa7-sportback-22059%2F3-0-tfsi-quattro-34940.html"
    local response
    
    response=$(curl -s --max-time 10 "$API_ENDPOINT/test/$test_url" 2>/dev/null)
    
    if [[ $? -eq 0 ]] && echo "$response" | grep -q '"success":true'; then
        log_success "Service de migration opÃ©rationnel"
        return 0
    else
        log_error "Service de migration non fonctionnel"
        log_error "RÃ©ponse: $response"
        return 1
    fi
}

# Migration d'un vÃ©hicule spÃ©cifique
migrate_vehicle() {
    local brand_slug="$1"
    local brand_id="$2"
    local model_slug="$3"
    local model_id="$4"
    local type_slug="$5"
    local type_id="$6"
    
    log_info "Migration: $brand_slug $model_slug $type_slug"
    
    local payload="{
        \"brand_slug\": \"$brand_slug\",
        \"brand_id\": $brand_id,
        \"model_slug\": \"$model_slug\",
        \"model_id\": $model_id,
        \"type_slug\": \"$type_slug\",
        \"type_id\": $type_id,
        \"force_update\": false
    }"
    
    local response
    response=$(curl -s --max-time 30 \\
        -H "Content-Type: application/json" \\
        -d "$payload" \\
        "$API_ENDPOINT/migrate-vehicle" 2>/dev/null)
    
    if [[ $? -eq 0 ]] && echo "$response" | grep -q '"success":true'; then
        local created_count
        created_count=$(echo "$response" | grep -o '"redirections_created":\\[[^]]*\\]' | grep -o '{[^}]*}' | wc -l)
        log_success "âœ… $brand_slug $model_slug: $created_count redirections crÃ©Ã©es"
        ((SUCCESSFUL_MIGRATIONS++))
        return 0
    else
        log_error "âŒ $brand_slug $model_slug: Ã©chec migration"
        log_error "RÃ©ponse: $response"
        ((FAILED_MIGRATIONS++))
        return 1
    fi
}

# AperÃ§u des redirections pour un vÃ©hicule
preview_vehicle_redirections() {
    local brand_slug="$1"
    local brand_id="$2"
    local model_slug="$3"
    local model_id="$4"
    local type_slug="$5"
    local type_id="$6"
    
    log_info "AperÃ§u redirections: $brand_slug $model_slug $type_slug"
    
    local response
    response=$(curl -s --max-time 15 \\
        "$API_ENDPOINT/preview/$brand_slug/$brand_id/$model_slug/$model_id/$type_slug/$type_id" 2>/dev/null)
    
    if [[ $? -eq 0 ]] && echo "$response" | grep -q '"success":true'; then
        local total_redirections
        total_redirections=$(echo "$response" | grep -o '"total_redirections":[0-9]*' | cut -d: -f2)
        echo "   â†’ $total_redirections redirections seraient crÃ©Ã©es"
        
        # Afficher quelques exemples
        echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    redirections = data.get('redirections', [])
    for i, r in enumerate(redirections[:3]):
        print(f'     {i+1}. {r[\"legacy_url\"]} â†’ {r[\"modern_url\"]}')
    if len(redirections) > 3:
        print(f'     ... et {len(redirections) - 3} autres')
except:
    pass
        " 2>/dev/null || true
        
        return 0
    else
        log_error "Impossible de rÃ©cupÃ©rer l'aperÃ§u"
        return 1
    fi
}

# ====================================
# ðŸ“‹ VÃ‰HICULES D'EXEMPLE
# ====================================

# Liste des vÃ©hicules Ã  migrer (exemples)
declare -a VEHICLES=(
    # Format: "brand_slug brand_id model_slug model_id type_slug type_id"
    "audi 22 a7-sportback 22059 3-0-tfsi-quattro 34940"
    "bmw 5 serie-3-e90 1234 320-i 5678"
    "peugeot 3 208 9876 1-6-hdi 4321"
    "renault 10 clio 5555 1-2-tce 7777"
    # Ajoutez d'autres vÃ©hicules selon vos besoins
)

# ====================================
# ðŸš€ FONCTIONS PRINCIPALES
# ====================================

# Tests prÃ©liminaires
run_preliminary_tests() {
    log_info "=== TESTS PRÃ‰LIMINAIRES ==="
    
    if ! test_backend_connection; then
        exit 1
    fi
    
    if ! test_migration_service; then
        exit 1
    fi
    
    log_success "Tous les tests prÃ©liminaires sont OK"
    echo
}

# AperÃ§u gÃ©nÃ©ral
show_preview() {
    log_info "=== APERÃ‡U DES MIGRATIONS ==="
    
    for vehicle_data in "${VEHICLES[@]}"; do
        read -r brand_slug brand_id model_slug model_id type_slug type_id <<< "$vehicle_data"
        preview_vehicle_redirections "$brand_slug" "$brand_id" "$model_slug" "$model_id" "$type_slug" "$type_id"
        ((TOTAL_VEHICLES++))
    done
    
    echo
    log_info "Total vÃ©hicules Ã  traiter: $TOTAL_VEHICLES"
    echo
}

# Migration complÃ¨te
run_migrations() {
    log_info "=== MIGRATION DES VÃ‰HICULES ==="
    
    for vehicle_data in "${VEHICLES[@]}"; do
        read -r brand_slug brand_id model_slug model_id type_slug type_id <<< "$vehicle_data"
        migrate_vehicle "$brand_slug" "$brand_id" "$model_slug" "$model_id" "$type_slug" "$type_id"
        
        # Pause courte entre migrations
        sleep 1
    done
}

# Test des redirections crÃ©Ã©es
test_redirections() {
    log_info "=== TEST DES REDIRECTIONS ==="
    
    # Test des exemples utilisateur
    local test_urls=(
        "pieces%2Ffiltre-a-huile-7%2Faudi-22%2Fa7-sportback-22059%2F3-0-tfsi-quattro-34940.html"
        "pieces%2Ffiltre-a-air-8%2Faudi-22%2Fa7-sportback-22059%2F3-0-tfsi-quattro-34940.html"
        "pieces%2Ffiltre-d-habitacle-424%2Faudi-22%2Fa7-sportback-22059%2F3-0-tfsi-quattro-34940.html"
    )
    
    for url in "${test_urls[@]}"; do
        log_info "Test: $(echo "$url" | sed 's/%2F/\\//g')"
        
        local response
        response=$(curl -s --max-time 10 "$API_ENDPOINT/test/$url" 2>/dev/null)
        
        if echo "$response" | grep -q '"success":true'; then
            local new_url
            new_url=$(echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data['migration']['new_url'])
except:
    print('erreur')
            " 2>/dev/null)
            log_success "âœ… â†’ $new_url"
        else
            log_error "âŒ Test Ã©chouÃ©"
        fi
    done
}

# Rapport final
show_final_report() {
    echo
    log_info "=== RAPPORT FINAL ==="
    echo "ðŸ“Š VÃ©hicules traitÃ©s: $TOTAL_VEHICLES"
    echo "âœ… Migrations rÃ©ussies: $SUCCESSFUL_MIGRATIONS"
    echo "âŒ Migrations Ã©chouÃ©es: $FAILED_MIGRATIONS"
    
    if [[ $FAILED_MIGRATIONS -eq 0 ]]; then
        echo
        log_success "ðŸŽ‰ DÃ‰PLOIEMENT RÃ‰USSI ! Toutes les redirections sont configurÃ©es."
    else
        echo
        log_warning "âš ï¸  $FAILED_MIGRATIONS migration(s) en Ã©chec. VÃ©rifiez les logs ci-dessus."
    fi
    
    echo
    echo "ðŸ“‹ Prochaines Ã©tapes:"
    echo "   1. Tester les redirections en production"
    echo "   2. Monitorer les logs 404 pour identifier d'autres URLs"
    echo "   3. Ajouter d'autres vÃ©hicules si nÃ©cessaire"
    echo
}

# ====================================
# ðŸŽ¯ MENU PRINCIPAL
# ====================================

show_menu() {
    echo
    echo "ðŸ”„ SYSTÃˆME DE MIGRATION URLs PIÃˆCES"
    echo "=================================="
    echo "1. Tests prÃ©liminaires uniquement"
    echo "2. AperÃ§u des migrations (sans crÃ©er)"
    echo "3. Migration complÃ¨te (avec crÃ©ation)"
    echo "4. Test des redirections existantes"
    echo "5. Tout exÃ©cuter (tests + aperÃ§u + migration + test)"
    echo "q. Quitter"
    echo
    read -p "Choisissez une option: " choice
}

# ====================================
# ðŸš€ POINT D'ENTRÃ‰E PRINCIPAL
# ====================================

main() {
    echo "ðŸ”„ SCRIPT DE DÃ‰PLOIEMENT - MIGRATION URLs PIÃˆCES"
    echo "Date: $(date)"
    echo "Backend: $BACKEND_URL"
    echo

    # Mode non-interactif si argument fourni
    if [[ $# -gt 0 ]]; then
        case "$1" in
            "test")
                run_preliminary_tests
                ;;
            "preview")
                run_preliminary_tests
                show_preview
                ;;
            "migrate")
                run_preliminary_tests
                show_preview
                run_migrations
                show_final_report
                ;;
            "all")
                run_preliminary_tests
                show_preview
                run_migrations
                test_redirections
                show_final_report
                ;;
            *)
                echo "Usage: $0 [test|preview|migrate|all]"
                exit 1
                ;;
        esac
        return
    fi

    # Mode interactif
    while true; do
        show_menu
        
        case "$choice" in
            1)
                run_preliminary_tests
                ;;
            2)
                run_preliminary_tests
                show_preview
                ;;
            3)
                run_preliminary_tests
                show_preview
                echo
                read -p "Confirmer la migration ? (y/N): " confirm
                if [[ $confirm =~ ^[Yy]$ ]]; then
                    run_migrations
                    show_final_report
                else
                    log_info "Migration annulÃ©e"
                fi
                ;;
            4)
                run_preliminary_tests
                test_redirections
                ;;
            5)
                run_preliminary_tests
                show_preview
                echo
                read -p "Lancer la migration complÃ¨te ? (y/N): " confirm
                if [[ $confirm =~ ^[Yy]$ ]]; then
                    run_migrations
                    test_redirections
                    show_final_report
                else
                    log_info "Migration annulÃ©e"
                fi
                ;;
            q|Q)
                log_info "Au revoir !"
                exit 0
                ;;
            *)
                log_error "Option invalide"
                ;;
        esac
        
        echo
        read -p "Appuyez sur EntrÃ©e pour continuer..."
    done
}

# ExÃ©cution
main "$@"
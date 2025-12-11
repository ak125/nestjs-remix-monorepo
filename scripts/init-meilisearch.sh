#!/bin/bash

# Script d'initialisation Meilisearch pour FAFA AUTO
# ==================================================

echo "ðŸš€ Initialisation de Meilisearch pour FAFA AUTO"

# Variables d'environnement
MEILISEARCH_HOST=${MEILISEARCH_HOST:-"http://localhost:7700"}
MEILISEARCH_MASTER_KEY=${MEILISEARCH_MASTER_KEY:-"masterKey123"}

echo "ðŸ“¡ Connexion Ã  Meilisearch : $MEILISEARCH_HOST"

# Fonction pour vÃ©rifier la connexion
check_meilisearch() {
    echo "â³ VÃ©rification de la connexion..."
    if curl -s "$MEILISEARCH_HOST/health" > /dev/null; then
        echo "âœ… Meilisearch est accessible"
        return 0
    else
        echo "âŒ Meilisearch n'est pas accessible"
        return 1
    fi
}

# Fonction pour crÃ©er les index
create_indexes() {
    echo "ðŸ“Š CrÃ©ation des index..."
    
    # Index des vÃ©hicules
    echo "ðŸš— CrÃ©ation de l'index vehicles..."
    curl -X POST "$MEILISEARCH_HOST/indexes" \
        -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" \
        -H "Content-Type: application/json" \
        -d '{"uid": "vehicles", "primaryKey": "id"}'
    
    # Index des produits
    echo "ðŸ“„ CrÃ©ation de l'index products..."
    curl -X POST "$MEILISEARCH_HOST/indexes" \
        -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" \
        -H "Content-Type: application/json" \
        -d '{"uid": "products", "primaryKey": "id"}'
}

# Fonction pour configurer les index
configure_indexes() {
    echo "âš™ï¸  Configuration des index..."
    
    # Configuration de l'index vehicles
    echo "ðŸš— Configuration de l'index vehicles..."
    curl -X PATCH "$MEILISEARCH_HOST/indexes/vehicles/settings" \
        -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "searchableAttributes": ["brand", "model", "version", "description", "category", "fuel_type", "transmission", "color"],
            "filterableAttributes": ["brand", "model", "category", "fuel_type", "transmission", "year", "price", "mileage", "color", "status"],
            "sortableAttributes": ["price", "year", "mileage", "created_at", "updated_at"],
            "rankingRules": ["words", "typo", "proximity", "attribute", "sort", "exactness", "price:asc"],
            "stopWords": ["le", "la", "les", "de", "du", "des", "un", "une"],
            "synonyms": {
                "voiture": ["vÃ©hicule", "auto", "automobile"],
                "diesel": ["gasoil"],
                "essence": ["gasoline", "sp95", "sp98"]
            }
        }'
    
    # Configuration de l'index products
    echo "ðŸ“„ Configuration de l'index products..."
    curl -X PATCH "$MEILISEARCH_HOST/indexes/products/settings" \
        -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "searchableAttributes": ["title", "content", "description", "tags", "category"],
            "filterableAttributes": ["category", "type", "status", "created_at"],
            "sortableAttributes": ["created_at", "updated_at"],
            "stopWords": ["le", "la", "les", "de", "du", "des", "un", "une", "et", "ou"]
        }'
}

# Fonction pour afficher le statut
show_status() {
    echo "ðŸ“Š Statut des index..."
    
    echo "ðŸš— Index vehicles:"
    curl -s "$MEILISEARCH_HOST/indexes/vehicles/stats" \
        -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" | jq .
    
    echo "ðŸ“„ Index products:"
    curl -s "$MEILISEARCH_HOST/indexes/products/stats" \
        -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" | jq .
}

# ExÃ©cution du script
main() {
    echo "ðŸ”§ Initialisation en cours..."
    
    if check_meilisearch; then
        create_indexes
        sleep 2
        configure_indexes
        sleep 2
        show_status
        echo "âœ… Initialisation terminÃ©e avec succÃ¨s!"
    else
        echo "âŒ Ã‰chec de l'initialisation"
        exit 1
    fi
}

# Lancement du script principal
main

#!/bin/bash

# Script d'initialisation Meilisearch pour FAFA AUTO
# ==================================================

echo "🚀 Initialisation de Meilisearch pour FAFA AUTO"

# Variables d'environnement
MEILISEARCH_HOST=${MEILISEARCH_HOST:-"http://localhost:7700"}
MEILISEARCH_MASTER_KEY=${MEILISEARCH_MASTER_KEY:-"masterKey123"}

echo "📡 Connexion à Meilisearch : $MEILISEARCH_HOST"

# Fonction pour vérifier la connexion
check_meilisearch() {
    echo "⏳ Vérification de la connexion..."
    if curl -s "$MEILISEARCH_HOST/health" > /dev/null; then
        echo "✅ Meilisearch est accessible"
        return 0
    else
        echo "❌ Meilisearch n'est pas accessible"
        return 1
    fi
}

# Fonction pour créer les index
create_indexes() {
    echo "📊 Création des index..."
    
    # Index des véhicules
    echo "🚗 Création de l'index vehicles..."
    curl -X POST "$MEILISEARCH_HOST/indexes" \
        -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" \
        -H "Content-Type: application/json" \
        -d '{"uid": "vehicles", "primaryKey": "id"}'
    
    # Index des produits
    echo "📄 Création de l'index products..."
    curl -X POST "$MEILISEARCH_HOST/indexes" \
        -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" \
        -H "Content-Type: application/json" \
        -d '{"uid": "products", "primaryKey": "id"}'
}

# Fonction pour configurer les index
configure_indexes() {
    echo "⚙️  Configuration des index..."
    
    # Configuration de l'index vehicles
    echo "🚗 Configuration de l'index vehicles..."
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
                "voiture": ["véhicule", "auto", "automobile"],
                "diesel": ["gasoil"],
                "essence": ["gasoline", "sp95", "sp98"]
            }
        }'
    
    # Configuration de l'index products
    echo "📄 Configuration de l'index products..."
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
    echo "📊 Statut des index..."
    
    echo "🚗 Index vehicles:"
    curl -s "$MEILISEARCH_HOST/indexes/vehicles/stats" \
        -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" | jq .
    
    echo "📄 Index products:"
    curl -s "$MEILISEARCH_HOST/indexes/products/stats" \
        -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" | jq .
}

# Exécution du script
main() {
    echo "🔧 Initialisation en cours..."
    
    if check_meilisearch; then
        create_indexes
        sleep 2
        configure_indexes
        sleep 2
        show_status
        echo "✅ Initialisation terminée avec succès!"
    else
        echo "❌ Échec de l'initialisation"
        exit 1
    fi
}

# Lancement du script principal
main

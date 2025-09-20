#!/bin/bash
# 📊 Analyse Détaillée des Métadonnées SEO
# Usage: ./scripts/seo-metadata-analyzer.sh [url1] [url2] ...

BASE_URL="http://localhost:3000"
OUTPUT_DIR="./reports/metadata"

mkdir -p "$OUTPUT_DIR"

echo "📊 ANALYSEUR DE MÉTADONNÉES SEO"
echo "================================"

# URLs à analyser par défaut
if [ $# -eq 0 ]; then
    urls=("accueil" "contact" "mentions-legales" "constructeurs" "products" "blog")
    echo "🔍 Analyse des pages par défaut..."
else
    urls=("$@")
    echo "🔍 Analyse des URLs spécifiées..."
fi

# Fonction d'analyse d'une URL
analyze_url() {
    local url=$1
    echo ""
    echo "🔍 Analyse: $url"
    echo "----------------------------------------"
    
    response=$(curl -s "$BASE_URL/api/seo/metadata/$url")
    
    if echo "$response" | jq . > /dev/null 2>&1; then
        # Extraction des données
        title=$(echo "$response" | jq -r '.meta_title // "❌ MANQUANT"')
        description=$(echo "$response" | jq -r '.meta_description // "❌ MANQUANT"')
        keywords=$(echo "$response" | jq -r '.meta_keywords // "❌ MANQUANT"')
        h1=$(echo "$response" | jq -r '.h1 // "❌ MANQUANT"')
        
        # Affichage formaté
        echo "📝 Titre: $title"
        echo "📄 Description: $description"
        echo "🏷️ Mots-clés: $keywords"
        echo "📰 H1: $h1"
        
        # Validation des longueurs
        title_len=${#title}
        desc_len=${#description}
        
        echo ""
        echo "📏 VALIDATION:"
        
        # Validation titre (30-60 caractères idéal)
        if [ "$title" != "❌ MANQUANT" ]; then
            if [ $title_len -ge 30 ] && [ $title_len -le 60 ]; then
                echo "  ✅ Titre: $title_len caractères (optimal)"
            elif [ $title_len -lt 30 ]; then
                echo "  ⚠️ Titre: $title_len caractères (trop court)"
            else
                echo "  ⚠️ Titre: $title_len caractères (trop long)"
            fi
        else
            echo "  ❌ Titre: manquant"
        fi
        
        # Validation description (120-160 caractères idéal)
        if [ "$description" != "❌ MANQUANT" ]; then
            if [ $desc_len -ge 120 ] && [ $desc_len -le 160 ]; then
                echo "  ✅ Description: $desc_len caractères (optimal)"
            elif [ $desc_len -lt 120 ]; then
                echo "  ⚠️ Description: $desc_len caractères (trop courte)"
            else
                echo "  ⚠️ Description: $desc_len caractères (trop longue)"
            fi
        else
            echo "  ❌ Description: manquante"
        fi
        
        # Sauvegarde
        safe_url=$(echo "$url" | tr '/' '_')
        echo "$response" > "$OUTPUT_DIR/metadata_${safe_url}_$(date +%Y%m%d_%H%M%S).json"
        
    else
        echo "❌ Erreur API ou URL inexistante"
    fi
}

# Analyse de toutes les URLs
for url in "${urls[@]}"; do
    analyze_url "$url"
done

# Génération du rapport de synthèse
echo ""
echo "📋 GÉNÉRATION DU RAPPORT DE SYNTHÈSE"
echo "====================================="

report_file="$OUTPUT_DIR/synthesis_$(date +%Y%m%d_%H%M%S).md"

cat > "$report_file" << EOF
# Rapport d'Analyse des Métadonnées SEO

**Date**: $(date)
**URLs analysées**: ${#urls[@]}

## URLs Testées
$(printf '- %s\n' "${urls[@]}")

## Recommandations Générales
- [ ] Vérifier les titres manquants
- [ ] Optimiser les longueurs de descriptions  
- [ ] Ajouter des mots-clés pertinents
- [ ] Contrôler la cohérence des H1

## Fichiers Générés
$(ls -la $OUTPUT_DIR/*.json 2>/dev/null | tail -${#urls[@]} | awk '{print "- " $9 " (" $5 " bytes)"}' || echo "Aucun fichier JSON généré")

EOF

echo "✅ Rapport sauvegardé: $report_file"
echo "📁 Fichiers détaillés dans: $OUTPUT_DIR/"

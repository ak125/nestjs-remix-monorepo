# Tests cURL pour l'API Layout
# Copiez et collez ces commandes dans votre terminal

# ================================
# 1. LAYOUT PRINCIPAL
# ================================

# Layout public complet
curl -X GET "http://localhost:3000/api/layout?context=public" | jq .

# Layout admin avec utilisateur
curl -X GET "http://localhost:3000/api/layout?context=admin&user=admin123" | jq .

# Layout commercial
curl -X GET "http://localhost:3000/api/layout?context=commercial&user=comm456" | jq .

# ================================
# 2. HEADER
# ================================

# Header public
curl -X GET "http://localhost:3000/api/layout/header?context=public" | jq .

# Header admin avec utilisateur
curl -X GET "http://localhost:3000/api/layout/header?context=admin&user=admin123" | jq .

# Header commercial
curl -X GET "http://localhost:3000/api/layout/header?context=commercial&user=comm456" | jq .

# ================================
# 3. FOOTER
# ================================

# Footer public
curl -X GET "http://localhost:3000/api/layout/footer?context=public" | jq .

# Footer admin
curl -X GET "http://localhost:3000/api/layout/footer?context=admin" | jq .

# Footer commercial
curl -X GET "http://localhost:3000/api/layout/footer?context=commercial" | jq .

# ================================
# 4. RECHERCHE RAPIDE
# ================================

# Recherche de produits
curl -X GET "http://localhost:3000/api/layout/search?q=iphone&context=public&limit=5" | jq .

# Recherche admin
curl -X GET "http://localhost:3000/api/layout/search?q=user&context=admin&limit=3" | jq .

# Données de recherche
curl -X GET "http://localhost:3000/api/layout/search-data?context=public" | jq .

# ================================
# 5. PARTAGE SOCIAL
# ================================

# Liens de partage
curl -X GET "http://localhost:3000/api/layout/share?url=https://example.com&title=Mon%20Article" | jq .

# Boutons de partage
curl -X GET "http://localhost:3000/api/layout/share-buttons?url=https://example.com&title=Mon%20Article&description=Description%20test" | jq .

# Boutons avec hashtags
curl -X GET "http://localhost:3000/api/layout/share-buttons?url=https://example.com&title=Mon%20Article&hashtags=tech,innovation" | jq .

# ================================
# 6. META TAGS
# ================================

# Meta tags pour page d'accueil
curl -X GET "http://localhost:3000/api/layout/meta/home?title=Accueil&description=Page%20d'accueil" | jq .

# Meta tags pour produit
curl -X GET "http://localhost:3000/api/layout/meta/product?title=iPhone%2015&description=Nouveau%20iPhone&keywords=iphone,smartphone" | jq .

# Meta tags HTML
curl -X GET "http://localhost:3000/api/layout/meta-html/home?title=Mon%20Site&description=Description%20du%20site" | jq .

# ================================
# 7. SECTIONS PERSONNALISÉES
# ================================

# Section header
curl -X GET "http://localhost:3000/api/layout/sections/header?context=public" | jq .

# Section footer
curl -X GET "http://localhost:3000/api/layout/sections/footer?context=public" | jq .

# Header personnalisé sans actions
curl -X GET "http://localhost:3000/api/layout/sections/header/custom?context=admin&showActions=false&showNotifications=true" | jq .

# Footer personnalisé sans newsletter
curl -X GET "http://localhost:3000/api/layout/sections/footer/custom?context=public&showNewsletter=false&showSocial=true" | jq .

# ================================
# 8. RECHERCHE FILTRÉE
# ================================

# Recherche de produits seulement
curl -X GET "http://localhost:3000/api/layout/sections/search/filtered?q=test&type=product&context=public&limit=5" | jq .

# Recherche d'utilisateurs seulement
curl -X GET "http://localhost:3000/api/layout/sections/search/filtered?q=admin&type=user&context=admin&limit=3" | jq .

# ================================
# 9. TESTS AVEC VERBOSE
# ================================

# Test avec headers détaillés
curl -v -X GET "http://localhost:3000/api/layout?context=public"

# Test avec timing
curl -w "Time: %{time_total}s\n" -X GET "http://localhost:3000/api/layout/header?context=public" | jq .

# Test de performance
time curl -s -X GET "http://localhost:3000/api/layout?context=admin&user=test" | jq .

# ================================
# 10. TESTS D'ERREUR
# ================================

# Endpoint inexistant (should return 404)
curl -X GET "http://localhost:3000/api/layout/nonexistent"

# Partage sans paramètres requis (should return error)
curl -X GET "http://localhost:3000/api/layout/share"

# Contexte invalide
curl -X GET "http://localhost:3000/api/layout?context=invalid" | jq .

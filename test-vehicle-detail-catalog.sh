#!/bin/bash

# 🧪 Test de la page de détail véhicule avec catalogue complet
# Teste l'affichage "Catalogue BMW Série 3 (E46) 320 d 150 ch de 2001 à 2005"

echo "🚗 Test de la page de détail véhicule avec catalogue complet"
echo "=================================================="

# Couleurs pour l'affichage
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Variables de test
BASE_URL="http://localhost:3000"
TEST_URLS=(
  "$BASE_URL/constructeurs/bmw/serie-3/bmw-serie-3-320d.html"
  "$BASE_URL/constructeurs/bmw/serie-1-f20/bmw-serie-1-125d.html"
  "$BASE_URL/vehicle/bmw/serie-3/320d"
  "$BASE_URL/vehicle/bmw/serie-1-f20/125d"
)

echo -e "${BLUE}🔍 URLs de test:${NC}"
for url in "${TEST_URLS[@]}"; do
  echo "  - $url"
done
echo ""

# Fonction de test d'une URL
test_url() {
  local url=$1
  local description=$2
  
  echo -e "${YELLOW}🧪 Test: $description${NC}"
  echo "   URL: $url"
  
  # Test de base - status HTTP
  echo -n "   📡 Status HTTP: "
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
  if [ "$status" = "200" ]; then
    echo -e "${GREEN}✅ $status${NC}"
  elif [ "$status" = "301" ] || [ "$status" = "302" ]; then
    echo -e "${YELLOW}🔄 $status (redirection)${NC}"
    # Pour les redirections, tester le contenu final
    content=$(curl -s -L "$url" 2>/dev/null)
  else
    echo -e "${RED}❌ $status${NC}"
    return 1
  fi
  
  # Test du contenu HTML (utiliser le contenu redirigé si applicable)
  if [ -z "$content" ]; then
    content=$(curl -s "$url" 2>/dev/null)
  fi
  if [[ $content == *"<html"* ]]; then
    echo -e "${GREEN}✅ HTML valide${NC}"
  else
    echo -e "${RED}❌ Pas de HTML${NC}"
    return 1
  fi
  
  # Test du titre avec "Catalogue"
  echo -n "   📝 Titre avec 'Catalogue': "
  if [[ $content == *"Catalogue BMW"* ]]; then
    echo -e "${GREEN}✅ Trouvé${NC}"
  else
    echo -e "${RED}❌ Non trouvé${NC}"
  fi
  
  # Test des sections catalogue
  echo -n "   📦 Section catalogue complet: "
  if [[ $content == *"Catalogue complet"* ]]; then
    echo -e "${GREEN}✅ Trouvé${NC}"
  else
    echo -e "${RED}❌ Non trouvé${NC}"
  fi
  
  # Test des familles de produits
  echo -n "   🏷️ Familles de produits: "
  if [[ $content == *"Filtration"* ]] && [[ $content == *"Freinage"* ]]; then
    echo -e "${GREEN}✅ Trouvé${NC}"
  else
    echo -e "${RED}❌ Non trouvé${NC}"
  fi
  
  # Test des données véhicule
  echo -n "   🚗 Données véhicule: "
  if [[ $content == *"ch de"* ]] && [[ $content == *"à 20"* ]]; then
    echo -e "${GREEN}✅ Trouvé${NC}"
  else
    echo -e "${RED}❌ Non trouvé${NC}"
  fi
  
  echo ""
}

# Vérifier si le serveur est démarré
echo -e "${BLUE}🔌 Vérification du serveur...${NC}"
if ! curl -s "$BASE_URL" > /dev/null 2>&1; then
  echo -e "${RED}❌ Serveur non accessible à $BASE_URL${NC}"
  echo -e "${YELLOW}💡 Démarrez le serveur avec: cd frontend && npm run dev${NC}"
  exit 1
else
  echo -e "${GREEN}✅ Serveur accessible${NC}"
fi

echo ""

# Tests des URLs
for i in "${!TEST_URLS[@]}"; do
  case $i in
    0) test_url "${TEST_URLS[$i]}" "BMW Série 3 (E46) 320d - URL originale .html" ;;
    1) test_url "${TEST_URLS[$i]}" "BMW Série 1 (F20) 125d - URL originale .html" ;;
    2) test_url "${TEST_URLS[$i]}" "BMW Série 3 (E46) 320d - Route directe /vehicle/" ;;
    3) test_url "${TEST_URLS[$i]}" "BMW Série 1 (F20) 125d - Route directe /vehicle/" ;;
  esac
done

# Test spécifique du contenu H1
echo -e "${YELLOW}🎯 Test spécifique du titre H1${NC}"
echo "=================================================="

for url in "${TEST_URLS[@]}"; do
  echo "📄 $url"
  content=$(curl -s -L "$url" 2>/dev/null)  # Suivre les redirections avec -L
  
  # Extraire le contenu H1
  h1_content=$(echo "$content" | grep -o '<h1[^>]*>.*</h1>' | sed 's/<[^>]*>//g' | head -1)
  
  if [ -n "$h1_content" ]; then
    echo -e "   📝 H1: ${GREEN}$h1_content${NC}"
    
    # Vérifier si contient "Catalogue"
    if [[ $h1_content == *"Catalogue"* ]]; then
      echo -e "   ✅ ${GREEN}Contient 'Catalogue'${NC}"
    else
      echo -e "   ❌ ${RED}Ne contient pas 'Catalogue'${NC}"
    fi
    
    # Vérifier si contient "ch de"
    if [[ $h1_content == *"ch de"* ]]; then
      echo -e "   ✅ ${GREEN}Contient 'ch de'${NC}"
    else
      echo -e "   ❌ ${RED}Ne contient pas 'ch de'${NC}"
    fi
    
    # Vérifier si ne contient plus "uniquement"
    if [[ $h1_content != *"uniquement"* ]]; then
      echo -e "   ✅ ${GREEN}Ne contient plus 'uniquement' (supprimé avec succès)${NC}"
    else
      echo -e "   ❌ ${RED}Contient encore 'uniquement'${NC}"
    fi
  else
    echo -e "   ❌ ${RED}Aucun H1 trouvé${NC}"
  fi
  
  echo ""
done

echo -e "${BLUE}🎉 Tests terminés !${NC}"
echo ""
echo -e "${YELLOW}💡 Pour voir la page en direct:${NC}"
echo "   📱 Ouvrez votre navigateur sur: $BASE_URL/constructeurs/bmw/serie-3/bmw-serie-3-320d.html"
echo ""
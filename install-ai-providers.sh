#!/bin/bash

echo "🤖 Installation des Providers IA GRATUITS pour votre système de génération de contenu"
echo "================================================================================="
echo ""

# Couleurs pour l'affichage
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Installer Ollama (local - gratuit illimité)
echo -e "${BLUE}📦 Étape 1/3: Installation d'Ollama (modèles IA locaux)${NC}"
echo "Cela peut prendre quelques minutes..."

if command -v ollama &> /dev/null; then
    echo -e "${GREEN}✅ Ollama est déjà installé${NC}"
else
    curl -fsSL https://ollama.com/install.sh | sh
    echo -e "${GREEN}✅ Ollama installé${NC}"
fi

# Démarrer Ollama en arrière-plan
ollama serve > /dev/null 2>&1 &
sleep 3

# Télécharger un modèle optimisé
echo ""
echo -e "${BLUE}📥 Téléchargement du modèle Llama 3.1 8B (4.7GB)${NC}"
echo "Ce modèle offre le meilleur compromis qualité/vitesse"
ollama pull llama3.1:8b

echo -e "${GREEN}✅ Modèle téléchargé et prêt à l'emploi${NC}"

# 2. Configurer le fichier .env
echo ""
echo -e "${BLUE}⚙️  Étape 2/3: Configuration du fichier .env${NC}"

# Vérifier si .env existe
if [ ! -f ".env" ]; then
    touch .env
fi

# Vérifier si la configuration IA existe déjà
if grep -q "AI_PROVIDER" .env; then
    echo -e "${YELLOW}⚠️  Configuration IA déjà présente dans .env${NC}"
else
    cat >> .env << 'EOF'

# ==========================================
# 🤖 CONFIGURATION IA - GÉNÉRATION DE CONTENU
# ==========================================

# Provider IA (auto = détection automatique du meilleur disponible)
AI_PROVIDER=auto

# === OLLAMA (Local - GRATUIT illimité) ===
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# === GROQ (API gratuite - Ultra rapide) ===
# Obtenir une clé gratuite sur: https://console.groq.com
# 14,400 requêtes/jour gratuites - Le plus rapide!
GROQ_API_KEY=
GROQ_MODEL=llama3-70b-8192

# === HUGGINGFACE (API gratuite - Backup) ===
# Obtenir une clé gratuite sur: https://huggingface.co/settings/tokens
HUGGINGFACE_API_KEY=
HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.2

# === OPENAI (Payant - Optionnel) ===
# Uniquement si vous avez déjà un compte OpenAI
OPENAI_API_KEY=
EOF
    echo -e "${GREEN}✅ Configuration ajoutée dans .env${NC}"
fi

# 3. Instructions finales
echo ""
echo -e "${BLUE}🎯 Étape 3/3: Prochaines actions${NC}"
echo "================================================================================="
echo ""
echo -e "${GREEN}✅ Ollama est installé et prêt!${NC} Vous pouvez déjà générer du contenu en local."
echo ""
echo -e "${YELLOW}📝 Pour améliorer les performances (RECOMMANDÉ):${NC}"
echo ""
echo "1. Créer un compte Groq GRATUIT (2 minutes):"
echo "   👉 https://console.groq.com"
echo ""
echo "2. Copier votre clé API gratuite"
echo ""
echo "3. L'ajouter dans le fichier .env:"
echo "   GROQ_API_KEY=gsk_votre_clé_ici"
echo ""
echo -e "${BLUE}💡 Avec Groq, vous aurez:${NC}"
echo "   • 14,400 requêtes/jour gratuites"
echo "   • Génération ultra-rapide (500 tokens/seconde!)"
echo "   • Meilleure qualité de contenu"
echo ""
echo "================================================================================="
echo ""
echo -e "${GREEN}🚀 Installation terminée!${NC}"
echo ""
echo -e "${YELLOW}Test rapide:${NC}"
echo "  ollama run llama3.1:8b \"Écris une description pour une vanne papillon\""
echo ""
echo -e "${YELLOW}Démarrer le backend:${NC}"
echo "  cd backend && npm run dev"
echo ""
echo "================================================================================="

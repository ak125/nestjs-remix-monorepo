# Installation et Configuration des Providers IA GRATUITS

## 🎯 Vous avez 3 options GRATUITES sans OpenAI !

---

## Option 1: Ollama (LOCAL - 100% GRATUIT) 🌟 RECOMMANDÉ

**Avantages:**
- ✅ Totalement GRATUIT et illimité
- ✅ Fonctionne hors ligne
- ✅ Aucune limite de tokens
- ✅ Données privées (tout reste sur votre machine)
- ✅ Très rapide une fois installé

### Installation

#### Sur Linux (dans votre dev container)
```bash
# Installer Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Démarrer le service
ollama serve &

# Télécharger un modèle (choisir selon vos besoins)
# Petit et rapide (2GB)
ollama pull llama3.2:3b

# Équilibré (4.7GB) - RECOMMANDÉ
ollama pull llama3.1:8b

# Puissant pour du contenu complexe (40GB)
ollama pull llama3.1:70b

# Modèle français optimisé (4GB)
ollama pull vigogne:7b-instruct
```

#### Configuration dans .env
```bash
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b  # ou llama3.2:3b pour plus rapide
```

#### Test
```bash
# Tester Ollama
curl http://localhost:11434/api/tags

# Générer du texte
ollama run llama3.1:8b "Écris une description pour une vanne papillon"
```

---

## Option 2: Groq (API GRATUITE - ULTRA RAPIDE) ⚡

**Avantages:**
- ✅ API 100% GRATUITE
- ✅ 14,400 requêtes/jour gratuites
- ✅ Le plus RAPIDE (jusqu'à 500 tokens/seconde!)
- ✅ Modèles puissants (Llama 3 70B)
- ✅ Parfait pour la production

### Installation

#### 1. Créer un compte gratuit
```bash
# Aller sur https://console.groq.com
# Créer un compte (GitHub OAuth disponible)
# Générer une clé API (gratuite!)
```

#### 2. Configuration dans .env
```bash
AI_PROVIDER=groq
GROQ_API_KEY=gsk_votre_clé_ici
GROQ_MODEL=llama3-70b-8192  # ou mixtral-8x7b-32768
```

#### Modèles disponibles (tous GRATUITS):
- `llama3-70b-8192` - Le plus puissant (recommandé)
- `llama3-8b-8192` - Rapide et efficace
- `mixtral-8x7b-32768` - Bon pour du contenu long
- `gemma-7b-it` - Alternative légère

#### Limites gratuites:
- 14,400 requêtes/jour
- 6,000 requêtes/minute
- Largement suffisant pour 99% des usages!

---

## Option 3: HuggingFace (API GRATUITE) 🤗

**Avantages:**
- ✅ API GRATUITE
- ✅ Accès à des milliers de modèles
- ✅ Bonne qualité de génération
- ⚠️ Plus lent que Groq

### Installation

#### 1. Créer un compte
```bash
# Aller sur https://huggingface.co
# Créer un compte gratuit
# Settings > Access Tokens > New Token
```

#### 2. Configuration dans .env
```bash
AI_PROVIDER=huggingface
HUGGINGFACE_API_KEY=hf_votre_clé_ici
HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.2
```

#### Modèles recommandés (tous GRATUITS):
- `mistralai/Mistral-7B-Instruct-v0.2` - Excellent rapport qualité/vitesse
- `meta-llama/Llama-2-7b-chat-hf` - Stable et fiable
- `tiiuae/falcon-7b-instruct` - Alternative intéressante
- `bigscience/bloomz-7b1` - Bon pour le français

---

## Auto-Détection (RECOMMANDÉ pour Production)

Le système peut auto-détecter le meilleur provider disponible:

```bash
# Dans .env
AI_PROVIDER=auto

# Le système essaiera dans cet ordre:
# 1. Ollama (local)
# 2. Groq (si GROQ_API_KEY existe)
# 3. HuggingFace (si HUGGINGFACE_API_KEY existe)
# 4. OpenAI (si OPENAI_API_KEY existe)
```

---

## Comparaison des Options

| Provider | Coût | Vitesse | Qualité | Hors ligne | Setup |
|----------|------|---------|---------|------------|-------|
| **Ollama** | 💯 Gratuit | ⚡⚡ Rapide | ⭐⭐⭐⭐ | ✅ Oui | 5 min |
| **Groq** | 💯 Gratuit | ⚡⚡⚡ Ultra | ⭐⭐⭐⭐⭐ | ❌ Non | 2 min |
| **HuggingFace** | 💯 Gratuit | ⚡ Moyen | ⭐⭐⭐ | ❌ Non | 3 min |
| OpenAI | 💰 Payant | ⚡⚡ Rapide | ⭐⭐⭐⭐⭐ | ❌ Non | 2 min |

---

## Configuration Recommandée selon Usage

### Pour Développement Local
```bash
AI_PROVIDER=ollama
OLLAMA_MODEL=llama3.2:3b  # Rapide et léger
```

### Pour Production avec Budget
```bash
AI_PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama3-70b-8192  # Meilleure qualité gratuite
```

### Pour Maximum de Résilience
```bash
AI_PROVIDER=auto
GROQ_API_KEY=gsk_...           # Primary
HUGGINGFACE_API_KEY=hf_...     # Backup
# + Ollama installé en local      # Fallback
```

---

## Installation Rapide Complète

### Script d'installation tout-en-un

```bash
#!/bin/bash

echo "🤖 Installation des providers IA GRATUITS"

# 1. Installer Ollama (local)
echo "📦 Installation d'Ollama..."
curl -fsSL https://ollama.com/install.sh | sh
ollama serve > /dev/null 2>&1 &
sleep 2
ollama pull llama3.1:8b

# 2. Configurer le .env
cat >> .env << EOF

# 🤖 AI CONTENT GENERATION
AI_PROVIDER=auto

# Ollama (local - gratuit illimité)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# Groq (API gratuite - ultra rapide)
# Obtenir une clé sur: https://console.groq.com
GROQ_API_KEY=
GROQ_MODEL=llama3-70b-8192

# HuggingFace (API gratuite - backup)
# Obtenir une clé sur: https://huggingface.co/settings/tokens
HUGGINGFACE_API_KEY=
HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.2
EOF

echo "✅ Configuration terminée!"
echo ""
echo "📝 Prochaines étapes:"
echo "1. Obtenir une clé Groq (gratuite): https://console.groq.com"
echo "2. Ajouter GROQ_API_KEY dans .env"
echo "3. Démarrer le backend: npm run dev"
echo ""
echo "🎯 Vous pouvez déjà utiliser Ollama en local!"
```

Enregistrez ce script dans `install-ai-providers.sh` et exécutez:

```bash
chmod +x install-ai-providers.sh
./install-ai-providers.sh
```

---

## Test de Fonctionnement

```bash
# Test Ollama
curl http://localhost:11434/api/tags

# Test de génération avec votre API
curl -X POST http://localhost:5001/api/ai-content/generate/product-description \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Vanne papillon motorisée DN50",
    "features": ["Corps fonte", "Motorisation 24V"],
    "tone": "professional",
    "length": "medium"
  }'
```

---

## Dépannage

### Ollama ne démarre pas
```bash
# Vérifier le statut
ps aux | grep ollama

# Redémarrer
pkill ollama
ollama serve &
```

### Groq retourne une erreur
```bash
# Vérifier votre clé API
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY"
```

### HuggingFace est lent
C'est normal, le modèle "chauffe" au premier appel. Patience!

---

## 🎉 Conclusion

**Vous n'avez AUCUNE excuse pour ne pas avoir de l'IA maintenant!**

1. **Quick Start**: Installez Ollama (5 minutes)
2. **Production**: Créez un compte Groq (2 minutes)
3. **Redondance**: Ajoutez HuggingFace en backup

**Tout est GRATUIT et ILLIMITÉ!** 🚀

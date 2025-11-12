# 🤖 Système de Génération de Contenu IA - README

## 📋 Vue d'ensemble

Système complet de génération de contenu intelligent utilisant plusieurs providers IA **100% GRATUITS** :
- **Ollama** (local, illimité)
- **Groq** (API gratuite, ultra-rapide)
- **HuggingFace** (API gratuite)
- OpenAI (optionnel, payant)

## 🚀 Démarrage Rapide (2 minutes)

```bash
# 1. Installer Ollama (local, gratuit)
curl -fsSL https://ollama.com/install.sh | sh
ollama serve &
ollama pull llama3.1:8b

# 2. Configurer l'environnement
cp .env.ai.example .env
# Éditer .env et définir AI_PROVIDER=ollama

# 3. Tester
./test-ai-content.sh
```

**✅ C'est tout ! Vous avez maintenant un système IA gratuit et illimité.**

## 📦 Fichiers Créés

### Backend
```
backend/src/modules/ai-content/
├── ai-content.module.ts              # Module principal
├── ai-content.controller.ts          # API endpoints
├── ai-content.service.ts             # Service avec auto-détection
├── ai-content-cache.service.ts       # Cache Redis
├── prompt-template.controller.ts     # Gestion templates
├── prompt-template.service.ts        # Service templates
├── providers/
│   ├── ollama.provider.ts            # Provider Ollama (local)
│   ├── groq.provider.ts              # Provider Groq (gratuit)
│   └── huggingface.provider.ts       # Provider HuggingFace (gratuit)
├── dto/
│   ├── generate-content.dto.ts       # DTOs génération
│   └── prompt-template.dto.ts        # DTOs templates
├── templates/
│   └── content-templates.ts          # Templates prédéfinis
└── __tests__/
    └── ai-content.service.spec.ts    # Tests unitaires
```

### Frontend
```
frontend/app/
├── hooks/
│   └── useAiContent.ts               # Hook React
└── components/ai/
    ├── AiContentGenerator.tsx        # Composant générique
    ├── ProductDescriptionGenerator.tsx # Spécialisé produits
    └── SEOMetaGenerator.tsx          # Spécialisé SEO
```

### Documentation & Scripts
```
.
├── AI-QUICK-START.md                 # Guide rapide (ce fichier)
├── AI-CONTENT-GENERATOR-DOCS.md      # Documentation complète
├── AI-PROVIDERS-GRATUITS.md          # Guide des providers gratuits
├── .env.ai.example                   # Configuration exemple
├── install-ai-providers.sh           # Script installation auto
└── test-ai-content.sh                # Script de tests
```

## 🎯 Types de Contenu Supportés

1. **product_description** - Descriptions de produits optimisées
2. **seo_meta** - Méta-descriptions SEO (150-160 chars)
3. **marketing_copy** - Textes marketing persuasifs
4. **blog_article** - Articles de blog structurés
5. **social_media** - Posts pour réseaux sociaux
6. **email_campaign** - Emails marketing

## 🔌 API Endpoints

```
POST /api/ai-content/generate                      # Génération générique
POST /api/ai-content/generate/product-description  # Description produit
POST /api/ai-content/generate/seo-meta            # Méta SEO
POST /api/ai-content/generate/batch               # Génération par lots

GET  /api/ai-content/prompts                      # Lister templates
POST /api/ai-content/prompts                      # Créer template
GET  /api/ai-content/prompts/:id                  # Obtenir template
POST /api/ai-content/prompts/:id/test             # Tester template
DELETE /api/ai-content/prompts/:id                # Supprimer template
```

## ⚙️ Configuration

### Option 1: Auto-Détection (Recommandé)

```bash
# .env
AI_PROVIDER=auto

# Configure tous les providers disponibles
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

GROQ_API_KEY=gsk_...
GROQ_MODEL=llama3-70b-8192

HUGGINGFACE_API_KEY=hf_...
```

Le système essaiera automatiquement : Ollama → Groq → HuggingFace → OpenAI

### Option 2: Provider Spécifique

```bash
# Utiliser uniquement Ollama (local)
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# OU utiliser Groq (gratuit, ultra-rapide)
AI_PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama3-70b-8192
```

## 📊 Comparaison des Providers

| Provider | Coût | Setup | Vitesse | Qualité | Hors ligne |
|----------|------|-------|---------|---------|------------|
| **Ollama** | 💯 Gratuit ∞ | 5 min | ⚡⚡ | ⭐⭐⭐⭐ | ✅ |
| **Groq** | 💯 Gratuit* | 2 min | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | ❌ |
| **HuggingFace** | 💯 Gratuit* | 3 min | ⚡ | ⭐⭐⭐ | ❌ |
| OpenAI | 💰 ~20€/mois | 2 min | ⚡⚡ | ⭐⭐⭐⭐⭐ | ❌ |

*14,400 req/jour pour Groq, quota limité pour HuggingFace

## 🎨 Exemples d'Utilisation

### Backend (cURL)

```bash
# Description de produit
curl -X POST http://localhost:5001/api/ai-content/generate/product-description \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Vanne papillon motorisée DN50",
    "features": ["Corps fonte", "Motorisation 24V"],
    "tone": "professional",
    "length": "medium"
  }'
```

### Frontend (React)

```typescript
import { useAiContent } from '~/hooks/useAiContent';

function MyComponent() {
  const { generateProductDescription, isLoading } = useAiContent();

  const generate = async () => {
    const result = await generateProductDescription({
      productName: 'Vanne papillon DN50',
      features: ['Corps fonte', 'Motorisation 24V'],
      tone: 'professional',
      length: 'medium',
    });
    
    console.log(result.content);
  };

  return (
    <button onClick={generate} disabled={isLoading}>
      ✨ Générer avec IA
    </button>
  );
}
```

### Composant UI

```typescript
import { AiContentGenerator } from '~/components/ai/AiContentGenerator';

export default function AdminPage() {
  return (
    <AiContentGenerator
      onContentGenerated={(content) => {
        console.log('Généré:', content);
      }}
    />
  );
}
```

## 🧪 Tests

```bash
# Lancer tous les tests
./test-ai-content.sh

# Tests unitaires
cd backend && npm test ai-content

# Test manuel
ollama run llama3.1:8b "Test de génération"
```

## 🔧 Dépannage

### Ollama ne démarre pas
```bash
ps aux | grep ollama
pkill ollama && ollama serve &
```

### Modèle non trouvé
```bash
ollama list
ollama pull llama3.1:8b
```

### Erreur de connexion
```bash
curl http://localhost:11434/api/tags
# Si erreur : vérifier que ollama serve est lancé
```

### Cache Redis inactif
```bash
docker-compose -f docker-compose.redis.yml up -d
redis-cli ping
```

## 📚 Documentation Complète

- **Guide rapide** : `AI-QUICK-START.md` (ce fichier)
- **Documentation complète** : `AI-CONTENT-GENERATOR-DOCS.md`
- **Providers gratuits** : `AI-PROVIDERS-GRATUITS.md`

## 🎯 Roadmap

- [x] Support Ollama (local)
- [x] Support Groq (gratuit)
- [x] Support HuggingFace (gratuit)
- [x] Auto-détection providers
- [x] Cache Redis
- [x] Templates personnalisables
- [x] Génération par lots
- [x] Composants React
- [ ] Support Anthropic Claude
- [ ] Interface admin pour templates
- [ ] Analytics et monitoring
- [ ] A/B testing de prompts

## 🤝 Support

**Problèmes courants :**
1. Vérifier les logs : `tail -f logs/backend.log`
2. Tester Ollama : `ollama run llama3.1:8b "test"`
3. Vérifier l'API : `curl http://localhost:5001/api/health`

**Resources :**
- Ollama : https://ollama.com
- Groq : https://console.groq.com
- HuggingFace : https://huggingface.co

## 🎉 Conclusion

Vous avez maintenant un système de génération de contenu IA :
- ✅ **100% GRATUIT** (Ollama + Groq)
- ✅ **Illimité** (Ollama local)
- ✅ **Ultra-rapide** (Groq)
- ✅ **Prêt pour la production**
- ✅ **Évolutif** (ajoutez des providers facilement)

**Commencez maintenant :**
```bash
./install-ai-providers.sh
```

🚀 **Bonne génération !**

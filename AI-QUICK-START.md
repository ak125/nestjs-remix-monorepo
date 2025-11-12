# 🚀 Guide de Démarrage Ultra-Rapide - Générateur IA GRATUIT

## 🎉 AUCUNE API PAYANTE REQUISE !

Vous avez **3 options 100% GRATUITES** :

| Option | Coût | Vitesse | Installation | Qualité |
|--------|------|---------|--------------|---------|
| **Ollama** 🌟 | **Gratuit ∞** | ⚡⚡ Rapide | 5 min | ⭐⭐⭐⭐ |
| **Groq** ⚡ | **Gratuit** | ⚡⚡⚡ Ultra | 2 min | ⭐⭐⭐⭐⭐ |
| **HuggingFace** 🤗 | **Gratuit** | ⚡ Moyen | 3 min | ⭐⭐⭐ |

---

## ⚡ Installation Express (5 minutes)

### Option A : Script Automatique (RECOMMANDÉ)

```bash
# 1. Exécuter le script d'installation
./install-ai-providers.sh

# 2. Attendre 2-3 minutes (téléchargement du modèle)

# 3. C'est prêt ! 🎉
```

### Option B : Manuel (Ollama)

```bash
# 1. Installer Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Démarrer le service
ollama serve &

# 3. Télécharger un modèle
ollama pull llama3.1:8b    # Recommandé (4.7GB)
# OU
ollama pull llama3.2:3b    # Plus léger (2GB)

# 4. Configurer .env
cat >> .env << EOF
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
EOF
```

### Option C : Groq API (Ultra-Rapide)

```bash
# 1. Créer un compte gratuit (2 min)
# 👉 https://console.groq.com

# 2. Générer une clé API gratuite

# 3. Configurer .env
cat >> .env << EOF
AI_PROVIDER=groq
GROQ_API_KEY=gsk_votre_clé_ici
GROQ_MODEL=llama3-70b-8192
EOF
```

---

## 🎯 Configuration Optimale (Auto-Détection)

**Utilisez tous les providers disponibles en fallback :**

```bash
# Dans votre .env
AI_PROVIDER=auto

# Ollama (local - priorité 1)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# Groq (gratuit - priorité 2)
GROQ_API_KEY=gsk_votre_clé_ici
GROQ_MODEL=llama3-70b-8192

# HuggingFace (gratuit - priorité 3)
HUGGINGFACE_API_KEY=hf_votre_clé_ici
HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.2
```

Le système essaiera automatiquement dans cet ordre.

---

## ✅ Test de Fonctionnement

### 1. Test Ollama

```bash
# Vérifier que le service fonctionne
curl http://localhost:11434/api/tags

# Test de génération direct
ollama run llama3.1:8b "Écris une description professionnelle pour une vanne papillon motorisée DN50"
```

### 2. Test de l'API Backend

```bash
# Générer une description de produit
curl -X POST http://localhost:5001/api/ai-content/generate/product-description \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Vanne papillon motorisée DN50",
    "category": "Vannes",
    "features": [
      "Corps en fonte GGG40",
      "Disque inox 316L",
      "Motorisation 24V DC"
    ],
    "tone": "professional",
    "length": "medium"
  }'
```

### 3. Test Méta SEO

```bash
curl -X POST http://localhost:5001/api/ai-content/generate/seo-meta \
  -H "Content-Type: application/json" \
  -d '{
    "pageTitle": "Vannes papillon motorisées - Catalogue 2025",
    "targetKeyword": "vanne papillon motorisée",
    "keywords": ["automatisation", "robinet industriel"]
  }'
```

---

## 🎨 Utilisation Frontend

### Composant Générique

```typescript
import { AiContentGenerator } from '~/components/ai/AiContentGenerator';

export default function AdminContentPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">
        Générateur de Contenu IA
      </h1>
      
      <AiContentGenerator
        onContentGenerated={(content) => {
          console.log('Contenu:', content);
          // Utiliser le contenu
        }}
      />
    </div>
  );
}
```

### Composant Produit

```typescript
import { ProductDescriptionGenerator } from '~/components/ai/ProductDescriptionGenerator';

export default function ProductEditPage() {
  return (
    <ProductDescriptionGenerator
      productName="Vanne papillon DN50"
      onGenerated={(description) => {
        // Sauvegarder la description
        updateProduct({ description });
      }}
    />
  );
}
```

### Hook React

```typescript
import { useAiContent } from '~/hooks/useAiContent';

function MyComponent() {
  const { 
    generateProductDescription, 
    isLoading, 
    error 
  } = useAiContent();

  const handleGenerate = async () => {
    const result = await generateProductDescription({
      productName: 'Vanne papillon DN50',
      features: ['Corps fonte', 'Motorisation 24V'],
      tone: 'professional',
      length: 'medium',
    });
    
    console.log(result.content);
  };

  return (
    <button onClick={handleGenerate} disabled={isLoading}>
      {isLoading ? 'Génération...' : '✨ Générer avec IA'}
    </button>
  );
}
```

---

## 🔥 Exemples d'Utilisation Avancée

### Génération en Masse

```typescript
// Générer des descriptions pour tous les produits
async function generateAllDescriptions(products: Product[]) {
  const { generateProductDescription } = useAiContent();
  
  for (const product of products) {
    const result = await generateProductDescription({
      productName: product.name,
      category: product.category,
      features: product.features,
      tone: 'professional',
      length: 'medium',
    });
    
    await updateProduct(product.id, {
      description: result.content
    });
  }
}
```

### Génération par Lots

```bash
curl -X POST http://localhost:5001/api/ai-content/generate/batch \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {
        "type": "product_description",
        "prompt": "Vanne papillon DN50",
        "tone": "professional"
      },
      {
        "type": "seo_meta",
        "prompt": "Page catalogue vannes",
        "tone": "professional"
      }
    ]
  }'
```

---

## 🎯 Modèles Recommandés

### Pour Ollama (Local)

```bash
# Rapide et léger (2GB)
ollama pull llama3.2:3b

# Équilibré - RECOMMANDÉ (4.7GB)
ollama pull llama3.1:8b

# Puissant (40GB - si vous avez la RAM)
ollama pull llama3.1:70b

# Optimisé français (4GB)
ollama pull vigogne:7b-instruct
```

### Pour Groq (API Gratuite)

- `llama3-70b-8192` - **Le meilleur** (recommandé)
- `llama3-8b-8192` - Rapide et efficace
- `mixtral-8x7b-32768` - Bon pour contenu long
- `gemma-7b-it` - Alternative légère

### Pour HuggingFace (API Gratuite)

- `mistralai/Mistral-7B-Instruct-v0.2` - Excellent
- `meta-llama/Llama-2-7b-chat-hf` - Stable
- `tiiuae/falcon-7b-instruct` - Alternative

---

## 💡 Bonnes Pratiques

### 1. Cache Redis (Recommandé)

```bash
# Démarrer Redis
docker-compose -f docker-compose.redis.yml up -d

# Configurer .env
REDIS_URL=redis://localhost:6379
```

**Économies : 90% des requêtes en moins !**

### 2. Paramètres de Génération

```typescript
// Précis et factuel
{ temperature: 0.3, tone: 'professional' }

// Équilibré
{ temperature: 0.7, tone: 'friendly' }

// Créatif
{ temperature: 1.0, tone: 'persuasive' }
```

### 3. Longueurs Optimales

- **short** : 100-200 mots (méta-descriptions, tweets)
- **medium** : 250-500 mots (descriptions produits)
- **long** : 500-1000 mots (articles, guides)

---

## 🔧 Dépannage

### Ollama ne démarre pas

```bash
# Vérifier le processus
ps aux | grep ollama

# Redémarrer
pkill ollama
ollama serve &

# Vérifier les logs
journalctl -u ollama -f
```

### Erreur "Model not found"

```bash
# Lister les modèles installés
ollama list

# Télécharger le modèle manquant
ollama pull llama3.1:8b
```

### Groq retourne 429 (Rate Limit)

**Solution :** Vous avez atteint la limite gratuite (14,400/jour).
- Attendez 24h
- Basculez sur Ollama (local, illimité)
- Ajoutez HuggingFace en backup

### Génération trop lente

**Solutions :**
1. Utilisez Groq (ultra-rapide)
2. Réduisez `maxLength`
3. Utilisez un modèle plus petit (`llama3.2:3b`)
4. Activez le cache Redis

---

## 📊 Monitoring et Stats

### Vérifier le cache

```bash
curl http://localhost:5001/api/ai-content/cache/stats
```

### Lister les templates

```bash
curl http://localhost:5001/api/ai-content/prompts
```

### Health Check

```bash
curl http://localhost:5001/api/health
```

---

## 🚀 Démarrage du Système

```bash
# 1. Démarrer Ollama (si utilisé)
ollama serve &

# 2. Démarrer Redis (optionnel)
docker-compose -f docker-compose.redis.yml up -d

# 3. Démarrer le backend
cd backend && npm run dev

# 4. Démarrer le frontend
cd frontend && npm run dev
```

---

## 📚 Ressources

- 📖 Documentation complète : `AI-CONTENT-GENERATOR-DOCS.md`
- 🔧 Providers gratuits : `AI-PROVIDERS-GRATUITS.md`
- 🤖 Ollama : https://ollama.com
- ⚡ Groq : https://console.groq.com
- 🤗 HuggingFace : https://huggingface.co

---

## ✅ Checklist de Mise en Production

- [ ] Ollama installé et testé
- [ ] Clé Groq configurée (backup)
- [ ] Redis activé pour le cache
- [ ] Tests de génération réussis
- [ ] Monitoring configuré
- [ ] Templates personnalisés créés
- [ ] Documentation équipe mise à jour

---

## 🎉 C'est Prêt !

Vous avez maintenant un système de génération de contenu IA **professionnel**, **gratuit**, et **illimité** !

**Commencez simplement :**
```bash
ollama run llama3.1:8b "Bonjour, génère-moi du contenu !"
```

🚀 **Bonne génération !**

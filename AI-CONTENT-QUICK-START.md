# 🤖 AI Content Generator - Guide de Démarrage Rapide# Guide de Démarrage Rapide - Générateur de Contenu IA



## ✅ Configuration Actuelle - GROQ Gratuit Activé !## Installation



### 📊 Provider Actif### 1. Installer les dépendances



- **Provider:** Groq (14,400 req/jour GRATUIT)```bash

- **Modèle:** `llama-3.1-70b-versatile`cd backend

- **Cache:** Redis 7 jours TTLnpm install ioredis

- **Fallback:** HuggingFace automatique si quota dépassénpm install --save-dev @types/ioredis

```

---

### 2. Configuration

## 🚀 Accès Rapide

Ajoutez ces variables dans votre fichier `.env` :

### Option 1 : Dashboard Admin (recommandé)

```bash

```# OpenAI API (obligatoire pour la production)

http://localhost:5173/adminOPENAI_API_KEY=sk-votre-clé-api

→ Cliquez sur "🤖 IA Content Generator" (badge NOUVEAU)

```# Provider (optionnel, par défaut: openai)

AI_PROVIDER=openai

### Option 2 : Accès Direct

# Redis (optionnel mais recommandé pour le cache)

```REDIS_URL=redis://localhost:6379

http://localhost:5173/admin/ai-content```

```

### 3. Démarrer les services

---

```bash

## 🎯 Tester Maintenant# Démarrer Redis (si vous l'utilisez)

docker-compose -f docker-compose.redis.yml up -d

### Test API avec curl

# Démarrer le backend

```bashnpm run dev

curl -X POST http://localhost:3000/api/ai-content/generate \```

  -H "Content-Type: application/json" \

  -d '{## Utilisation Rapide

    "type": "product_description",

    "prompt": "Plaquettes de frein Brembo pour Renault Clio 5",### Backend - Générer une description de produit

    "context": {

      "brand": "Brembo",```bash

      "vehicle": "Renault Clio 5"curl -X POST http://localhost:5001/api/ai-content/generate/product-description \

    }  -H "Content-Type: application/json" \

  }'  -d '{

```    "productName": "Vanne papillon motorisée DN50",

    "category": "Vannes",

### Résultat attendu    "features": [

      "Corps en fonte GGG40",

```json      "Disque inox 316L",

{      "Motorisation 24V DC"

  "content": "Les plaquettes de frein Brembo pour Renault Clio 5 offrent...",    ],

  "metadata": {    "tone": "professional",

    "provider": "groq",    "length": "medium"

    "model": "llama-3.1-70b-versatile",  }'

    "cached": false,```

    "generatedAt": "2025-11-12T10:30:00Z"

  }### Backend - Générer une méta-description SEO

}

``````bash

curl -X POST http://localhost:5001/api/ai-content/generate/seo-meta \

---  -H "Content-Type: application/json" \

  -d '{

## 📦 Types de Contenu Disponibles    "pageTitle": "Vannes papillon motorisées - Catalogue 2025",

    "targetKeyword": "vanne papillon motorisée",

| Type | Description | Utilisation |    "keywords": ["automatisation", "robinet industriel"]

|------|-------------|-------------|  }'

| `product_description` | Description produit détaillée | Fiches produits e-commerce |```

| `seo_meta` | Titre + Meta Description optimisés | SEO pages produits |

| `marketing_copy` | Texte promotionnel engageant | Landing pages, promos |### Frontend - Utiliser le composant

| `blog_article` | Article complet 800-1500 mots | Blog automobile, conseils |

| `social_media` | Posts réseaux sociaux | Facebook, Instagram, Twitter |```typescript

| `email_campaign` | Email marketing HTML | Newsletters, campagnes |// Dans votre route Remix

import { AiContentGenerator } from '~/components/ai/AiContentGenerator';

---

export default function AdminContentPage() {

## 🔄 Changer de Provider  return (

    <div className="container mx-auto py-8">

### Basculer vers Ollama (Local Illimité)      <h1 className="text-3xl font-bold mb-6">Générateur de Contenu IA</h1>

      

**Avantage :** 0 limite, 100% offline, confidentialité totale      <AiContentGenerator

        onContentGenerated={(content) => {

1. **Démarrer Ollama en Docker :**          console.log('Contenu généré:', content);

```bash          // Faites quelque chose avec le contenu

docker-compose -f docker-compose.ollama.yml up -d        }}

docker exec -it ollama-ai ollama pull llama3.1:8b      />

```    </div>

  );

2. **Modifier `.env` :**}

```bash```

AI_PROVIDER=ollama

OLLAMA_BASE_URL=http://localhost:11434### Frontend - Générer pour un produit spécifique

OLLAMA_MODEL=llama3.1:8b

``````typescript

import { ProductDescriptionGenerator } from '~/components/ai/ProductDescriptionGenerator';

3. **Redémarrer le backend :**

```bashexport default function ProductEditPage() {

cd backend && npm run dev  const handleGenerated = (description: string) => {

```    // Mettre à jour le produit avec la nouvelle description

    console.log('Description:', description);

### Basculer vers OpenAI (Payant, Ultra-Performant)  };



1. **Obtenir une clé API :** https://platform.openai.com/api-keys  return (

    <ProductDescriptionGenerator

2. **Modifier `.env` :**      productName="Vanne papillon DN50"

```bash      onGenerated={handleGenerated}

AI_PROVIDER=openai    />

OPENAI_API_KEY=sk-votre-clé  );

OPENAI_MODEL=gpt-4o-mini}

``````



---## Mode Développement (Sans API Key)



## 📊 Comparaison des ProvidersSi vous n'avez pas encore de clé OpenAI, le système fonctionnera en mode mock :



| Provider | Coût | Quota | Qualité | Vitesse | Offline |```bash

|----------|------|-------|---------|---------|---------|# Pas besoin de OPENAI_API_KEY

| **Groq** | ✅ Gratuit | 14,400/jour | ⭐⭐⭐⭐ | ⚡⚡⚡ | ❌ |# Le système générera du contenu factice pour le développement

| **Ollama** | ✅ Gratuit | ♾️ Illimité | ⭐⭐⭐⭐ | ⚡⚡ | ✅ |```

| HuggingFace | ✅ Gratuit | 1,000/jour | ⭐⭐⭐ | ⚡ | ❌ |

| OpenAI | 💰 Payant | Selon plan | ⭐⭐⭐⭐⭐ | ⚡⚡⚡ | ❌ |Le mode mock :

- ✅ Fonctionne immédiatement sans configuration

**Recommandation :**- ✅ Simule un délai réaliste d'API

- **Développement/Test :** Groq (actuel)- ✅ Génère du contenu de démonstration

- **Production e-commerce :** Ollama ou OpenAI- ❌ Ne génère pas de vrai contenu intelligent

- **Backup automatique :** HuggingFace

## Templates de Prompts

---

### Lister les templates disponibles

## 🎨 Composants Frontend

```bash

### 1. Générateur Génériquecurl http://localhost:5001/api/ai-content/prompts

```

```tsx

import { AiContentGenerator } from '~/components/ai/AiContentGenerator';### Créer un template personnalisé



export default function MyPage() {```bash

  return <AiContentGenerator />;curl -X POST http://localhost:5001/api/ai-content/prompts \

}  -H "Content-Type: application/json" \

```  -d '{

    "name": "Description Technique",

### 2. Générateur Descriptions Produits    "description": "Template pour descriptions techniques détaillées",

    "category": "product",

```tsx    "systemPrompt": "Tu es un ingénieur technique qui rédige des spécifications précises.",

import { ProductDescriptionGenerator } from '~/components/ai/ProductDescriptionGenerator';    "userPromptTemplate": "Crée une description technique pour {{productName}} avec ces specs: {{specifications}}",

    "variables": [

<ProductDescriptionGenerator />      {

```        "name": "productName",

        "type": "string",

### 3. Générateur SEO Meta        "required": true

      },

```tsx      {

import { SEOMetaGenerator } from '~/components/ai/SEOMetaGenerator';        "name": "specifications",

        "type": "object",

<SEOMetaGenerator />        "required": true

```      }

    ],

### 4. Hook personnalisé    "defaultSettings": {

      "temperature": 0.5,

```tsx      "maxLength": 800

import { useAiContent } from '~/hooks/useAiContent';    },

    "tags": ["technical", "product"]

function MyComponent() {  }'

  const { generateContent, loading, error } = useAiContent();```



  const handleGenerate = async () => {## Exemples d'Intégration

    const result = await generateContent({

      type: 'product_description',### 1. Générer des descriptions pour un catalogue

      prompt: 'Filtre à huile Mann-Filter pour BMW',

      context: { brand: 'Mann-Filter', vehicle: 'BMW Série 3' }```typescript

    });import { useAiContent } from '~/hooks/useAiContent';

    console.log(result.content);

  };function BulkProductDescriptions() {

  const { generateProductDescription } = useAiContent();

  return <button onClick={handleGenerate}>Générer</button>;

}  const generateForProducts = async (products: Product[]) => {

```    for (const product of products) {

      const result = await generateProductDescription({

---        productName: product.name,

        category: product.category,

## 📈 Monitoring & Cache        features: product.features,

        tone: 'professional',

### Vérifier le cache Redis        length: 'medium',

      });

```bash

redis-cli      // Sauvegarder la description

> KEYS ai:*      await updateProduct(product.id, {

> GET "ai:content:hash:xxxxx"        description: result.content,

> TTL "ai:content:hash:xxxxx"  # Temps restant avant expiration      });

```    }

  };

### Logs Backend

  return <button onClick={() => generateForProducts(products)}>

Recherchez ces messages dans les logs :    Générer toutes les descriptions

  </button>;

```}

✅ Cache HIT - ai:content:hash:abc123 (temps: 5ms)```

⚠️ Cache MISS - Génération via Groq (temps: 2500ms)

🔄 Provider Ollama indisponible, fallback vers Groq### 2. Générer du SEO automatiquement

🎯 Contenu généré avec succès (provider: groq, tokens: 450)

``````typescript

function AutoSEOGenerator({ page }: { page: Page }) {

---  const { generateSEOMeta } = useAiContent();



## 🛠️ Dépannage  useEffect(() => {

    if (!page.metaDescription) {

### Erreur "No AI provider configured"      generateSEOMeta({

        pageTitle: page.title,

**Cause :** Variable `AI_PROVIDER` manquante dans `.env`        pageUrl: page.url,

        targetKeyword: page.mainKeyword,

**Solution :**      }).then((result) => {

```bash        // Sauvegarder automatiquement

# Vérifiez votre .env        updatePageMeta(page.id, result.content);

cat backend/.env | grep AI_PROVIDER      });

    }

# Si manquant, ajoutez :  }, [page]);

echo "AI_PROVIDER=groq" >> backend/.env

echo "GROQ_API_KEY=gsk_..." >> backend/.env  return <div>SEO généré automatiquement</div>;

```}

```

### Erreur "Rate limit exceeded"

### 3. Pré-remplir un formulaire

**Cause :** Quota Groq dépassé (14,400 req/jour)

```typescript

**Solution automatique :** Le système bascule sur HuggingFacefunction ProductForm() {

  const [description, setDescription] = useState('');

**Solution manuelle :** Attendez 1 minute ou basculez vers Ollama  const { generateProductDescription, isLoading } = useAiContent();



### Ollama ne répond pas  const handleAutoFill = async () => {

    const result = await generateProductDescription({

```bash      productName: formData.name,

# Vérifier le conteneur      category: formData.category,

docker ps | grep ollama      features: formData.features,

      tone: 'professional',

# Voir les logs      length: 'medium',

docker logs ollama-ai    });



# Redémarrer    setDescription(result.content);

docker-compose -f docker-compose.ollama.yml restart  };

```

  return (

---    <form>

      <input name="name" />

## 💡 Bonnes Pratiques      <textarea 

        value={description}

### 1. Optimisez vos prompts        onChange={(e) => setDescription(e.target.value)}

      />

❌ **Mauvais :**      <button type="button" onClick={handleAutoFill} disabled={isLoading}>

```        ✨ Générer avec IA

"Décris ce produit"      </button>

```    </form>

  );

✅ **Bon :**}

``````

"Génère une description SEO-optimisée pour des plaquettes de frein Brembo 

destinées à une Renault Clio 5 (2019-2024). Inclure : caractéristiques ## Performances et Cache

techniques, avantages, compatibilité. Ton professionnel et rassurant. 

150-200 mots."### Statistiques du cache

```

```bash

### 2. Utilisez le contexte# Vérifier les stats du cache

curl http://localhost:5001/api/ai-content/cache/stats

```json```

{

  "type": "product_description",### Vider le cache

  "prompt": "Amortisseurs Bilstein B6",

  "context": {```bash

    "brand": "Bilstein",# Vider tout le cache AI

    "category": "Suspension",curl -X DELETE http://localhost:5001/api/ai-content/cache

    "vehicle": "Volkswagen Golf 7",```

    "targetAudience": "particuliers",

    "tone": "informatif",## Dépannage

    "keywords": ["confort", "tenue de route", "qualité allemande"]

  }### Erreur: "No AI provider API key configured"

}

```**Solution :** Ajoutez `OPENAI_API_KEY` dans votre `.env` ou utilisez le mode mock pour le développement.



### 3. Exploitez le cache### Erreur: "Redis connection failed"



Les prompts identiques retournent instantanément le résultat en cache (< 10ms vs 2000ms)**Solution :** 

1. Vérifiez que Redis est démarré : `docker-compose -f docker-compose.redis.yml ps`

---2. Ou désactivez le cache en retirant `REDIS_URL` du `.env`



## 🎯 Cas d'Usage Réels### Le contenu généré est toujours le même



### 1. Descriptions Produits en Masse**Solution :** Augmentez la `temperature` (0.7-1.0) pour plus de variété :



```typescript```typescript

const products = await getProducts();generateContent({

  ...options,

for (const product of products) {  temperature: 1.0, // Plus créatif

  const description = await generateContent({  useCache: false,  // Désactiver le cache

    type: 'product_description',});

    prompt: `${product.name} pour ${product.vehicle}`,```

    context: { brand: product.brand, category: product.category }

  });### Timeout lors de la génération

  

  await updateProduct(product.id, { description: description.content });**Solution :** OpenAI peut être lent parfois. Augmentez le timeout ou utilisez `gpt-3.5-turbo` qui est plus rapide.

}

```## Prochaines Étapes



### 2. Génération SEO Automatique1. **Créer une route admin** : `/admin/ai-content`

2. **Ajouter des templates personnalisés** pour votre domaine

```typescript3. **Intégrer dans vos workflows** existants

const pages = await getPages();4. **Monitorer les coûts** via OpenAI dashboard

5. **Tester différents prompts** pour optimiser les résultats

for (const page of pages) {

  const seo = await generateContent({## Ressources

    type: 'seo_meta',

    prompt: page.title,- 📚 Documentation complète : `AI-CONTENT-GENERATOR-DOCS.md`

    context: { url: page.url, keywords: page.keywords }- 🔗 OpenAI API : https://platform.openai.com/docs

  });- 💡 Exemples de prompts : https://platform.openai.com/examples

  - 📊 Monitoring des coûts : https://platform.openai.com/usage

  await updatePageSEO(page.id, {

    metaTitle: seo.content.title,## Support

    metaDescription: seo.content.description

  });Pour toute question :

}1. Consultez la documentation complète

```2. Vérifiez les logs : `tail -f logs/backend.log`

3. Testez avec le mode mock pour isoler les problèmes

### 3. Articles Blog Automatiques

```typescript
const topics = ['plaquettes de frein', 'vidange moteur', 'pneus hiver'];

for (const topic of topics) {
  const article = await generateContent({
    type: 'blog_article',
    prompt: `Guide complet : ${topic}`,
    context: { audience: 'débutants', tone: 'éducatif' }
  });
  
  await createBlogPost({
    title: topic,
    content: article.content,
    publishedAt: new Date()
  });
}
```

---

## 📚 Ressources

### Documentation

- **API Backend :** `/backend/src/modules/ai-content/README.md`
- **Dashboard Admin :** `http://localhost:5173/admin/ai-content`
- **Groq Docs :** https://console.groq.com/docs
- **Ollama Docs :** https://ollama.ai/docs

### Endpoints API

```
POST   /api/ai-content/generate              # Générer du contenu
GET    /api/ai-content/templates             # Liste des templates
POST   /api/ai-content/templates             # Créer un template
GET    /api/ai-content/templates/:id         # Détails d'un template
PUT    /api/ai-content/templates/:id         # Modifier un template
DELETE /api/ai-content/templates/:id         # Supprimer un template
```

---

**🎉 Système 100% opérationnel avec Groq gratuit !**

**Prochaines étapes :**
1. Testez le dashboard : `http://localhost:5173/admin/ai-content`
2. Générez votre premier contenu
3. Basculez vers Ollama si besoin d'illimité

**Support :** Consultez les logs backend ou le code source dans `/backend/src/modules/ai-content/`

# Système de Génération de Contenu IA

## Vue d'ensemble

Le système de génération de contenu IA permet de créer automatiquement différents types de contenus (descriptions produits, méta-descriptions SEO, textes marketing, etc.) en utilisant l'API OpenAI.

## Architecture

### Backend (NestJS)

```
backend/src/modules/ai-content/
├── ai-content.module.ts           # Module principal
├── ai-content.controller.ts       # Endpoints API
├── ai-content.service.ts          # Logique de génération
├── ai-content-cache.service.ts    # Gestion du cache Redis
├── prompt-template.controller.ts  # Gestion des templates
├── prompt-template.service.ts     # Service de templates
├── dto/
│   ├── generate-content.dto.ts    # DTOs de génération
│   └── prompt-template.dto.ts     # DTOs de templates
└── templates/
    └── content-templates.ts        # Templates de prompts
```

### Frontend (React/Remix)

```
frontend/app/
├── hooks/
│   └── useAiContent.ts            # Hook React pour l'API
└── components/ai/
    ├── AiContentGenerator.tsx      # Composant générique
    ├── ProductDescriptionGenerator.tsx  # Spécialisé produits
    └── SEOMetaGenerator.tsx        # Spécialisé SEO
```

## Configuration

### Variables d'environnement

Ajoutez dans votre fichier `.env` :

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-...
AI_PROVIDER=openai

# Redis (optionnel, pour le cache)
REDIS_URL=redis://localhost:6379
```

### Installation des dépendances

```bash
# Backend
cd backend
npm install ioredis

# Si vous utilisez TypeScript
npm install --save-dev @types/ioredis
```

## API Endpoints

### Génération de contenu générique

```http
POST /api/ai-content/generate
Content-Type: application/json

{
  "type": "product_description",
  "prompt": "Vanne papillon motorisée DN50",
  "tone": "professional",
  "language": "fr",
  "maxLength": 500,
  "temperature": 0.7,
  "useCache": true,
  "context": {
    "category": "Vannes",
    "features": ["Corps fonte", "Motorisation 24V"]
  }
}
```

**Types de contenu disponibles :**
- `product_description` - Description de produit
- `seo_meta` - Méta-description SEO
- `marketing_copy` - Texte marketing
- `blog_article` - Article de blog
- `social_media` - Post réseaux sociaux
- `email_campaign` - Email marketing

**Tons disponibles :**
- `professional` - Professionnel
- `casual` - Décontracté
- `friendly` - Amical
- `technical` - Technique
- `persuasive` - Persuasif
- `informative` - Informatif

### Description de produit

```http
POST /api/ai-content/generate/product-description
Content-Type: application/json

{
  "productName": "Vanne papillon motorisée DN50",
  "category": "Vannes",
  "features": [
    "Corps en fonte GGG40",
    "Disque inox 316L",
    "Motorisation 24V DC"
  ],
  "specifications": {
    "DN": "50",
    "PN": "16",
    "température": "-10°C à +120°C"
  },
  "targetAudience": "Professionnels du traitement de l'eau",
  "tone": "professional",
  "length": "medium"
}
```

### Méta-description SEO

```http
POST /api/ai-content/generate/seo-meta
Content-Type: application/json

{
  "pageTitle": "Vannes papillon motorisées - Catalogue 2025",
  "pageUrl": "https://example.com/vannes-papillon",
  "targetKeyword": "vanne papillon motorisée",
  "keywords": ["automatisation", "robinet industriel", "vanne électrique"],
  "businessType": "E-commerce industriel"
}
```

### Génération par lots

```http
POST /api/ai-content/generate/batch
Content-Type: application/json

{
  "requests": [
    {
      "type": "product_description",
      "prompt": "Produit 1",
      "tone": "professional"
    },
    {
      "type": "seo_meta",
      "prompt": "Page 1",
      "tone": "professional"
    }
  ]
}
```

### Gestion des templates de prompts

```http
# Lister tous les templates
GET /api/ai-content/prompts

# Obtenir un template
GET /api/ai-content/prompts/:id

# Créer un template
POST /api/ai-content/prompts
{
  "name": "Mon Template",
  "description": "Description du template",
  "category": "product",
  "systemPrompt": "Tu es un expert...",
  "userPromptTemplate": "Crée une description pour {{productName}}",
  "variables": [
    {
      "name": "productName",
      "type": "string",
      "required": true,
      "description": "Nom du produit"
    }
  ],
  "defaultSettings": {
    "temperature": 0.7,
    "maxLength": 500
  },
  "tags": ["product", "description"]
}

# Tester un template
POST /api/ai-content/prompts/:id/test
{
  "productName": "Mon Produit"
}

# Supprimer un template
DELETE /api/ai-content/prompts/:id
```

## Utilisation Frontend

### Hook useAiContent

```typescript
import { useAiContent } from '~/hooks/useAiContent';

function MyComponent() {
  const { 
    generateContent, 
    generateProductDescription, 
    generateSEOMeta,
    isLoading, 
    error 
  } = useAiContent();

  const handleGenerate = async () => {
    try {
      const result = await generateProductDescription({
        productName: 'Vanne papillon DN50',
        category: 'Vannes',
        features: ['Corps fonte', 'Motorisation 24V'],
        tone: 'professional',
        length: 'medium',
      });
      
      console.log(result.content);
    } catch (err) {
      console.error('Erreur:', err);
    }
  };

  return (
    <div>
      <button onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? 'Génération...' : 'Générer'}
      </button>
      {error && <p>Erreur: {error}</p>}
    </div>
  );
}
```

### Composant AiContentGenerator

```typescript
import { AiContentGenerator } from '~/components/ai/AiContentGenerator';

function MyPage() {
  return (
    <AiContentGenerator
      initialType="product_description"
      onContentGenerated={(content) => {
        console.log('Contenu généré:', content);
      }}
    />
  );
}
```

### Composant ProductDescriptionGenerator

```typescript
import { ProductDescriptionGenerator } from '~/components/ai/ProductDescriptionGenerator';

function ProductPage() {
  return (
    <ProductDescriptionGenerator
      productName="Vanne papillon DN50"
      onGenerated={(description) => {
        // Utiliser la description générée
        console.log(description);
      }}
    />
  );
}
```

### Composant SEOMetaGenerator

```typescript
import { SEOMetaGenerator } from '~/components/ai/SEOMetaGenerator';

function SEOPage() {
  return (
    <SEOMetaGenerator
      initialPageTitle="Ma Page"
      onGenerated={(meta) => {
        console.log('Titre:', meta.title);
        console.log('Description:', meta.description);
      }}
    />
  );
}
```

## Système de Cache

Le système utilise Redis pour mettre en cache les contenus générés :

- **Clé de cache** : Générée à partir du hash SHA-256 du type et du contexte
- **TTL par défaut** : 7 jours
- **Préfixe** : `ai-content:`

### Avantages du cache :
- Réduit les coûts d'API
- Accélère les réponses
- Assure la cohérence des contenus

### Désactiver le cache :
```typescript
await generateContent({
  type: 'product_description',
  prompt: 'Mon produit',
  useCache: false, // Désactive le cache
});
```

## Templates de Prompts

Le système inclut des templates prédéfinis pour :
- Descriptions de produits standards
- Méta-descriptions SEO
- Posts réseaux sociaux

### Syntaxe des templates :

```handlebars
{{variable}}                    # Variable simple
{{#if variable}}...{{/if}}      # Condition
{{#each array}}{{this}}{{/each}} # Boucle sur tableau
```

### Exemple de template :

```typescript
const template = {
  name: 'Description Produit',
  systemPrompt: 'Tu es un expert en e-commerce.',
  userPromptTemplate: `
Crée une description pour :

Nom : {{productName}}
{{#if category}}Catégorie : {{category}}{{/if}}
{{#if features}}
Caractéristiques :
{{#each features}}
- {{this}}
{{/each}}
{{/if}}

Ton : {{tone}}
`,
  variables: [
    { name: 'productName', type: 'string', required: true },
    { name: 'category', type: 'string', required: false },
    { name: 'features', type: 'array', required: false },
    { name: 'tone', type: 'string', required: false, defaultValue: 'professional' },
  ],
};
```

## Modèles AI

### OpenAI
- **Modèle par défaut** : `gpt-4o-mini` (rapide et économique)
- **Alternative** : `gpt-4` (plus puissant)

### Configuration :
```typescript
// Dans ai-content.service.ts
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  body: JSON.stringify({
    model: 'gpt-4o-mini', // ou 'gpt-4'
    temperature: 0.7,
    max_tokens: 1000,
  }),
});
```

## Mode Mock (Développement)

Si aucune clé API n'est configurée, le système utilise un provider mock qui génère du contenu factice :

```typescript
// Aucune clé API requise en mode développement
OPENAI_API_KEY=  # Vide ou absent
```

Le mode mock est utile pour :
- Développement sans coûts d'API
- Tests d'intégration
- Démonstrations

## Paramètres de Génération

### Temperature (0-2)
- **0.0-0.3** : Très précis et déterministe
- **0.4-0.7** : Équilibré (recommandé)
- **0.8-1.2** : Créatif
- **1.3-2.0** : Très créatif/aléatoire

### MaxLength
- **50-200** : Courte (tweets, méta-descriptions)
- **200-500** : Moyenne (descriptions produits)
- **500-2000** : Longue (articles, guides)

## Bonnes Pratiques

1. **Utilisez le cache** pour les contenus statiques
2. **Testez les templates** avant de les utiliser en production
3. **Surveillez les coûts** via OpenAI dashboard
4. **Validez toujours** le contenu généré avant publication
5. **Personnalisez les prompts** pour votre domaine métier

## Intégration avec app.module.ts

Ajoutez le module dans votre `app.module.ts` :

```typescript
import { AiContentModule } from './modules/ai-content/ai-content.module';

@Module({
  imports: [
    // ... autres modules
    AiContentModule,
  ],
})
export class AppModule {}
```

## Tests

### Test unitaire du service

```typescript
import { Test } from '@nestjs/testing';
import { AiContentService } from './ai-content.service';
import { ConfigService } from '@nestjs/config';

describe('AiContentService', () => {
  let service: AiContentService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AiContentService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(null), // Mode mock
          },
        },
      ],
    }).compile();

    service = module.get<AiContentService>(AiContentService);
  });

  it('should generate product description', async () => {
    const result = await service.generateProductDescription({
      productName: 'Test Product',
      tone: 'professional',
      length: 'medium',
    });

    expect(result).toBeDefined();
    expect(result.content).toBeTruthy();
    expect(result.type).toBe('product_description');
  });
});
```

## Monitoring et Logs

Les logs incluent :
- Temps de génération
- Utilisation du cache (hit/miss)
- Erreurs d'API
- Statistiques d'utilisation des templates

```typescript
// Exemple de logs
[AiContentService] Generated product_description content in 1234ms
[AiContentService] Cache hit for product_description
[AiContentCacheService] Cleared 10 cache entries matching *
```

## Prochaines Étapes

- [ ] Ajout d'Anthropic Claude comme provider alternatif
- [ ] Interface admin pour gérer les templates
- [ ] Analytics d'utilisation et de coûts
- [ ] Support multilingue avancé
- [ ] A/B testing de prompts
- [ ] Génération d'images (DALL-E)

## Support

Pour toute question ou problème :
1. Vérifiez les logs backend
2. Testez avec le mode mock
3. Vérifiez la configuration Redis
4. Consultez la documentation OpenAI

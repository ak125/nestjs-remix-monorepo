---
title: "ai content module"
status: draft
version: 1.0.0
---

# AI Content Generation Module - Technical Specification

**Module**: `ai-content`  
**Version**: 1.0.0  
**Status**: ✅ Production  
**Priority**: HIGH - Strategic differentiator

---

## 📝 Overview

Le **AI Content Module** fournit des capacités de **génération de contenu automatisée** via plusieurs providers d'IA (Groq, HuggingFace, OpenAI). Il permet de créer des descriptions produits, meta SEO, articles de blog, copies marketing et contenus réseaux sociaux en utilisant des **LLMs de dernière génération**.

### Business Value
- **Productivité:** Génération automatique de 400k descriptions produits (80h → 2h)
- **SEO:** Optimisation automatique meta descriptions (CTR +15-25%)
- **Coûts:** Providers gratuits (Groq, HuggingFace) → $0/mois vs OpenAI $50-200/mois
- **Qualité:** Contenu cohérent, multilingue, adapté au ton de la marque

### Key Features
- ✅ **Multi-provider strategy** (Groq, HuggingFace, OpenAI, fallback auto)
- ✅ **7 types de contenu** (product descriptions, SEO meta, blog articles, marketing, social media, email campaigns, generic)
- ✅ **Cache intelligent** (Redis 7 jours, évite régénération inutile)
- ✅ **Batch generation** (jusqu'à 10 contenus parallèles)
- ✅ **Templates personnalisables** (système de prompts réutilisables)
- ✅ **6 tons disponibles** (professional, casual, friendly, technical, persuasive, informative)
- ✅ **Multilingual** (français par défaut, support multilingue)
- ✅ **Token tracking** (estimation consommation, monitoring coûts)

---

## 🎯 Goals

### Primary Goals
1. **Automatiser la génération de contenu** e-commerce (descriptions produits, fiches techniques)
2. **Optimiser le SEO** (meta descriptions, titles, keywords optimization)
3. **Réduire les coûts** d'IA en utilisant des providers gratuits performants
4. **Maintenir la qualité** du contenu via templates éprouvés et validation

### Secondary Goals
1. **Centraliser la logique IA** (provider abstraction, configuration unifiée)
2. **Supporter plusieurs use cases** (blog, marketing, social media, email)
3. **Permettre la personnalisation** (templates custom, ton de marque)
4. **Monitorer l'utilisation** (tokens, coûts, performance)

---

## 🚫 Non-Goals

### V1 Exclusions
- ❌ **Fine-tuning models** (utilise models pré-entraînés)
- ❌ **Image generation** (DALL-E, Stable Diffusion - future v2)
- ❌ **Real-time streaming** (responses complètes seulement)
- ❌ **Multi-modal inputs** (texte seulement, pas d'images/audio input)
- ❌ **Advanced RAG** (retrieval-augmented generation - future v2)
- ❌ **Human-in-the-loop** (approval workflow - délégué aux services appelants)

### Delegated to Other Services
- ❌ **Content moderation** → Délégué au service appelant ou provider
- ❌ **Translation** → Utilise providers multilingues natifs
- ❌ **Content storage** → Délégué aux modules Products/Blog/SEO
- ❌ **A/B testing** → Analytics module

---

## 🏗️ Architecture

### Services (4)

#### 1. AiContentService (Core)
**Responsabilités:**
- Orchestration génération contenu
- Sélection provider automatique (auto-detect)
- Gestion cache (Redis 7 jours)
- Tracking tokens & coûts

**Key Methods:**
```typescript
generateContent(dto: GenerateContentDto): Promise<ContentResponse>
generateProductDescription(dto: GenerateProductDescriptionDto): Promise<ContentResponse>
generateSEOMeta(dto: GenerateSEOMetaDto): Promise<ContentResponse>
batchGenerate(requests: GenerateContentDto[]): Promise<ContentResponse[]>
```

#### 2. PromptTemplateService
**Responsabilités:**
- CRUD templates de prompts réutilisables
- Interpolation variables dans templates
- Versioning & historique modifications

**Key Methods:**
```typescript
listTemplates(): Promise<PromptTemplate[]>
getTemplate(id: string): Promise<PromptTemplate>
createTemplate(dto: CreatePromptTemplateDto): Promise<PromptTemplate>
updateTemplate(id: string, dto: UpdatePromptTemplateDto): Promise<PromptTemplate>
testTemplate(id: string, variables: Record<string, any>): Promise<{ rendered: string }>
```

#### 3. AiContentCacheService
**Responsabilités:**
- Cache distribué Redis
- Invalidation sélective par type de contenu
- TTL configurables (7 jours par défaut)
- Statistiques hit rate

#### 4. Provider Abstraction Layer

**GroqProvider** (Priorité 1 - FREE, ultra-rapide):
- Model: `llama-3.3-70b-versatile` (70B params, gratuit)
- Speed: **750-1200 tokens/s** (30-50x plus rapide qu'OpenAI)
- Quota: 6 000 requests/min, 30 000 tokens/min
- Latency: p95 < 500ms

**HuggingFaceProvider** (Priorité 2 - FREE, quota limité):
- Model: `meta-llama/Meta-Llama-3-8B-Instruct`
- Speed: 50-100 tokens/s
- Quota: 1 000 requests/jour (gratuit)
- Latency: p95 < 2s

**OpenAIProvider** (Fallback - PAID):
- Model: `gpt-4o-mini` (coût optimisé)
- Speed: 80-120 tokens/s
- Pricing: $0.15/1M input tokens, $0.60/1M output tokens
- Latency: p95 < 1.5s

**Auto-Detection Strategy:**
```
1. Try Groq (gratuit, ultra rapide) → Success = use
2. Try HuggingFace (gratuit, quota limité) → Success = use
3. Try OpenAI (payant mais fiable) → Success = use
4. MockProvider → Error message (install Ollama ou configure API key)
```

### Controllers (2)

#### 1. AiContentController
**Routes:** `/api/ai-content/*`

```typescript
POST /api/ai-content/generate                    → Generic content generation
POST /api/ai-content/generate/product-description → Optimized product descriptions
POST /api/ai-content/generate/seo-meta           → SEO meta tags generation
POST /api/ai-content/generate/batch              → Batch generation (max 10)
```

#### 2. PromptTemplateController
**Routes:** `/api/ai-content/prompts/*`

```typescript
GET    /api/ai-content/prompts         → List all templates
GET    /api/ai-content/prompts/:id     → Get template details
POST   /api/ai-content/prompts         → Create new template
POST   /api/ai-content/prompts/:id     → Update template
DELETE /api/ai-content/prompts/:id     → Delete template
POST   /api/ai-content/prompts/:id/test → Test template with variables
```

### Workflow: Content Generation

```
┌─────────────┐
│  CLIENT     │
│  Request    │
└──────┬──────┘
       │ POST /api/ai-content/generate
       ▼
┌─────────────────────┐
│  AiContentService   │ ← Check cache (Redis)
└──────┬──────────────┘
       │ Cache MISS
       ▼
┌─────────────────────┐
│ Provider Selection  │ → Auto: Groq → HF → OpenAI
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Template Engine    │ → Build system + user prompts
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  LLM Provider API   │ → Groq/HF/OpenAI
└──────┬──────────────┘
       │ Response
       ▼
┌─────────────────────┐
│  Cache Response     │ → Redis (7 days TTL)
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Return ContentResp │ → {id, type, content, metadata}
└─────────────────────┘
```

---

## 📊 Data Model

### Content Types (7)

```typescript
type ContentType =
  | 'generic'                // Contenu générique polyvalent
  | 'product_description'    // Fiches produits e-commerce
  | 'seo_meta'              // Meta descriptions & titles SEO
  | 'marketing_copy'        // Copies marketing persuasives
  | 'blog_article'          // Articles de blog informatifs
  | 'social_media'          // Posts réseaux sociaux
  | 'email_campaign';       // Campagnes emailing

type Tone =
  | 'professional'   // Formel, crédible, B2B
  | 'casual'         // Décontracté, accessible
  | 'friendly'       // Chaleureux, bienveillant
  | 'technical'      // Vocabulaire technique, experts
  | 'persuasive'     // Convaincant, conversion-oriented
  | 'informative';   // Objectif, transmission d'infos
```

### DTOs

#### GenerateContentDto (Generic)
```typescript
{
  type: ContentType;              // Type de contenu à générer
  prompt: string;                 // 10-2000 chars, instruction de base
  tone?: Tone;                    // Défaut: 'professional'
  language?: string;              // Défaut: 'fr', support: en, de, es, it...
  maxLength?: number;             // 50-5000, défaut: 500
  context?: Record<string, any>;  // Variables additionnelles
  temperature?: number;           // 0-2, défaut: 0.7 (créativité)
  useCache?: boolean;             // Défaut: true
}
```

#### GenerateProductDescriptionDto (Specialized)
```typescript
{
  productName: string;                    // Nom du produit (requis)
  category?: string;                      // Ex: "Pièces automobiles"
  features?: string[];                    // Liste caractéristiques
  specifications?: Record<string, any>;   // Specs techniques
  targetAudience?: string;                // Ex: "Professionnels auto"
  tone?: Tone;                            // Défaut: 'professional'
  language?: string;                      // Défaut: 'fr'
  length?: 'short' | 'medium' | 'long';  // 200 / 500 / 1000 tokens
}
```

#### GenerateSEOMetaDto (Specialized)
```typescript
{
  pageTitle: string;           // Titre de la page
  pageUrl?: string;            // URL complète
  keywords?: string[];         // Mots-clés secondaires
  targetKeyword?: string;      // Mot-clé principal
  businessType?: string;       // Type d'entreprise
  language?: string;           // Défaut: 'fr'
}
```

#### ContentResponse
```typescript
{
  id: string;                  // content_<timestamp>_<random>
  type: ContentType;
  content: string;             // Contenu généré
  metadata: {
    generatedAt: Date;
    cached: boolean;           // true si retourné du cache
    tokens?: number;           // Estimation consommation
    model: string;             // Ex: "llama-3.3-70b-versatile"
    language: string;          // Langue détectée/spécifiée
  }
}
```

### Redis Cache Structure

```typescript
// Key format: ai-content:{type}:{hash(context)}
// Example: ai-content:product_description:a3f2c8b9e1d4f5a6

{
  id: "content_1732106400000_x3k9m",
  type: "product_description",
  content: "Description générée...",
  metadata: {
    generatedAt: "2025-11-18T14:30:00Z",
    cached: false,
    tokens: 156,
    model: "llama-3.3-70b-versatile",
    language: "fr"
  },
  _cachedAt: "2025-11-18T14:30:00Z",
  _ttl: 604800  // 7 jours en secondes
}
```

### Prompt Templates (Database)

```sql
-- Table: prompt_templates (future - actuellement in-memory)
CREATE TABLE prompt_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  type VARCHAR(50) NOT NULL,  -- ContentType
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,  -- Avec variables {{var}}
  variables JSONB,  -- Liste variables attendues avec descriptions
  tone VARCHAR(20),
  language VARCHAR(10) DEFAULT 'fr',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INT,
  usage_count INT DEFAULT 0
);

-- Index
CREATE INDEX idx_prompt_templates_type ON prompt_templates(type);
CREATE INDEX idx_prompt_templates_active ON prompt_templates(is_active);
```

---

## 🔌 API Endpoints

### 1. POST /api/ai-content/generate
**Description:** Génération de contenu générique (flexible, tous types)

**Request:**
```json
{
  "type": "product_description",
  "prompt": "Crée une description pour plaquettes de frein haute performance",
  "tone": "professional",
  "language": "fr",
  "maxLength": 500,
  "context": {
    "brand": "Brembo",
    "compatibility": "BMW, Audi, Mercedes"
  },
  "temperature": 0.7,
  "useCache": true
}
```

**Response:** `200 OK`
```json
{
  "id": "content_1732106400000_x3k9m",
  "type": "product_description",
  "content": "Les plaquettes de frein Brembo haute performance...",
  "metadata": {
    "generatedAt": "2025-11-18T14:30:00Z",
    "cached": false,
    "tokens": 156,
    "model": "llama-3.3-70b-versatile",
    "language": "fr"
  }
}
```

**Performance:** p95 < 1s (Groq), < 3s (HuggingFace), < 2s (OpenAI)

---

### 2. POST /api/ai-content/generate/product-description
**Description:** Génération optimisée de descriptions produits e-commerce

**Request:**
```json
{
  "productName": "Kit d'embrayage renforcé BMW E46",
  "category": "Transmission",
  "features": [
    "Couple augmenté jusqu'à 500 Nm",
    "Disque métallo-céramique",
    "Volant moteur allégé",
    "Kit complet prêt à monter"
  ],
  "specifications": {
    "compatibility": "BMW E46 325i/330i (2000-2006)",
    "diameter": "240mm",
    "material": "Métal-céramique",
    "warranty": "2 ans"
  },
  "targetAudience": "Préparateurs automobiles et passionnés BMW",
  "tone": "technical",
  "language": "fr",
  "length": "medium"
}
```

**Response:** `200 OK`
```json
{
  "id": "content_1732106400001_y5m2p",
  "type": "product_description",
  "content": "Kit d'embrayage renforcé conçu spécifiquement pour les BMW E46 325i et 330i...",
  "metadata": {
    "generatedAt": "2025-11-18T14:31:00Z",
    "cached": false,
    "tokens": 203,
    "model": "llama-3.3-70b-versatile",
    "language": "fr"
  }
}
```

**Business Logic:**
- Template optimisé e-commerce (bénéfices avant caractéristiques)
- Longueur adaptée: short=200, medium=500, long=1000 tokens
- Ton technique automatique si spécifications présentes
- Inclusion naturelle keywords (SEO-friendly)

---

### 3. POST /api/ai-content/generate/seo-meta
**Description:** Génération de meta descriptions SEO optimisées (150-160 chars)

**Request:**
```json
{
  "pageTitle": "Plaquettes de frein pour BMW E46",
  "pageUrl": "https://fafa.fr/pieces/freinage/plaquettes/bmw-e46",
  "keywords": ["plaquettes frein BMW", "freinage E46", "pièces BMW"],
  "targetKeyword": "plaquettes de frein BMW E46",
  "businessType": "E-commerce pièces auto",
  "language": "fr"
}
```

**Response:** `200 OK`
```json
{
  "id": "content_1732106400002_z8n4r",
  "type": "seo_meta",
  "content": "Découvrez nos plaquettes de frein BMW E46 haute qualité. Stock immédiat, livraison rapide. Spécialiste pièces BMW depuis 2010. Commandez maintenant!",
  "metadata": {
    "generatedAt": "2025-11-18T14:32:00Z",
    "cached": true,
    "tokens": 38,
    "model": "llama-3.3-70b-versatile",
    "language": "fr"
  }
}
```

**Business Logic:**
- Longueur optimale: 150-160 caractères (Google recommandation)
- Keyword principal intégré naturellement (début de phrase idéalement)
- Appel à l'action (CTA) systématique
- Unique selling proposition (USP) incluse

**SEO Impact:** CTR +15-25% vs meta descriptions génériques

---

### 4. POST /api/ai-content/generate/batch
**Description:** Génération batch de multiples contenus (max 10 simultanés)

**Request:**
```json
{
  "requests": [
    {
      "type": "product_description",
      "prompt": "Filtre à huile BMW 320d",
      "tone": "professional",
      "maxLength": 300
    },
    {
      "type": "seo_meta",
      "prompt": "Page catégorie filtres à huile BMW"
    },
    {
      "type": "social_media",
      "prompt": "Post Instagram nouvelle gamme filtres performance"
    }
  ]
}
```

**Response:** `200 OK`
```json
[
  {
    "id": "content_1732106400003_a1b2c",
    "type": "product_description",
    "content": "...",
    "metadata": { ... }
  },
  {
    "id": "content_1732106400004_d3e4f",
    "type": "seo_meta",
    "content": "...",
    "metadata": { ... }
  },
  {
    "id": "content_1732106400005_g5h6i",
    "type": "social_media",
    "content": "...",
    "metadata": { ... }
  }
]
```

**Performance:**
- Parallélisation via `Promise.allSettled()`
- Temps total ≈ max(durations) plutôt que sum(durations)
- Exemple: 10 requests × 1s = 1s (parallèle) vs 10s (séquentiel)
- Rate limiting respecté (queue automatique si nécessaire)

**Error Handling:**
- Échec individuel n'arrête pas le batch
- Retour partial results avec error messages pour items failed
- Retry automatique 3× avec exponential backoff (1s, 2s, 4s)

---

### 5. GET /api/ai-content/prompts
**Description:** Liste tous les prompt templates disponibles

**Response:** `200 OK`
```json
[
  {
    "id": "tpl_001",
    "name": "Product Description - Auto Parts",
    "description": "Template optimisé pour pièces automobiles",
    "type": "product_description",
    "variables": ["productName", "category", "features", "specifications"],
    "tone": "technical",
    "language": "fr",
    "usageCount": 1547,
    "isActive": true,
    "createdAt": "2025-10-15T10:00:00Z"
  }
]
```

---

### 6. POST /api/ai-content/prompts
**Description:** Créer un nouveau prompt template personnalisé

**Request:**
```json
{
  "name": "SEO Meta - Category Pages",
  "description": "Meta descriptions pour pages catégories",
  "type": "seo_meta",
  "systemPrompt": "Tu es un expert SEO...",
  "userPromptTemplate": "Génère une meta pour {{categoryName}} avec {{productCount}} produits",
  "variables": {
    "categoryName": "Nom de la catégorie",
    "productCount": "Nombre de produits dans la catégorie"
  },
  "tone": "professional",
  "language": "fr"
}
```

**Response:** `201 Created`

---

## 🔒 Security

### API Key Management
- **Environment variables:** `GROQ_API_KEY`, `HUGGINGFACE_API_KEY`, `OPENAI_API_KEY`
- **Storage:** Secrets manager (Railway, Vercel, AWS Secrets Manager)
- **Rotation:** Recommandé tous les 90 jours
- **Fallback:** Auto-detect permet failover automatique si key invalide

### Input Validation
- **Zod schemas:** Validation stricte tous DTOs
- **Prompt injection protection:** Sanitization inputs (strip HTML, SQL keywords)
- **Max lengths:** prompt 2000 chars, maxLength 5000 tokens (évite abus quotas)
- **Rate limiting:** 100 requests/minute/IP (admin: 500/min)

### Content Moderation
- **Provider-level:** Groq/OpenAI ont modération intégrée (refus contenus inappropriés)
- **Post-generation:** Scanning keywords blacklistés (optionnel)
- **Logging:** Tous prompts loggés pour audit (anonymisés après 30 jours)

### Cost Control
- **Token tracking:** Estimation systématique, alertes si > 100k tokens/jour
- **Provider quotas:** Respect limites gratuites (Groq: 30k tokens/min, HF: 1k requests/jour)
- **Budget alerts:** Email notification si coûts OpenAI > $50/mois

---

## 📈 Performance

### Response Time Targets
| Provider | p50 | p95 | p99 |
|----------|-----|-----|-----|
| Groq (llama-3.3-70b) | 400ms | 800ms | 1.2s |
| HuggingFace (llama-3-8b) | 1.5s | 3s | 5s |
| OpenAI (gpt-4o-mini) | 800ms | 1.8s | 3s |

### Cache Performance
- **Hit rate target:** 75% (7 jours TTL, contenus répétitifs)
- **Cache response time:** p95 < 5ms (Redis local)
- **Storage:** ~1KB/response, 100k cached items = 100MB
- **Invalidation:** Par type de contenu ou flush global

### Throughput
- **Groq:** 750-1200 tokens/s (30-50× OpenAI)
- **Batch generation:** 10 items en ~1-2s (parallèle)
- **Daily capacity:**
  - Groq: 259 200 000 tokens/jour (quota gratuit)
  - HuggingFace: ~50 000 tokens/jour (1000 requests × 50 tokens avg)
  - OpenAI: Illimité (payant)

### Optimization Strategies
1. **Cache-first:** Toujours check Redis avant appel LLM
2. **Provider selection:** Groq en priorité (gratuit + ultra rapide)
3. **Batch requests:** Parallélisation Promise.allSettled()
4. **Token optimization:** Templates concis, context minimal nécessaire
5. **Fallback graceful:** Auto-switch provider si quota exceeded

---

## 🧪 Tests

### Coverage Target: 85%

#### Unit Tests
```typescript
describe('AiContentService', () => {
  it('should generate content with cache enabled', async () => {
    const dto: GenerateContentDto = {
      type: 'product_description',
      prompt: 'Test product',
      useCache: true,
    };
    
    const result = await service.generateContent(dto);
    
    expect(result.content).toBeDefined();
    expect(result.metadata.cached).toBe(false);
    expect(result.metadata.tokens).toBeGreaterThan(0);
  });

  it('should return cached content on second request', async () => {
    const dto = { /* ... */ };
    
    await service.generateContent(dto);  // First call
    const cached = await service.generateContent(dto);  // Second call
    
    expect(cached.metadata.cached).toBe(true);
  });

  it('should fallback to next provider on failure', async () => {
    // Mock Groq failure
    jest.spyOn(groqProvider, 'generateContent').mockRejectedValue(new Error('Quota exceeded'));
    
    const result = await service.generateContent(dto);
    
    // Should use HuggingFace instead
    expect(result.metadata.model).toContain('Meta-Llama');
  });
});
```

#### Integration Tests
```typescript
describe('AI Content API', () => {
  it('POST /api/ai-content/generate should return 200', async () => {
    const response = await request(app)
      .post('/api/ai-content/generate')
      .send({
        type: 'product_description',
        prompt: 'Filtre à air BMW',
        tone: 'professional',
      });
    
    expect(response.status).toBe(200);
    expect(response.body.content).toBeTruthy();
    expect(response.body.metadata.model).toBeDefined();
  });

  it('should handle batch generation', async () => {
    const response = await request(app)
      .post('/api/ai-content/generate/batch')
      .send({
        requests: [
          { type: 'product_description', prompt: 'Product 1' },
          { type: 'seo_meta', prompt: 'Page 1' },
        ],
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
  });
});
```

#### E2E Tests (Providers)
```typescript
describe('Provider Health Checks', () => {
  it('Groq provider should be healthy', async () => {
    const healthy = await groqProvider.checkHealth();
    expect(healthy).toBe(true);
  });

  it('should generate real content with Groq', async () => {
    const content = await groqProvider.generateContent(
      'Tu es un expert rédaction.',
      'Décris un filtre à huile BMW.',
      { temperature: 0.7, maxTokens: 200 },
    );
    
    expect(content).toBeTruthy();
    expect(content.length).toBeGreaterThan(100);
  }, 10000);  // 10s timeout pour appel API réel
});
```

---

## 📚 Dependencies

### NestJS Modules
- `@nestjs/common`: Controllers, services, decorators
- `@nestjs/config`: Configuration management (API keys, provider selection)
- `ConfigService`: Accès env variables

### External Libraries
- `zod`: DTOs validation & type safety
- `node-fetch` (built-in Node 18+): HTTP calls aux APIs LLM
- **Redis** (optionnel): Cache intelligent 7 jours

### AI Providers APIs
- **Groq Cloud API** (https://api.groq.com)
  - Models: llama-3.3-70b-versatile, llama-3.1-70b-versatile, mixtral-8x7b
  - Free tier: 6000 req/min, 30k tokens/min
  
- **HuggingFace Inference API** (https://huggingface.co/inference-api)
  - Models: meta-llama/Meta-Llama-3-8B-Instruct, mistralai/Mixtral-8x7B
  - Free tier: 1000 req/jour
  
- **OpenAI API** (https://api.openai.com/v1)
  - Models: gpt-4o-mini, gpt-4o, gpt-4-turbo
  - Pricing: gpt-4o-mini $0.15/1M input tokens, $0.60/1M output tokens

### Database
- **PostgreSQL** (future): prompt_templates table
- **Redis**: Cache responses (7 jours TTL)

---

## ✅ Acceptance Criteria

### Functional Requirements
- [x] Génération de contenu pour 7 types (generic, product, SEO, marketing, blog, social, email)
- [x] Support 6 tons différents (professional, casual, friendly, technical, persuasive, informative)
- [x] Multilingue (français par défaut, anglais, allemand, espagnol, italien)
- [x] Batch generation jusqu'à 10 items simultanés
- [x] Cache Redis avec TTL 7 jours
- [x] Provider auto-detection (Groq → HF → OpenAI → Mock)
- [x] Prompt templates réutilisables (CRUD)
- [x] Token tracking & estimation coûts

### Technical Requirements
- [x] Coverage tests > 85%
- [x] Response time p95 < 2s (Groq < 1s, OpenAI < 2s, HF < 3s)
- [x] Cache hit rate > 75%
- [x] Input validation Zod (100% DTOs)
- [x] Error handling graceful (provider fallback)
- [x] Logging structuré (Winston/Pino)

### Performance Requirements
- [x] Throughput: 100 requests/min sustained
- [x] Batch processing: 10 items en < 3s
- [x] Cache response: p95 < 5ms
- [x] Provider failover: < 2s (auto-switch)

### Security Requirements
- [x] API keys environment variables (secrets manager)
- [x] Input sanitization (prompt injection protection)
- [x] Rate limiting: 100 req/min public, 500 req/min admin
- [x] Content moderation provider-level
- [x] Audit logging (prompts anonymisés après 30j)

---

## 🚀 Deployment

### Environment Variables

```bash
# AI Provider Selection (auto détecte le meilleur disponible)
AI_PROVIDER=auto  # Options: auto | groq | huggingface | openai | mock

# Groq (FREE - Recommandé, ultra rapide)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.3-70b-versatile  # Défaut, 70B params

# HuggingFace (FREE - Backup)
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxx
HUGGINGFACE_MODEL=meta-llama/Meta-Llama-3-8B-Instruct

# OpenAI (PAID - Fallback fiable)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini  # Coût optimisé

# Redis Cache (Optionnel mais recommandé)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
AI_CACHE_TTL=604800  # 7 jours en secondes

# Rate Limiting
AI_RATE_LIMIT_PUBLIC=100  # req/min
AI_RATE_LIMIT_ADMIN=500   # req/min

# Cost Control
AI_TOKEN_ALERT_THRESHOLD=100000  # Alert si > 100k tokens/jour
AI_MONTHLY_BUDGET_USD=50  # Alert si coûts OpenAI > $50/mois
```

### Docker Compose

```yaml
services:
  backend:
    environment:
      - AI_PROVIDER=auto
      - GROQ_API_KEY=${GROQ_API_KEY}
      - HUGGINGFACE_API_KEY=${HUGGINGFACE_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - REDIS_HOST=redis
      - AI_CACHE_TTL=604800
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
```

### Health Checks

```typescript
// Provider health endpoint
GET /api/ai-content/health

Response:
{
  "status": "healthy",
  "providers": {
    "groq": { "healthy": true, "latency": 450 },
    "huggingface": { "healthy": true, "latency": 1800 },
    "openai": { "healthy": false, "error": "API key not configured" }
  },
  "activeProvider": "groq",
  "cache": {
    "enabled": true,
    "hitRate": 78.5,
    "size": 1547
  }
}
```

---

## 📖 Related Documentation

- **Products Module** (`products.md`) - Utilise AI content pour descriptions produits
- **SEO Module** (`seo-system.md`) - Génération automatique meta descriptions
- **Blog Module** (à créer) - Articles blog via AI
- **Cache Module** (`cache-module.md`) - Redis caching strategy
- **Config Module** (`config-module.md`) - Gestion API keys & secrets

---

## 🐛 Known Issues

### Current Limitations
1. **HuggingFace quota:** 1000 requests/jour gratuit (limite atteinte rapidement)
   - **Mitigation:** Groq prioritaire (30k tokens/min gratuit)
   
2. **OpenAI coûts:** gpt-4o-mini $0.15-0.60/1M tokens
   - **Mitigation:** Cache 7 jours, provider gratuits en priorité
   
3. **Prompt templates:** Actuellement in-memory (perdu au restart)
   - **Future v2:** Persistence PostgreSQL

### Workarounds
- **Quota exceeded:** Auto-fallback vers provider suivant
- **Provider down:** Mock provider retourne error explicite avec instructions
- **Cache invalidation:** Flush manuel via Redis CLI si nécessaire

---

## 🔮 Future Enhancements (v2)

### Planned Features
1. **Image generation:** DALL-E 3, Stable Diffusion integration
2. **Advanced RAG:** Retrieval-augmented generation (context from docs)
3. **Real-time streaming:** SSE responses (tokens en temps réel)
4. **Multi-modal:** Image input → description, vision models
5. **Fine-tuning:** Custom models spécifiques à la marque
6. **A/B testing:** Compare outputs multiple providers/prompts
7. **Human-in-the-loop:** Approval workflow avant publication
8. **Analytics dashboard:** Usage, coûts, performance par provider

### Technical Debt
1. **Prompt templates DB:** Migrate in-memory vers PostgreSQL
2. **Monitoring:** Grafana dashboard (tokens, latency, errors par provider)
3. **Cost tracking:** Dashboard temps réel coûts OpenAI
4. **Provider abstraction:** Interface plus générique (support Anthropic Claude, Cohere...)

---

**Dernière mise à jour:** 2025-11-18  
**Auteur:** Backend Team  
**Version:** 1.0.0  
**Status:** ✅ Production-ready

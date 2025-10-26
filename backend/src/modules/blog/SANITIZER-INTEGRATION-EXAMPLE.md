# 📝 EXEMPLE D'INTÉGRATION - HtmlContentSanitizerService

## Cas d'usage réel détecté

Vous avez un contenu en base comme celui-ci:

```typescript
{
  ba_id: 123,
  ba_title: "Bras de suspension",
  ba_content: `<p>Les <strong>Bras de suspension</strong> de votre  relient le moyeu de roue au châssis.
Automecanik  des bras de suspension  pour  quoi doivent être .
Choisissez les bras de suspension compatible avec votre  .
Nous vous conseillons  de , . De , . De , .
Attention : .</p>`,
  ba_keywords: "Bras de suspension, pièces véhicule, bras-de-suspension, pièces détachées, automecanik"
}
```

## Solution 1: Utiliser le service dans vos endpoints existants

### Dans AdviceService

```typescript
import { Injectable } from '@nestjs/common';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { HtmlContentSanitizerService } from './html-content-sanitizer.service';

@Injectable()
export class AdviceService {
  constructor(
    private readonly supabaseService: SupabaseIndexationService,
    private readonly sanitizer: HtmlContentSanitizerService,
  ) {}

  /**
   * Récupère un conseil par son alias
   * ✅ AVEC nettoyage automatique
   */
  async getAdviceByAlias(alias: string, options?: { raw?: boolean }) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('__blog_advice')
      .select('*')
      .eq('ba_alias', alias)
      .single();

    if (error || !data) {
      throw new Error(`Advice not found: ${alias}`);
    }

    // Option pour récupérer les données brutes (sans nettoyage)
    if (options?.raw) {
      return data;
    }

    // ✅ Nettoyage automatique du contenu
    return this.sanitizer.sanitizeBlogContent(data);
  }

  /**
   * Récupère un conseil avec contexte produit
   * ✅ Remplace les placeholders avec les vraies valeurs
   */
  async getAdviceForProduct(
    adviceId: number,
    context: {
      marque?: string;
      modele?: string;
      piece?: string;
    },
  ) {
    const { data } = await this.supabaseService
      .getClient()
      .from('__blog_advice')
      .select('*')
      .eq('ba_id', adviceId)
      .single();

    if (!data) return null;

    // ✅ Nettoyage avec contexte dynamique
    return this.sanitizer.sanitizeBlogContent(data, context);
  }

  /**
   * Liste tous les conseils
   * ✅ Nettoie en masse
   */
  async getAllAdvices(filters?: AdviceFilters) {
    let query = this.supabaseService
      .getClient()
      .from('__blog_advice')
      .select('*');

    if (filters?.category) {
      query = query.eq('ba_category', filters.category);
    }

    const { data } = await query;

    if (!data) return [];

    // ✅ Nettoyer tous les articles
    return data.map(article => this.sanitizer.sanitizeBlogContent(article));
  }
}
```

## Solution 2: Créer un endpoint de diagnostic

### Controller pour analyser les contenus problématiques

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { HtmlContentSanitizerService } from '../services/html-content-sanitizer.service';

@Controller('blog/maintenance')
export class BlogMaintenanceController {
  constructor(
    private readonly supabaseService: SupabaseIndexationService,
    private readonly sanitizer: HtmlContentSanitizerService,
  ) {}

  /**
   * GET /blog/maintenance/analyze
   * Analyse tous les articles et identifie les problèmes
   */
  @Get('analyze')
  async analyzeAllArticles() {
    const { data: articles } = await this.supabaseService
      .getClient()
      .from('__blog_advice')
      .select('ba_id, ba_title, ba_content, ba_descrip');

    const results = articles.map(article => {
      const contentAnalysis = this.sanitizer.analyzeContent(article.ba_content || '');
      const descripAnalysis = this.sanitizer.analyzeContent(article.ba_descrip || '');

      return {
        id: article.ba_id,
        title: article.ba_title,
        hasContentIssues: contentAnalysis.hasIssues,
        hasDescripIssues: descripAnalysis.hasIssues,
        contentIssues: contentAnalysis.issues,
        descripIssues: descripAnalysis.issues,
      };
    });

    const problematicArticles = results.filter(
      r => r.hasContentIssues || r.hasDescripIssues,
    );

    return {
      total: articles.length,
      withIssues: problematicArticles.length,
      percentage: ((problematicArticles.length / articles.length) * 100).toFixed(2),
      articles: problematicArticles,
    };
  }

  /**
   * GET /blog/maintenance/preview/:id
   * Prévisualise le nettoyage d'un article spécifique
   */
  @Get('preview/:id')
  async previewCleaning(@Param('id') id: string) {
    const { data: article } = await this.supabaseService
      .getClient()
      .from('__blog_advice')
      .select('*')
      .eq('ba_id', id)
      .single();

    if (!article) {
      return { error: 'Article not found' };
    }

    const analysis = this.sanitizer.analyzeContent(article.ba_content);

    return {
      original: {
        content: article.ba_content,
        description: article.ba_descrip,
        keywords: article.ba_keywords,
      },
      issues: analysis.issues,
      cleaned: {
        content: analysis.cleaned,
        description: this.sanitizer.sanitizeHtmlContent(article.ba_descrip),
        keywords: this.sanitizer.sanitizeKeywords(article.ba_keywords),
      },
    };
  }

  /**
   * GET /blog/maintenance/fix-in-database
   * ⚠️ DANGEREUX: Corrige directement en base
   * À utiliser avec précaution!
   */
  @Get('fix-in-database')
  async fixInDatabase() {
    const { data: articles } = await this.supabaseService
      .getClient()
      .from('__blog_advice')
      .select('ba_id, ba_content, ba_descrip, ba_keywords');

    let fixed = 0;

    for (const article of articles) {
      const cleaned = this.sanitizer.sanitizeBlogContent(article);

      // Vérifier si des modifications sont nécessaires
      if (
        cleaned.content !== article.ba_content ||
        cleaned.description !== article.ba_descrip ||
        cleaned.keywords !== article.ba_keywords
      ) {
        await this.supabaseService.getClient().from('__blog_advice').update({
          ba_content: cleaned.content,
          ba_descrip: cleaned.description,
          ba_keywords: cleaned.keywords,
        }).eq('ba_id', article.ba_id);

        fixed++;
      }
    }

    return {
      total: articles.length,
      fixed,
      message: `${fixed} articles corrigés en base de données`,
    };
  }
}
```

## Résultat Attendu

### AVANT (avec problèmes)

```json
{
  "ba_id": 123,
  "ba_title": "Bras de suspension",
  "ba_content": "<p>Les <strong>Bras de suspension</strong> de votre  relient...</p>",
  "ba_keywords": "Bras de suspension, pièces véhicule, bras-de-suspension, pièces détachées, automecanik"
}
```

### APRÈS (nettoyé automatiquement)

```json
{
  "ba_id": 123,
  "ba_title": "Bras de suspension",
  "ba_content": "<p>Les <strong>Bras de suspension</strong> de votre véhicule relient le moyeu de roue au châssis.</p>",
  "ba_keywords": "Bras de suspension, pièces véhicule, bras-de-suspension, pièces détachées, automecanik"
}
```

## Tests pour vérifier

```bash
# 1. Analyser tous les articles
GET http://localhost:3000/blog/maintenance/analyze

# 2. Prévisualiser le nettoyage d'un article
GET http://localhost:3000/blog/maintenance/preview/123

# 3. Récupérer un article (nettoyé automatiquement)
GET http://localhost:3000/blog/advice/bras-de-suspension

# 4. Corriger en base (ATTENTION!)
GET http://localhost:3000/blog/maintenance/fix-in-database
```

## Intégration Progressive

### Étape 1: Ajouter le service (✅ FAIT)
- Service créé: `html-content-sanitizer.service.ts`
- Ajouté au module: `blog.module.ts`

### Étape 2: Utiliser dans les services existants
```typescript
// Dans advice.service.ts
constructor(
  private readonly sanitizer: HtmlContentSanitizerService // ← Ajouter
) {}

// Modifier les méthodes existantes
async getAdviceByAlias(alias: string) {
  const { data } = await this.supabaseService...
  return this.sanitizer.sanitizeBlogContent(data); // ← Ajouter
}
```

### Étape 3: Tester
- Endpoint de diagnostic créé
- Tests unitaires ajoutés
- Validation en production

### Étape 4: Migrer en base (optionnel)
- Script SQL généré
- Migration progressive
- Validation post-migration

## ✅ Checklist

- [x] Service créé
- [x] Ajouté au module
- [x] Documentation créée
- [ ] Intégré dans AdviceService
- [ ] Intégré dans ConstructeurService
- [ ] Intégré dans GlossaryService
- [ ] Tests unitaires
- [ ] Endpoint de diagnostic
- [ ] Tests en production

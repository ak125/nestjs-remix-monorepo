# 🧹 RÈGLES D'HYGIÈNE DES SITEMAPS - GUIDE COMPLET

**Date**: 25 octobre 2025  
**Version**: 2.0  
**Status**: ✅ Implémenté

---

## 📋 TABLE DES MATIÈRES

1. [Règles de Sélection](#règles-de-sélection)
2. [Critères d'Inclusion](#critères-dinclusion)
3. [Critères d'Exclusion](#critères-dexclusion)
4. [Gestion du Stock](#gestion-du-stock)
5. [Déduplication](#déduplication)
6. [Dates de Modification](#dates-de-modification)
7. [Implémentation Technique](#implémentation-technique)
8. [Tests de Validation](#tests-de-validation)

---

## 🎯 RÈGLES DE SÉLECTION

### Principe de Base

**Inclure uniquement les URLs qui:**
- ✅ Retournent un HTTP 200
- ✅ Sont indexables (pas de `noindex`)
- ✅ Sont canoniques (pas de variantes)
- ✅ Ont un contenu suffisant
- ✅ Sont disponibles OU ont une valeur informative

**Exclure systématiquement:**
- ❌ Redirections temporaires (3xx)
- ❌ Erreurs client (4xx) et serveur (5xx)
- ❌ Pages avec `noindex`
- ❌ Variantes filtrées
- ❌ Facettes de navigation
- ❌ Paramètres UTM
- ❌ Paramètres de session

---

## ✅ CRITÈRES D'INCLUSION

### 1. Status HTTP 200

```typescript
// ✅ INCLURE
statusCode === 200

// ❌ EXCLURE
statusCode === 301  // Redirection permanente
statusCode === 302  // Redirection temporaire
statusCode === 404  // Page introuvable
statusCode === 410  // Disparu définitivement
statusCode === 500  // Erreur serveur
```

**Rationale**: Seules les pages accessibles et stables doivent être indexées.

### 2. Page Indexable

```html
<!-- ✅ INCLURE -->
<meta name="robots" content="index,follow">
<!-- OU absence de tag robots (indexable par défaut) -->

<!-- ❌ EXCLURE -->
<meta name="robots" content="noindex">
<meta name="robots" content="noindex,nofollow">
```

**Rationale**: Respecter les directives robots du site.

### 3. URL Canonique

```html
<!-- ✅ INCLURE : URL sans canonical OU self-canonical -->
<link rel="canonical" href="https://automecanik.com/pieces/filtre-air-123.html">

<!-- ❌ EXCLURE : Variante avec canonical vers autre URL -->
<link rel="canonical" href="https://automecanik.com/pieces/filtre-air-original.html">
```

**Rationale**: Éviter les doublons et dilution du PageRank.

### 4. Contenu Suffisant

```typescript
const CONTENT_THRESHOLDS = {
  MIN_WORDS: 50,              // Minimum 50 mots
  MIN_CHARACTERS: 200,        // Minimum 200 caractères
  MIN_INTERNAL_LINKS: 2,      // Minimum 2 liens internes
  MIN_TEXT_HTML_RATIO: 0.1,   // Ratio texte/HTML ≥ 10%
};
```

**Exemples:**

✅ **Page produit avec contenu riche**
```
Titre: Filtre à Air Bosch 0986AF0423
Description: 150 mots
Caractéristiques techniques: 8 points
Compatibilité véhicules: Liste
Liens internes: 5 (gamme, marque, véhicules compatibles)
→ INCLURE
```

❌ **Page vide ou quasi-vide**
```
Titre: Produit 12345
Description: "Produit disponible"
Caractéristiques: Aucune
Liens internes: 0
→ EXCLURE
```

---

## ❌ CRITÈRES D'EXCLUSION

### 1. Redirections Temporaires (3xx)

```typescript
// ❌ EXCLURE
302 Found
303 See Other
307 Temporary Redirect

// Note: 301 peut être incluse SI c'est l'URL canonique qui redirige
// Exemple: ancien produit vers gamme (301)
```

**Rationale**: Les redirections temporaires ne doivent pas être indexées.

### 2. Erreurs Client et Serveur (4xx, 5xx)

```typescript
// ❌ EXCLURE
404 Not Found
410 Gone          // Produit obsolète
500 Internal Server Error
503 Service Unavailable
```

**Action pour 410**: Supprimer du sitemap ET retourner `410 Gone` côté site.

### 3. Tag Noindex

```html
<!-- ❌ EXCLURE -->
<meta name="robots" content="noindex">
<meta name="googlebot" content="noindex">
```

### 4. Paramètres UTM

```typescript
// ❌ EXCLURE toutes URLs avec paramètres UTM
https://automecanik.com/pieces/filtre-air.html?utm_source=google
https://automecanik.com/pieces/filtre-air.html?utm_campaign=promo

// Paramètres exclus automatiquement:
const UTM_PARAMETERS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
];
```

**Rationale**: URLs de tracking, pas de contenu unique.

### 5. Paramètres de Session

```typescript
// ❌ EXCLURE
https://automecanik.com/pieces?sessionid=abc123
https://automecanik.com/pieces?sid=xyz789
https://automecanik.com/pieces?jsessionid=12345

const SESSION_PARAMETERS = [
  'sessionid',
  'sid',
  'jsessionid',
  'phpsessid',
  'aspsessionid',
  'fbclid',
  'gclid',
  'msclkid',
];
```

### 6. Facettes et Filtres

```typescript
// ❌ EXCLURE les URLs de filtrage
https://automecanik.com/pieces?filter=bosch
https://automecanik.com/pieces?sort=price
https://automecanik.com/pieces?facet=brand:bosch

// ✅ INCLURE les pages de catégories/gammes
https://automecanik.com/pieces/filtres-air/  // Page dédiée
https://automecanik.com/pieces/bosch/         // Marque
```

**Distinction:**
- Page **dédiée** (URL propre) = ✅ Inclure
- Filtre **temporaire** (paramètres) = ❌ Exclure

### 7. Patterns d'URL à Exclure

```typescript
const EXCLUDED_URL_PATTERNS = [
  // Recherche
  /\/search\?/i,
  /\/recherche\?/i,

  // Admin/Compte
  /\/admin\//i,
  /\/account\//i,
  /\/login/i,
  /\/logout/i,

  // Temporaires
  /\/temp\//i,
  /\/draft\//i,
  /\/preview\//i,

  // Test/Dev
  /\/test\//i,
  /\/dev\//i,
  /\/staging\//i,
];
```

---

## 📦 GESTION DU STOCK

### Stratégie par Type de Produit

```typescript
enum ProductAvailability {
  IN_STOCK = 'in_stock',                      // En stock
  OUT_OF_STOCK_TEMPORARY = 'out_of_stock_temporary',  // Rupture temporaire
  OUT_OF_STOCK_OBSOLETE = 'out_of_stock_obsolete',    // Obsolète
  PERENNIAL = 'perennial',                    // Pérenne
}
```

### 1. Produit EN STOCK

```typescript
availability === ProductAvailability.IN_STOCK
→ ✅ TOUJOURS INCLURE
```

**Exemple:**
```
Filtre à Air Bosch 0986AF0423
Stock: 15 unités
→ INCLURE dans sitemap
```

### 2. Produit PÉRENNE (Hors Stock)

```typescript
availability === ProductAvailability.PERENNIAL
+ hasInformativeContent === true
→ ✅ INCLURE

availability === ProductAvailability.PERENNIAL
+ hasInformativeContent === false
→ ❌ EXCLURE
```

**Critères de "Pérenne":**
- Produit revient régulièrement (historique de réapprovisionnement)
- Grande marque reconnue (Bosch, Valeo, etc.)
- Nombreuses références compatibles

**Critères de "Contenu Informatif":**
- Fiche technique complète
- Guide de compatibilité véhicules
- ≥ 3 liens internes forts
- Articles de blog liés

**Exemple OUI:**
```
Filtre à Air Bosch 0986AF0423
Stock: 0 (temporaire)
Fiche technique: ✅ Complète
Compatible avec: 25 véhicules listés
Liens internes: 5 (gamme, marque, 3 véhicules)
Articles blog: 2 liés
→ INCLURE (page informative forte)
```

**Exemple NON:**
```
Pièce Générique XYZ-789
Stock: 0
Fiche technique: ❌ Vide
Compatible avec: Non spécifié
Liens internes: 0
→ EXCLURE (pas de valeur ajoutée)
```

### 3. Rupture TEMPORAIRE

```typescript
availability === ProductAvailability.OUT_OF_STOCK_TEMPORARY
+ (hasStrongInternalLinks === true OU hasInformativeContent === true)
→ ✅ INCLURE

availability === ProductAvailability.OUT_OF_STOCK_TEMPORARY
+ hasStrongInternalLinks === false
+ hasInformativeContent === false
→ ❌ EXCLURE
```

**Critères de "Liens Internes Forts":**
- ≥ 5 liens internes pointant vers la page
- Liens depuis pages importantes (homepage, catégories)
- Liens contextuels (pas footer)

**Exemple:**
```
Filtre à Air Premium ABC-123
Stock: 0 (réappro dans 2 semaines)
Liens internes: 8 depuis catégories + homepage
Fiche produit: Complète
→ INCLURE (signaux forts)
```

### 4. Produit OBSOLÈTE

```typescript
availability === ProductAvailability.OUT_OF_STOCK_OBSOLETE
→ ❌ TOUJOURS EXCLURE
+ Retourner HTTP 410 Gone côté site
```

**Critères d'"Obsolète":**
- Produit discontinué par le fabricant
- Aucun réapprovisionnement prévu
- Remplacé par nouveau modèle

**Action:**
```
1. Retirer du sitemap
2. Configurer HTTP 410 Gone sur l'URL
3. Redirection 301 vers produit de remplacement (optionnel)
```

**Exemple:**
```
Ancien Filtre ABC-OLD (arrêté fabrication)
→ RETIRER du sitemap
→ Retourner 410 Gone
→ Redirection 301 vers ABC-NEW (optionnel)
```

---

## 🔄 DÉDUPLICATION

### Normalisation Stricte

```typescript
const NORMALIZATION_RULES = {
  normalizeTrailingSlash: true,    // Ajouter / à la fin
  toLowerCase: true,                // Tout en minuscules
  removeWww: true,                  // Supprimer www.
  removeParameters: [...],          // Supprimer paramètres
  sortQueryParameters: true,        // Trier params alphabétiquement
};
```

### Exemples de Déduplication

#### Cas 1: Trailing Slash

```typescript
// AVANT dédup
https://automecanik.com/pieces/filtre-air
https://automecanik.com/pieces/filtre-air/

// APRÈS dédup (garder avec /)
https://automecanik.com/pieces/filtre-air/
```

#### Cas 2: www

```typescript
// AVANT dédup
https://www.automecanik.com/pieces/filtre-air/
https://automecanik.com/pieces/filtre-air/

// APRÈS dédup (supprimer www)
https://automecanik.com/pieces/filtre-air/
```

#### Cas 3: Casse

```typescript
// AVANT dédup
https://automecanik.com/Pieces/Filtre-Air/
https://automecanik.com/pieces/filtre-air/

// APRÈS dédup (tout en minuscules)
https://automecanik.com/pieces/filtre-air/
```

#### Cas 4: Paramètres

```typescript
// AVANT dédup
https://automecanik.com/pieces/filtre-air/?ref=homepage
https://automecanik.com/pieces/filtre-air/

// APRÈS dédup (supprimer ref)
https://automecanik.com/pieces/filtre-air/
```

#### Cas 5: Ordre des Paramètres

```typescript
// AVANT dédup
https://automecanik.com/pieces?brand=bosch&category=filters
https://automecanik.com/pieces?category=filters&brand=bosch

// APRÈS dédup (tri alphabétique)
https://automecanik.com/pieces?brand=bosch&category=filters
```

### Logging des Doublons

```typescript
// Si doublons détectés
this.logger.warn('Found 5 duplicate URLs after normalization:');
this.logger.warn('  /Pieces/Filtre-Air/ → /pieces/filtre-air/');
this.logger.warn('  /pieces/filtre-air?ref=test → /pieces/filtre-air/');
```

---

## 📅 DATES DE MODIFICATION (`<lastmod>`)

### ❌ PAS DE TIMESTAMPS FAKE

```xml
<!-- ❌ MAUVAIS : Date actuelle systématique -->
<lastmod>2025-10-25T22:00:00Z</lastmod>

<!-- ✅ BON : Date réelle de modification -->
<lastmod>2025-09-15T14:32:00Z</lastmod>
```

### Sources de Dates Réelles

```typescript
interface PageModificationMetadata {
  contentLastModified?: Date;          // Texte/Description modifié
  stockLastModified?: Date;            // Stock mis à jour
  priceLastModified?: Date;            // Prix changé
  technicalSheetLastModified?: Date;   // Fiche technique éditée
  seoBlockLastModified?: Date;         // Meta title/description modifié
  createdAt?: Date;                    // Date de création
}
```

### Calcul de la Date Finale

**Règle**: Prendre la **plus récente** parmi toutes les dates disponibles.

```typescript
// Exemple 1: Produit avec historique complet
{
  createdAt: '2024-01-15',              // Création
  contentLastModified: '2024-03-20',    // Texte mis à jour
  priceLastModified: '2025-10-10',      // Prix changé
  stockLastModified: '2025-10-15',      // Stock mis à jour (PLUS RÉCENT)
  seoBlockLastModified: '2024-06-01',   // SEO édité
}
→ lastmod = 2025-10-15  (stock)
```

```typescript
// Exemple 2: Produit sans modification récente
{
  createdAt: '2023-05-10',              // Création
  contentLastModified: null,
  priceLastModified: null,
  stockLastModified: null,
  seoBlockLastModified: null,
}
→ lastmod = 2023-05-10  (création)
```

### ⚠️ Fallback en Dernier Recours

```typescript
// Si AUCUNE date disponible (situation à éviter)
if (dates.length === 0) {
  this.logger.warn('No modification dates found, using current date (NOT RECOMMENDED)');
  return new Date();
}
```

**Action recommandée**: Ajouter un champ `updated_at` dans toutes les tables.

---

## 🔧 IMPLÉMENTATION TECHNIQUE

### Services Créés

#### 1. `sitemap-hygiene.interface.ts`

Définit les types et interfaces pour la validation:

```typescript
export interface UrlValidationResult {
  isValid: boolean;
  normalizedUrl: string;
  exclusionReasons: string[];
  lastModified: Date;
}

export enum ProductAvailability {
  IN_STOCK,
  OUT_OF_STOCK_TEMPORARY,
  OUT_OF_STOCK_OBSOLETE,
  PERENNIAL,
}
```

#### 2. `sitemap-hygiene.service.ts`

Service de validation et nettoyage:

```typescript
@Injectable()
export class SitemapHygieneService {
  // Normalise une URL
  normalizeUrl(url: string): string

  // Vérifie exclusion
  shouldExcludeUrl(url: string): { exclude: boolean; reasons: string[] }

  // Calcule lastmod réelle
  calculateRealLastModified(metadata: PageModificationMetadata): Date

  // Gestion stock
  shouldIncludeOutOfStockProduct(availability, links, content): boolean

  // Validation complète
  validateUrl(url: string, options): UrlValidationResult

  // Déduplication
  deduplicateUrls(urls: string[]): { unique: string[]; duplicates: Map }
}
```

### Utilisation dans sitemap-scalable.service.ts

```typescript
import { SitemapHygieneService } from './sitemap-hygiene.service';

@Injectable()
export class SitemapScalableService {
  constructor(
    private hygieneService: SitemapHygieneService
  ) {}

  async generateFinalSitemap(config: SitemapConfig): Promise<string> {
    // 1. Fetch URLs
    let urls = await this.fetchUrls(config);

    // 2. Valider chaque URL
    const validatedUrls = urls.map(url => {
      const validation = this.hygieneService.validateUrl(url.loc, {
        statusCode: 200,
        isIndexable: true,
        isCanonical: true,
        hasSufficientContent: url.wordCount >= 50,
        productAvailability: url.availability,
        modificationMetadata: url.metadata,
      });

      return validation.isValid ? {
        ...url,
        loc: validation.normalizedUrl,
        lastmod: validation.lastModified.toISOString(),
      } : null;
    }).filter(Boolean);

    // 3. Dédupliquer
    const { unique } = this.hygieneService.deduplicateUrls(
      validatedUrls.map(u => u.loc)
    );

    // 4. Générer XML
    return this.buildSitemapXml(validatedUrls, config);
  }
}
```

---

## ✅ TESTS DE VALIDATION

### Test 1: Normalisation URL

```typescript
describe('URL Normalization', () => {
  it('should normalize trailing slash', () => {
    const url = 'https://automecanik.com/pieces/filtre-air';
    const normalized = hygieneService.normalizeUrl(url);
    expect(normalized).toBe('https://automecanik.com/pieces/filtre-air/');
  });

  it('should remove www', () => {
    const url = 'https://www.automecanik.com/pieces/';
    const normalized = hygieneService.normalizeUrl(url);
    expect(normalized).toBe('https://automecanik.com/pieces/');
  });

  it('should lowercase pathname', () => {
    const url = 'https://automecanik.com/Pieces/Filtre-Air/';
    const normalized = hygieneService.normalizeUrl(url);
    expect(normalized).toBe('https://automecanik.com/pieces/filtre-air/');
  });
});
```

### Test 2: Exclusion URLs

```typescript
describe('URL Exclusion', () => {
  it('should exclude UTM parameters', () => {
    const url = 'https://automecanik.com/pieces/?utm_source=google';
    const { exclude, reasons } = hygieneService.shouldExcludeUrl(url);
    expect(exclude).toBe(true);
    expect(reasons).toContain('Contains UTM parameters');
  });

  it('should exclude session parameters', () => {
    const url = 'https://automecanik.com/pieces/?sessionid=abc123';
    const { exclude, reasons } = hygieneService.shouldExcludeUrl(url);
    expect(exclude).toBe(true);
    expect(reasons).toContain('Contains session parameters');
  });
});
```

### Test 3: Gestion Stock

```typescript
describe('Out of Stock Products', () => {
  it('should include perennial product with content', () => {
    const { include } = hygieneService.shouldIncludeOutOfStockProduct(
      ProductAvailability.PERENNIAL,
      true,   // hasStrongInternalLinks
      true,   // hasInformativeContent
    );
    expect(include).toBe(true);
  });

  it('should exclude obsolete product', () => {
    const { include } = hygieneService.shouldIncludeOutOfStockProduct(
      ProductAvailability.OUT_OF_STOCK_OBSOLETE,
      true,
      true,
    );
    expect(include).toBe(false);
  });
});
```

### Test 4: Déduplication

```typescript
describe('URL Deduplication', () => {
  it('should detect duplicates', () => {
    const urls = [
      'https://automecanik.com/pieces/filtre-air',
      'https://automecanik.com/pieces/filtre-air/',
      'https://www.automecanik.com/pieces/filtre-air/',
    ];

    const { unique, duplicates } = hygieneService.deduplicateUrls(urls);
    expect(unique.length).toBe(1);
    expect(duplicates.size).toBe(1);
  });
});
```

### Test 5: Calcul Date Modification

```typescript
describe('Last Modified Calculation', () => {
  it('should return most recent date', () => {
    const metadata = {
      createdAt: new Date('2024-01-01'),
      contentLastModified: new Date('2024-06-15'),
      priceLastModified: new Date('2025-10-10'),  // Plus récent
      stockLastModified: new Date('2025-09-20'),
    };

    const lastMod = hygieneService.calculateRealLastModified(metadata);
    expect(lastMod).toEqual(new Date('2025-10-10'));
  });
});
```

---

## 📊 MÉTRIQUES DE QUALITÉ

### KPIs à Surveiller

```typescript
interface SitemapQualityMetrics {
  // Taux d'inclusion
  totalUrlsCandidates: number;
  totalUrlsIncluded: number;
  inclusionRate: number;  // included/candidates

  // Raisons d'exclusion
  excludedByStatusCode: number;
  excludedByNoindex: number;
  excludedByNonCanonical: number;
  excludedByInsufficientContent: number;
  excludedByOutOfStock: number;
  excludedByDuplicates: number;

  // Qualité
  averageContentWordCount: number;
  averageInternalLinks: number;
  pagesWithRealLastModified: number;  // vs fake timestamp
}
```

### Objectifs de Qualité

```
✅ Taux d'inclusion: 70-85%
   (Si > 95% → trop permissif, si < 60% → trop strict)

✅ Doublons: < 1%
   (URLs normalisées doivent éliminer quasi tous les doublons)

✅ Dates réelles: > 95%
   (Presque toutes les pages doivent avoir une vraie lastmod)

✅ Contenu suffisant: 100%
   (Toutes les URLs incluses doivent respecter les seuils)
```

---

## 🎯 CHECKLIST DE VALIDATION

Avant de déployer en production, vérifier:

### Configuration
- [ ] `EXCLUDED_PARAMETERS` inclut tous les paramètres de tracking
- [ ] `EXCLUDED_URL_PATTERNS` couvre les cas d'usage du site
- [ ] `CONTENT_THRESHOLDS` adaptés au type de contenu

### Données
- [ ] Toutes les tables ont un champ `updated_at`
- [ ] Les produits ont un statut de disponibilité (stock)
- [ ] Les produits ont des indicateurs de contenu (word_count, links_count)

### Tests
- [ ] Tests unitaires passent (normalisation, exclusion, dédup)
- [ ] Tests d'intégration validés sur sample de données
- [ ] Métriques de qualité dans les objectifs

### Monitoring
- [ ] Logs d'exclusion activés (pour audit)
- [ ] Métriques Prometheus configurées
- [ ] Alertes sur taux d'exclusion anormal

---

## 📚 RESSOURCES

### Standards et Bonnes Pratiques

- [Sitemap Protocol 0.9](https://www.sitemaps.org/protocol.html)
- [Google Search Central - Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)

### Outils de Validation

```bash
# Valider XML
xmllint --noout sitemap.xml

# Tester robots.txt
curl https://automecanik.com/robots.txt

# Soumettre à Google
https://search.google.com/search-console
```

---

**✅ HYGIÈNE DES SITEMAPS: PRÊT POUR LA PRODUCTION**

Ces règles garantissent:
- 🎯 Qualité maximale des URLs indexées
- 🚀 Meilleur crawl budget
- 📈 Amélioration du SEO
- 🧹 Propreté et maintenabilité

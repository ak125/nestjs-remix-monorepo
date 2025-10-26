# 🧹 HTML Content Sanitizer - Guide d'utilisation

## Problème Résolu

Le contenu HTML stocké dans la base de données contient parfois des **placeholders vides** ou des **templates incomplets** :

### Exemples de problèmes

```html
<!-- ❌ AVANT (Problématique) -->
Les Bras de suspension de votre  relient le moyeu...
<!-- Mot manquant après "votre" -->

pour  quoi doivent être .
<!-- "pour  quoi" au lieu de "pour lesquels" -->

De  , . De  , .
<!-- Placeholders vides dans listes -->

Attention : .
<!-- Texte d'attention incomplet -->
```

### Solution appliquée

```html
<!-- ✅ APRÈS (Nettoyé) -->
Les Bras de suspension de votre véhicule relient le moyeu...

pour lesquels doivent être changés.

<!-- Listes vides supprimées -->

<!-- Texte incomplet supprimé -->
```

---

## Service: `HtmlContentSanitizerService`

### Méthodes Disponibles

#### 1. `sanitizeHtmlContent(content, context?)`

Nettoie le contenu HTML automatiquement.

**Usage:**
```typescript
import { HtmlContentSanitizerService } from './services/html-content-sanitizer.service';

// Dans votre service
constructor(
  private readonly sanitizer: HtmlContentSanitizerService
) {}

// Nettoyage simple
const cleaned = this.sanitizer.sanitizeHtmlContent(article.ba_content);

// Avec contexte pour remplacer dynamiquement
const cleaned = this.sanitizer.sanitizeHtmlContent(
  article.ba_content,
  {
    marque: 'Renault',
    modele: 'Clio',
    piece: 'Bras de suspension'
  }
);
```

#### 2. `sanitizeBlogContent(article, context?)`

Nettoie un objet article complet (content, description, keywords, preview).

**Usage:**
```typescript
const article = {
  ba_content: '<p>Les pièces de votre  compatible...</p>',
  ba_descrip: 'Description avec  placeholders',
  ba_keywords: 'mot1, mot1, mot2, , mot3', // Doublons et vides
};

const cleaned = this.sanitizer.sanitizeBlogContent(article, {
  marque: 'Peugeot'
});

// cleaned.content → Nettoyé
// cleaned.description → Nettoyé
// cleaned.keywords → 'mot1, mot2, mot3' (dédupliqué)
```

#### 3. `hasIncompletePlaceholders(content)`

Vérifie si un contenu a des placeholders manquants.

**Usage:**
```typescript
if (this.sanitizer.hasIncompletePlaceholders(article.ba_content)) {
  console.warn('⚠️ Contenu avec placeholders incomplets détecté');
}
```

#### 4. `analyzeContent(content)`

Analyse et rapporte les problèmes trouvés.

**Usage:**
```typescript
const analysis = this.sanitizer.analyzeContent(article.ba_content);

if (analysis.hasIssues) {
  console.log('Problèmes détectés:', analysis.issues);
  // ['Placeholder manquant après "de votre"', 'Liste avec placeholders vides']
}

const cleanedContent = analysis.cleaned;
```

---

## Intégration dans les Services Existants

### Exemple: AdviceService

```typescript
import { HtmlContentSanitizerService } from './html-content-sanitizer.service';

@Injectable()
export class AdviceService {
  constructor(
    private readonly supabaseService: SupabaseIndexationService,
    private readonly sanitizer: HtmlContentSanitizerService,
  ) {}

  async getAdviceByAlias(alias: string) {
    const { data } = await this.supabaseService
      .getClient()
      .from('__blog_advice')
      .select('*')
      .eq('ba_alias', alias)
      .single();

    if (!data) return null;

    // ✅ Nettoyer le contenu avant de retourner
    return this.sanitizer.sanitizeBlogContent(data);
  }

  async searchAdvice(query: string) {
    const { data } = await this.supabaseService
      .getClient()
      .from('__blog_advice')
      .select('*')
      .ilike('ba_title', `%${query}%`);

    // ✅ Nettoyer tous les articles
    return data.map(article => 
      this.sanitizer.sanitizeBlogContent(article)
    );
  }
}
```

### Exemple: ConstructeurService

```typescript
async getConstructeurByMarque(marqueId: number) {
  const { data } = await this.supabaseService
    .getClient()
    .from('__blog_seo_marque')
    .select('*')
    .eq('bsm_marque_id', marqueId)
    .single();

  if (!data) return null;

  // ✅ Nettoyer avec contexte marque
  const marque = await this.getMarqueName(marqueId);
  
  return this.sanitizer.sanitizeBlogContent(data, {
    marque: marque.marque_name,
  });
}
```

---

## Règles de Nettoyage Appliquées

| Pattern | Remplacement | Raison |
|---------|--------------|--------|
| `de votre  relient` | `de votre véhicule relient` | Mot manquant |
| `pour  quoi` | `pour lesquels` | Placeholder vide |
| `De  , .` | `` (supprimé) | Liste vide |
| `Attention : .` | `` (supprimé) | Texte incomplet |
| `&nbsp;&nbsp;+` | `&nbsp;` | Doubles espaces HTML |
| `\s{3,}` | ` ` | Multiples espaces |
| Keywords doublons | Dédupliqués | Optimisation SEO |

---

## Tests

### Test unitaire

```typescript
describe('HtmlContentSanitizerService', () => {
  let service: HtmlContentSanitizerService;

  beforeEach(() => {
    service = new HtmlContentSanitizerService();
  });

  it('devrait nettoyer "de votre  relient"', () => {
    const dirty = 'Les pièces de votre  relient le châssis';
    const clean = service.sanitizeHtmlContent(dirty);
    expect(clean).toBe('Les pièces de votre véhicule relient le châssis');
  });

  it('devrait détecter les placeholders manquants', () => {
    const content = 'Compatible avec votre .';
    expect(service.hasIncompletePlaceholders(content)).toBe(true);
  });

  it('devrait dédupliquer les keywords', () => {
    const keywords = 'pièce, pièce, auto, auto, moto';
    const clean = service.sanitizeKeywords(keywords);
    expect(clean).toBe('pièce, auto, moto');
  });
});
```

---

## Migration des Données en Base (Optionnel)

Si vous voulez corriger les données directement en base au lieu d'utiliser le service :

```sql
-- Corriger dans __blog_advice
UPDATE __blog_advice
SET ba_content = REPLACE(ba_content, 'de votre  relient', 'de votre véhicule relient')
WHERE ba_content LIKE '%de votre  relient%';

UPDATE __blog_advice
SET ba_content = REPLACE(ba_content, 'pour  quoi', 'pour lesquels')
WHERE ba_content LIKE '%pour  quoi%';

-- Corriger dans __blog_seo_marque
UPDATE __blog_seo_marque
SET bsm_content = REPLACE(bsm_content, 'de votre  ', 'de votre véhicule ')
WHERE bsm_content LIKE '%de votre  %';
```

---

## Monitoring

Pour identifier les articles problématiques en production :

```typescript
// Dans un endpoint admin ou script de maintenance
@Get('admin/analyze-content')
async analyzeAllContent() {
  const { data: articles } = await this.supabaseService
    .getClient()
    .from('__blog_advice')
    .select('ba_id, ba_title, ba_content');

  const issues = articles
    .map(article => ({
      id: article.ba_id,
      title: article.ba_title,
      analysis: this.sanitizer.analyzeContent(article.ba_content),
    }))
    .filter(result => result.analysis.hasIssues);

  return {
    total: articles.length,
    withIssues: issues.length,
    issues: issues.map(i => ({
      id: i.id,
      title: i.title,
      problems: i.analysis.issues,
    })),
  };
}
```

---

## ✅ Avantages

1. **Correction automatique** - Pas besoin de modifier la base
2. **Contexte dynamique** - Remplacement intelligent selon marque/modèle
3. **Performance** - Traitement côté serveur rapide
4. **Maintenabilité** - Centralisé dans un service
5. **Réversible** - Données source inchangées

---

## 📋 Checklist d'intégration

- [ ] Service ajouté au `BlogModule`
- [ ] Injecté dans `AdviceService`
- [ ] Injecté dans `ConstructeurService`
- [ ] Injecté dans `GlossaryService`
- [ ] Injecté dans `GuideService`
- [ ] Utilisé dans tous les `getBy*()` methods
- [ ] Tests unitaires ajoutés
- [ ] Documentation mise à jour

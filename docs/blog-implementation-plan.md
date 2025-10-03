# 🚀 Plan d'implémentation - Améliorations Blog

**Date**: 1er octobre 2025  
**Branche**: `blogv2`  
**Estimation totale**: 10 heures

---

## 📋 SPRINT 1: Quick Wins Visuels (4h)

### ✅ Tâche 1.1: Ajouter images sections H2/H3 (1h)

**Fichiers à modifier**:
- `frontend/app/routes/blog-pieces-auto.conseils.$pg_alias.tsx`
- `frontend/app/routes/blog.article.$slug.tsx`

**Changements**:

```typescript
// Dans blog-pieces-auto.conseils.$pg_alias.tsx ligne ~265
{article.sections.map((section, index) => (
  <section key={index} id={section.anchor} className="mb-8">
    {section.level === 2 ? (
      <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-500">
        {section.title}
      </h2>
    ) : (
      <h3 className="text-xl font-semibold text-gray-800 mb-3 ml-4">
        {section.title}
      </h3>
    )}
    
    {/* 🆕 AJOUTER CETTE SECTION */}
    {section.wall && section.wall !== 'no.jpg' && (
      <img 
        src={`/upload/blog/guide/mini/${section.wall}`}
        alt={section.title}
        width={225}
        height={165}
        className="float-left mr-6 mb-4 border-4 border-gray-200 rounded-lg shadow-sm"
        loading="lazy"
      />
    )}
    
    <div 
      className={`prose prose-lg max-w-none ${section.level === 3 ? 'ml-4' : ''}
        prose-p:text-gray-700 prose-p:leading-relaxed
        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
        prose-strong:font-semibold
        prose-ul:list-disc prose-ul:pl-6
        prose-li:text-gray-700`}
      dangerouslySetInnerHTML={{ __html: section.content }}
    />

    {/* Clear float after image */}
    {section.wall && section.wall !== 'no.jpg' && (
      <div className="clear-both" />
    )}

    {section.cta_link && section.cta_anchor && (
      <CTAButton 
        anchor={section.cta_anchor} 
        link={section.cta_link}
        className={section.level === 3 ? 'ml-4' : ''}
      />
    )}
  </section>
))}
```

**Tests**:
- [ ] Vérifier qu'une image `bg2_wall` s'affiche en float-left
- [ ] Vérifier le border-radius et l'ombre
- [ ] Tester responsive mobile (image pleine largeur)

---

### ✅ Tâche 1.2: Images mini articles similaires (1h)

**Fichier à modifier**:
- `frontend/app/routes/blog-pieces-auto.conseils.$pg_alias.tsx` (lignes 352-383)

**Changements**:

```typescript
// Remplacer la section "On vous propose"
{article.relatedArticles && article.relatedArticles.length > 0 && (
  <div className="bg-white rounded-lg shadow-lg">
    <div className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        📰 On vous propose
      </h3>
      <div className="space-y-4">
        {article.relatedArticles.map((related) => (
          <Link
            key={related.id}
            to={related.pg_alias ? `/blog-pieces-auto/conseils/${related.pg_alias}` : `/blog/article/${related.slug}`}
            className="flex gap-3 group hover:bg-gray-50 rounded-lg p-2 transition-colors"
          >
            {/* 🆕 AJOUTER L'IMAGE */}
            {related.wall && related.wall !== 'no.jpg' ? (
              <img 
                src={`/upload/blog/guide/mini/${related.wall}`}
                alt={related.title}
                className="w-24 h-20 object-cover rounded-md flex-shrink-0"
                loading="lazy"
              />
            ) : (
              <div className="w-24 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-md flex-shrink-0 flex items-center justify-center">
                <span className="text-2xl">📄</span>
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-1">
                {related.title}
              </h4>
              <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                {related.excerpt}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Eye className="w-3 h-3" />
                <span>{related.viewsCount.toLocaleString()} vues</span>
                {/* 🆕 AJOUTER DATE */}
                {related.updatedAt && (
                  <>
                    <span>•</span>
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(related.updatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  </>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  </div>
)}
```

**Backend**: S'assurer que l'API retourne le champ `wall` dans `relatedArticles`

```typescript
// backend/src/modules/blog/services/advice.service.ts
// Vérifier que transformAdviceToArticle() inclut wall
```

**Tests**:
- [ ] Images mini affichées (225x165px redimensionnées)
- [ ] Fallback emoji si pas d'image
- [ ] Date formatée en français
- [ ] Hover effects

---

### ✅ Tâche 1.3: Activer tracking compteur vues (1h)

**Fichier à modifier**:
- `frontend/app/routes/blog-pieces-auto.conseils.$pg_alias.tsx`

**Changements**:

```typescript
import { useEffect } from 'react';

export default function BlogArticleByGamme() {
  const { article, error } = useLoaderData<typeof loader>();

  // 🆕 AJOUTER CE USEEFFECT
  useEffect(() => {
    if (!article) return;

    // Incrémenter le compteur de vues après 3 secondes (évite les bounces)
    const viewTimer = setTimeout(async () => {
      try {
        const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
        await fetch(`${baseUrl}/api/blog/article/${article.id}/increment-views`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        console.log('✅ Vue enregistrée pour', article.title);
      } catch (err) {
        console.warn('⚠️ Erreur tracking vue:', err);
      }
    }, 3000);

    return () => clearTimeout(viewTimer);
  }, [article]);

  // ... reste du code
}
```

**Backend**: Créer l'endpoint

```typescript
// backend/src/modules/blog/controllers/blog.controller.ts

@Post('article/:id/increment-views')
@ApiOperation({ summary: '👀 Incrémenter compteur vues article' })
async incrementViews(@Param('id') id: string): Promise<any> {
  try {
    // Extraire type et ID legacy
    const [type, legacyId] = id.split('_');
    
    let success = false;
    
    switch (type) {
      case 'advice':
        success = await this.adviceService.incrementAdviceViews(legacyId);
        break;
      case 'guide':
        success = await this.guideService.incrementGuideViews(legacyId);
        break;
      default:
        return { success: false, error: 'Type inconnu' };
    }

    return {
      success,
      message: success ? 'Vue enregistrée' : 'Erreur enregistrement'
    };
  } catch (error) {
    this.logger.error(`Erreur increment vues: ${error.message}`);
    return { success: false, error: error.message };
  }
}
```

**Tests**:
- [ ] Vue incrémentée après 3s
- [ ] Pas de double comptage (même session)
- [ ] Logging console visible
- [ ] Cache invalidé

---

### ✅ Tâche 1.4: Dates format français amélioré (30min)

**Fichier à modifier**:
- `frontend/app/routes/blog-pieces-auto.conseils.$pg_alias.tsx`

**Changements**:

```typescript
// Fonction utilitaire
const formatFrenchDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric'
  }) + ' à ' + date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Dans le render (après le header)
<div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
  <div className="flex items-center gap-2">
    <Calendar className="w-4 h-4" />
    <span>
      Publié le {formatFrenchDate(article.publishedAt)}
    </span>
  </div>
  
  {article.updatedAt && article.updatedAt !== article.publishedAt && (
    <>
      <span className="text-gray-400">|</span>
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4" />
        <span>
          Modifié le {formatFrenchDate(article.updatedAt)}
        </span>
      </div>
    </>
  )}
</div>
```

**Tests**:
- [ ] Format: `01/10/2025 à 14:30`
- [ ] "Modifié le" affiché seulement si différent
- [ ] Responsive mobile

---

## 📦 SPRINT 2: Composants Réutilisables (6h)

### ✅ Tâche 2.1: Extraire TableOfContents component (2h)

**Nouveau fichier**: `frontend/app/components/blog/TableOfContents.tsx`

```typescript
import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';

export interface TOCSection {
  level: number;
  title: string;
  anchor: string;
}

interface TableOfContentsProps {
  sections: TOCSection[];
  className?: string;
}

export function TableOfContents({ sections, className = '' }: TableOfContentsProps) {
  const [activeSection, setActiveSection] = useState<string>('');

  useEffect(() => {
    // Scroll spy avec IntersectionObserver
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-20% 0px -80% 0px',
        threshold: 0.5
      }
    );

    // Observer toutes les sections
    sections.forEach((section) => {
      const element = document.getElementById(section.anchor);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [sections]);

  const handleClick = (anchor: string) => {
    const element = document.getElementById(anchor);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (sections.length === 0) return null;

  return (
    <nav className={`bg-white rounded-lg shadow-lg sticky top-4 ${className}`}>
      <div className="p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          📑 Sommaire
        </h3>
        <div className="space-y-2">
          {sections.map((section) => {
            const isActive = activeSection === section.anchor;
            const isH2 = section.level === 2;

            return (
              <button
                key={section.anchor}
                onClick={() => handleClick(section.anchor)}
                className={`
                  w-full text-left text-sm transition-all duration-200
                  ${isH2 ? 'font-medium text-gray-900' : 'ml-4 text-gray-600'}
                  ${isActive 
                    ? 'text-blue-600 font-semibold bg-blue-50 -ml-2 pl-2 py-1 rounded-r-lg border-l-2 border-blue-600' 
                    : 'hover:text-blue-600 hover:bg-gray-50 -ml-2 pl-2 py-1 rounded-r-lg'
                  }
                `}
              >
                <span className="flex items-center gap-2">
                  {isActive && <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                  <span className="line-clamp-2">{section.title}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>Progression</span>
            <span>
              {sections.findIndex(s => s.anchor === activeSection) + 1} / {sections.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ 
                width: `${((sections.findIndex(s => s.anchor === activeSection) + 1) / sections.length) * 100}%` 
              }}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
```

**Utilisation**:

```typescript
// Dans blog-pieces-auto.conseils.$pg_alias.tsx
import { TableOfContents } from '~/components/blog/TableOfContents';

// Remplacer l'ancienne section TOC par:
<TableOfContents 
  sections={article.sections.map(s => ({
    level: s.level,
    title: s.title,
    anchor: s.anchor
  }))}
/>
```

**Tests**:
- [ ] Scroll spy actif
- [ ] Smooth scroll au clic
- [ ] Progress bar mise à jour
- [ ] Active state visible
- [ ] Responsive

---

### ✅ Tâche 2.2: Créer LazyImage component (2h)

**Nouveau fichier**: `frontend/app/components/blog/LazyImage.tsx`

```typescript
import { useState, useEffect, useRef } from 'react';
import { ImageIcon } from 'lucide-react';

interface LazyImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  placeholder?: string;
}

export function LazyImage({
  src,
  alt,
  width,
  height,
  className = '',
  placeholder = '/upload/loading-min.gif'
}: LazyImageProps) {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Image visible, charger la vraie source
          const img = new Image();
          img.src = src;
          
          img.onload = () => {
            setImageSrc(src);
            setIsLoading(false);
          };
          
          img.onerror = () => {
            setHasError(true);
            setIsLoading(false);
          };
          
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px' // Charger 50px avant que l'image soit visible
      }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, [src]);

  if (hasError) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-100 rounded ${className}`}
        style={{ width, height }}
      >
        <div className="text-center text-gray-400">
          <ImageIcon className="w-8 h-8 mx-auto mb-2" />
          <p className="text-xs">Image indisponible</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        className={`
          ${className}
          transition-opacity duration-500
          ${isLoading ? 'opacity-50' : 'opacity-100'}
        `}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50 rounded">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}
    </div>
  );
}
```

**Utilisation**:

```typescript
import { LazyImage } from '~/components/blog/LazyImage';

// Remplacer les <img> par:
<LazyImage 
  src={`/upload/blog/guide/mini/${section.wall}`}
  alt={section.title}
  width={225}
  height={165}
  className="float-left mr-6 mb-4 border-4 border-gray-200 rounded-lg"
/>
```

**Tests**:
- [ ] Images chargées seulement quand visibles
- [ ] Spinner pendant chargement
- [ ] Fallback en cas d'erreur
- [ ] Fade-in smooth

---

### ✅ Tâche 2.3: Créer ScrollToTop component (1h)

**Nouveau fichier**: `frontend/app/components/blog/ScrollToTop.tsx`

```typescript
import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      setIsVisible(window.pageYOffset > 300);
    };

    window.addEventListener('scroll', toggleVisibility);
    toggleVisibility(); // Check initial position

    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`
        fixed bottom-8 right-8 z-50
        bg-blue-600 hover:bg-blue-700 text-white
        p-4 rounded-full shadow-2xl
        transition-all duration-300 transform
        ${isVisible 
          ? 'translate-y-0 opacity-100 scale-100' 
          : 'translate-y-16 opacity-0 scale-50 pointer-events-none'
        }
        hover:scale-110 active:scale-95
        focus:outline-none focus:ring-4 focus:ring-blue-300
      `}
      aria-label="Retour en haut"
      title="Retour en haut de la page"
    >
      <ArrowUp className="w-6 h-6" />
    </button>
  );
}
```

**Utilisation**:

```typescript
// Dans blog-pieces-auto.conseils.$pg_alias.tsx et blog.article.$slug.tsx
import { ScrollToTop } from '~/components/blog/ScrollToTop';

export default function BlogArticle() {
  return (
    <div>
      {/* ... contenu ... */}
      <ScrollToTop />
    </div>
  );
}
```

**Tests**:
- [ ] Apparaît après 300px scroll
- [ ] Animation smooth
- [ ] Responsive mobile
- [ ] Accessible (keyboard)

---

### ✅ Tâche 2.4: Analytics tracking (1h)

**Nouveau fichier**: `frontend/app/utils/analytics.ts`

```typescript
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export function trackArticleView(articleId: string, title: string) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'article_view', {
      article_id: articleId,
      article_title: title,
      page_location: window.location.href,
      page_title: document.title
    });
  }
  console.log('📊 Analytics: Article view', { articleId, title });
}

export function trackCTAClick(ctaLink: string, ctaAnchor: string) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'cta_click', {
      link_url: ctaLink,
      link_text: ctaAnchor,
      page_location: window.location.href
    });
  }
  console.log('📊 Analytics: CTA click', { ctaLink, ctaAnchor });
}

export function trackShareArticle(method: 'native' | 'copy', articleId: string) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'share', {
      method,
      content_type: 'article',
      item_id: articleId
    });
  }
  console.log('📊 Analytics: Article shared', { method, articleId });
}

export function trackReadingTime(articleId: string, durationSeconds: number) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'reading_time', {
      article_id: articleId,
      duration: durationSeconds,
      engagement_level: durationSeconds > 120 ? 'high' : durationSeconds > 60 ? 'medium' : 'low'
    });
  }
  console.log('📊 Analytics: Reading time', { articleId, durationSeconds });
}
```

**Utilisation**:

```typescript
// Dans blog-pieces-auto.conseils.$pg_alias.tsx
import { trackArticleView, trackCTAClick, trackShareArticle, trackReadingTime } from '~/utils/analytics';

export default function BlogArticle() {
  const { article } = useLoaderData<typeof loader>();
  const [startTime] = useState(Date.now());

  useEffect(() => {
    if (article) {
      trackArticleView(article.id, article.title);
    }

    // Track reading time on unmount
    return () => {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      if (duration > 5) { // Au moins 5 secondes
        trackReadingTime(article.id, duration);
      }
    };
  }, [article, startTime]);

  // Dans CTAButton
  const handleCTAClick = () => {
    trackCTAClick(article.cta_link!, article.cta_anchor!);
  };

  // Dans bouton Share
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: article.title, url: window.location.href });
      trackShareArticle('native', article.id);
    } else {
      navigator.clipboard.writeText(window.location.href);
      trackShareArticle('copy', article.id);
    }
  };
}
```

**Tests**:
- [ ] Events Google Analytics visibles
- [ ] Console logs en dev
- [ ] Pas d'erreurs si gtag absent
- [ ] Reading time calculé correctement

---

## 🚀 SPRINT 3: Navigation Articles (4h)

### ✅ Tâche 3.1: Backend getAdjacentArticles (2h)

**Fichier à modifier**: `backend/src/modules/blog/services/guide.service.ts`

```typescript
/**
 * 🔄 Récupérer les articles précédent/suivant
 */
async getAdjacentArticles(currentId: string | number): Promise<{
  previous: BlogArticle | null;
  next: BlogArticle | null;
}> {
  const cacheKey = `guide:adjacent:${currentId}`;

  try {
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached as any;

    const client = this.supabaseService.getClient();

    // Article précédent (ID inférieur, tri DESC)
    const { data: prevData } = await client
      .from('__blog_guide')
      .select('*')
      .lt('bg_id', currentId.toString())
      .order('bg_id', { ascending: false })
      .limit(1);

    // Article suivant (ID supérieur, tri ASC)
    const { data: nextData } = await client
      .from('__blog_guide')
      .select('*')
      .gt('bg_id', currentId.toString())
      .order('bg_id', { ascending: true })
      .limit(1);

    const result = {
      previous: prevData && prevData.length > 0 
        ? await this.transformGuideToArticle(client, prevData[0]) 
        : null,
      next: nextData && nextData.length > 0 
        ? await this.transformGuideToArticle(client, nextData[0]) 
        : null
    };

    await this.cacheManager.set(cacheKey, result, 3600);
    return result;
  } catch (error) {
    this.logger.error(`❌ Erreur getAdjacentArticles: ${error.message}`);
    return { previous: null, next: null };
  }
}
```

**Endpoint API**: `blog.controller.ts`

```typescript
@Get('article/:id/adjacent')
@ApiOperation({ summary: '🔄 Récupérer articles adjacents (précédent/suivant)' })
async getAdjacentArticles(@Param('id') id: string): Promise<any> {
  try {
    const [type, legacyId] = id.split('_');
    
    let result = { previous: null, next: null };
    
    switch (type) {
      case 'guide':
        result = await this.guideService.getAdjacentArticles(legacyId);
        break;
      case 'advice':
        result = await this.adviceService.getAdjacentArticles(legacyId);
        break;
      default:
        return { success: false, error: 'Type inconnu' };
    }

    return {
      success: true,
      data: result,
      message: 'Articles adjacents récupérés'
    };
  } catch (error) {
    this.logger.error(`Erreur getAdjacentArticles: ${error.message}`);
    return { success: false, error: error.message };
  }
}
```

**Tests**:
- [ ] Previous article correct
- [ ] Next article correct
- [ ] Null si premier/dernier
- [ ] Cache fonctionne

---

### ✅ Tâche 3.2: Frontend ArticleNavigation component (2h)

**Nouveau fichier**: `frontend/app/components/blog/ArticleNavigation.tsx`

```typescript
import { Link } from '@remix-run/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ArticleNavigationProps {
  previous: {
    id: string;
    title: string;
    slug: string;
    pg_alias?: string | null;
    excerpt: string;
  } | null;
  next: {
    id: string;
    title: string;
    slug: string;
    pg_alias?: string | null;
    excerpt: string;
  } | null;
}

export function ArticleNavigation({ previous, next }: ArticleNavigationProps) {
  if (!previous && !next) return null;

  const getUrl = (article: NonNullable<ArticleNavigationProps['previous' | 'next']>) => {
    return article.pg_alias 
      ? `/blog-pieces-auto/conseils/${article.pg_alias}` 
      : `/blog/article/${article.slug}`;
  };

  return (
    <nav className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Article précédent */}
      {previous ? (
        <Link
          to={getUrl(previous)}
          className="group flex items-start gap-4 p-6 bg-white rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all duration-200"
        >
          <div className="p-3 bg-blue-50 rounded-full group-hover:bg-blue-100 transition-colors">
            <ChevronLeft className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Article précédent</p>
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2">
              {previous.title}
            </h3>
            <p className="text-sm text-gray-600 line-clamp-2">
              {previous.excerpt}
            </p>
          </div>
        </Link>
      ) : (
        <div /> // Spacer pour grid
      )}

      {/* Article suivant */}
      {next ? (
        <Link
          to={getUrl(next)}
          className="group flex items-start gap-4 p-6 bg-white rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all duration-200"
        >
          <div className="flex-1 min-w-0 text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Article suivant</p>
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2">
              {next.title}
            </h3>
            <p className="text-sm text-gray-600 line-clamp-2">
              {next.excerpt}
            </p>
          </div>
          <div className="p-3 bg-blue-50 rounded-full group-hover:bg-blue-100 transition-colors">
            <ChevronRight className="w-6 h-6 text-blue-600" />
          </div>
        </Link>
      ) : null}
    </nav>
  );
}
```

**Utilisation dans loader**:

```typescript
// frontend/app/routes/blog-pieces-auto.conseils.$pg_alias.tsx
export async function loader({ params, request }: LoaderFunctionArgs) {
  // ... code existant ...

  // 🆕 Charger articles adjacents
  let adjacentArticles = null;
  if (article) {
    try {
      const adjResponse = await fetch(
        `${baseUrl}/api/blog/article/${article.id}/adjacent`
      );
      if (adjResponse.ok) {
        const adjData = await adjResponse.json();
        adjacentArticles = adjData.data;
      }
    } catch (err) {
      console.warn('Articles adjacents non disponibles');
    }
  }

  return json({ article, adjacentArticles });
}

// Dans le composant
import { ArticleNavigation } from '~/components/blog/ArticleNavigation';

export default function BlogArticle() {
  const { article, adjacentArticles } = useLoaderData<typeof loader>();

  return (
    <div>
      {/* ... contenu article ... */}
      
      {adjacentArticles && (
        <ArticleNavigation 
          previous={adjacentArticles.previous}
          next={adjacentArticles.next}
        />
      )}
    </div>
  );
}
```

**Tests**:
- [ ] Navigation previous/next visible
- [ ] Design responsive
- [ ] Hover effects
- [ ] Liens fonctionnels

---

## 📝 CHECKLIST FINALE

### Sprint 1 (4h)
- [ ] 1.1 Images sections H2/H3 (1h)
- [ ] 1.2 Images mini articles similaires (1h)
- [ ] 1.3 Tracking vues (1h)
- [ ] 1.4 Dates françaises (30min)
- [ ] Tests visuels sprint 1 (30min)

### Sprint 2 (6h)
- [ ] 2.1 TableOfContents component (2h)
- [ ] 2.2 LazyImage component (2h)
- [ ] 2.3 ScrollToTop component (1h)
- [ ] 2.4 Analytics tracking (1h)

### Sprint 3 (4h)
- [ ] 3.1 Backend getAdjacentArticles (2h)
- [ ] 3.2 Frontend ArticleNavigation (2h)

### Tests finaux
- [ ] Tests E2E articles
- [ ] Tests performance (Lighthouse)
- [ ] Tests mobile responsive
- [ ] Tests SEO (Google Search Console)
- [ ] Tests analytics (GA4)

---

## 🎯 RÉSULTAT ATTENDU

Après ces 3 sprints (14h total), votre blog aura :

✅ **100% des fonctionnalités PHP** + nouvelles features modernes  
✅ **UX améliorée** : Images, navigation, scroll  
✅ **Analytics complets** : Tracking vues, CTA, partages  
✅ **Performance optimisée** : Lazy loading, cache  
✅ **Composants réutilisables** : TOC, LazyImage, Navigation  
✅ **SEO optimisé** : Meta complètes, dates, structured data  

**Score qualité final estimé : 10/10** 🎉

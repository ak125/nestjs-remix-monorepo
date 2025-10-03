/**
 * 📊 Analytics - Utilitaires pour le tracking des événements
 * Compatible Google Analytics (gtag.js) et console logs en dev
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

/**
 * 👀 Tracker la vue d'un article
 */
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

/**
 * 🔗 Tracker un clic sur CTA
 */
export function trackCTAClick(ctaLink: string, ctaAnchor: string, articleId?: string) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'cta_click', {
      link_url: ctaLink,
      link_text: ctaAnchor,
      article_id: articleId,
      page_location: window.location.href
    });
  }
  console.log('📊 Analytics: CTA click', { ctaLink, ctaAnchor, articleId });
}

/**
 * 📤 Tracker un partage d'article
 */
export function trackShareArticle(method: 'native' | 'copy' | 'twitter' | 'facebook' | 'linkedin', articleId: string, articleTitle?: string) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'share', {
      method,
      content_type: 'article',
      item_id: articleId,
      item_title: articleTitle
    });
  }
  console.log('📊 Analytics: Article shared', { method, articleId, articleTitle });
}

/**
 * ⏱️ Tracker le temps de lecture
 */
export function trackReadingTime(articleId: string, durationSeconds: number, articleTitle?: string) {
  if (typeof window !== 'undefined' && window.gtag) {
    const engagementLevel = durationSeconds > 120 ? 'high' : durationSeconds > 60 ? 'medium' : 'low';
    
    window.gtag('event', 'reading_time', {
      article_id: articleId,
      article_title: articleTitle,
      duration: durationSeconds,
      engagement_level: engagementLevel
    });
  }
  console.log('📊 Analytics: Reading time', { articleId, durationSeconds, articleTitle });
}

/**
 * 🔖 Tracker l'ajout aux favoris
 */
export function trackBookmark(articleId: string, action: 'add' | 'remove', articleTitle?: string) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action === 'add' ? 'add_to_wishlist' : 'remove_from_wishlist', {
      item_id: articleId,
      item_name: articleTitle,
      item_category: 'blog_article'
    });
  }
  console.log('📊 Analytics: Bookmark', { action, articleId, articleTitle });
}

/**
 * 🔍 Tracker une recherche
 */
export function trackSearch(query: string, resultsCount: number) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'search', {
      search_term: query,
      results_count: resultsCount
    });
  }
  console.log('📊 Analytics: Search', { query, resultsCount });
}

/**
 * 📥 Tracker le scroll depth (profondeur de lecture)
 */
export function trackScrollDepth(articleId: string, percentage: number) {
  if (typeof window !== 'undefined' && window.gtag) {
    // Track milestones: 25%, 50%, 75%, 100%
    const milestone = Math.floor(percentage / 25) * 25;
    
    window.gtag('event', 'scroll_depth', {
      article_id: articleId,
      scroll_percentage: milestone,
      page_location: window.location.href
    });
  }
  console.log('📊 Analytics: Scroll depth', { articleId, percentage });
}

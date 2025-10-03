/**
 * ✨ OPTIMISATIONS BLOG - Version améliorée
 * 
 * Améliorations appliquées :
 * 1. Image featured réduite (h-48 md:h-64 au lieu de h-auto)
 * 2. Layout 4 colonnes (au lieu de 3) : article = 3 col, sidebar = 1 col
 * 3. Sommaire sticky en sidebar
 * 4. Articles croisés avec logos constructeurs
 * 5. Performance : lazy loading, width/height, object-cover
 * 6. Responsive optimisé
 */

// CHANGEMENTS À APPLIQUER DANS blog-pieces-auto.conseils.$pg_alias.tsx

// 1️⃣ IMAGE FEATURED - Réduire la taille
// AVANT:
// <div className="mt-6 rounded-xl overflow-hidden shadow-2xl max-w-4xl mx-auto">
//   <img src={article.featuredImage} className="w-full h-auto" />
// </div>

// APRÈS:
<div className="mt-6 rounded-xl overflow-hidden shadow-lg max-w-2xl mx-auto border-4 border-white/20">
  <img
    src={article.featuredImage}
    alt={article.title}
    className="w-full h-48 md:h-64 object-cover"
    loading="eager"
    width="800"
    height="256"
  />
</div>

// 2️⃣ LAYOUT GRID - 4 colonnes pour meilleure lecture
// AVANT: grid-cols-1 lg:grid-cols-3
// APRÈS: grid-cols-1 lg:grid-cols-4

<div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
  {/* Article: 3 colonnes */}
  <article className="lg:col-span-3 order-2 lg:order-1">
    {/* ... */}
  </article>
  
  {/* Sidebar: 1 colonne */}
  <aside className="lg:col-span-1 order-1 lg:order-2">
    {/* ... */}
  </aside>
</div>

// 3️⃣ SOMMAIRE STICKY
<aside className="lg:col-span-1 order-1 lg:order-2">
  <div className="lg:sticky lg:top-20 space-y-6">
    {/* Table des matières */}
    {article.sections.length > 0 && (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <TableOfContents sections={article.sections} />
      </div>
    )}
    
    {/* Articles croisés */}
    {article.relatedArticles && article.relatedArticles.length > 0 && (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">📰 On vous propose</h3>
        {/* ... */}
      </div>
    )}
  </div>
</aside>

// 4️⃣ VÉHICULES COMPATIBLES - Logos constructeurs améliorés
<VehicleCarousel vehicles={article.compatibleVehicles} />
// Le composant affiche déjà les logos avec marque_logo

// 5️⃣ ARTICLES CROISÉS - Compact et optimisé
{article.relatedArticles.map((related) => (
  <Link
    key={related.id}
    to={related.pg_alias ? `/blog-pieces-auto/conseils/${related.pg_alias}` : `/blog/article/${related.slug}`}
    className="flex gap-3 group hover:bg-gray-50 rounded-lg p-3 transition-all border border-transparent hover:border-blue-200"
  >
    {/* Image ou placeholder */}
    {related.featuredImage ? (
      <img
        src={related.featuredImage}
        alt={related.title}
        className="w-20 h-16 object-cover rounded-md flex-shrink-0"
        loading="lazy"
        width="80"
        height="64"
      />
    ) : (
      <div className="w-20 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-md flex items-center justify-center">
        <span className="text-xl">📄</span>
      </div>
    )}
    
    {/* Contenu */}
    <div className="flex-1 min-w-0">
      <h4 className="font-medium text-sm text-gray-900 group-hover:text-blue-600 line-clamp-2 mb-1">
        {related.title}
      </h4>
      <p className="text-xs text-gray-500 flex items-center gap-1">
        <Eye className="w-3 h-3" />
        {related.viewsCount.toLocaleString()} vues
      </p>
    </div>
  </Link>
))}

// 6️⃣ PERFORMANCE - Lazy loading images dans sections
{section.wall && section.wall !== 'no.jpg' && (
  <img
    src={`/upload/blog/guide/mini/${section.wall}`}
    alt={section.title}
    className="float-left mr-4 mb-2 w-32 h-32 object-cover rounded-md border-2 border-gray-200"
    loading="lazy"
    width="128"
    height="128"
  />
)}

// 7️⃣ RESPONSIVE - Order sur mobile
// Sur mobile: sidebar en premier (sommaire visible en haut)
// Sur desktop: article à gauche, sidebar à droite
<article className="lg:col-span-3 order-2 lg:order-1">
  {/* Article content */}
</article>

<aside className="lg:col-span-1 order-1 lg:order-2">
  {/* Sidebar sticky */}
</aside>

// 8️⃣ OPTIMISATIONS CSS
// - object-cover pour images (évite déformation)
// - width/height explicites (évite CLS)
// - loading="lazy" sauf featured (eager)
// - transition-all pour smooth UX
// - line-clamp-2 pour textes tronqués

export const optimizationTips = {
  images: {
    featured: "h-48 md:h-64 (au lieu de h-auto)",
    section: "w-32 h-32 avec loading=lazy",
    related: "w-20 h-16 avec loading=lazy",
    vehicles: "Déjà optimisé dans VehicleCarousel"
  },
  layout: {
    grid: "4 colonnes (3 article + 1 sidebar)",
    sidebar: "sticky top-20 sur desktop",
    order: "sidebar d'abord sur mobile"
  },
  performance: {
    lazyLoading: "Toutes images sauf featured",
    dimensions: "width/height explicites",
    objectFit: "object-cover pour proportions"
  },
  ux: {
    summaire: "Sticky en sidebar, toujours visible",
    crossArticles: "Compact avec images",
    transitions: "Smooth hover effects"
  }
};

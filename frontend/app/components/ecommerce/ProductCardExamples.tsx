/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛒 PRODUCT CARD E-COMMERCE - EXEMPLES D'UTILISATION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Exemples concrets d'utilisation de la ProductCard optimisée conversion
 * avec différents scénarios e-commerce réels.
 */

import { ProductCard } from './ProductCard';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 EXEMPLE 1: Produit En Stock avec Remise
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function ProductCardInStockWithDiscount() {
  return (
    <div className="max-w-sm">
      <ProductCard
        id="plaquettes-frein-clio4"
        name="Plaquettes de frein avant"
        description="Plaquettes de frein haute performance pour Renault Clio 4. Compatible tous moteurs diesel et essence."
        oemRef="7701208265"
        imageUrl="/images/products/plaquettes-frein.jpg"
        imageAlt="Plaquettes de frein avant Renault Clio 4"
        price={36.90}
        originalPrice={45.90}
        discountPercent={20}
        stockStatus="in-stock"
        stockQuantity={15}
        isCompatible={true}
        compatibilityNote="Compatible avec votre Renault Clio 4 1.5 dCi 2016"
        onAddToCart={(id) => {
          console.log('✅ Produit ajouté:', id);
          // Appel API backend
          // fetch('/api/cart/add', { method: 'POST', body: JSON.stringify({ productId: id }) })
        }}
        onImageClick={(id) => {
          console.log('🔍 Image cliquée:', id);
          // Ouvrir modal zoom ou redirection
          // window.location.href = `/products/${id}`;
        }}
      />
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 EXEMPLE 2: Produit Stock Faible (Urgence)
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function ProductCardLowStock() {
  return (
    <div className="max-w-sm">
      <ProductCard
        id="disques-frein-megane"
        name="Disques de frein avant (x2)"
        description="Disques de frein ventilés diamètre 280mm"
        oemRef="7701207795"
        imageUrl="/images/products/disques-frein.jpg"
        imageAlt="Disques de frein Renault Mégane"
        price={89.00}
        stockStatus="low-stock"
        stockQuantity={2}
        isCompatible={true}
        showDescription={true}
        showCompatibility={true}
        onAddToCart={(id) => console.log('Ajout panier:', id)}
      />
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 EXEMPLE 3: Produit Rupture de Stock
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function ProductCardOutOfStock() {
  return (
    <div className="max-w-sm">
      <ProductCard
        id="filtre-huile-scenic"
        name="Filtre à huile"
        oemRef="8200768913"
        imageUrl="/images/products/filtre-huile.jpg"
        imageAlt="Filtre à huile Renault Scenic"
        price={12.50}
        stockStatus="out-of-stock"
        isCompatible={true}
        showDescription={false}
        onAddToCart={(id) => console.log('Produit indisponible:', id)}
      />
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 EXEMPLE 4: Produit Incompatible
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function ProductCardIncompatible() {
  return (
    <div className="max-w-sm">
      <ProductCard
        id="courroie-distribution-captur"
        name="Kit courroie de distribution"
        description="Kit complet avec pompe à eau"
        oemRef="7701477028"
        imageUrl="/images/products/courroie-distribution.jpg"
        imageAlt="Courroie de distribution"
        price={189.00}
        stockStatus="in-stock"
        isCompatible={false}
        compatibilityNote="⚠️ Non compatible avec votre Renault Clio 4 1.5 dCi"
        showCompatibility={true}
        onAddToCart={(id) => console.log('Produit incompatible:', id)}
      />
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 EXEMPLE 5: Mode Compact (Grilles Produits)
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function ProductCardCompact() {
  return (
    <div className="max-w-xs">
      <ProductCard
        id="bougie-clio"
        name="Bougies d'allumage (x4)"
        oemRef="7700500155"
        imageUrl="/images/products/bougies.jpg"
        imageAlt="Bougies d'allumage"
        price={24.90}
        stockStatus="in-stock"
        isCompatible={true}
        compactMode={true}
        showDescription={false}
        showCompatibility={false}
        onAddToCart={(id) => console.log('Ajout panier compact:', id)}
      />
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 EXEMPLE 6: Grille de Produits (Catalogue)
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function ProductGridExample() {
  const products = [
    {
      id: 'plaquettes-1',
      name: 'Plaquettes de frein AV',
      oemRef: 'REF-001',
      price: 45.90,
      originalPrice: 55.90,
      stockStatus: 'in-stock' as const,
      imageUrl: '/images/products/plaquettes-1.jpg',
    },
    {
      id: 'disques-1',
      name: 'Disques de frein (x2)',
      oemRef: 'REF-002',
      price: 89.00,
      stockStatus: 'low-stock' as const,
      stockQuantity: 3,
      imageUrl: '/images/products/disques-1.jpg',
    },
    {
      id: 'filtre-1',
      name: 'Filtre à huile',
      oemRef: 'REF-003',
      price: 12.50,
      stockStatus: 'out-of-stock' as const,
      imageUrl: '/images/products/filtre-1.jpg',
    },
    {
      id: 'courroie-1',
      name: 'Courroie distribution',
      oemRef: 'REF-004',
      price: 189.00,
      stockStatus: 'in-stock' as const,
      imageUrl: '/images/products/courroie-1.jpg',
      isCompatible: false,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-md py-xl">
      <h2 className="font-heading text-3xl font-bold text-neutral-900 mb-lg">
        Catalogue Freinage
      </h2>

      {/* 
        Grille responsive
        • Mobile: 1 colonne
        • Tablet: 2 colonnes
        • Desktop: 3-4 colonnes
        • gap-lg → 24px (8px grid)
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-lg">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            {...product}
            imageAlt={product.name}
            isCompatible={product.isCompatible ?? true}
            showDescription={false}
            compactMode={true}
            onAddToCart={(id) => {
              console.log('✅ Ajouté au panier:', id);
              // Mise à jour state panier
              // updateCart(id);
            }}
            onImageClick={(id) => {
              console.log('🔍 Voir détails:', id);
              // Redirection fiche produit
              // navigate(`/products/${id}`);
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 EXEMPLE 7: Résultats de Recherche
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function SearchResultsExample() {
  const searchResults = [
    {
      id: 'search-1',
      name: 'Plaquettes de frein avant Bosch',
      description: 'Plaquettes céramique haute performance',
      oemRef: 'BOSCH-0986494',
      price: 52.90,
      originalPrice: 62.90,
      stockStatus: 'in-stock' as const,
      imageUrl: '/images/products/bosch-plaquettes.jpg',
      isCompatible: true,
      compatibilityNote: '✓ Compatible Renault Clio 4 (2012-2019)',
    },
    {
      id: 'search-2',
      name: 'Plaquettes de frein avant Brembo',
      description: 'Plaquettes sport haute température',
      oemRef: 'BREMBO-P68033',
      price: 68.90,
      stockStatus: 'low-stock' as const,
      stockQuantity: 2,
      imageUrl: '/images/products/brembo-plaquettes.jpg',
      isCompatible: true,
      compatibilityNote: '✓ Compatible Renault Clio 4 RS (2013+)',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-md py-xl">
      <div className="mb-lg">
        <h1 className="font-heading text-3xl font-bold text-neutral-900 mb-sm">
          Résultats pour "plaquettes de frein"
        </h1>
        <p className="font-sans text-neutral-600">
          {searchResults.length} produits trouvés pour votre Renault Clio 4
        </p>
      </div>

      {/* Liste résultats */}
      <div className="space-y-lg">
        {searchResults.map((product) => (
          <ProductCard
            key={product.id}
            {...product}
            imageAlt={product.name}
            showDescription={true}
            showCompatibility={true}
            compactMode={false}
            onAddToCart={(id) => console.log('Ajout:', id)}
            onImageClick={(id) => console.log('Détails:', id)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 EXEMPLE 8: Showcase Complet (Tous les États)
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function ProductCardShowcase() {
  return (
    <div className="min-h-screen bg-neutral-50 py-xl px-md">
      <div className="max-w-7xl mx-auto">
        <h1 className="font-heading text-4xl font-bold text-neutral-900 mb-xl text-center">
          🛒 ProductCard E-Commerce - Showcase
        </h1>

        {/* Section: États de stock */}
        <section className="mb-xl">
          <h2 className="font-heading text-2xl font-bold text-neutral-900 mb-lg">
            📦 États de Stock
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            <div>
              <h3 className="font-heading text-sm font-semibold text-neutral-600 mb-sm">
                ✅ En Stock
              </h3>
              <ProductCardInStockWithDiscount />
            </div>
            <div>
              <h3 className="font-heading text-sm font-semibold text-neutral-600 mb-sm">
                ⚠️ Stock Faible
              </h3>
              <ProductCardLowStock />
            </div>
            <div>
              <h3 className="font-heading text-sm font-semibold text-neutral-600 mb-sm">
                ✕ Rupture de Stock
              </h3>
              <ProductCardOutOfStock />
            </div>
          </div>
        </section>

        {/* Section: Compatibilité */}
        <section className="mb-xl">
          <h2 className="font-heading text-2xl font-bold text-neutral-900 mb-lg">
            🔧 Compatibilité
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div>
              <h3 className="font-heading text-sm font-semibold text-neutral-600 mb-sm">
                ✓ Compatible
              </h3>
              <ProductCardInStockWithDiscount />
            </div>
            <div>
              <h3 className="font-heading text-sm font-semibold text-neutral-600 mb-sm">
                ✕ Incompatible
              </h3>
              <ProductCardIncompatible />
            </div>
          </div>
        </section>

        {/* Section: Modes d'affichage */}
        <section className="mb-xl">
          <h2 className="font-heading text-2xl font-bold text-neutral-900 mb-lg">
            📐 Modes d'Affichage
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div>
              <h3 className="font-heading text-sm font-semibold text-neutral-600 mb-sm">
                Mode Standard
              </h3>
              <ProductCardInStockWithDiscount />
            </div>
            <div>
              <h3 className="font-heading text-sm font-semibold text-neutral-600 mb-sm">
                Mode Compact
              </h3>
              <ProductCardCompact />
            </div>
          </div>
        </section>

        {/* Section: Grille produits */}
        <section>
          <h2 className="font-heading text-2xl font-bold text-neutral-900 mb-lg">
            🗂️ Grille Produits (Catalogue)
          </h2>
          <ProductGridExample />
        </section>
      </div>
    </div>
  );
}

export default ProductCardShowcase;

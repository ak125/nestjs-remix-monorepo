/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 PRODUCT CARD EXAMPLE - Design System Complet
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Exemple complet intégrant :
 * • Couleurs métier (Primary, Secondary, Success, Warning, Error, Neutral)
 * • Typographie métier (Montserrat, Inter, Roboto Mono)
 * • Système d'espacement 8px grid (xs, sm, md, lg, xl)
 * 
 * Ce composant démontre l'utilisation correcte du Design System
 * pour une card produit pièces automobiles.
 */

interface ProductCardExampleProps {
  name: string;
  oemRef: string;
  sku: string;
  price: number;
  stock: number;
  description: string;
  imageUrl: string;
  isCompatible: boolean;
  hasDelayedDelivery?: boolean;
  deliveryTime?: string;
}

export function ProductCardExample({
  name,
  oemRef,
  sku,
  price,
  stock,
  description,
  imageUrl,
  isCompatible,
  hasDelayedDelivery = false,
  deliveryTime = '24-48h',
}: ProductCardExampleProps) {
  return (
    <article className="bg-white rounded-lg shadow-md border border-neutral-200 overflow-hidden hover:shadow-lg transition-shadow">
      {/* 
        Image Container
        • No padding (image full width)
      */}
      <div className="relative aspect-square bg-neutral-100">
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover"
        />
        
        {/* 
          Badge Compatibilité (Success ou Error)
          • Espacement: p-xs (4px) - Micro-espacement badge
          • Position: absolute top-xs right-xs
        */}
        {isCompatible ? (
          <span className="absolute top-xs right-xs bg-success text-white px-sm py-xs rounded-full text-xs font-sans font-medium shadow-md">
            ✓ Compatible
          </span>
        ) : (
          <span className="absolute top-xs right-xs bg-error text-white px-sm py-xs rounded-full text-xs font-sans font-medium shadow-md">
            ✗ Incompatible
          </span>
        )}
      </div>
      
      {/* 
        Content Container
        • Espacement: p-md (16px) - Padding standard carte
      */}
      <div className="p-md">
        {/* 
          Titre Produit
          • Police: font-heading (Montserrat Bold) - Impact
          • Espacement: mb-sm (8px)
        */}
        <h3 className="font-heading text-lg font-semibold text-neutral-900 mb-sm line-clamp-2">
          {name}
        </h3>
        
        {/* 
          SKU (Code interne)
          • Police: font-mono (Roboto Mono) - Précision technique
          • Espacement: mb-sm (8px)
        */}
        <div className="flex items-center gap-sm mb-sm">
          <span className="font-sans text-xs text-neutral-500">SKU:</span>
          <code className="font-mono text-xs text-neutral-900 bg-neutral-100 px-xs py-xs rounded">
            {sku}
          </code>
        </div>
        
        {/* 
          Référence OEM
          • Police: font-mono (Roboto Mono) - Code technique
          • Espacement: mb-md (16px)
        */}
        <div className="flex items-center gap-sm mb-md">
          <span className="font-sans text-xs text-neutral-500">Réf OEM:</span>
          <code className="font-mono text-xs text-neutral-900 bg-neutral-100 px-xs py-xs rounded">
            {oemRef}
          </code>
        </div>
        
        {/* 
          Description
          • Police: font-sans (Inter Regular) - Lisibilité
          • Espacement: mb-md (16px)
        */}
        <p className="font-sans text-sm text-neutral-700 mb-md line-clamp-2">
          {description}
        </p>
        
        {/* 
          Stock Indicator
          • Police: font-mono (Roboto Mono) - Donnée précise
          • Couleur: Success si stock > 10
          • Espacement: mb-md (16px), gap-sm entre éléments
        */}
        <div className="flex items-center justify-between mb-md">
          <span className={`font-mono text-sm font-medium ${stock > 10 ? 'text-success' : 'text-warning'}`}>
            Stock: {stock} unités
          </span>
          <span className="font-sans text-xs text-neutral-500">
            Livraison {deliveryTime}
          </span>
        </div>
        
        {/* 
          Prix
          • Police: font-mono (Roboto Mono) - Précision financière
          • Espacement: mb-md (16px)
        */}
        <div className="flex items-baseline mb-md">
          <span className="font-mono text-3xl font-bold text-neutral-900">
            {price.toFixed(2)} €
          </span>
          <span className="font-sans text-sm text-neutral-500 ml-sm">TTC</span>
        </div>
        
        {/* 
          Alerte Délai (Warning) - Conditionnel
          • Couleur: Warning (orange)
          • Espacement: p-sm (8px), mb-md (16px)
        */}
        {hasDelayedDelivery && (
          <div className="bg-warning/10 border border-warning/30 text-warning-foreground px-sm py-sm rounded-md text-sm mb-md font-sans flex items-center gap-xs">
            <span>⚠️</span>
            <span>Livraison sous 3-5 jours</span>
          </div>
        )}
        
        {/* 
          Message Incompatibilité (Error) - Conditionnel
          • Couleur: Error (rouge sombre)
          • Espacement: p-sm (8px), mb-md (16px)
        */}
        {!isCompatible && (
          <div className="bg-error/10 border border-error/30 text-error px-sm py-sm rounded-md text-sm mb-md font-sans flex items-center gap-xs">
            <span>✗</span>
            <span>Non compatible avec votre véhicule</span>
          </div>
        )}
        
        {/* 
          Actions Container
          • Espacement: space-y-sm (8px vertical entre boutons)
        */}
        <div className="space-y-sm">
          {/* 
            Bouton CTA Principal (Primary)
            • Couleur: Primary #FF3B30 (rouge/orangé) - Action
            • Police: font-heading (Montserrat) - Robustesse
            • Espacement: py-sm px-md (8px vertical, 16px horizontal)
          */}
          <button
            className="w-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-heading font-semibold py-sm px-md rounded-lg transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!isCompatible || stock === 0}
          >
            {stock === 0 ? 'Rupture de stock' : 'Ajouter au panier'}
          </button>
          
          {/* 
            Lien Secondaire (Secondary)
            • Couleur: Secondary #0F4C81 (bleu acier) - Navigation
            • Police: font-sans (Inter) - Sobre
            • Espacement: py-xs (4px) - Minimal pour lien
          */}
          <button className="w-full text-center text-secondary-500 hover:text-secondary-600 font-sans text-sm py-xs hover:underline transition-colors">
            Voir les détails techniques
          </button>
        </div>
      </div>
    </article>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📊 SHOWCASE - Grid de Product Cards
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Démonstration d'une grille de produits avec espacement LG (24px)
 */
export function ProductGridExample() {
  const sampleProducts: ProductCardExampleProps[] = [
    {
      name: 'Plaquettes de frein avant Brembo',
      oemRef: '7701208265',
      sku: 'BRK-12345-FR',
      price: 45.99,
      stock: 12,
      description: 'Plaquettes haute performance. Compatible Renault Clio 4 (2012-2019). Certifiées ECE R90.',
      imageUrl: 'https://via.placeholder.com/400',
      isCompatible: true,
      hasDelayedDelivery: false,
    },
    {
      name: 'Disques de frein arrière Zimmermann',
      oemRef: '7701207795',
      sku: 'DSK-67890-FR',
      price: 89.50,
      stock: 5,
      description: 'Disques ventilés. Compatible Renault Megane 3 (2008-2016). Qualité OEM.',
      imageUrl: 'https://via.placeholder.com/400',
      isCompatible: true,
      hasDelayedDelivery: true,
      deliveryTime: '3-5 jours',
    },
    {
      name: 'Kit embrayage LUK',
      oemRef: '7701476745',
      sku: 'CLU-11223-FR',
      price: 189.99,
      stock: 0,
      description: 'Kit complet. Compatible Renault Laguna 2 (2001-2007). Garantie 1 an.',
      imageUrl: 'https://via.placeholder.com/400',
      isCompatible: false,
      hasDelayedDelivery: false,
    },
  ];

  return (
    <section className="py-xl px-md max-w-7xl mx-auto">
      {/* 
        Section Header
        • Police: font-heading (Montserrat) - Titre
        • Espacement: mb-lg (24px)
      */}
      <div className="mb-lg">
        <h2 className="font-heading text-3xl font-bold text-neutral-900 mb-sm">
          Nos meilleures ventes
        </h2>
        <p className="font-sans text-lg text-neutral-600">
          Pièces de freinage haute performance pour votre véhicule
        </p>
      </div>
      
      {/* 
        Grid Container
        • Espacement: gap-lg (24px) - Gap entre cartes
        • Responsive: 1 col mobile, 2 cols tablet, 3 cols desktop
      */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
        {sampleProducts.map((product, index) => (
          <ProductCardExample key={index} {...product} />
        ))}
      </div>
    </section>
  );
}

export default ProductCardExample;

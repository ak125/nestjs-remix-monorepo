/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛒 CATALOGUE DEMO - INTÉGRATION COMPLÈTE E-COMMERCE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Démo complète intégrant les 3 composants critiques :
 * - SmartHeader : Navigation + Recherche + CTA Véhicule
 * - AdvancedFilters : Filtrage multi-critères
 * - ProductCard : Affichage produits
 */

import { type MetaFunction } from '@remix-run/node';
import { useState, useMemo } from 'react';
import { AdvancedFilters, type FilterValues } from '~/components/ecommerce/AdvancedFilters';
import { ProductCard } from '~/components/ecommerce/ProductCard';
import { SmartHeader, type Vehicle } from '~/components/ecommerce/SmartHeader';

export const meta: MetaFunction = () => {
  return [
    { title: 'Catalogue Pièces Auto - Démo E-Commerce' },
    { name: 'description', content: 'Démo intégration complète SmartHeader + AdvancedFilters + ProductCard' },
  ];
};

// ═══════════════════════════════════════════════════════════════════════════
// 🗄️ MOCK DATA (Remplacer par API backend en production)
// ═══════════════════════════════════════════════════════════════════════════

const MOCK_BRANDS = ['Peugeot', 'Renault', 'Citroën', 'Ford', 'Volkswagen', 'BMW', 'Mercedes', 'Audi'];

const MOCK_CATEGORIES = [
  'Freinage',
  'Filtration',
  'Moteur',
  'Transmission',
  'Suspension',
  'Éclairage',
  'Échappement',
  'Climatisation',
];

interface Product {
  id: string;
  name: string;
  description: string;
  oemRef: string;
  imageUrl: string;
  imageAlt: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock';
  isCompatible: boolean;
  brand: string;
  model: string;
  category: string;
  year?: number;
  engine?: string;
}

const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Plaquettes de frein avant',
    description: 'Plaquettes céramique haute performance',
    oemRef: '7701208265',
    imageUrl: '/images/plaquettes-frein.jpg',
    imageAlt: 'Plaquettes de frein avant',
    price: 45.90,
    originalPrice: 55.90,
    discountPercent: 18,
    stockStatus: 'in-stock',
    isCompatible: true,
    brand: 'Renault',
    model: 'Clio 4',
    category: 'Freinage',
    year: 2016,
    engine: '1.5 dCi',
  },
  {
    id: '2',
    name: 'Disques de frein (x2)',
    description: 'Paire de disques ventilés',
    oemRef: '7701207795',
    imageUrl: '/images/disques-frein.jpg',
    imageAlt: 'Disques de frein',
    price: 89.00,
    stockStatus: 'low-stock',
    isCompatible: true,
    brand: 'Renault',
    model: 'Mégane',
    category: 'Freinage',
    year: 2015,
    engine: '1.6 dCi',
  },
  {
    id: '3',
    name: 'Filtre à huile',
    description: 'Filtre à huile OEM qualité',
    oemRef: '8200768913',
    imageUrl: '/images/filtre-huile.jpg',
    imageAlt: 'Filtre à huile',
    price: 12.50,
    stockStatus: 'out-of-stock',
    isCompatible: false,
    brand: 'Peugeot',
    model: '208',
    category: 'Filtration',
    year: 2018,
    engine: '1.2 PureTech',
  },
  {
    id: '4',
    name: 'Courroie de distribution',
    description: 'Kit complet avec galet tendeur',
    oemRef: '1612282380',
    imageUrl: '/images/courroie-distribution.jpg',
    imageAlt: 'Courroie de distribution',
    price: 125.00,
    originalPrice: 145.00,
    discountPercent: 14,
    stockStatus: 'in-stock',
    isCompatible: true,
    brand: 'Citroën',
    model: 'C3',
    category: 'Moteur',
    year: 2017,
    engine: '1.4 HDi',
  },
  {
    id: '5',
    name: 'Amortisseur avant gauche',
    description: 'Amortisseur à gaz haute performance',
    oemRef: '5202CK',
    imageUrl: '/images/amortisseur.jpg',
    imageAlt: 'Amortisseur avant',
    price: 78.50,
    stockStatus: 'in-stock',
    isCompatible: true,
    brand: 'Peugeot',
    model: '308',
    category: 'Suspension',
    year: 2016,
    engine: '1.6 HDi',
  },
  {
    id: '6',
    name: 'Phare avant LED',
    description: 'Optique LED avec réglage automatique',
    oemRef: '9806749180',
    imageUrl: '/images/phare-led.jpg',
    imageAlt: 'Phare avant LED',
    price: 245.00,
    originalPrice: 299.00,
    discountPercent: 18,
    stockStatus: 'low-stock',
    isCompatible: false,
    brand: 'Peugeot',
    model: '3008',
    category: 'Éclairage',
    year: 2019,
    engine: '1.5 BlueHDi',
  },
  {
    id: '7',
    name: 'Filtre à air',
    description: 'Filtre à air haute filtration',
    oemRef: '1444VK',
    imageUrl: '/images/filtre-air.jpg',
    imageAlt: 'Filtre à air',
    price: 18.90,
    stockStatus: 'in-stock',
    isCompatible: true,
    brand: 'Citroën',
    model: 'Berlingo',
    category: 'Filtration',
    year: 2015,
    engine: '1.6 HDi',
  },
  {
    id: '8',
    name: 'Kit embrayage complet',
    description: 'Disque + mécanisme + butée',
    oemRef: '2050W9',
    imageUrl: '/images/kit-embrayage.jpg',
    imageAlt: 'Kit embrayage',
    price: 189.00,
    originalPrice: 229.00,
    discountPercent: 17,
    stockStatus: 'in-stock',
    isCompatible: true,
    brand: 'Peugeot',
    model: '208',
    category: 'Transmission',
    year: 2016,
    engine: '1.6 HDi',
  },
  {
    id: '9',
    name: 'Radiateur moteur',
    description: 'Radiateur aluminium OEM',
    oemRef: '1330.AH',
    imageUrl: '/images/radiateur.jpg',
    imageAlt: 'Radiateur moteur',
    price: 156.00,
    stockStatus: 'out-of-stock',
    isCompatible: false,
    brand: 'Citroën',
    model: 'C4',
    category: 'Moteur',
    year: 2014,
    engine: '1.6 e-HDi',
  },
  {
    id: '10',
    name: 'Silencieux arrière',
    description: 'Pot échappement inox',
    oemRef: '1706.EJ',
    imageUrl: '/images/silencieux.jpg',
    imageAlt: 'Silencieux échappement',
    price: 98.50,
    stockStatus: 'low-stock',
    isCompatible: true,
    brand: 'Peugeot',
    model: '207',
    category: 'Échappement',
    year: 2012,
    engine: '1.4 HDi',
  },
  {
    id: '11',
    name: 'Compresseur climatisation',
    description: 'Compresseur A/C avec huile',
    oemRef: '9671216280',
    imageUrl: '/images/compresseur-clim.jpg',
    imageAlt: 'Compresseur climatisation',
    price: 267.00,
    originalPrice: 320.00,
    discountPercent: 17,
    stockStatus: 'in-stock',
    isCompatible: true,
    brand: 'Peugeot',
    model: '308',
    category: 'Climatisation',
    year: 2016,
    engine: '1.6 HDi',
  },
  {
    id: '12',
    name: 'Batterie 12V 70Ah',
    description: 'Batterie calcium argent',
    oemRef: 'VARTA-D59',
    imageUrl: '/images/batterie.jpg',
    imageAlt: 'Batterie 12V',
    price: 89.90,
    stockStatus: 'in-stock',
    isCompatible: true,
    brand: 'Universel',
    model: 'Tous modèles',
    category: 'Électrique',
    year: 2020,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function CatalogDemo() {
  // État véhicule (partagé entre SmartHeader et AdvancedFilters)
  const [savedVehicle, setSavedVehicle] = useState<Vehicle | null>(() => {
    // Récupérer depuis localStorage si disponible
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('saved-vehicle');
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  });

  // État filtres
  const [filters, setFilters] = useState<FilterValues>(() => {
    // Auto-remplir avec véhicule si configuré
    if (savedVehicle) {
      return {
        brand: savedVehicle.brand,
        model: savedVehicle.model,
        year: savedVehicle.year,
        engine: savedVehicle.engine,
        compatibleOnly: true, // Auto-activé si véhicule configuré
      };
    }
    return {};
  });

  // État panier
  const [cartItemCount, setCartItemCount] = useState(0);

  // État recherche
  const [searchQuery, setSearchQuery] = useState('');

  // ───────────────────────────────────────────────────────────────────────────
  // 🔍 LOGIQUE FILTRAGE PRODUITS
  // ───────────────────────────────────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    let results = [...MOCK_PRODUCTS];

    // Recherche par nom/OEM
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.oemRef.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query)
      );
    }

    // Filtres véhicule
    if (filters.brand) {
      results = results.filter((p) => p.brand === filters.brand);
    }
    if (filters.model) {
      results = results.filter((p) => p.model.toLowerCase().includes(filters.model!.toLowerCase()));
    }
    if (filters.year) {
      results = results.filter((p) => p.year === filters.year);
    }
    if (filters.engine) {
      results = results.filter((p) => p.engine?.toLowerCase().includes(filters.engine!.toLowerCase()));
    }

    // Filtres produit
    if (filters.category) {
      results = results.filter((p) => p.category === filters.category);
    }
    if (filters.oemRef) {
      results = results.filter((p) => p.oemRef.toLowerCase().includes(filters.oemRef!.toLowerCase()));
    }

    // Filtres prix
    if (filters.priceMin !== undefined) {
      results = results.filter((p) => p.price >= filters.priceMin!);
    }
    if (filters.priceMax !== undefined) {
      results = results.filter((p) => p.price <= filters.priceMax!);
    }

    // Filtres options
    if (filters.inStockOnly) {
      results = results.filter((p) => p.stockStatus === 'in-stock');
    }
    if (filters.compatibleOnly) {
      results = results.filter((p) => p.isCompatible);
    }

    return results;
  }, [filters, searchQuery]);

  // ───────────────────────────────────────────────────────────────────────────
  // 🎬 HANDLERS
  // ───────────────────────────────────────────────────────────────────────────

  const handleVehicleSelect = (vehicle: Vehicle) => {
    setSavedVehicle(vehicle);
    
    // Sauvegarder dans localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('saved-vehicle', JSON.stringify(vehicle));
    }

    // Auto-remplir filtres
    setFilters({
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      engine: vehicle.engine,
      compatibleOnly: true,
    });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
  };

  const handleFilterReset = () => {
    setFilters({});
    setSearchQuery('');
  };

  const handleAddToCart = (productId: string) => {
    console.log('Ajout au panier:', productId);
    setCartItemCount((prev) => prev + 1);
    
    // TODO: Appeler API backend
    // await addToCart({ productId, quantity: 1 });
  };

  const handleImageClick = (productId: string) => {
    console.log('Image cliquée:', productId);
    // TODO: Ouvrir modal zoom ou rediriger vers page produit
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 🎨 RENDER
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header intelligent */}
      <SmartHeader
        savedVehicle={savedVehicle}
        onVehicleSelect={handleVehicleSelect}
        onSearch={handleSearch}
        cartItemCount={cartItemCount}
        logoUrl="/logo.svg"
        companyName="Auto Pièces Pro"
      />

      {/* Info véhicule configuré (si applicable) */}
      {savedVehicle && (
        <div className="bg-success-50 border-b border-success-200">
          <div className="max-w-7xl mx-auto px-md py-sm">
            <p className="font-sans text-sm text-success-800">
              <strong className="font-heading">✓ Véhicule configuré:</strong>{' '}
              {savedVehicle.brand} {savedVehicle.model} {savedVehicle.engine} ({savedVehicle.year})
              {' • '}
              <button
                onClick={() => {
                  setSavedVehicle(null);
                  localStorage.removeItem('saved-vehicle');
                  setFilters({});
                }}
                className="underline hover:text-success-900 font-semibold"
              >
                Changer de véhicule
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-md py-xl">
        <h1 className="font-heading text-4xl font-bold text-neutral-900 mb-lg">
          Catalogue Pièces Auto
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-lg">
          {/* Sidebar filtres (sticky) */}
          <aside className="lg:col-span-1">
            <div className="sticky top-xl">
              <AdvancedFilters
                values={filters}
                onChange={handleFilterChange}
                onReset={handleFilterReset}
                brands={MOCK_BRANDS}
                categories={MOCK_CATEGORIES}
                resultCount={filteredProducts.length}
                totalCount={MOCK_PRODUCTS.length}
                collapsed={false}
                showVehicleFilters={true}
                showPriceFilter={true}
                showStockFilter={true}
              />
            </div>
          </aside>

          {/* Grille produits */}
          <main className="lg:col-span-3">
            {/* Message recherche active */}
            {searchQuery && (
              <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-md mb-lg">
                <p className="font-sans text-sm text-secondary-800">
                  <strong className="font-heading">Recherche :</strong> "{searchQuery}"
                  {' • '}
                  <button
                    onClick={() => setSearchQuery('')}
                    className="underline hover:text-secondary-900 font-semibold"
                  >
                    Effacer
                  </button>
                </p>
              </div>
            )}

            {/* Résultats */}
            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-2xl text-center">
                <div className="text-6xl mb-md">😕</div>
                <h2 className="font-heading text-2xl font-bold text-neutral-900 mb-sm">
                  Aucun produit trouvé
                </h2>
                <p className="font-sans text-neutral-600 mb-lg">
                  Essayez de modifier vos critères de recherche ou de réinitialiser les filtres.
                </p>
                <button
                  onClick={handleFilterReset}
                  className="px-xl py-md bg-primary-500 text-white rounded-lg font-heading font-semibold hover:bg-primary-600 transition-colors"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            ) : (
              <>
                {/* Compteur résultats (visible mobile) */}
                <div className="lg:hidden bg-white rounded-lg shadow-sm p-md mb-md">
                  <p className="font-heading text-sm font-bold text-neutral-900">
                    {filteredProducts.length} / {MOCK_PRODUCTS.length} résultats
                  </p>
                </div>

                {/* Grille produits */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-lg">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      id={product.id}
                      name={product.name}
                      description={product.description}
                      oemRef={product.oemRef}
                      imageUrl={product.imageUrl}
                      imageAlt={product.imageAlt}
                      price={product.price}
                      originalPrice={product.originalPrice}
                      discountPercent={product.discountPercent}
                      stockStatus={product.stockStatus}
                      isCompatible={product.isCompatible}
                      onAddToCart={handleAddToCart}
                      onImageClick={handleImageClick}
                      compactMode={true}
                    />
                  ))}
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {/* Footer simple */}
      <footer className="bg-neutral-900 text-white py-xl mt-2xl">
        <div className="max-w-7xl mx-auto px-md text-center">
          <p className="font-sans text-sm text-neutral-400">
            © 2025 Auto Pièces Pro • Démo Intégration E-Commerce
          </p>
          <p className="font-sans text-xs text-neutral-500 mt-sm">
            SmartHeader + AdvancedFilters + ProductCard
          </p>
        </div>
      </footer>
    </div>
  );
}

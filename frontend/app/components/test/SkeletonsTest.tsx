/**
 * 🧪 TEST: Skeleton Components
 * 
 * Visualisation de toutes les variantes de skeleton
 * Pour tester: /test/skeletons
 */

import * as React from "react";
import {
  Skeleton,
  ProductCardSkeleton,
  CartItemSkeleton,
  SearchResultsSkeleton,
  PageSkeleton,
  CardSkeleton,
} from "../ui/skeleton";

export default function SkeletonsTest() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ⏳ Skeleton Loading Components
          </h1>
          <p className="text-gray-600">
            Composants de chargement avec animations fluides (1.5s ease-in-out)
          </p>
        </div>

        {/* 1. Basic Skeleton */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            1. Basic Skeleton
          </h2>
          <div className="bg-white rounded-lg shadow p-6 space-y-3">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
        </section>

        {/* 2. ProductCard Skeleton */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            2. ProductCard Skeleton
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <ProductCardSkeleton />
            <ProductCardSkeleton />
            <ProductCardSkeleton />
            <ProductCardSkeleton />
          </div>
        </section>

        {/* 3. CartItem Skeleton */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            3. CartItem Skeleton
          </h2>
          <div className="bg-white rounded-lg shadow p-4 space-y-3">
            <CartItemSkeleton />
            <CartItemSkeleton />
            <CartItemSkeleton />
          </div>
        </section>

        {/* 4. SearchResults Skeleton */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            4. SearchResults Skeleton (count=6)
          </h2>
          <SearchResultsSkeleton count={6} />
        </section>

        {/* 5. Card Skeleton */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            5. Card Skeleton
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </section>

        {/* 6. Page Skeleton */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            6. Page Skeleton (Full Layout)
          </h2>
          <div className="bg-white rounded-lg shadow p-6">
            <PageSkeleton />
          </div>
        </section>

        {/* 7. Mixed Layout */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            7. Mixed Layout (Realistic Use Case)
          </h2>
          <div className="grid grid-cols-12 gap-6">
            {/* Sidebar */}
            <div className="col-span-12 lg:col-span-3 space-y-4">
              <CardSkeleton />
              <CardSkeleton />
            </div>

            {/* Main Content */}
            <div className="col-span-12 lg:col-span-9 space-y-6">
              {/* Header */}
              <div className="bg-white rounded-lg shadow p-6 space-y-3">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-5 w-1/2" />
              </div>

              {/* Products Grid */}
              <SearchResultsSkeleton count={8} />
            </div>
          </div>
        </section>

        {/* 8. Auto-Reload Demo */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            8. Auto-Reload Demo (Simulated Loading)
          </h2>
          <AutoReloadDemo />
        </section>

        {/* Animation Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            ℹ️ Animation Details
          </h3>
          <ul className="space-y-2 text-blue-800">
            <li>• <strong>Duration:</strong> 1.5s (pulse animation)</li>
            <li>• <strong>Easing:</strong> ease-in-out</li>
            <li>• <strong>Fade-in:</strong> 200ms opacity transition</li>
            <li>• <strong>Colors:</strong> bg-gray-200 (light mode)</li>
            <li>• <strong>Accessibility:</strong> Respects prefers-reduced-motion</li>
          </ul>
        </div>

      </div>
    </div>
  );
}

/**
 * Auto-Reload Demo Component
 * Simule un chargement avec toggle skeleton/contenu
 */
function AutoReloadDemo() {
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setLoading(prev => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {loading ? "⏳ Chargement..." : "✅ Contenu chargé"}
        </h3>
        <button
          onClick={() => setLoading(!loading)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Toggle
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ProductCardSkeleton />
          <ProductCardSkeleton />
          <ProductCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border p-4">
              <img
                src={`https://via.placeholder.com/300?text=Produit+${i}`}
                alt={`Produit ${i}`}
                className="aspect-square rounded-lg mb-3 object-cover"
              />
              <div className="flex gap-2 mb-3">
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                  -15%
                </span>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                  OES
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Produit #{i}
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Description du produit exemple
              </p>
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="text-xl font-bold text-gray-900">
                  {(49.99 * i).toFixed(2)}€
                </span>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  Ajouter
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Import React for hooks
// Removed duplicate import - already at top

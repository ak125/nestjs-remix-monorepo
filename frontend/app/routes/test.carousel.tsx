/**
 * 🎠 Test Page - Carousel & ProductGallery
 * 
 * Exemples de galeries d'images produit avec:
 * - Différents ratios d'aspect
 * - Avec/sans thumbnails
 * - Lightbox zoom
 * - Navigation clavier
 */

import { type MetaFunction } from '@remix-run/node';

import { ProductGallery } from '../components/products/ProductGallery';
import { Separator } from '../components/ui/separator';

export const meta: MetaFunction = () => {
  return [{ title: 'Test Carousel - Product Galleries' }];
};

// Mock images pour les tests
const mockProductImages = [
  {
    id: '1',
    url: 'https://picsum.photos/800/800?random=1',
    thumbnail: 'https://picsum.photos/200/200?random=1',
    alt: 'Vue face du produit',
  },
  {
    id: '2',
    url: 'https://picsum.photos/800/800?random=2',
    thumbnail: 'https://picsum.photos/200/200?random=2',
    alt: 'Vue de côté',
  },
  {
    id: '3',
    url: 'https://picsum.photos/800/800?random=3',
    thumbnail: 'https://picsum.photos/200/200?random=3',
    alt: 'Vue arrière',
  },
  {
    id: '4',
    url: 'https://picsum.photos/800/800?random=4',
    thumbnail: 'https://picsum.photos/200/200?random=4',
    alt: 'Détail texture',
  },
  {
    id: '5',
    url: 'https://picsum.photos/800/800?random=5',
    thumbnail: 'https://picsum.photos/200/200?random=5',
    alt: 'Packaging',
  },
];

const landscapeImages = [
  {
    id: '1',
    url: 'https://picsum.photos/1200/800?random=10',
    thumbnail: 'https://picsum.photos/200/133?random=10',
    alt: 'Paysage 1',
  },
  {
    id: '2',
    url: 'https://picsum.photos/1200/800?random=11',
    thumbnail: 'https://picsum.photos/200/133?random=11',
    alt: 'Paysage 2',
  },
  {
    id: '3',
    url: 'https://picsum.photos/1200/800?random=12',
    thumbnail: 'https://picsum.photos/200/133?random=12',
    alt: 'Paysage 3',
  },
];

const singleImage = [
  {
    id: '1',
    url: 'https://picsum.photos/800/800?random=20',
    alt: 'Image unique',
  },
];

export default function TestCarousel() {
  return (
    <div className="container mx-auto py-12 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">🎠 Carousel & Product Gallery</h1>
        <p className="text-gray-600 text-lg">
          Exemples de galeries d'images produit avec navigation, thumbnails et zoom.
        </p>
      </div>

      {/* Exemple 1: Gallery complète */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-2">Gallery Complète (5 images)</h2>
        <p className="text-gray-600 mb-6">
          Carousel principal + thumbnails + lightbox zoom + indicateurs
        </p>
        
        <div className="grid md:grid-cols-2 gap-8">
          <ProductGallery
            images={mockProductImages}
            productName="Produit Test 1"
            showThumbnails={true}
          />
          
          <div className="space-y-4">
            <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
              <h3 className="font-semibold mb-2">🎯 Features testées:</h3>
              <ul className="space-y-1 text-sm">
                <li>✅ Navigation avec flèches prev/next</li>
                <li>✅ Thumbnails cliquables (synchronisées)</li>
                <li>✅ Indicateur de position (1/5)</li>
                <li>✅ Bouton zoom (hover)</li>
                <li>✅ Lightbox plein écran (clic sur image)</li>
                <li>✅ Navigation clavier (← →)</li>
                <li>✅ Loop infini</li>
              </ul>
            </div>

            <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded">
              <h3 className="font-semibold mb-2">🎨 Design:</h3>
              <ul className="space-y-1 text-sm">
                <li>• Ratio 1:1 (carré) pour produits e-commerce</li>
                <li>• Thumbnails 4 par ligne (mobile → desktop)</li>
                <li>• Border active bleue avec ring</li>
                <li>• Transitions smooth (scale, opacity)</li>
                <li>• Hover effects (zoom button, scale image)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Separator className="my-12" />

      {/* Exemple 2: Format paysage */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-2">Format Paysage (16:9)</h2>
        <p className="text-gray-600 mb-6">
          Images landscape avec thumbnails proportionnels
        </p>
        
        <div className="max-w-3xl">
          <ProductGallery
            images={landscapeImages}
            productName="Paysages"
            showThumbnails={true}
          />
        </div>
      </section>

      <Separator className="my-12" />

      {/* Exemple 3: Sans thumbnails */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-2">Sans Thumbnails</h2>
        <p className="text-gray-600 mb-6">
          Gallery minimaliste sans bande de thumbnails
        </p>
        
        <div className="grid md:grid-cols-2 gap-8">
          <ProductGallery
            images={mockProductImages}
            productName="Produit Minimaliste"
            showThumbnails={false}
          />
          
          <div className="flex items-center">
            <p className="text-gray-600">
              <strong>Cas d'usage:</strong> Quand l'espace est limité ou pour un design épuré.
              Navigation uniquement via les flèches et les indicateurs de position.
            </p>
          </div>
        </div>
      </section>

      <Separator className="my-12" />

      {/* Exemple 4: Image unique */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-2">Image Unique</h2>
        <p className="text-gray-600 mb-6">
          Produit avec une seule image (pas de navigation)
        </p>
        
        <div className="grid md:grid-cols-2 gap-8">
          <ProductGallery
            images={singleImage}
            productName="Produit Simple"
            showThumbnails={true}
          />
          
          <div className="flex items-center">
            <div className="bg-amber-50 border-l-4 border-amber-600 p-4 rounded">
              <h3 className="font-semibold mb-2">⚠️ Comportement:</h3>
              <ul className="space-y-1 text-sm">
                <li>• Pas de flèches de navigation</li>
                <li>• Pas de thumbnails (inutiles)</li>
                <li>• Indicateur 1/1</li>
                <li>• Zoom toujours disponible</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Separator className="my-12" />

      {/* Exemple 5: Empty state */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-2">Empty State</h2>
        <p className="text-gray-600 mb-6">
          Produit sans images (fallback)
        </p>
        
        <div className="grid md:grid-cols-2 gap-8">
          <ProductGallery
            images={[]}
            productName="Produit Sans Images"
            showThumbnails={true}
          />
          
          <div className="flex items-center">
            <p className="text-gray-600">
              Affiche un placeholder gris avec message "Aucune image disponible".
            </p>
          </div>
        </div>
      </section>

      <Separator className="my-12" />

      {/* Instructions */}
      <section className="bg-gray-50 p-8 rounded-lg">
        <h2 className="text-2xl font-bold mb-4">🧪 Tests Interactifs</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-3">Navigation:</h3>
            <ul className="space-y-2 text-sm">
              <li>🖱️ Clic sur prev/next buttons</li>
              <li>🖱️ Clic sur thumbnails</li>
              <li>⌨️ Flèches clavier (← →)</li>
              <li>📱 Swipe sur mobile/tablet</li>
              <li>🔄 Loop infini (dernière → première)</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-3">Zoom & Lightbox:</h3>
            <ul className="space-y-2 text-sm">
              <li>🔍 Hover sur image → bouton zoom visible</li>
              <li>🖱️ Clic sur image → ouvre lightbox</li>
              <li>🖱️ Clic sur bouton zoom → ouvre lightbox</li>
              <li>❌ Clic sur fond noir → ferme lightbox</li>
              <li>❌ Clic sur bouton X → ferme lightbox</li>
              <li>⌨️ Navigation dans lightbox avec ← →</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="font-semibold mb-3">📦 Utilisation dans votre code:</h3>
          <pre className="bg-gray-800 text-gray-100 p-4 rounded text-xs overflow-x-auto">
{`import { ProductGallery } from '~/components/products/ProductGallery';

<ProductGallery
  images={product.images}
  productName={product.name}
  showThumbnails={true}
/>`}
          </pre>
        </div>
      </section>
    </div>
  );
}

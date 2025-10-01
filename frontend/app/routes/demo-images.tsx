/**
 * 🧪 PAGE DE DÉMONSTRATION - IMAGES OPTIMISÉES WEBP
 * 
 * Route: /demo-images
 * 
 * Compare les images originales vs optimisées WebP
 */

import { OptimizedRackImage } from '~/components/OptimizedImage';
import ImageOptimizer from '~/utils/image-optimizer';

export default function DemoImagesPage() {
  // Exemples d'images à tester
  const rackImages = [
    { folder: '13', filename: 'IMG_0001.jpg' },
    { folder: '13', filename: 'IMG_0002.jpg' },
    { folder: '13', filename: 'IMG_0003.jpg' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🖼️ Démonstration Images Optimisées WebP
          </h1>
          <p className="text-xl text-gray-600">
            Comparaison avant/après - Supabase Image Transformation
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-12">
          <StatCard
            icon="🚀"
            label="Réduction de taille"
            value="90%"
            description="500 KB → 50 KB"
            color="blue"
          />
          <StatCard
            icon="⚡"
            label="Plus rapide"
            value="10x"
            description="2s → 200ms"
            color="green"
          />
          <StatCard
            icon="💰"
            label="Économie"
            value="60%"
            description="Bande passante"
            color="yellow"
          />
          <StatCard
            icon="🎯"
            label="Images totales"
            value="2.7M"
            description="Aucun re-upload !"
            color="purple"
          />
        </div>

        {/* Comparison Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">
            📊 Comparaison Visuelle
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Before */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-red-600">❌ Avant (Original JPG)</h3>
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                  ~500 KB
                </span>
              </div>
              <div className="border-4 border-red-200 rounded-lg overflow-hidden">
                <img
                  src={ImageOptimizer.getOriginalUrl('rack-images/13/IMG_0001.jpg')}
                  alt="Original"
                  className="w-full h-64 object-cover"
                />
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Format: JPG/PNG</li>
                <li>• Temps de chargement: ~2-3s</li>
                <li>• Non optimisé</li>
              </ul>
            </div>

            {/* After */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-green-600">✅ Après (WebP Optimisé)</h3>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  ~50 KB
                </span>
              </div>
              <div className="border-4 border-green-200 rounded-lg overflow-hidden">
                <OptimizedRackImage
                  folder="13"
                  filename="IMG_0001.jpg"
                  alt="Optimisé WebP"
                  preset="hero"
                  className="w-full h-64 object-cover"
                />
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Format: WebP</li>
                <li>• Temps de chargement: ~200-300ms</li>
                <li>• Optimisé automatiquement</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Gallery Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">
            🎨 Galerie Images Rack (WebP)
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {rackImages.map((img, index) => (
              <div key={index} className="space-y-2">
                <div className="rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                  <OptimizedRackImage
                    folder={img.folder}
                    filename={img.filename}
                    alt={`Image ${index + 1}`}
                    preset="card"
                    className="w-full h-48 object-cover"
                  />
                </div>
                <p className="text-sm text-gray-500 text-center">
                  {img.folder}/{img.filename}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Presets Demo */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">
            🎯 Presets Disponibles
          </h2>

          <div className="grid md:grid-cols-4 gap-6">
            <PresetDemo
              preset="thumbnail"
              title="Thumbnail"
              description="150×150, 80% qualité"
              folder="13"
              filename="IMG_0001.jpg"
            />
            <PresetDemo
              preset="card"
              title="Card"
              description="300×200, 85% qualité"
              folder="13"
              filename="IMG_0001.jpg"
            />
            <PresetDemo
              preset="hero"
              title="Hero"
              description="800×600, 90% qualité"
              folder="13"
              filename="IMG_0001.jpg"
            />
            <PresetDemo
              preset="full"
              title="Full"
              description="1600×1200, 95% qualité"
              folder="13"
              filename="IMG_0001.jpg"
            />
          </div>
        </div>

        {/* Technical Details */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg p-8 text-white">
          <h2 className="text-2xl font-bold mb-6">🔧 Détails Techniques</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <span className="mr-2">❌</span> URL Avant
              </h3>
              <code className="block bg-black bg-opacity-20 p-3 rounded text-xs break-all">
                {ImageOptimizer.getOriginalUrl('rack-images/13/IMG_0001.jpg')}
              </code>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <span className="mr-2">✅</span> URL Après
              </h3>
              <code className="block bg-black bg-opacity-20 p-3 rounded text-xs break-all">
                {ImageOptimizer.getOptimizedUrl('rack-images/13/IMG_0001.jpg', { width: 800 })}
              </code>
            </div>
          </div>

          <div className="mt-6 grid md:grid-cols-3 gap-4">
            <TechCard
              icon="🔄"
              title="Transformation"
              value="Automatique"
            />
            <TechCard
              icon="📦"
              title="Format"
              value="WebP"
            />
            <TechCard
              icon="⚙️"
              title="Re-upload requis"
              value="Aucun"
            />
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-12 text-center">
          <div className="inline-block bg-white rounded-xl shadow-lg p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              🎉 Prêt à optimiser votre site ?
            </h3>
            <p className="text-gray-600 mb-6">
              Consultez le guide complet d'implémentation
            </p>
            <a
              href="/OPTIMISATION_IMAGES_WEBP_GUIDE.md"
              target="_blank"
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              📖 Voir le Guide Complet
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// Component helpers
function StatCard({ icon, label, value, description, color }: {
  icon: string;
  label: string;
  value: string;
  description: string;
  color: 'blue' | 'green' | 'yellow' | 'purple';
}) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    yellow: 'from-yellow-500 to-yellow-600',
    purple: 'from-purple-500 to-purple-600',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-lg p-6 text-white shadow-lg`}>
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-sm opacity-90 mb-1">{label}</div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-xs opacity-80">{description}</div>
    </div>
  );
}

function PresetDemo({ preset, title, description, folder, filename }: {
  preset: 'thumbnail' | 'card' | 'hero' | 'full';
  title: string;
  description: string;
  folder: string;
  filename: string;
}) {
  return (
    <div className="text-center">
      <div className="mb-3">
        <OptimizedRackImage
          folder={folder}
          filename={filename}
          alt={title}
          preset={preset}
          className="w-full rounded-lg shadow-md"
        />
      </div>
      <h4 className="font-semibold text-gray-800">{title}</h4>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}

function TechCard({ icon, title, value }: {
  icon: string;
  title: string;
  value: string;
}) {
  return (
    <div className="bg-white bg-opacity-10 rounded-lg p-4 text-center">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-sm opacity-90">{title}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}

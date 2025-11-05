import { 
  Button, 
  ConversionCTA, 
  UrgentCTA, 
  MobileCTA, 
  SecondaryCTA, 
  GhostCTA 
} from '@fafa/ui';
import { type MetaFunction } from '@remix-run/node';
import { ShoppingCart, Heart, Package, ArrowRight, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export const meta: MetaFunction = () => {
  return [
    { title: 'Test Button Unifié - @fafa/ui' },
    { name: 'description', content: 'Page de test pour le composant Button unifié' },
  ];
};

export default function TestButtonPage() {
  const [cart, setCart] = useState<string[]>([]);

  const handleAddToCart = async (productName: string) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setCart([...cart, productName]);
  };

  const handleCheckout = async () => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success(`Commande de ${cart.length} articles confirmée !`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            ✅ Test Button Unifié @fafa/ui
          </h1>
          <p className="text-lg text-gray-600">
            Validation de toutes les fonctionnalités du nouveau Button
          </p>
          {cart.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg inline-block">
              <p className="text-sm text-blue-800">
                🛒 Panier : {cart.length} article(s)
              </p>
            </div>
          )}
        </div>

        {/* Section 1: Tous les Intents */}
        <section className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">
            1️⃣ Tous les Intents (10 variants)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button intent="primary" size="md">Primary</Button>
            <Button intent="accent" size="md">Accent</Button>
            <Button intent="secondary" size="md">Secondary</Button>
            <Button intent="success" size="md">Success</Button>
            <Button intent="danger" size="md">Danger</Button>
            <Button intent="ghost" size="md">Ghost</Button>
            <Button intent="outline" size="md">Outline</Button>
            <Button intent="link" size="md">Link</Button>
            <Button intent="conversion" size="md">Conversion ⭐</Button>
            <Button intent="urgent" size="md">Urgent ⭐</Button>
          </div>
        </section>

        {/* Section 2: Toutes les Sizes */}
        <section className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">
            2️⃣ Toutes les Sizes (7 tailles)
          </h2>
          <div className="flex flex-wrap items-end gap-4">
            <Button size="xs">XS (28px)</Button>
            <Button size="sm">SM (32px)</Button>
            <Button size="md">MD (40px)</Button>
            <Button size="lg">LG (48px)</Button>
            <Button size="xl">XL (56px)</Button>
            <Button size="hero">HERO (64px) ⭐</Button>
            <Button size="icon">
              <ShoppingCart className="w-5 h-5" />
            </Button>
          </div>
        </section>

        {/* Section 3: Variantes Pré-configurées */}
        <section className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">
            3️⃣ Variantes Pré-configurées
          </h2>
          <div className="space-y-4">
            <ConversionCTA
              trackingLabel="test_conversion_cta"
              trackingData={{ page: 'test', position: 'section-3' }}
              onClick={() => handleAddToCart('Pièce Premium')}
              iconLeft={<ShoppingCart />}
            >
              ConversionCTA - Ajouter au panier 89,99 €
            </ConversionCTA>

            <UrgentCTA
              trackingLabel="test_urgent_cta"
              onClick={handleCheckout}
            >
              🔥 UrgentCTA - Plus que 2 pièces en stock !
            </UrgentCTA>

            <MobileCTA
              onClick={() => handleAddToCart('Pièce Mobile')}
            >
              MobileCTA - Commander (pleine largeur mobile)
            </MobileCTA>

            <SecondaryCTA iconRight={<ArrowRight />}>
              SecondaryCTA - En savoir plus
            </SecondaryCTA>

            <GhostCTA>
              GhostCTA - Annuler
            </GhostCTA>
          </div>
        </section>

        {/* Section 4: Analytics Tracking */}
        <section className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">
            4️⃣ Analytics Tracking
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Ouvrez la Console DevTools pour voir les événements gtag
          </p>
          <div className="flex flex-wrap gap-4">
            <Button
              intent="conversion"
              trackingLabel="add_to_cart_test"
              trackingData={{
                product_id: 'TEST-12345',
                price: 89.99,
                category: 'test'
              }}
              onClick={() => console.log('CTA cliqué avec tracking')}
            >
              CTA avec Analytics
            </Button>
          </div>
        </section>

        {/* Section 5: Animations */}
        <section className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">
            5️⃣ Animations (Success + Loading)
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                ✅ Success Animation (2s)
              </p>
              <Button
                intent="success"
                showSuccessAnimation
                onClick={() => handleAddToCart('Pièce avec animation')}
              >
                Ajouter avec animation succès
              </Button>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-2">
                🔄 Loading State (async)
              </p>
              <Button
                intent="primary"
                onClick={async () => {
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  toast.success('Action complétée !');
                }}
              >
                Action async (2s loading)
              </Button>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-2">
                🔄 isLoading manuel
              </p>
              <Button
                intent="primary"
                isLoading
                loadingText="Traitement en cours..."
              >
                Loading manuel
              </Button>
            </div>
          </div>
        </section>

        {/* Section 6: Icons */}
        <section className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">
            6️⃣ Icons Support
          </h2>
          <div className="flex flex-wrap gap-4">
            <Button
              iconLeft={<ShoppingCart />}
            >
              Icon Left
            </Button>

            <Button
              iconRight={<ArrowRight />}
            >
              Icon Right
            </Button>

            <Button
              iconLeft={<Package />}
              iconRight={<ArrowRight />}
            >
              Both Icons
            </Button>

            <Button
              intent="danger"
              iconLeft={<Trash2 />}
            >
              Supprimer
            </Button>

            <Button
              intent="ghost"
              iconLeft={<Heart />}
            >
              Favoris
            </Button>
          </div>
        </section>

        {/* Section 7: Breathing + FullWidthMobile */}
        <section className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">
            7️⃣ Breathing + FullWidthMobile
          </h2>
          
          <div className="space-y-8">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                🌬️ Breathing (my-6 mx-auto)
              </p>
              <Button
                intent="conversion"
                breathing
              >
                Bouton avec breathing (+15% conversion)
              </Button>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-2">
                📱 FullWidthMobile (w-full md:w-auto)
              </p>
              <Button
                intent="primary"
                fullWidthMobile
              >
                Pleine largeur sur mobile
              </Button>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-2">
                🎯 Breathing + FullWidthMobile
              </p>
              <Button
                intent="conversion"
                breathing
                fullWidthMobile
              >
                Les deux combinés
              </Button>
            </div>
          </div>
        </section>

        {/* Section 8: Scénario E-commerce Complet */}
        <section className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">
            8️⃣ Scénario E-commerce Complet
          </h2>
          
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                <Package className="w-12 h-12 text-gray-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Filtre à huile Bosch F026407006
                </h3>
                <p className="text-sm text-gray-600">
                  Référence OEM : F026407006
                </p>
                <p className="text-2xl font-bold text-blue-600 mt-2">
                  89,99 €
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <ConversionCTA
                trackingLabel="add_to_cart_pdp"
                trackingData={{
                  product_id: 'F026407006',
                  price: 89.99,
                  brand: 'Bosch'
                }}
                onClick={() => handleAddToCart('Filtre à huile Bosch')}
                iconLeft={<ShoppingCart />}
              >
                Ajouter au panier - 89,99 €
              </ConversionCTA>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  intent="secondary"
                  iconLeft={<Heart />}
                  onClick={() => toast.success('Ajouté aux favoris')}
                >
                  Favoris
                </Button>

                <Button
                  intent="ghost"
                  iconRight={<ArrowRight />}
                >
                  Comparer
                </Button>
              </div>
            </div>
          </div>

          {cart.length > 0 && (
            <div className="mt-6">
              <UrgentCTA
                onClick={handleCheckout}
              >
                🔥 Commander maintenant ({cart.length} article{cart.length > 1 ? 's' : ''})
              </UrgentCTA>
            </div>
          )}
        </section>

        {/* Footer Tests */}
        <div className="text-center text-sm text-gray-500 space-y-2">
          <p>✅ Phase 1 : Button Unification - Complétée</p>
          <p>📦 Package : @fafa/ui@2.0.0</p>
          <p>🎯 10 intents • 7 sizes • Analytics • Animations • Mobile-first</p>
        </div>

      </div>
    </div>
  );
}

/**
 * 🎉 DEMO SONNER - Notifications Modernes
 * 
 * Page de test pour visualiser Sonner
 * Route: /test/sonner
 */

import { Link } from "@remix-run/react";
import { ShoppingCart, CheckCircle2, AlertTriangle, XCircle, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SonnerDemo() {
  
  // Différents types de notifications
  const showSuccess = () => {
    toast.success("Produit ajouté au panier", {
      description: "Plaquettes de frein avant x2",
      action: {
        label: "Voir panier",
        onClick: () => console.log("Navigation vers panier"),
      },
    });
  };

  const showError = () => {
    toast.error("Stock insuffisant", {
      description: "Il ne reste que 2 unités en stock",
    });
  };

  const showWarning = () => {
    toast.warning("Stock faible", {
      description: "Plus que 3 unités disponibles",
    });
  };

  const showInfo = () => {
    toast.info("Livraison gratuite", {
      description: "Pour toute commande supérieure à 50€",
    });
  };

  const showPromise = () => {
    const promise = new Promise((resolve) => {
      setTimeout(() => resolve({ name: "Plaquettes de frein" }), 2000);
    });

    toast.promise(promise, {
      loading: "Ajout au panier en cours...",
      success: (data: any) => `${data.name} ajouté au panier !`,
      error: "Erreur lors de l'ajout",
    });
  };

  const showCustom = () => {
    toast.custom((t) => (
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-lg shadow-lg">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6" />
          <div>
            <div className="font-bold">Notification personnalisée</div>
            <div className="text-sm opacity-90">Avec style custom !</div>
          </div>
          <button
            onClick={() => toast.dismiss(t)}
            className="ml-auto bg-white/20 hover:bg-white/30 rounded p-1"
          >
            ✕
          </button>
        </div>
      </div>
    ));
  };

  const showWithAction = () => {
    toast.success("Commande validée", {
      description: "Commande #12345 - Total: 149.99€",
      action: {
        label: "Suivre",
        onClick: () => console.log("Suivi commande"),
      },
      cancel: {
        label: "Annuler",
        onClick: () => console.log("Annulation"),
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <Link to="/admin" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
          ← Retour
        </Link>
        <h1 className="text-4xl font-bold mb-2">🎉 Sonner - Notifications Modernes</h1>
        <p className="text-gray-600">
          Remplace react-hot-toast avec des notifications plus élégantes et fonctionnelles
        </p>
      </div>

      {/* Comparaison */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">❌</span>
            <h3 className="font-bold text-red-700">react-hot-toast</h3>
          </div>
          <ul className="text-sm text-red-800 space-y-1">
            <li>• Notifications basiques</li>
            <li>• Pas d'actions intégrées</li>
            <li>• Style limité</li>
            <li>• Moins accessible</li>
          </ul>
        </div>

        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">✅</span>
            <h3 className="font-bold text-green-700">Sonner</h3>
          </div>
          <ul className="text-sm text-green-800 space-y-1">
            <li>✅ Notifications riches</li>
            <li>✅ Boutons d'action intégrés</li>
            <li>✅ Hautement customisable</li>
            <li>✅ Accessible (ARIA)</li>
            <li>✅ Promise support</li>
          </ul>
        </div>
      </div>

      {/* Types de notifications */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-2xl font-bold mb-6">Types de Notifications</h2>
        <div className="grid md:grid-cols-2 gap-4">
          
          {/* Success */}
          <button
            onClick={showSuccess}
            className="flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 border-2 border-green-200 rounded-lg transition-colors text-left"
          >
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div>
              <div className="font-bold text-green-900">Success</div>
              <div className="text-sm text-green-700">Avec action "Voir panier"</div>
            </div>
          </button>

          {/* Error */}
          <button
            onClick={showError}
            className="flex items-center gap-3 p-4 bg-red-50 hover:bg-red-100 border-2 border-red-200 rounded-lg transition-colors text-left"
          >
            <XCircle className="h-8 w-8 text-red-600" />
            <div>
              <div className="font-bold text-red-900">Error</div>
              <div className="text-sm text-red-700">Stock insuffisant</div>
            </div>
          </button>

          {/* Warning */}
          <button
            onClick={showWarning}
            className="flex items-center gap-3 p-4 bg-yellow-50 hover:bg-yellow-100 border-2 border-yellow-200 rounded-lg transition-colors text-left"
          >
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <div>
              <div className="font-bold text-yellow-900">Warning</div>
              <div className="text-sm text-yellow-700">Stock faible</div>
            </div>
          </button>

          {/* Info */}
          <button
            onClick={showInfo}
            className="flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-lg transition-colors text-left"
          >
            <Info className="h-8 w-8 text-blue-600" />
            <div>
              <div className="font-bold text-blue-900">Info</div>
              <div className="text-sm text-blue-700">Livraison gratuite</div>
            </div>
          </button>

          {/* Promise */}
          <button
            onClick={showPromise}
            className="flex items-center gap-3 p-4 bg-purple-50 hover:bg-purple-100 border-2 border-purple-200 rounded-lg transition-colors text-left"
          >
            <Loader2 className="h-8 w-8 text-purple-600" />
            <div>
              <div className="font-bold text-purple-900">Promise</div>
              <div className="text-sm text-purple-700">Loading → Success</div>
            </div>
          </button>

          {/* Custom */}
          <button
            onClick={showCustom}
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border-2 border-purple-200 rounded-lg transition-colors text-left"
          >
            <ShoppingCart className="h-8 w-8 text-purple-600" />
            <div>
              <div className="font-bold text-purple-900">Custom</div>
              <div className="text-sm text-purple-700">Style personnalisé</div>
            </div>
          </button>
        </div>
      </div>

      {/* Features avancées */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-2xl font-bold mb-6">Features Avancées</h2>
        <div className="space-y-3">
          
          <button
            onClick={showWithAction}
            className="w-full p-4 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-lg text-left transition-colors"
          >
            <div className="font-bold text-blue-900 mb-1">Notification avec Actions</div>
            <div className="text-sm text-blue-700">Boutons "Suivre" et "Annuler"</div>
          </button>

          <button
            onClick={() => {
              toast.success("Multiple notifications", { description: "1/3" });
              setTimeout(() => toast.success("Notification 2", { description: "2/3" }), 300);
              setTimeout(() => toast.success("Notification 3", { description: "3/3" }), 600);
            }}
            className="w-full p-4 bg-green-50 hover:bg-green-100 border-2 border-green-200 rounded-lg text-left transition-colors"
          >
            <div className="font-bold text-green-900 mb-1">Notifications Multiples</div>
            <div className="text-sm text-green-700">Stack automatique</div>
          </button>

          <button
            onClick={() => {
              toast("Notification persistante", {
                description: "Ne disparaît pas automatiquement",
                duration: Infinity,
                action: {
                  label: "Fermer",
                  onClick: () => {},
                },
              });
            }}
            className="w-full p-4 bg-yellow-50 hover:bg-yellow-100 border-2 border-yellow-200 rounded-lg text-left transition-colors"
          >
            <div className="font-bold text-yellow-900 mb-1">Persistante</div>
            <div className="text-sm text-yellow-700">Doit être fermée manuellement</div>
          </button>
        </div>
      </div>

      {/* Code Examples */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">💻 Code Exemples</h2>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Success simple :</p>
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`toast.success("Produit ajouté au panier")`}
            </pre>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Avec description et action :</p>
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`toast.success("Produit ajouté", {
  description: "Plaquettes de frein x2",
  action: {
    label: "Voir panier",
    onClick: () => navigate('/cart')
  }
})`}
            </pre>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Promise (loading → success) :</p>
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`const promise = addToCart(product)

toast.promise(promise, {
  loading: 'Ajout en cours...',
  success: 'Ajouté !',
  error: 'Erreur'
})`}
            </pre>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-3">🚀 Prochaines Étapes</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>Remplacer <code className="bg-white px-2 py-1 rounded">react-hot-toast</code> dans admin.orders</li>
          <li>Tester sur mobile (swipe to dismiss)</li>
          <li>Personnaliser les couleurs avec vos design tokens</li>
          <li>Ajouter dans tous les formulaires</li>
        </ol>
      </div>
    </div>
  );
}

// app/routes/cart-service.tsx
// Service de gestion du panier optimisé appliquant "vérifier existant et utiliser le meilleur"

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useActionData, Form, useNavigation } from '@remix-run/react';
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Check,
  AlertCircle,
  Package,
  CreditCard,
  Truck
} from 'lucide-react';
import { getOptionalUser } from '../auth/unified.server';

// Interfaces TypeScript pour le panier
interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  availability: 'in_stock' | 'low_stock' | 'out_of_stock';
}

interface CartData {
  items: CartItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  itemCount: number;
}

// Loader pour récupérer les données du panier
export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await getOptionalUser({ context });
  
  // En production, récupérer le vrai panier depuis l'API
  const cartData: CartData = {
    items: [
      {
        id: 'cart-1',
        productId: 'prod-123',
        name: 'Plaquettes de frein avant',
        price: 89.99,
        quantity: 2,
        image: '/images/brake-pads.jpg',
        availability: 'in_stock'
      },
      {
        id: 'cart-2',
        productId: 'prod-456',
        name: 'Huile moteur 5W-30',
        price: 24.50,
        quantity: 1,
        image: '/images/engine-oil.jpg',
        availability: 'low_stock'
      },
      {
        id: 'cart-3',
        productId: 'prod-789',
        name: 'Filtre à air',
        price: 15.75,
        quantity: 1,
        image: '/images/air-filter.jpg',
        availability: 'out_of_stock'
      }
    ],
    subtotal: 220.23,
    shipping: 9.90,
    tax: 46.05,
    total: 276.18,
    itemCount: 4
  };

  return json({ user, cartData });
}

// Action pour gérer les modifications du panier
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionType = formData.get('actionType') as string;
  const itemId = formData.get('itemId') as string;
  const _quantity = parseInt(formData.get('quantity') as string);

  try {
    switch (actionType) {
      case 'updateQuantity':
        // En production, mettre à jour via API
        return json({ 
          success: true, 
          message: `Quantité mise à jour pour l'article ${itemId}` 
        });
        
      case 'removeItem':
        // En production, supprimer via API
        return json({ 
          success: true, 
          message: `Article ${itemId} supprimé du panier` 
        });
        
      case 'clearCart':
        // En production, vider le panier via API
        return json({ 
          success: true, 
          message: 'Panier vidé avec succès' 
        });
        
      default:
        return json({ 
          success: false, 
          error: 'Action non reconnue' 
        }, { status: 400 });
    }
  } catch (error) {
    return json({ 
      success: false, 
      error: 'Erreur lors de la mise à jour du panier' 
    }, { status: 500 });
  }
}

export default function CartService() {
  const { cartData } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  
  const isSubmitting = navigation.state === 'submitting';

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  };

  const getAvailabilityBadge = (availability: CartItem['availability']) => {
    const styles = {
      in_stock: 'bg-green-100 text-green-800',
      low_stock: 'bg-orange-100 text-orange-800',
      out_of_stock: 'bg-red-100 text-red-800'
    };
    
    const labels = {
      in_stock: 'En stock',
      low_stock: 'Stock limité',
      out_of_stock: 'Rupture'
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[availability]}`}>
        {labels[availability]}
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-8 text-white mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ShoppingCart className="h-12 w-12" />
            <div>
              <h1 className="text-4xl font-bold">Mon Panier</h1>
              <p className="text-blue-100 text-lg mt-1">
                {cartData.itemCount} article{cartData.itemCount > 1 ? 's' : ''} dans votre panier
              </p>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur px-6 py-3 rounded-lg">
            <div className="text-2xl font-bold">
              {formatPrice(cartData.total)}
            </div>
            <div className="text-sm text-blue-100 mt-1">
              Total TTC
            </div>
          </div>
        </div>
      </div>

      {/* Messages de feedback */}
      {actionData && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          actionData.success 
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {actionData.success ? (
            <Check className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span>
            {actionData.success 
              ? ('message' in actionData ? actionData.message : 'Opération réussie')
              : ('error' in actionData ? actionData.error : 'Une erreur est survenue')
            }
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Articles du panier */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-lg">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Package className="h-5 w-5" />
                Articles ({cartData.itemCount})
              </h2>
            </div>
            
            <div className="divide-y divide-gray-200">
              {cartData.items.map((item) => (
                <div key={item.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <img 
                        src={item.image || '/images/placeholder.jpg'} 
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <div>
                        <h3 className="font-medium text-gray-900">{item.name}</h3>
                        <p className="text-sm text-gray-500">Réf: {item.productId}</p>
                        <div className="mt-1">
                          {getAvailabilityBadge(item.availability)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      {/* Contrôles de quantité */}
                      <Form method="post" className="flex items-center space-x-2">
                        <input type="hidden" name="actionType" value="updateQuantity" />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="quantity" value={(item.quantity - 1).toString()} />
                        <button 
                          type="submit"
                          disabled={isSubmitting || item.quantity <= 1}
                          className="p-1 rounded-full border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        
                        <input type="hidden" name="quantity" value={(item.quantity + 1).toString()} />
                        <button 
                          type="submit"
                          disabled={isSubmitting || item.availability === 'out_of_stock'}
                          className="p-1 rounded-full border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </Form>
                      
                      {/* Prix */}
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatPrice(item.price)} / unité
                        </p>
                      </div>
                      
                      {/* Supprimer */}
                      <Form method="post">
                        <input type="hidden" name="actionType" value="removeItem" />
                        <input type="hidden" name="itemId" value={item.id} />
                        <button 
                          type="submit"
                          disabled={isSubmitting}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </Form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Résumé de commande */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-lg p-6 sticky top-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Résumé</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Sous-total</span>
                <span className="font-medium">{formatPrice(cartData.subtotal)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600 flex items-center gap-1">
                  <Truck className="h-4 w-4" />
                  Livraison
                </span>
                <span className="font-medium">{formatPrice(cartData.shipping)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">TVA</span>
                <span className="font-medium">{formatPrice(cartData.tax)}</span>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex justify-between">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-lg font-bold text-blue-600">
                    {formatPrice(cartData.total)}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="mt-8 space-y-3">
              <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                <CreditCard className="h-5 w-5" />
                Procéder au paiement
              </button>
              
              <Form method="post">
                <input type="hidden" name="actionType" value="clearCart" />
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Vider le panier
                </button>
              </Form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
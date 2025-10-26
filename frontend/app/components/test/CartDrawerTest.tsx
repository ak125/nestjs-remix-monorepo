/**
 * 🧪 TEST COMPONENT - CartDrawer Features
 * 
 * Composant de test pour démontrer :
 * - 🚚 Seuil franco avec barre de progression
 * - 📦 ETA livraison estimée
 * - 🎁 Upsell produits recommandés
 */

import { useState } from 'react';
import { CartSidebar } from '../navbar/CartSidebar';
import { Button } from '../ui/button';

interface MockCartItem {
  id: string;
  product_name: string;
  product_ref: string;
  product_brand?: string;
  product_image?: string;
  quantity: number;
  price: number;
  unit_price?: number;
  has_consigne?: boolean;
  consigne_unit?: number;
}

export function CartDrawerTest() {
  const [isOpen, setIsOpen] = useState(false);
  const [mockItems, setMockItems] = useState<MockCartItem[]>([
    {
      id: '1',
      product_name: 'Filtre à huile BOSCH',
      product_ref: 'FO-123-BOSCH',
      product_brand: 'BOSCH',
      product_image: 'https://via.placeholder.com/200',
      quantity: 2,
      price: 12.90,
      unit_price: 12.90,
      has_consigne: false,
    },
    {
      id: '2',
      product_name: 'Kit de distribution GATES',
      product_ref: 'KD-456-GATES',
      product_brand: 'GATES',
      product_image: 'https://via.placeholder.com/200',
      quantity: 1,
      price: 89.50,
      unit_price: 89.50,
      has_consigne: true,
      consigne_unit: 15.00,
    },
  ]);

  const calculateSubtotal = () => {
    return mockItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const calculateConsigneTotal = () => {
    return mockItems.reduce((sum, item) => {
      if (item.has_consigne && item.consigne_unit) {
        return sum + item.consigne_unit * item.quantity;
      }
      return sum;
    }, 0);
  };

  const subtotal = calculateSubtotal();
  const consigneTotal = calculateConsigneTotal();
  const shippingCost = subtotal >= 150 ? 0 : 15.90;
  const total = subtotal + consigneTotal + shippingCost;

  const mockSummary = {
    total_items: mockItems.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    consigne_total: consigneTotal,
    shipping_cost: shippingCost,
    total_price: total,
    discount_amount: 0,
    tax_amount: total * 0.2,
  };

  // Actions mock
  const addTestItem = () => {
    const newItem: MockCartItem = {
      id: `item-${Date.now()}`,
      product_name: 'Bougies d\'allumage NGK (x4)',
      product_ref: `BG-${Math.random().toString(36).substring(7)}`,
      product_brand: 'NGK',
      product_image: 'https://via.placeholder.com/200',
      quantity: 1,
      price: 24.50,
      unit_price: 24.50,
      has_consigne: false,
    };
    setMockItems([...mockItems, newItem]);
  };

  const removeItem = (itemId: string) => {
    setMockItems(mockItems.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeItem(itemId);
      return;
    }
    setMockItems(mockItems.map(item => 
      item.id === itemId ? { ...item, quantity: newQuantity } : item
    ));
  };

  const clearCart = () => {
    setMockItems([]);
  };

  return (
    <div className="p-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 Test CartDrawer Features
          </h1>
          <p className="text-gray-600">
            Démonstration des nouvelles fonctionnalités : Seuil franco, ETA livraison, Upsell
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Sous-total</div>
            <div className="text-2xl font-bold text-gray-900">
              {subtotal.toFixed(2)}€
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {mockItems.length} article(s)
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Progression Franco</div>
            <div className="text-2xl font-bold text-green-600">
              {Math.round((subtotal / 150) * 100)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {subtotal >= 150 ? '✅ Atteint !' : `Plus que ${(150 - subtotal).toFixed(2)}€`}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">ETA Livraison</div>
            <div className="text-2xl font-bold text-blue-600">
              {subtotal >= 150 ? '2-3j' : '3-5j'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              jours ouvrés
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Actions de Test</h2>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setIsOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              🛒 Ouvrir le panier ({mockSummary.total_items})
            </Button>
            
            <Button onClick={addTestItem} variant="outline">
              ➕ Ajouter un article
            </Button>
            
            <Button onClick={clearCart} variant="outline" className="text-red-600 border-red-600">
              🗑️ Vider le panier
            </Button>
          </div>
        </div>

        {/* Scénarios de test */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📋 Scénarios de Test</h2>
          <div className="space-y-3">
            <TestScenario
              title="Test Seuil Franco (< 150€)"
              description="Vérifier l'affichage de la barre de progression et du message"
              action={() => setMockItems([
                { id: '1', product_name: 'Test Item', product_ref: 'T-1', quantity: 1, price: 49.90, unit_price: 49.90 }
              ])}
              status={subtotal < 150 ? '✅ Actif' : '⏸️ Inactif'}
            />
            
            <TestScenario
              title="Test Seuil Franco (≥ 150€)"
              description="Vérifier le message de félicitation livraison gratuite"
              action={() => setMockItems([
                { id: '1', product_name: 'Test Item', product_ref: 'T-1', quantity: 2, price: 80.00, unit_price: 80.00 }
              ])}
              status={subtotal >= 150 ? '✅ Actif' : '⏸️ Inactif'}
            />
            
            <TestScenario
              title="Test ETA Livraison"
              description="Vérifier que l'ETA change selon le montant (2-3j si ≥150€, 3-5j sinon)"
              action={() => {}}
              status={`📦 ${subtotal >= 150 ? '2-3 jours' : '3-5 jours'}`}
            />
            
            <TestScenario
              title="Test Upsell (< 5 articles)"
              description="Vérifier l'affichage des recommandations si panier < 5 articles"
              action={() => setMockItems([
                { id: '1', product_name: 'Test Item 1', product_ref: 'T-1', quantity: 1, price: 29.90, unit_price: 29.90 },
                { id: '2', product_name: 'Test Item 2', product_ref: 'T-2', quantity: 1, price: 39.90, unit_price: 39.90 },
              ])}
              status={mockSummary.total_items < 5 ? '✅ Affiché' : '❌ Masqué'}
            />
          </div>
        </div>

        {/* Current Cart Items */}
        <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📦 Articles actuels</h2>
          {mockItems.length === 0 ? (
            <p className="text-gray-500 italic">Panier vide</p>
          ) : (
            <div className="space-y-2">
              {mockItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{item.product_name}</div>
                    <div className="text-sm text-gray-600">
                      Réf: {item.product_ref} • Qté: {item.quantity} • {item.price.toFixed(2)}€
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      −
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      +
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-red-600"
                      onClick={() => removeItem(item.id)}
                    >
                      🗑️
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CartSidebar */}
      <CartSidebar 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </div>
  );
}

interface TestScenarioProps {
  title: string;
  description: string;
  action: () => void;
  status: string;
}

function TestScenario({ title, description, action, status }: TestScenarioProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex-1">
        <div className="font-medium text-gray-900">{title}</div>
        <div className="text-sm text-gray-600">{description}</div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold px-3 py-1 bg-white rounded-full border">
          {status}
        </span>
        <Button size="sm" variant="outline" onClick={action}>
          Tester
        </Button>
      </div>
    </div>
  );
}

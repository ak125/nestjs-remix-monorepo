import { Badge } from "@fafa/ui";
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { Button } from '~/components/ui/button';
import { useLoaderData, useActionData, Form, useNavigation } from '@remix-run/react';
import { useState, useEffect } from 'react';

// Types pour le stock - adapté aux données working-stock
interface StockItem {
  pri_piece_id: string;
  pri_ref: string;
  pri_des: string;
  pri_dispo: string;
  pri_vente_ttc: string;
  pri_marge: string;
  // Champs calculés pour compatibilité
  id?: string;
  quantity?: number;
  available?: number;
  reserved?: number;
  min_stock?: number;
  max_stock?: number;
}

interface StockDashboard {
  statistics: {
    totalProducts: number;
    outOfStock: number;
    lowStock: number;
    overstock: number;
  };
  recentMovements: any[];
  alerts: any[];
  topProducts: any[];
  lastUpdated: string;
}

interface StockFilters {
  search?: string;
  location?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
  page?: number;
  limit?: number;
}

// Loader pour charger les données
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  
  // Récupérer les filtres de l'URL
  const filters: StockFilters = {
    search: searchParams.get('search') || undefined,
    location: searchParams.get('location') || undefined,
    lowStock: searchParams.get('lowStock') === 'true',
    outOfStock: searchParams.get('outOfStock') === 'true',
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '50'),
  };

  try {
    // Appel à la nouvelle API consolidée
    const baseUrl = process.env.API_URL || 'http://localhost:3000';
    
    // Dashboard et stats
    const statsResponse = await fetch(`${baseUrl}/api/admin/stock/stats`);
    
    const statsData = statsResponse.ok ? await statsResponse.json() : null;
    
    // Construire le dashboard dans le bon format
    const dashboard: StockDashboard = {
      statistics: {
        totalProducts: statsData?.data?.totalItems || 0,
        outOfStock: statsData?.data?.unavailableItems || 0,
        lowStock: statsData?.data?.lowStockItems || 0,
        overstock: 0, // Non disponible dans working-stock
      },
      recentMovements: [],
      alerts: [],
      topProducts: [],
      lastUpdated: new Date().toISOString(),
    };

    // Stock avec filtres - utiliser search si on a une recherche
    let stockParams = new URLSearchParams();
    if (filters.search) {
      stockParams.append('search', filters.search);
    }
    if (filters.page) stockParams.append('page', filters.page.toString());
    if (filters.limit) stockParams.append('limit', filters.limit.toString());

    const stockEndpoint = filters.search 
      ? `${baseUrl}/api/admin/stock/search?${stockParams}`
      : `${baseUrl}/api/admin/stock/dashboard?${stockParams}`;
    
    const stockResponse = await fetch(stockEndpoint);
    const stockResponseData = stockResponse.ok ? await stockResponse.json() : null;
    
    // Adapter les données au format attendu
    const stockData = {
      items: stockResponseData?.data?.items || stockResponseData?.data || [],
      total: stockResponseData?.data?.total || stockResponseData?.data?.length || 0,
      stats: statsData?.data || {},
    };

    return json({
      dashboard,
      stockData,
      filters,
      success: true,
    });
  } catch (error) {
    console.error('Erreur chargement stock:', error);
    return json({
      dashboard: null,
      stockData: { items: [], total: 0, stats: {} },
      filters,
      error: 'Erreur de chargement des données stock',
      success: false,
    });
  }
}

// Action pour les actions sur le stock
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionType = formData.get('actionType') as string;
  
  const baseUrl = process.env.API_URL || 'http://localhost:3000';

  try {
    switch (actionType) {
      case 'recordMovement': {
        const movement = {
          productId: formData.get('productId') as string,
          movementType: formData.get('movementType') as string,
          quantity: parseInt(formData.get('quantity') as string),
          reason: formData.get('reason') as string,
          notes: formData.get('notes') as string,
        };

        const response = await fetch(`${baseUrl}/api/admin/stock/${movement.productId}/reserve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(movement),
        });

        if (response.ok) {
          return json({ success: true, message: 'Mouvement enregistré avec succès' });
        } else {
          const error = await response.json();
          return json({ success: false, error: error.message });
        }
      }

      case 'adjustInventory': {
        const productId = formData.get('productId') as string;
        const adjustment = {
          actualQuantity: parseInt(formData.get('actualQuantity') as string),
          reason: formData.get('reason') as string,
          notes: formData.get('notes') as string,
        };

        const response = await fetch(
          `${baseUrl}/api/admin/stock/${productId}/availability`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(adjustment),
          }
        );

        if (response.ok) {
          const result = await response.json();
          return json({ success: true, message: result.message });
        } else {
          const error = await response.json();
          return json({ success: false, error: error.message });
        }
      }

      default:
        return json({ success: false, error: 'Action non reconnue' });
    }
  } catch (error) {
    console.error('Erreur action stock:', error);
    return json({ 
      success: false, 
      error: 'Erreur lors de l\'exécution de l\'action' 
    });
  }
}

// Composant principal
export default function AdminStock() {
  const { dashboard, stockData, filters, success } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  const isSubmitting = navigation.state === 'submitting';

  // Afficher les notifications
  useEffect(() => {
    if (actionData?.success) {
      // Notification de succès
      console.log('✅ Action réussie');
    }
  }, [actionData]);

  if (!success) {
    return (
      <div className="p-6">
              {!success && (
<Alert className="rounded-lg p-4" variant="error">
          <h2 className="text-lg font-semibold text-red-800">
            Erreur de chargement
          </h2>
          <p className="text-red-600">Impossible de charger les données stock.</p>
          <div className="mt-4 text-sm text-red-500">
            <p>Vérifiez que :</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Le serveur backend est démarré</li>
              <li>Le service working-stock est activé</li>
              <li>Les routes /api/admin/stock/* sont disponibles</li>
            </ul>
          </div>
        </Alert>
      )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Gestion des Stocks Enrichie
          </h1>
          <p className="text-gray-600">
            Dashboard complet avec filtrage avancé et rapports détaillés
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔄 Actualiser
          </button>
          <button
            onClick={() => {
              const url = `${process.env.API_URL || 'http://localhost:3000'}/api/admin/stock/health`;
              window.open(url, '_blank');
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            📊 Rapport Complet
          </button>
        </div>
      </div>

      {/* Dashboard - Statistiques */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Produits Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboard.statistics.totalProducts}
                </p>
              </div>
              <div className="text-blue-600">📦</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Rupture Stock</p>
                <p className="text-2xl font-bold text-red-600">
                  {dashboard.statistics.outOfStock}
                </p>
              </div>
              <div className="text-red-600">🚨</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Stock Faible</p>
                <p className="text-2xl font-bold text-orange-600">
                  {dashboard.statistics.lowStock}
                </p>
              </div>
              <div className="text-orange-600">⚠️</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Surstock</p>
                <p className="text-2xl font-bold text-purple-600">
                  {dashboard.statistics.overstock}
                </p>
              </div>
              <div className="text-purple-600">📈</div>
            </div>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white p-6 rounded-lg shadow border">
        <h2 className="text-lg font-semibold mb-4">Filtres</h2>
        <Form method="get" className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recherche
            </label>
            <input
              type="text"
              name="search"
              defaultValue={filters.search}
              placeholder="Référence ou nom..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Emplacement
            </label>
            <input
              type="text"
              name="location"
              defaultValue={filters.location}
              placeholder="Emplacement..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtres rapides
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="lowStock"
                  defaultChecked={filters.lowStock}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Stock faible</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="outOfStock"
                  defaultChecked={filters.outOfStock}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="ml-2 text-sm text-gray-700">Rupture</span>
              </label>
            </div>
          </div>

          <div className="flex items-end">
            <Button className="w-full  px-4 py-2 rounded-lg" variant="blue" type="submit">\n  🔍 Filtrer\n</Button>
          </div>
        </Form>
      </div>

      {/* Liste des stocks */}
      <div className="bg-white rounded-lg shadow border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            Stock ({stockData.total} produits)
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Produit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix TTC
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Marge
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  État
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stockData.items.map((item: StockItem) => (
                <tr key={item.pri_piece_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {item.pri_ref}
                      </div>
                      <div className="text-sm text-gray-500 max-w-xs truncate">
                        {item.pri_des}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: 'EUR',
                    }).format(parseFloat(item.pri_vente_ttc))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {parseFloat(item.pri_marge).toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.pri_dispo === '1' ? (
                      <Badge variant="success">
                        ✓ Disponible
                      </Badge>
                    ) : (
                      <Badge variant="error">
                        ✗ Indisponible
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedProduct(item);
                          setShowMovementModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProduct(item);
                          setShowAdjustModal(true);
                        }}
                        className="text-green-600 hover:text-green-900"
                      >
                        Détails
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {stockData.items.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg">📦</div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              Aucun produit trouvé
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Essayez de modifier vos filtres de recherche.
            </p>
          </div>
        )}
      </div>

      {/* Modal Mouvement */}
      {showMovementModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              Enregistrer un mouvement
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {selectedProduct.pri_ref} - {selectedProduct.pri_des}
            </p>
            
            <Form method="post" onSubmit={() => setShowMovementModal(false)}>
              <input type="hidden" name="actionType" value="recordMovement" />
              <input type="hidden" name="productId" value={selectedProduct.pri_piece_id} />
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type de mouvement
                  </label>
                  <select
                    name="movementType"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner...</option>
                    <option value="IN">Entrée</option>
                    <option value="OUT">Sortie</option>
                    <option value="ADJUSTMENT">Ajustement</option>
                    <option value="RETURN">Retour</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantité
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    min="1"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Raison
                  </label>
                  <input
                    type="text"
                    name="reason"
                    required
                    placeholder="Ex: Livraison fournisseur"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (optionnel)
                  </label>
                  <textarea
                    name="notes"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowMovementModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <Button className="px-4 py-2  rounded-lg disabled:opacity-50" variant="blue" type="submit"
                  disabled={isSubmitting}>\n  {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}\n</Button>
              </div>
            </Form>
          </div>
        </div>
      )}

      {/* Modal Ajustement */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              Ajustement d'inventaire
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {selectedProduct.pri_ref} - {selectedProduct.pri_des}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              État: {selectedProduct.pri_dispo === '1' ? 'Disponible' : 'Indisponible'}
            </p>
            
            <Form method="post" onSubmit={() => setShowAdjustModal(false)}>
              <input type="hidden" name="actionType" value="adjustInventory" />
              <input type="hidden" name="productId" value={selectedProduct.pri_piece_id} />
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Disponibilité
                  </label>
                  <select
                    name="availability"
                    defaultValue={selectedProduct.pri_dispo}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1">Disponible</option>
                    <option value="0">Indisponible</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Raison de l'ajustement
                  </label>
                  <input
                    type="text"
                    name="reason"
                    required
                    placeholder="Ex: Inventaire physique"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (optionnel)
                  </label>
                  <textarea
                    name="notes"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <Button className="px-4 py-2  rounded-lg disabled:opacity-50" variant="green" type="submit"
                  disabled={isSubmitting}>\n  {isSubmitting ? 'Ajustement...' : 'Ajuster'}\n</Button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}

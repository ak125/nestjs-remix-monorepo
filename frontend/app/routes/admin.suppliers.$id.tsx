/**
 * 🏢 DÉTAIL FOURNISSEUR - Admin Interface
 * 
 * Page de détail d'un fournisseur spécifique
 * Route: /admin/suppliers/:id
 */

import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { Badge } from '~/components/ui/badge';
import { useLoaderData, Link, useFetcher } from "@remix-run/react";
import { requireUser } from "../auth/unified.server";

// Types pour les données du fournisseur
interface SupplierDetail {
  id: string;
  name: string;
  alias: string;
  display: string;
  sort: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  // Nouvelles propriétés enrichies
  statistics?: {
    totalBrands: number;
    totalPieces: number;
    totalLinks: number;
    activeLinks: number;
  };
  links?: Array<{
    id: any;
    type: string;
    isActive: boolean;
    productInfo?: { 
      id: any; 
      designation: string; 
      reference: string; 
      brand: string; 
      isActive: boolean; 
    };
  }>;
}

interface SupplierDetailData {
  supplier: SupplierDetail | null;
  error?: string;
}

// Loader pour récupérer les détails du fournisseur
export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const user = await requireUser({ context });
  
  // Vérifier les permissions admin
  if (!user.level || user.level < 7) {
    throw new Response("Accès non autorisé", { status: 403 });
  }

  const supplierId = params.id;
  if (!supplierId) {
    throw new Response("ID fournisseur manquant", { status: 400 });
  }

  try {
    console.log('[SupplierDetail] Récupération fournisseur ID:', supplierId);
    
    // Appel direct à l'API backend - route details
    const apiUrl = `http://localhost:3000/api/suppliers/details/${supplierId}`;
    const response = await fetch(apiUrl, {
      headers: { "Internal-Call": "true" },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return json<SupplierDetailData>({
          supplier: null,
          error: `Fournisseur avec ID ${supplierId} non trouvé`,
        });
      }
      throw new Error(`API Error: ${response.status}`);
    }

    const supplierData = await response.json();
    console.log('[SupplierDetail] Données reçues:', supplierData);

    // Extraire les données du wrapper API
    const supplier_raw = supplierData.data || supplierData;

    // Transformer les données
    const supplier: SupplierDetail = {
      id: supplier_raw.spl_id || supplier_raw.id,
      name: supplier_raw.spl_name || supplier_raw.name,
      alias: supplier_raw.spl_alias || supplier_raw.alias || '',
      display: supplier_raw.spl_display || supplier_raw.display || '1',
      sort: supplier_raw.spl_sort || supplier_raw.sort || '0',
      status: (supplier_raw.spl_display === '1' || supplier_raw.spl_display === 1) ? 'active' : 'inactive',
      created_at: supplier_raw.created_at || new Date().toISOString(),
      updated_at: supplier_raw.updated_at || new Date().toISOString(),
      // Ajouter les données enrichies
      statistics: supplier_raw.statistics || {
        totalBrands: 0,
        totalPieces: 0,
        totalLinks: 0,
        activeLinks: 0,
      },
      links: supplier_raw.links || [],
    };

    return json<SupplierDetailData>({ supplier });

  } catch (error: any) {
    console.error('[SupplierDetail] Erreur:', error);
    return json<SupplierDetailData>({
      supplier: null,
      error: `Erreur lors de la récupération: ${error?.message || 'Erreur inconnue'}`,
    });
  }
}

// Composant de la page de détail
export default function SupplierDetail() {
  const { supplier, error } = useLoaderData<SupplierDetailData>();
  const fetcher = useFetcher();

  // Si erreur ou fournisseur non trouvé
  if (error || !supplier) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Fournisseur non trouvé
            </h1>
            <p className="text-gray-600 mb-6">
              {error || "Le fournisseur demandé n'existe pas ou n'est plus accessible."}
            </p>
            <Link
              to="/admin/suppliers"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              ← Retour à la liste des fournisseurs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleToggleStatus = () => {
    const newStatus = supplier.status === 'active' ? 'inactive' : 'active';
    const newDisplay = newStatus === 'active' ? '1' : '0';
    
    fetcher.submit(
      { 
        intent: 'toggle-status',
        display: newDisplay 
      },
      { method: 'POST' }
    );
  };

  const handleDelete = () => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le fournisseur "${supplier.name}" ?`)) {
      fetcher.submit(
        { intent: 'delete' },
        { method: 'POST' }
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header avec navigation */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link
              to="/admin/suppliers"
              className="text-blue-600 hover:text-blue-800 transition-colors"
            >
              ← Retour
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              Détails du Fournisseur
            </h1>
          </div>
          
          <div className="flex items-center space-x-3">
            <Badge className="px-3 py-1 rounded-full text-sm font-medium " variant={supplier.status === 'active' ? 'success' : 'error'}>\n  {supplier.status === 'active' ? 'Actif' : 'Inactif'}\n</Badge>
          </div>
        </div>

        {/* Carte principale */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {/* En-tête de la carte */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">{supplier.name}</h2>
                <p className="text-blue-100">
                  Alias: <span className="font-medium">{supplier.alias || 'Non défini'}</span>
                </p>
              </div>
              <div className="text-right">
                <div className="text-4xl mb-2">🏢</div>
                <p className="text-blue-100">ID: {supplier.id}</p>
              </div>
            </div>
          </div>

          {/* Contenu de la carte */}
          <div className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Informations générales */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                  Informations Générales
                </h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Nom:</span>
                    <span className="font-medium">{supplier.name}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Alias/Code:</span>
                    <span className="font-medium">{supplier.alias || 'Non défini'}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Statut:</span>
                    <span className={`font-medium ${
                      supplier.status === 'active' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {supplier.status === 'active' ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ordre de tri:</span>
                    <span className="font-medium">{supplier.sort}</span>
                  </div>
                </div>
              </div>

              {/* Informations techniques */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                  Informations Techniques
                </h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">ID Base:</span>
                    <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                      {supplier.id}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Display:</span>
                    <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                      {supplier.display}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Créé le:</span>
                    <span className="text-sm">
                      {new Date(supplier.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Modifié le:</span>
                    <span className="text-sm">
                      {new Date(supplier.updated_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-gray-50 px-6 py-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex space-x-3">
                <button
                  onClick={handleToggleStatus}
                  disabled={fetcher.state !== 'idle'}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    supplier.status === 'active'
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  } disabled:opacity-50`}
                >
                  {fetcher.state !== 'idle' ? 'Chargement...' : 
                   supplier.status === 'active' ? 'Désactiver' : 'Activer'}
                </button>
                
                <Link
                  to={`/admin/suppliers/${supplier.id}/edit`}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Modifier
                </Link>
              </div>
              
              <button
                onClick={handleDelete}
                disabled={fetcher.state !== 'idle'}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>

        {/* Statistiques rapides */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
            <div className="text-2xl text-blue-600 mb-2">📦</div>
            <div className="text-lg font-semibold text-gray-900">Produits</div>
            <div className="text-sm text-gray-600">
              <div className="flex justify-between items-center mt-2">
                <span>Articles:</span>
                <span className="font-semibold text-blue-600">{supplier.statistics?.totalPieces || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Marques:</span>
                <span className="font-semibold text-blue-600">{supplier.statistics?.totalBrands || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Actifs:</span>
                <span className="font-semibold text-green-600">{supplier.statistics?.activeLinks || 0}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
            <div className="text-2xl text-green-600 mb-2">📋</div>
            <div className="text-lg font-semibold text-gray-900">Commandes</div>
            <div className="text-sm text-gray-600">À implémenter</div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
            <div className="text-2xl text-purple-600 mb-2">💰</div>
            <div className="text-lg font-semibold text-gray-900">CA Total</div>
            <div className="text-sm text-gray-600">À implémenter</div>
          </div>
        </div>

        {/* Section détaillée des produits */}
        {supplier.links && supplier.links.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Liste des Produits ({supplier.links.length})
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Référence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Marque/Gamme
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {supplier.links.slice(0, 20).map((link, index) => (
                    <tr key={link.id || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="mr-2">📦</span>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {link.productInfo?.designation || 'Produit sans nom'}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {link.productInfo?.id || link.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {link.productInfo?.reference || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {link.productInfo?.brand || 'À déterminer'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className="inline-flex px-2 py-1 text-xs font-semibold rounded-full " variant={link.isActive ? 'success' : 'error'}>\n  {link.isActive ? 'Actif' : 'Inactif'}\n</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {supplier.links.length > 20 && (
                <div className="mt-4 text-center text-sm text-gray-500">
                  ... et {supplier.links.length - 20} autres produits
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Action pour gérer les modifications (toggle status, delete)
export async function action({ request, params }: { request: Request; params: any }) {
  const formData = await request.formData();
  const intent = formData.get('intent') as string;
  const supplierId = params.id;

  try {
    if (intent === 'toggle-status') {
      const display = formData.get('display') as string;
      
      const response = await fetch(`http://localhost:3000/api/suppliers/${supplierId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Internal-Call': 'true',
        },
        body: JSON.stringify({ spl_display: display }),
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      return json({ success: true });
    }

    if (intent === 'delete') {
      const response = await fetch(`http://localhost:3000/api/suppliers/${supplierId}`, {
        method: 'DELETE',
        headers: { 'Internal-Call': 'true' },
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      // Redirection vers la liste après suppression
      return redirect('/admin/suppliers');
    }

    return json({ error: 'Action non reconnue' }, { status: 400 });

  } catch (error: any) {
    console.error('[SupplierDetail Action] Erreur:', error);
    return json({ error: error?.message || 'Erreur inconnue' }, { status: 500 });
  }
}

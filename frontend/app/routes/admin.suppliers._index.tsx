/**
 * 📋 INTERFACE GESTION FOURNISSEURS - Admin Interface
 * ✅ Aligné sur l'architecture des autres modules (users, orders, messages)
 * ✅ Utilise requireAdmin pour l'authentification
 * ✅ Interface moderne avec filtres et pagination
 * ✅ Style cohérent avec les autres composants admin
 */

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams, Form, useNavigate } from "@remix-run/react";
import { useState } from "react";
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { requireAdmin } from "../auth/unified.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Gestion des Fournisseurs - Admin" },
    { name: "description", content: "Interface d'administration pour la gestion des fournisseurs" },
  ];
};

// Types pour la gestion des fournisseurs (alignés avec les schémas Zod backend)
interface Supplier {
  id: number;
  code: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  country?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  paymentTerms?: string;
  minimumOrderAmount?: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Nouvelles propriétés ajoutées
  statistics?: {
    totalBrands: number;
    totalPieces: number;
    totalLinks: number;
  };
  links?: Array<{
    id: any;
    type: string;
    isActive: boolean;
    brand?: { id: any; name: string; };
    piece?: { id: any; reference: string; };
    productInfo?: { 
      id: any; 
      designation: string; 
      reference: string; 
      brand: string; 
      isActive: boolean; 
    };
  }>;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  // Utiliser requireAdmin comme les autres modules admin
  await requireAdmin({ context });
  
  const url = new URL(request.url);
  const params = {
    status: url.searchParams.get("status") || undefined,
    search: url.searchParams.get("search") || undefined,
    country: url.searchParams.get("country") || undefined,
    page: url.searchParams.get("page") || "1",
    limit: url.searchParams.get("limit") || "20",
  };
  
  try {
    console.log("🔄 Chargement des fournisseurs depuis l'API...");
    
    // Utiliser l'API suppliers existante
    const apiUrl = `http://localhost:3000/api/suppliers`;
    
    const suppliersResponse = await fetch(apiUrl, {
      headers: { "Internal-Call": "true" },
    });
    
    if (!suppliersResponse.ok) {
      throw new Error(`API Error: ${suppliersResponse.status}`);
    }
    
    const suppliersData = await suppliersResponse.json();
    const suppliers = suppliersData.suppliers || [];
    
    // Enrichir chaque fournisseur avec ses statistiques (pour les premiers 20)
    const enrichedSuppliers = await Promise.all(
      suppliers.slice(0, 20).map(async (supplier: any) => {
        try {
          const detailsResponse = await fetch(
            `http://localhost:3000/api/suppliers/details/${supplier.id}`,
            { headers: { "Internal-Call": "true" } }
          );
          
          if (detailsResponse.ok) {
            const detailsData = await detailsResponse.json();
            return {
              ...supplier,
              statistics: detailsData.data?.statistics || {
                totalBrands: 0,
                totalPieces: 0,
                totalLinks: 0
              },
              links: detailsData.data?.links || []
            };
          } else {
            // Erreur HTTP - utiliser les statistiques par défaut
            return {
              ...supplier,
              statistics: { totalBrands: 0, totalPieces: 0, totalLinks: 0 },
              links: []
            };
          }
        } catch (error) {
          console.warn(`Erreur enrichissement fournisseur ${supplier.id}:`, error);
          // Retourner le fournisseur avec des statistiques par défaut SEULEMENT en cas d'erreur
          return {
            ...supplier,
            statistics: { totalBrands: 0, totalPieces: 0, totalLinks: 0 },
            links: []
          };
        }
      })
    );
    
    // Utiliser les données enrichies pour les calculs
    const suppliersToProcess = enrichedSuppliers.length > 0 ? enrichedSuppliers : suppliers;
    
    // Appliquer les filtres côté client pour l'instant
    let filteredSuppliers = suppliersToProcess;
    
    if (params.search) {
      const search = params.search.toLowerCase();
      filteredSuppliers = suppliersToProcess.filter((supplier: any) =>
        supplier.name?.toLowerCase().includes(search) ||
        supplier.companyName?.toLowerCase().includes(search) ||
        supplier.code?.toLowerCase().includes(search)
      );
    }
    
    if (params.status) {
      const isActive = params.status === "active";
      filteredSuppliers = filteredSuppliers.filter((supplier: any) => 
        supplier.isActive === isActive
      );
    }
    
    // Pagination côté client
    const page = parseInt(params.page);
    const _limit = parseInt(params.limit);
    const startIndex = (page - 1) * _limit;
    const endIndex = startIndex + _limit;
    const paginatedSuppliers = filteredSuppliers.slice(startIndex, endIndex);
    
    // Calculer les statistiques
    const statistics = {
      total: suppliers.length,
      active: suppliers.filter((s: any) => s.isActive).length,
      inactive: suppliers.filter((s: any) => !s.isActive).length,
      withEmail: suppliers.filter((s: any) => s.email).length,
      withWebsite: 0, // Pas de champ website dans l'API actuelle
      countries: [...new Set(suppliers.map((s: any) => s.country).filter(Boolean))]
    };
    
    console.log(`✅ ${paginatedSuppliers.length} fournisseurs chargés (${filteredSuppliers.length} total après filtre)`);

    return json({
      suppliers: paginatedSuppliers,
      totalSuppliers: filteredSuppliers.length,
      totalPages: Math.ceil(filteredSuppliers.length / _limit),
      currentPage: page,
      statistics,
      params,
    });
    
  } catch (error) {
    console.error("❌ Erreur lors du chargement des fournisseurs:", error);
    
    // Données de fallback pour éviter les erreurs d'interface
    return json({
      suppliers: [],
      totalSuppliers: 0,
      totalPages: 0,
      currentPage: 1,
      statistics: {
        total: 0,
        active: 0,
        inactive: 0,
        withEmail: 0,
        withWebsite: 0,
        countries: []
      },
      params
    });
  }
}

export default function SuppliersIndex() {
  const { suppliers, totalPages, currentPage, statistics, params } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [localSearch, setLocalSearch] = useState(params.search || '');
  
  const _limit = parseInt(params.limit);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (localSearch.trim()) {
      newParams.set('search', localSearch.trim());
    } else {
      newParams.delete('search');
    }
    newParams.set('page', '1');
    navigate(`/admin/suppliers?${newParams.toString()}`);
  };
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Gestion des Fournisseurs
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Gérez vos fournisseurs et leurs informations
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/admin/suppliers/import"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            📤 Importer
          </Link>
          <Button className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm" variant="blue" asChild><Link to="/admin/suppliers/new">➕ Nouveau Fournisseur</Link></Button>
        </div>
      </div>
      
      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <StatCard 
          title="Total" 
          value={statistics.total} 
          icon="🏢"
        />
        <StatCard 
          title="Actifs" 
          value={statistics.active} 
          icon="✅"
          color="green" 
        />
        <StatCard 
          title="Inactifs" 
          value={statistics.inactive} 
          icon="❌"
          color="gray" 
        />
        <StatCard 
          title="Avec Email" 
          value={statistics.withEmail} 
          icon="📧"
        />
        <StatCard 
          title="Avec Site Web" 
          value={statistics.withWebsite} 
          icon="🌐"
        />
        <StatCard 
          title="Pays" 
          value={statistics.countries.length} 
          icon="🌍"
        />
      </div>
      
      {/* Filtres */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 sm:space-x-4">
            {/* Barre de recherche */}
            <div className="flex-1 min-w-0">
              <form onSubmit={handleSearch} className="relative">
                <input
                  type="text"
                  placeholder="Rechercher par nom, code, email..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="block w-full pr-10 border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <button
                  type="submit"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  🔍
                </button>
              </form>
            </div>
            
            {/* Filtres */}
            <div className="flex items-center space-x-3">
              <Form method="get" className="flex items-center space-x-2">
                <input type="hidden" name="search" value={params.search || ''} />
                <select 
                  name="status"
                  className="border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  defaultValue={params.status || ''}
                  onChange={(e) => e.target.form?.submit()}
                >
                  <option value="">Tous les statuts</option>
                  <option value="true">Actif</option>
                  <option value="false">Inactif</option>
                </select>
              </Form>
            </div>
          </div>
        </div>
      </div>
      
      {/* Liste des fournisseurs */}
      <div className="space-y-4">
        {suppliers.length === 0 ? (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="text-center py-8">
                <div className="mx-auto h-12 w-12 text-gray-400 text-4xl">
                  🏢
                </div>
                <h3 className="mt-2 text-lg font-medium text-gray-900">
                  Aucun fournisseur trouvé
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {params.search ? 
                    `Aucun résultat pour "${params.search}"` : 
                    "Aucun fournisseur dans votre base de données"
                  }
                </p>
                <div className="mt-6">
                  <Button className="px-4 py-2 border border-transparent shadow-sm text-sm  rounded-md" variant="blue" asChild><Link to="/admin/suppliers/new">➕ Ajouter le premier fournisseur</Link></Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {suppliers.map((supplier) => (
              <SupplierCard 
                key={supplier.id} 
                supplier={supplier} 
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <PaginationControls 
          currentPage={currentPage}
          totalPages={totalPages}
          searchParams={searchParams}
        />
      )}
    </div>
  );
}

// Composant Carte Statistique
function StatCard({ 
  title, 
  value, 
  icon, 
  color = "blue" 
}: { 
  title: string; 
  value: number; 
  icon: string;
  color?: "blue" | "green" | "yellow" | "red" | "gray"; 
}) {
  const colorClasses = {
    blue: "text-primary bg-primary/10",
    green: "text-success bg-success/10",
    yellow: "text-warning bg-warning/10",
    red: "text-destructive bg-destructive/10",
    gray: "text-gray-600 bg-gray-50",
  };

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className={`flex-shrink-0 rounded-lg p-2 ${colorClasses[color]}`}>
            <div className="text-2xl">{icon}</div>
          </div>
          <div className="ml-4 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="text-lg font-medium text-gray-900">
                {value.toLocaleString()}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

// Composant Carte Fournisseur
function SupplierCard({ supplier }: { supplier: Supplier }) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">{supplier.name}</h3>
              <Badge className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium " variant={supplier.isActive ? 'success' : 'error'}>\n  {supplier.isActive ? "Actif" : "Inactif"}\n</Badge>
              {supplier.code && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {supplier.code}
                </span>
              )}
            </div>
            
            {supplier.companyName && (
              <p className="text-sm text-gray-600 mb-2">
                🏢 {supplier.companyName}
              </p>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              {supplier.email && (
                <div className="flex items-center text-gray-600">
                  📧 {supplier.email}
                </div>
              )}
              {supplier.phone && (
                <div className="flex items-center text-gray-600">
                  📞 {supplier.phone}
                </div>
              )}
              {supplier.city && (
                <div className="flex items-center text-gray-600">
                  🌍 {supplier.city}, {supplier.country}
                </div>
              )}
            </div>
            
            {supplier.contactName && (
              <div className="mt-2 text-sm">
                <span className="text-gray-500">Contact:</span>
                <span className="ml-1 font-medium text-gray-900">{supplier.contactName}</span>
                {supplier.contactEmail && (
                  <span className="text-gray-500 ml-2">({supplier.contactEmail})</span>
                )}
              </div>
            )}
            
            {supplier.minimumOrderAmount && (
              <div className="mt-2 text-sm">
                <span className="text-gray-500">Commande minimum:</span>
                <span className="ml-1 font-medium text-gray-900">{supplier.minimumOrderAmount}€</span>
              </div>
            )}

            {/* Nouvelles statistiques articles/marques */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-lg font-semibold text-blue-600">
                    {supplier.statistics?.totalBrands ?? 0}
                  </div>
                  <div className="text-gray-500">Marques</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-green-600">
                    {supplier.statistics?.totalPieces ?? 0}
                  </div>
                  <div className="text-gray-500">Articles</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-purple-600">
                    {supplier.statistics?.totalLinks ?? 0}
                  </div>
                  <div className="text-gray-500">Total Liens</div>
                </div>
              </div>
              
              {/* Message informatif si pas de liens */}
              {(!supplier.statistics?.totalLinks || supplier.statistics.totalLinks === 0) && (
                <div className="mt-2 text-xs text-gray-400 text-center">
                  Aucune liaison configurée pour ce fournisseur
                </div>
              )}
            </div>

            {/* Aperçu des liens récents */}
            {supplier.links && supplier.links.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-sm">
                  <div className="text-gray-500 font-medium mb-2">
                    Derniers liens ({supplier.links.length} total):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {supplier.links.slice(0, 10).map((link, index) => (
                      <span
                        key={index}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          link.type === 'brand' 
                            ? 'info' : 'success'
                        }`}
                        title={link.productInfo ? `${link.productInfo.designation} - ${link.productInfo.brand} (Ref: ${link.productInfo.reference})` : ''}
                      >
                        {link.type === 'brand' ? '🏷️' : '📦'} 
                        <span className="truncate max-w-24">
                          {link.productInfo?.designation || link.brand?.name || link.piece?.reference || 'N/A'}
                        </span>
                        {link.productInfo?.brand && 
                         link.productInfo.brand !== 'À déterminer' && 
                         link.productInfo.brand !== link.productInfo.designation && (
                          <span className="ml-1 text-xs opacity-70 font-normal">
                            ({link.productInfo.brand.substring(0, 8)}{link.productInfo.brand.length > 8 ? '...' : ''})
                          </span>
                        )}
                      </span>
                    ))}
                    {supplier.links.length > 10 && (
                      <span className="text-xs text-gray-500">
                        +{supplier.links.length - 10} autres...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-2 ml-4">
            <Link 
              to={`/admin/suppliers/${supplier.id}`}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              👁️ Voir
            </Link>
            <Link 
              to={`/admin/suppliers/${supplier.id}/edit`}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              ✏️ Modifier
            </Link>
            <button 
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-destructive bg-white hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              🗑️ Supprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Composant Contrôles de Pagination
function PaginationControls({ 
  currentPage, 
  totalPages, 
  searchParams 
}: { 
  currentPage: number; 
  totalPages: number; 
  searchParams: URLSearchParams; 
}) {
  const createPageUrl = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    return `/admin/suppliers?${newParams.toString()}`;
  };

  return (
    <nav className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-lg shadow">
      <div className="hidden sm:block">
        <p className="text-sm text-gray-700">
          Page <span className="font-medium">{currentPage}</span> sur{' '}
          <span className="font-medium">{totalPages}</span>
        </p>
      </div>
      <div className="flex-1 flex justify-between sm:justify-end">
        {currentPage > 1 && (
          <Link
            to={createPageUrl(currentPage - 1)}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            ← Précédent
          </Link>
        )}
        
        <div className="hidden sm:flex space-x-1 mx-4">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const page = Math.max(1, currentPage - 2) + i;
            if (page > totalPages) return null;
            
            return (
              <Link 
                key={page} 
                to={createPageUrl(page)}
                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md ${
                  page === currentPage
                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {page}
              </Link>
            );
          })}
        </div>
        
        {currentPage < totalPages && (
          <Link
            to={createPageUrl(currentPage + 1)}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Suivant →
          </Link>
        )}
      </div>
    </nav>
  );
}

/**
 * 📦 GESTION DE STOCK COMMERCIAL
 * 
 * Interface optimisée basée sur l'existant admin.stock.working.tsx
 * ✅ Réutilise les APIs fonctionnelles
 * ✅ Interface adaptée au contexte commercial
 * ✅ Données réelles de pieces_price
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useSearchParams, Form, Link } from '@remix-run/react';
import { useState } from 'react';
import { 
  Package, AlertTriangle, TrendingDown, TrendingUp,
  History, FileText, Download, Search
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";

interface StockItem {
  pri_piece_id: string;
  pri_ref: string;
  pri_des: string;
  pri_dispo: string;
  pri_vente_ttc: string;
  pri_vente_ht: string;
  pri_qte_vente: string;
  pri_marge: string;
}

interface StockStats {
  availableItems: number;
  unavailableItems: number;
  lowStockItems: number;
  totalItems: number;
}

interface LoaderData {
  stats: StockStats;
  items: StockItem[];
  totalItems: number;
  currentPage: number;
  limit: number;
  filters: {
    search: string;
    available: string;
    minPrice: string;
    maxPrice: string;
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const search = url.searchParams.get('search') || '';
  const available = url.searchParams.get('available') || '';
  const minPrice = url.searchParams.get('minPrice') || '';
  const maxPrice = url.searchParams.get('maxPrice') || '';

  try {
    // Configuration API centralisée
    const API_BASE = process.env.NODE_ENV === 'production' 
      ? process.env.API_URL 
      : 'http://127.0.0.1:3000';
      
    // Réutiliser les APIs existantes qui fonctionnent
    const statsResponse = await fetch(`${API_BASE}/api/admin/stock/stats`);
    const statsData = await statsResponse.json();

    // Construire l'URL pour le dashboard avec filtres
    const dashboardUrl = new URL(`${API_BASE}/api/admin/stock/dashboard`);
    dashboardUrl.searchParams.set('page', page.toString());
    dashboardUrl.searchParams.set('limit', limit.toString());
    if (search) dashboardUrl.searchParams.set('search', search);
    if (available) dashboardUrl.searchParams.set('available', available);
    if (minPrice) dashboardUrl.searchParams.set('minPrice', minPrice);
    if (maxPrice) dashboardUrl.searchParams.set('maxPrice', maxPrice);

    const dashboardResponse = await fetch(dashboardUrl.toString());
    const dashboardData = await dashboardResponse.json();

    return json({
      stats: statsData.success ? statsData.data : { 
        availableItems: 0, 
        unavailableItems: 0, 
        lowStockItems: 0,
        totalItems: 0 
      },
      items: dashboardData.success ? dashboardData.data.items : [],
      totalItems: dashboardData.success ? dashboardData.data.totalItems : 0,
      currentPage: page,
      limit,
      filters: { search, available, minPrice, maxPrice },
    });
  } catch (error) {
    console.error('Erreur chargement stock commercial:', error);
    return json({
      stats: { availableItems: 0, unavailableItems: 0, lowStockItems: 0, totalItems: 0 },
      items: [],
      totalItems: 0,
      currentPage: 1,
      limit: 20,
      filters: { search: '', available: '', minPrice: '', maxPrice: '' },
    });
  }
}

export default function CommercialStockIndex() {
  const { stats, items, totalItems, currentPage, limit, filters } = useLoaderData<LoaderData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(parseFloat(price));
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  const getStockStatus = (item: StockItem) => {
    if (item.pri_dispo === '0') {
      return { label: "Rupture", color: "bg-red-100 text-red-800" };
    }
    if (parseFloat(item.pri_marge) < 20) {
      return { label: "Marge faible", color: "bg-orange-100 text-orange-800" };
    }
    return { label: "Disponible", color: "bg-green-100 text-green-800" };
  };

  const handleExport = () => {
    // Logique d'export basée sur l'API existante
    window.open(`http://localhost:3000/api/admin/stock/health`, '_blank');
  };

  return (
    <div className="container mx-auto p-6">
      {/* Header Commercial */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Gestion du Stock Commercial</h1>
          <p className="text-gray-600 mt-1">
            Tableau de bord pour l'équipe commerciale
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Exporter Stock
          </Button>
          <Link to="/commercial/stock/inventory">
            <Button>
              <Package className="mr-2 h-4 w-4" />
              Inventaire
            </Button>
          </Link>
        </div>
      </div>

      {/* Cartes de statistiques commerciales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Produits</p>
              <p className="text-2xl font-bold">{formatNumber(stats.totalItems || totalItems)}</p>
            </div>
            <Package className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-6 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">Disponibles</p>
              <p className="text-2xl font-bold text-green-700">{formatNumber(stats.availableItems)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Prêt à la vente
          </p>
        </Card>

        <Card className="p-6 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-700">Indisponibles</p>
              <p className="text-2xl font-bold text-red-700">{formatNumber(stats.unavailableItems)}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Nécessite réapprovisionnement
          </p>
        </Card>

        <Card className="p-6 border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-700">Marge &lt; 20%</p>
              <p className="text-2xl font-bold text-yellow-700">{formatNumber(stats.lowStockItems)}</p>
            </div>
            <TrendingDown className="h-8 w-8 text-yellow-600" />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Attention rentabilité
          </p>
        </Card>
      </div>

      {/* Filtres commerciaux */}
      <Card className="mb-6 p-6">
        <Form method="get" className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-64">
            <Input
              name="search"
              placeholder="Rechercher un produit (ref, description)..."
              defaultValue={filters.search}
              className="w-full"
            />
          </div>
          <select
            name="available"
            defaultValue={filters.available}
            className="px-3 py-2 border rounded-md"
          >
            <option value="">Toutes disponibilités</option>
            <option value="true">Disponibles uniquement</option>
            <option value="false">Indisponibles uniquement</option>
          </select>
          <Input
            name="minPrice"
            type="number"
            step="0.01"
            placeholder="Prix min €"
            defaultValue={filters.minPrice}
            className="w-32"
          />
          <Input
            name="maxPrice"
            type="number"
            step="0.01"
            placeholder="Prix max €"
            defaultValue={filters.maxPrice}
            className="w-32"
          />
          <Button type="submit">
            <Search className="mr-2 h-4 w-4" />
            Filtrer
          </Button>
        </Form>
      </Card>

      {/* Tableau de stock commercial */}
      <Card>
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">
              Inventaire Produits ({formatNumber(totalItems)} références)
            </h2>
            <div className="text-sm text-gray-500">
              Page {currentPage} • {items.length} affichés
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="w-12 p-4">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedItems(
                          new Set(items.map((item) => item.pri_piece_id))
                        );
                      } else {
                        setSelectedItems(new Set());
                      }
                    }}
                  />
                </th>
                <th className="text-left p-4 font-medium text-gray-700">Référence</th>
                <th className="text-left p-4 font-medium text-gray-700">Description</th>
                <th className="text-right p-4 font-medium text-gray-700">Prix HT</th>
                <th className="text-right p-4 font-medium text-gray-700">Prix TTC</th>
                <th className="text-right p-4 font-medium text-gray-700">Marge</th>
                <th className="text-center p-4 font-medium text-gray-700">Statut</th>
                <th className="text-right p-4 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item) => {
                  const status = getStockStatus(item);
                  const isSelected = selectedItems.has(item.pri_piece_id);
                  
                  return (
                    <tr 
                      key={item.pri_piece_id} 
                      className={`border-b hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const newSelected = new Set(selectedItems);
                            if (e.target.checked) {
                              newSelected.add(item.pri_piece_id);
                            } else {
                              newSelected.delete(item.pri_piece_id);
                            }
                            setSelectedItems(newSelected);
                          }}
                        />
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-900">
                          {item.pri_ref}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {item.pri_piece_id}
                        </div>
                      </td>
                      <td className="p-4 max-w-xs">
                        <div className="text-sm text-gray-900 truncate">
                          {item.pri_des}
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono">
                        {formatPrice(item.pri_vente_ht)}
                      </td>
                      <td className="p-4 text-right font-mono font-semibold">
                        {formatPrice(item.pri_vente_ttc)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="font-semibold">
                          {parseFloat(item.pri_marge).toFixed(1)}%
                        </div>
                        <div className={`text-xs ${
                          parseFloat(item.pri_marge) < 20 ? 'text-red-600' :
                          parseFloat(item.pri_marge) > 50 ? 'text-green-600' : 'text-yellow-600'
                        }`}>
                          {parseFloat(item.pri_marge) < 20 ? 'Faible' :
                           parseFloat(item.pri_marge) > 50 ? 'Élevée' : 'Normale'}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <Badge className={status.color}>
                          {status.label}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Link to={`/commercial/products/${item.pri_piece_id}`}>
                            <Button variant="secondary" size="sm">
                              <FileText className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link to={`/commercial/stock/${item.pri_piece_id}/history`}>
                            <Button variant="secondary" size="sm">
                              <History className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Aucun produit trouvé avec ces critères
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalItems > limit && (
          <div className="p-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Affichage de {(currentPage - 1) * limit + 1} à{' '}
              {Math.min(currentPage * limit, totalItems)} sur {formatNumber(totalItems)} produits
            </div>
            <div className="flex gap-2">
              {currentPage > 1 && (
                <Link
                  to={`?${new URLSearchParams({ 
                    ...Object.fromEntries(searchParams), 
                    page: (currentPage - 1).toString() 
                  })}`}
                >
                  <Button variant="outline" size="sm">Précédent</Button>
                </Link>
              )}
              {currentPage * limit < totalItems && (
                <Link
                  to={`?${new URLSearchParams({ 
                    ...Object.fromEntries(searchParams), 
                    page: (currentPage + 1).toString() 
                  })}`}
                >
                  <Button variant="outline" size="sm">Suivant</Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Actions en lot sélectionnées */}
      {selectedItems.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white shadow-lg border rounded-lg p-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">
              {selectedItems.size} produit{selectedItems.size > 1 ? 's' : ''} sélectionné{selectedItems.size > 1 ? 's' : ''}
            </span>
            <Button size="sm" variant="outline">
              Exporter sélection
            </Button>
            <Button size="sm" variant="outline">
              Actions en lot
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

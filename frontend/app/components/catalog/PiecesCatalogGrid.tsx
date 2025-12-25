// 📁 frontend/app/components/catalog/PiecesCatalogGrid.tsx
// 🎨 Catalogue de pièces avec le design de FamilyGammeHierarchy

import { Link } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';

// ========================================
// 🎯 TYPES POUR LE CATALOGUE DE PIÈCES
// ========================================

export interface PieceCategory {
  id: string;
  name: string;
  systemName: string;
  description: string;
  piecesCount: number;
  icon: string;
  color: string;
  image: string;
  pieces: Piece[];
}

export interface Piece {
  piece_id: string;
  piece_name: string;
  piece_sku: string;
  piece_activ: boolean;
  piece_top: boolean;
  piece_price?: number;
  piece_description?: string;
  brand?: string;
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock';
}

export interface PiecesCatalogStats {
  total_categories: number;
  total_pieces: number;
  total_brands: number;
  categories_with_pieces: number;
}

interface PiecesCatalogGridProps {
  className?: string;
  catalogData?: {
    categories: PieceCategory[];
    stats: PiecesCatalogStats;
    success: boolean;
  } | null;
}

// ========================================
// 🎨 DONNÉES MOCKÉES POUR LA DÉMO
// ========================================

const mockCatalogData = {
  categories: [
    {
      id: "freinage",
      name: "Système de freinage",
      systemName: "Freinage",
      description: "Plaquettes, disques, étriers, liquides de frein et tous composants du système de freinage pour tous véhicules.",
      piecesCount: 8743,
      icon: "🛑",
      color: "from-red-500 to-red-700",
      image: "/images/categories/freinage.jpg",
      pieces: [
        {
          piece_id: "BRK001",
          piece_name: "Plaquettes de frein avant Bosch BP1234",
          piece_sku: "BRK001-BOSCH",
          piece_activ: true,
          piece_top: true,
          piece_price: 45.99,
          brand: "Bosch",
          stock_status: "in_stock" as const
        },
        {
          piece_id: "BRK002", 
          piece_name: "Disques de frein ventilés Brembo 09.9772.11",
          piece_sku: "BRK002-BREMBO",
          piece_activ: true,
          piece_top: false,
          piece_price: 89.50,
          brand: "Brembo",
          stock_status: "in_stock" as const
        }
      ]
    },
    {
      id: "moteur",
      name: "Moteur et transmission",
      systemName: "Moteur",
      description: "Filtres, huiles, courroies, pompes et toutes pièces moteur pour l'entretien et la réparation.",
      piecesCount: 12456,
      icon: "⚙️",
      color: "from-blue-500 to-blue-700", 
      image: "/images/categories/moteur.jpg",
      pieces: [
        {
          piece_id: "ENG001",
          piece_name: "Filtre à huile Mann W712/93",
          piece_sku: "ENG001-MANN",
          piece_activ: true,
          piece_top: false,
          piece_price: 12.50,
          brand: "Mann",
          stock_status: "in_stock" as const
        },
        {
          piece_id: "ENG002",
          piece_name: "Courroie de distribution Gates 5491XS",
          piece_sku: "ENG002-GATES", 
          piece_activ: true,
          piece_top: true,
          piece_price: 67.80,
          brand: "Gates",
          stock_status: "low_stock" as const
        }
      ]
    },
    {
      id: "suspension",
      name: "Suspension et direction",
      systemName: "Suspension",
      description: "Amortisseurs, ressorts, rotules, silentblocs et composants de suspension pour le confort de conduite.",
      piecesCount: 6521,
      icon: "🔧",
      color: "from-green-500 to-green-700",
      image: "/images/categories/suspension.jpg", 
      pieces: [
        {
          piece_id: "SUS001",
          piece_name: "Amortisseur avant gauche Monroe G7890",
          piece_sku: "SUS001-MONROE",
          piece_activ: true,
          piece_top: true,
          piece_price: 89.99,
          brand: "Monroe",
          stock_status: "in_stock" as const
        }
      ]
    },
    {
      id: "electrique",
      name: "Système électrique",
      systemName: "Électrique", 
      description: "Batteries, alternateurs, démarreurs, capteurs et composants électriques pour tous véhicules.",
      piecesCount: 4892,
      icon: "⚡",
      color: "from-yellow-500 to-yellow-700",
      image: "/images/categories/electrique.jpg",
      pieces: [
        {
          piece_id: "ELE001",
          piece_name: "Batterie Varta Blue Dynamic E11",
          piece_sku: "ELE001-VARTA",
          piece_activ: true,
          piece_top: false,
          piece_price: 125.00,
          brand: "Varta",
          stock_status: "in_stock" as const
        }
      ]
    },
    {
      id: "carrosserie",
      name: "Carrosserie et éclairage",
      systemName: "Carrosserie",
      description: "Optiques, pare-chocs, rétroviseurs, pare-brise et éléments de carrosserie.",
      piecesCount: 9876,
      icon: "🚗",
      color: "from-orange-500 to-orange-700",
      image: "/images/categories/carrosserie.jpg",
      pieces: [
        {
          piece_id: "CAR001",
          piece_name: "Phare avant droit H4 Valeo 043734",
          piece_sku: "CAR001-VALEO",
          piece_activ: true,
          piece_top: false,
          piece_price: 76.80,
          brand: "Valeo",
          stock_status: "in_stock" as const
        }
      ]
    },
    {
      id: "accessoires",
      name: "Accessoires et entretien",
      systemName: "Accessoires",
      description: "Huiles, liquides, outils et accessoires pour l'entretien et la maintenance.",
      piecesCount: 3214,
      icon: "🛠️",
      color: "from-purple-500 to-purple-700",
      image: "/images/categories/accessoires.jpg",
      pieces: [
        {
          piece_id: "ACC001",
          piece_name: "Huile moteur Castrol GTX 5W-30 5L",
          piece_sku: "ACC001-CASTROL",
          piece_activ: true,
          piece_top: true,
          piece_price: 34.99,
          brand: "Castrol",
          stock_status: "in_stock" as const
        }
      ]
    }
  ],
  stats: {
    total_categories: 6,
    total_pieces: 45702,
    total_brands: 89,
    categories_with_pieces: 6
  }
};

// ========================================
// 🎨 COMPOSANT PRINCIPAL
// ========================================

export default function PiecesCatalogGrid({ 
  className = '',
  catalogData
}: PiecesCatalogGridProps) {
  const [categories, setCategories] = useState<PieceCategory[]>([]);
  const [stats, setStats] = useState<PiecesCatalogStats>({
    total_categories: 0,
    total_pieces: 0,
    total_brands: 0,
    categories_with_pieces: 0
  });
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Charger les données depuis les props ou utiliser les données mockées
  useEffect(() => {
    console.log('🔍 PiecesCatalogGrid - catalogData reçu:', catalogData);
    
    if (catalogData) {
      if (catalogData.success && catalogData.categories) {
        console.log('✅ Format API détecté avec', catalogData.categories.length, 'catégories');
        setCategories(catalogData.categories);
        setStats(catalogData.stats);
        
        // Auto-expand les premières catégories pour l'affichage
        if (catalogData.categories.length > 0) {
          setExpandedCategories(catalogData.categories.slice(0, 3).map(c => c.id));
        }
        setLoading(false);
      }
    } else {
      console.log('⚠️ Utilisation des données mockées');
      setCategories(mockCatalogData.categories);
      setStats(mockCatalogData.stats);
      
      // Auto-expand les premières catégories pour l'affichage
      setExpandedCategories(mockCatalogData.categories.slice(0, 3).map(c => c.id));
      setLoading(false);
    }
  }, [catalogData]);
  
  // Toggle d'expansion d'une catégorie
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
        <p className="text-center text-gray-500 mt-6">
          🛒 Chargement du catalogue de pièces...
        </p>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🛒</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            Aucune catégorie disponible
          </h3>
          <p className="text-gray-600">
            Le catalogue de pièces n'est pas encore configuré.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* En-tête avec statistiques */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white p-6 rounded-t-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">🛒 Catalogue Pièces Détachées</h2>
          <div className="text-right">
            <div className="text-3xl font-bold">{stats.total_pieces.toLocaleString()}</div>
            <div className="text-sm opacity-90">Pièces disponibles</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white bg-opacity-20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{categories.length}</div>
            <div className="text-xs opacity-90">Catégories</div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.categories_with_pieces}</div>
            <div className="text-xs opacity-90">Catégories actives</div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.total_brands}</div>
            <div className="text-xs opacity-90">Marques</div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">
              {stats.total_pieces > 0 ? Math.round(stats.total_pieces / stats.categories_with_pieces) : 0}
            </div>
            <div className="text-xs opacity-90">Pièces/catégorie</div>
          </div>
        </div>
      </div>

      {/* Grille des catégories */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => {
            const isExpanded = expandedCategories.includes(category.id);
            
            return (
              <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                {/* En-tête de la catégorie */}
                <div className={`bg-gradient-to-r ${category.color} text-white p-4`}>
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-2xl">{category.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{category.systemName}</h3>
                      <p className="text-sm opacity-90">{category.name}</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="bg-white bg-opacity-30 rounded-full px-3 py-1 text-sm font-bold">
                      {category.piecesCount.toLocaleString()} pièces
                    </span>
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-2 transition-colors"
                    >
                      <svg
                        className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Image et description */}
                <div className="p-4">
                  <div className="aspect-video bg-gray-100 rounded-lg mb-3 overflow-hidden">
                    <img
                      src={category.image}
                      alt={category.systemName}
                      width={320}
                      height={180}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.src = '/images/categories/default.svg';
                      }}
                    />
                  </div>
                  
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {category.description}
                  </p>
                </div>

                {/* Pièces de la catégorie */}
                {isExpanded && (
                  <div className="bg-gray-50 p-4 border-t border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-3">
                      Pièces populaires ({category.pieces.length} affichées)
                    </h4>
                    <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                      {category.pieces.slice(0, 10).map((piece) => {
                        const pieceUrl = `/pieces/${piece.piece_sku.toLowerCase()}`;
                        
                        return (
                          <Link
                            key={piece.piece_id}
                            to={pieceUrl}
                            className="bg-white rounded p-3 text-sm hover:bg-info/20 transition-colors block border border-gray-200"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-medium text-gray-700 text-xs line-clamp-2 flex-1 mr-2">
                                {piece.piece_name}
                              </span>
                              {piece.piece_top && (
                                <Badge variant="warning">TOP</Badge>
                              )}
                            </div>
                            
                            <div className="flex justify-between items-center">
                              <div className="text-xs text-gray-500">
                                {piece.brand} • {piece.piece_sku}
                              </div>
                              {piece.piece_price && (
                                <div className="text-sm font-bold text-blue-600">
                                  {piece.piece_price.toFixed(2)} €
                                </div>
                              )}
                            </div>
                            
                            <div className="mt-1">
                              <Badge className="text-xs px-2 py-1 rounded-full font-medium " variant={piece.stock_status === 'in_stock' ? 'success' : piece.stock_status === 'low_stock' ? 'warning' : 'error'}>\n  {piece.stock_status === 'in_stock' && 'En stock'}
                                {piece.stock_status === 'low_stock' && 'Stock faible'}
                                {piece.stock_status === 'out_of_stock' && 'Rupture'}\n</Badge>
                            </div>
                          </Link>
                        );
                      })}
                      
                      {category.piecesCount > 10 && (
                        <div className="text-center py-2">
                          <Link
                            to={`/pieces/catalogue?category=${category.id}`}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Voir les {(category.piecesCount - 10).toLocaleString()} autres →
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Pied de carte */}
                <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                  <Link
                    to={`/pieces/catalogue?category=${category.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
                  >
                    Explorer {category.systemName} →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pied de page avec actions */}
      <div className="bg-gray-50 px-6 py-4 rounded-b-lg border-t border-gray-200">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {expandedCategories.length} catégorie(s) dépliée(s) sur {categories.length}
          </div>
          <div className="space-x-3">
            <button
              onClick={() => setExpandedCategories(categories.map(c => c.id))}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Tout déplier
            </button>
            <button
              onClick={() => setExpandedCategories([])}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              Tout replier
            </button>
            <Button className="text-sm  px-4 py-2 rounded" variant="blue" asChild><Link to="/pieces/catalogue">Voir tout le catalogue</Link></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
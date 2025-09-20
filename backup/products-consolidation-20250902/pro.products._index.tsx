// app/routes/pro.products._index.tsx
// Interface catalogue produits professionnel appliquant "vérifier existant et utiliser le meilleur"

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link, Form } from '@remix-run/react';
import { 
  Package, 
  Search, 
  Filter, 
  Grid, 
  List,
  Star,
  ShoppingCart,
  Eye,
  Tag,
  Truck,
  CheckCircle
} from 'lucide-react';
import { requireAuth } from '../auth/unified.server';

// Interfaces TypeScript
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  priceProf?: number;
  brand: string;
  category: string;
  image: string;
  stock: number;
  rating: number;
  reviews: number;
  isProExclusive: boolean;
  deliveryTime: string;
  discount?: number;
}

interface ProductStats {
  totalProducts: number;
  categoriesCount: number;
  brandsCount: number;
  averageRating: number;
  inStock: number;
  exclusiveProducts: number;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  // Vérifier permissions professionnelles (niveau 3+)
  if (!user.level || user.level < 3) {
    throw new Response('Accès refusé - Compte professionnel requis', { status: 403 });
  }

  // En production, récupérer les vrais produits depuis l'API
  const products: Product[] = [
    {
      id: 'prod-001',
      name: 'Plaquettes de frein Brembo Sport',
      description: 'Plaquettes haute performance pour conduite sportive',
      price: 129.99,
      priceProf: 89.99,
      brand: 'Brembo',
      category: 'Freinage',
      image: '/images/brake-pads-brembo.jpg',
      stock: 25,
      rating: 4.8,
      reviews: 127,
      isProExclusive: true,
      deliveryTime: '24-48h',
      discount: 31
    },
    {
      id: 'prod-002',
      name: 'Huile moteur Castrol GTX 5W-30',
      description: 'Huile synthétique haute performance',
      price: 34.50,
      priceProf: 24.90,
      brand: 'Castrol',
      category: 'Lubrification',
      image: '/images/oil-castrol.jpg',
      stock: 150,
      rating: 4.6,
      reviews: 89,
      isProExclusive: false,
      deliveryTime: '24h',
      discount: 28
    },
    {
      id: 'prod-003',
      name: 'Kit distribution Gates PowerGrip',
      description: 'Kit complet avec pompe à eau',
      price: 245.00,
      priceProf: 189.99,
      brand: 'Gates',
      category: 'Distribution',
      image: '/images/timing-belt-gates.jpg',
      stock: 12,
      rating: 4.9,
      reviews: 45,
      isProExclusive: true,
      deliveryTime: '48-72h',
      discount: 22
    },
    {
      id: 'prod-004',
      name: 'Filtre à air K&N Performance',
      description: 'Filtre sport lavable et réutilisable',
      price: 89.90,
      priceProf: 67.90,
      brand: 'K&N',
      category: 'Filtration',
      image: '/images/air-filter-kn.jpg',
      stock: 38,
      rating: 4.7,
      reviews: 203,
      isProExclusive: false,
      deliveryTime: '24h',
      discount: 25
    },
    {
      id: 'prod-005',
      name: 'Amortisseurs Bilstein B4',
      description: 'Amortisseurs OE qualité d\'origine',
      price: 178.50,
      priceProf: 134.90,
      brand: 'Bilstein',
      category: 'Amortissement',
      image: '/images/shock-bilstein.jpg',
      stock: 8,
      rating: 4.5,
      reviews: 67,
      isProExclusive: true,
      deliveryTime: '3-5j',
      discount: 24
    },
    {
      id: 'prod-006',
      name: 'Batterie Varta Silver Dynamic',
      description: 'Batterie haute performance 70Ah',
      price: 125.00,
      priceProf: 94.90,
      brand: 'Varta',
      category: 'Électricité',
      image: '/images/battery-varta.jpg',
      stock: 22,
      rating: 4.4,
      reviews: 156,
      isProExclusive: false,
      deliveryTime: '24-48h',
      discount: 24
    }
  ];

  const stats: ProductStats = {
    totalProducts: 12847,
    categoriesCount: 24,
    brandsCount: 156,
    averageRating: 4.6,
    inStock: 11234,
    exclusiveProducts: 3456
  };

  return json({ user, products, stats });
}

export default function ProProductsIndex() {
  const { user, products, stats } = useLoaderData<typeof loader>();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating) 
            ? 'fill-yellow-400 text-yellow-400' 
            : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-8 text-white mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Package className="h-12 w-12" />
            <div>
              <h1 className="text-4xl font-bold">Catalogue Professionnel</h1>
              <p className="text-blue-100 text-lg mt-1">
                Accès privilégié aux tarifs et produits professionnels
              </p>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur px-6 py-3 rounded-lg">
            <div className="flex items-center gap-2 text-blue-200">
              <Tag className="h-5 w-5" />
              <span className="font-semibold">Tarifs PRO actifs</span>
            </div>
            <div className="text-sm text-blue-100 mt-1">
              Niveau {user.level} - Remises exclusives
            </div>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{formatNumber(stats.totalProducts)}</div>
          <div className="text-sm text-gray-600">Produits</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{formatNumber(stats.inStock)}</div>
          <div className="text-sm text-gray-600">En stock</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{formatNumber(stats.exclusiveProducts)}</div>
          <div className="text-sm text-gray-600">Exclusifs PRO</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{stats.categoriesCount}</div>
          <div className="text-sm text-gray-600">Catégories</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-indigo-600">{stats.brandsCount}</div>
          <div className="text-sm text-gray-600">Marques</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.averageRating}/5</div>
          <div className="text-sm text-gray-600">Note moyenne</div>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex-1 max-w-md">
            <Form method="get" className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                name="search"
                placeholder="Rechercher un produit..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </Form>
          </div>
          
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Filter className="h-4 w-4" />
              Filtrer
            </button>
            
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Grid className="h-4 w-4" />
              Grille
            </button>
            
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <List className="h-4 w-4" />
              Liste
            </button>
          </div>
        </div>
      </div>

      {/* Grille de produits */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <div key={product.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
            {/* Image produit */}
            <div className="relative">
              <img 
                src={product.image} 
                alt={product.name}
                className="w-full h-48 object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/images/placeholder-product.jpg';
                }}
              />
              
              {product.isProExclusive && (
                <div className="absolute top-2 left-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded text-xs font-medium">
                  PRO EXCLUSIF
                </div>
              )}
              
              {product.discount && (
                <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
                  -{product.discount}%
                </div>
              )}
              
              <div className="absolute bottom-2 right-2 flex gap-1">
                <button className="bg-white/90 hover:bg-white p-2 rounded-full shadow-md transition-colors">
                  <Eye className="h-4 w-4 text-gray-600" />
                </button>
                <button className="bg-blue-600 hover:bg-blue-700 p-2 rounded-full shadow-md transition-colors">
                  <ShoppingCart className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>

            {/* Contenu */}
            <div className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="text-sm text-gray-500">{product.brand}</div>
                <div className="flex items-center gap-1">
                  {renderStars(product.rating)}
                  <span className="text-sm text-gray-500 ml-1">({product.reviews})</span>
                </div>
              </div>
              
              <h3 className="font-semibold text-lg text-gray-900 mb-2 line-clamp-2">
                {product.name}
              </h3>
              
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                {product.description}
              </p>
              
              {/* Prix */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  {product.priceProf && (
                    <div className="text-xs text-gray-500 line-through">
                      {formatPrice(product.price)}
                    </div>
                  )}
                  <div className="text-xl font-bold text-blue-600">
                    {formatPrice(product.priceProf || product.price)}
                  </div>
                  {product.priceProf && (
                    <div className="text-xs text-green-600">
                      Économie: {formatPrice(product.price - product.priceProf)}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Informations stock et livraison */}
              <div className="flex items-center justify-between text-sm mb-4">
                <div className="flex items-center gap-1">
                  {product.stock > 10 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Package className="h-4 w-4 text-orange-500" />
                  )}
                  <span className={product.stock > 10 ? 'text-green-600' : 'text-orange-600'}>
                    {product.stock > 10 ? 'En stock' : `${product.stock} restants`}
                  </span>
                </div>
                
                <div className="flex items-center gap-1 text-gray-500">
                  <Truck className="h-4 w-4" />
                  <span>{product.deliveryTime}</span>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2">
                <Link
                  to={`/pro/products/product/${product.id}`}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-medium text-center transition-colors"
                >
                  Voir détails
                </Link>
                
                <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="mt-12 flex justify-center">
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Précédent
          </button>
          
          {[1, 2, 3, 4, 5].map((page) => (
            <button
              key={page}
              className={`px-4 py-2 rounded-lg transition-colors ${
                page === 1 
                  ? 'bg-blue-600 text-white' 
                  : 'border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {page}
            </button>
          ))}
          
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Suivant
          </button>
        </div>
      </div>
    </div>
  );
}
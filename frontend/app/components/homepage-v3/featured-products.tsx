import { Badge } from '@fafa/ui';
import { Star, ShoppingCart, Eye, AlertCircle } from "lucide-react";

interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  brand: string;
  promo: number;
  rating: number;
  reviews: number;
  stock: number;
  image: string;
  badges: string[];
}

interface FeaturedProductsProps {
  products: Product[];
}

export function FeaturedProducts({ products }: FeaturedProductsProps) {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Produits Vedettes
          </h2>
          <p className="text-xl text-gray-600">
            Découvrez notre sélection de pièces les plus populaires
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <div 
              key={product.id}
              className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition transform hover:-translate-y-2 overflow-hidden group"
            >
              {/* Image */}
              <div className="relative h-64 bg-gray-200 overflow-hidden">
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                  onError={(e) => {
                    e.currentTarget.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f3f4f6' width='400' height='300'/%3E%3Ctext fill='%236b7280' font-size='24' font-family='Arial' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3E${product.name}%3C/text%3E%3C/svg%3E`;
                  }}
                />
                
                {/* Badges */}
                <div className="absolute top-4 left-4 space-y-2">
                  {product.badges.map((badge, index) => (
                    <div 
                      key={index}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        badge === 'NOUVEAU' ? 'bg-success text-white' :
                        badge === 'PROMO' ? 'bg-destructive text-white' :
                        'bg-orange-500 text-white'
                      }`}
                    >
                      {badge}
                    </div>
                  ))}
                </div>

                {/* Stock Warning */}
                {product.stock < 20 && (
                  <div className="absolute bottom-4 left-4 bg-destructive text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1 animate-pulse">
                    <AlertCircle className="h-3 w-3" />
                    <span>Plus que {product.stock} en stock!</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="text-sm text-gray-500 font-semibold mb-2">{product.brand}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{product.name}</h3>
                
                {/* Rating */}
                <div className="flex items-center space-x-2 mb-4">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i}
                        className={`h-4 w-4 ${
                          i < Math.floor(product.rating) 
                            ? 'text-yellow-400 fill-yellow-400' 
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-600">
                    {product.rating} ({product.reviews} avis)
                  </span>
                </div>

                {/* Price */}
                <div className="mb-4">
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-bold text-indigo-600">
                      {product.price.toFixed(2)}€
                    </span>
                    {product.originalPrice && (
                      <span className="text-lg text-gray-400 line-through">
                        {product.originalPrice.toFixed(2)}€
                      </span>
                    )}
                    {product.promo > 0 && (
                      <Badge variant="error">-{product.promo}%</Badge>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-2">
                  <button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg font-semibold transition flex items-center justify-center space-x-2">
                    <ShoppingCart className="h-5 w-5" />
                    <span>Ajouter</span>
                  </button>
                  <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-lg transition">
                    <Eye className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <a 
            href="/produits" 
            className="inline-block bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-4 rounded-full font-semibold text-lg transition transform hover:scale-105 shadow-xl"
          >
            Voir tous les produits →
          </a>
        </div>
      </div>
    </section>
  );
}

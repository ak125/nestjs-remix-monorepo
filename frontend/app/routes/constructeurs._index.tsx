// 🏠 Page d'index des constructeurs
import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";

interface Brand {
  id: number;
  alias: string;
  name: string;
  logo: string;
  country: string;
  isPopular: boolean;
}

interface LoaderData {
  brands: Brand[];
  popularBrands: Brand[];
}

export async function loader(_: LoaderFunctionArgs) {
  // Mock data pour les marques
  const brands: Brand[] = [
    { id: 47, alias: 'dacia', name: 'DACIA', logo: 'dacia.webp', country: 'Roumanie', isPopular: true },
    { id: 22, alias: 'audi', name: 'AUDI', logo: 'audi.webp', country: 'Allemagne', isPopular: true },
    { id: 140, alias: 'bmw', name: 'BMW', logo: 'bmw.webp', country: 'Allemagne', isPopular: true },
    // ... autres marques
  ];

  return json<LoaderData>({
    brands,
    popularBrands: brands.filter(b => b.isPopular)
  });
}

export const meta: MetaFunction = () => [
  { title: "Constructeurs automobiles - Pièces détachées" },
  { name: "description", content: "Découvrez toutes les marques de véhicules et leurs pièces détachées" }
];

export default function ConstructeursIndex() {
  const { brands, popularBrands } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Constructeurs automobiles
        </h1>

        {/* Marques populaires */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">
            Marques populaires
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {popularBrands.map((brand) => (
              <Link
                key={brand.id}
                to={`/constructeurs/${brand.alias}-${brand.id}`}
                className="group block p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                    <img
                      src={`/images/brands/${brand.logo}`}
                      alt={brand.name}
                      className="w-12 h-12 object-contain"
                    />
                  </div>
                  <h3 className="font-medium text-gray-900">{brand.name}</h3>
                  <p className="text-sm text-gray-500">{brand.country}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Toutes les marques */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">
            Toutes les marques ({brands.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {brands.map((brand) => (
              <Link
                key={brand.id}
                to={`/constructeurs/${brand.alias}-${brand.id}`}
                className="group flex items-center p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <img
                  src={`/images/brands/${brand.logo}`}
                  alt={brand.name}
                  className="w-8 h-8 object-contain mr-3"
                />
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                    {brand.name}
                  </h3>
                  <p className="text-sm text-gray-500">{brand.country}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
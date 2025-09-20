// 📁 frontend/app/routes/_index.tsx
// 🎯 VERSION BASÉE SUR VOTRE PAGE PHP - Utilise les endpoints existants

import { type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, ShoppingCart, Package, Award, Shield, Clock, Users, Phone } from "lucide-react";

// 🏗️ Composant pour l'affichage hiérarchique du catalogue
function CatalogHierarchySection() {
  const [catalogHierarchy, setCatalogHierarchy] = useState<any>(null);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCatalogHierarchy() {
      try {
        const response = await fetch('http://localhost:3000/api/catalog/hierarchy');
        const data = await response.json();
        setCatalogHierarchy(data);
        console.log('🏗️ Hiérarchie récupérée:', data);
      } catch (error) {
        console.error('❌ Erreur lors de la récupération de la hiérarchie:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCatalogHierarchy();
  }, []);

  const toggleFamily = (familyId: number) => {
    const newExpanded = new Set(expandedFamilies);
    if (newExpanded.has(familyId)) {
      newExpanded.delete(familyId);
    } else {
      newExpanded.add(familyId);
    }
    setExpandedFamilies(newExpanded);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-4 text-gray-600">Chargement de la hiérarchie du catalogue...</p>
      </div>
    );
  }

  if (!catalogHierarchy?.families || catalogHierarchy.families.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Aucune famille trouvée dans le catalogue</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 📊 Statistiques globales */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-lg mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold">{catalogHierarchy.total_families}</div>
            <div className="text-blue-100">Familles de produits</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{catalogHierarchy.total_gammes}</div>
            <div className="text-blue-100">Gammes disponibles</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{catalogHierarchy.total_products?.toLocaleString()}</div>
            <div className="text-blue-100">Références au catalogue</div>
          </div>
        </div>
      </div>

      {/* 🏗️ Liste hiérarchique des familles */}
      <div className="space-y-4">
        {catalogHierarchy.families.map((family: any) => (
          <div key={family.mf_id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* 📁 En-tête de famille */}
            <div 
              className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleFamily(family.mf_id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <img 
                      src={`/upload/articles/familles-produits/${family.mf_pic}`}
                      alt={family.mf_name}
                      className="w-16 h-16 object-cover rounded-lg"
                      onError={(e) => {
                        e.currentTarget.src = '/upload/loading-min.gif';
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 mb-1">{family.mf_name}</h3>
                    <p className="text-gray-600 text-sm mb-2 line-clamp-2">{family.mf_description}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <Package className="w-4 h-4 mr-1" />
                        {family.stats.total_gammes} gammes
                      </span>
                      <span className="flex items-center">
                        <ShoppingCart className="w-4 h-4 mr-1" />
                        {family.stats.total_products.toLocaleString()} produits
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {expandedFamilies.has(family.mf_id) ? (
                    <ChevronDown className="w-6 h-6 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-6 h-6 text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            {/* 🎯 Gammes de la famille (collapsible) */}
            {expandedFamilies.has(family.mf_id) && (
              <div className="border-t border-gray-100 bg-gray-50">
                <div className="p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    Gammes disponibles dans {family.mf_name}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {family.gammes.map((gamme: any) => (
                      <Link
                        key={gamme.pg_id}
                        to={`/catalogue/gamme/${gamme.pg_alias}-${gamme.pg_id}`}
                        className="group"
                      >
                        <div className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
                          <div className="flex items-center space-x-3">
                            <img 
                              src={`/upload/articles/gammes-produits/catalogue/${gamme.pg_img}`}
                              alt={gamme.pg_name}
                              className="w-12 h-12 object-cover rounded-lg"
                              onError={(e) => {
                                e.currentTarget.src = '/upload/loading-min.gif';
                              }}
                            />
                            <div className="flex-1">
                              <h5 className="font-semibold text-gray-800 text-sm group-hover:text-blue-600 transition-colors">
                                {gamme.pg_name}
                              </h5>
                              <p className="text-xs text-gray-500 mb-1 line-clamp-1">{gamme.pg_description}</p>
                              <p className="text-xs text-blue-600 font-medium">
                                {gamme.product_count.toLocaleString()} produits
                              </p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
import { BrandCarousel } from "../components/home/BrandCarousel";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import VehicleSelector from "../components/vehicle/VehicleSelector";

// Configuration de l'API
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.automecanik.com' 
  : 'http://localhost:3000';

export const meta: MetaFunction = () => {
  return [
    { title: "Pièces Auto - Leader des pièces automobiles | Trouvez vos pièces auto en ligne" },
    { name: "description", content: "Découvrez notre large gamme de pièces automobiles de qualité. Livraison rapide, prix compétitifs et service client expert." },
    { name: "keywords", content: "pièces auto, pièces automobiles, pièces détachées, auto, voiture, mécanique" },
    { property: "og:title", content: "Pièces Auto - Leader des pièces automobiles" },
    { property: "og:description", content: "Votre spécialiste en pièces automobiles de qualité" },
    { property: "og:type", content: "website" },
    { name: "robots", content: "index, follow" },
  ];
};

// 🔧 Loader basé sur votre logique PHP originale
export async function loader() {
  try {
    console.log('🔄 Chargement des données de la homepage...');
    
    const [familiesResponse, brandsResponse, popularProductsResponse, suppliersResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/api/catalog/families/all`),
      fetch(`${API_BASE_URL}/api/catalog/brands`),
      fetch(`${API_BASE_URL}/api/catalog/popular-products`),
      fetch(`${API_BASE_URL}/api/catalog/suppliers`),
    ]);

    // Traitement des familles
    const familiesData = familiesResponse.ok ? await familiesResponse.json() : {};
    const familiesArray = Object.values(familiesData).flat();
    console.log(`✅ ${familiesArray.length} familles récupérées`);

    // Traitement des marques
    const brandsData = brandsResponse.ok ? await brandsResponse.json() : { brands: [] };
    console.log(`✅ ${brandsData.brands?.length || 0} marques récupérées`);

    // Traitement des produits populaires
    const popularProductsData = popularProductsResponse.ok ? await popularProductsResponse.json() : { products: [] };
    console.log(`✅ ${popularProductsData.products?.length || 0} produits populaires récupérés`);

    // Traitement des équipementiers
    const suppliersData = suppliersResponse.ok ? await suppliersResponse.json() : { suppliers: [] };
    console.log(`✅ ${suppliersData.suppliers?.length || 0} équipementiers récupérés`);

    // Calcul des statistiques
    const stats = {
      totalFamilies: familiesArray.length,
      totalBrands: brandsData.brands?.length || 0,
      totalProducts: 50000,
      satisfaction: 4.8,
    };

    return {
      families: familiesArray,
      brands: brandsData.brands || [],
      popularProducts: popularProductsData.products || [],
      suppliers: suppliersData.suppliers || [],
      stats,
      success: true,
    };
  } catch (error) {
    console.error('❌ Erreur lors du chargement de la homepage:', error);
    return {
      families: [],
      brands: [],
      popularProducts: [],
      stats: { totalFamilies: 0, totalBrands: 0, totalProducts: 0, satisfaction: 0 },
      success: false,
    };
  }
}

export default function Index() {
  const { families, brands, popularProducts, suppliers, stats } = useLoaderData<typeof loader>();

  // � Debug logs temporaires
  console.log('🔍 Debug Frontend - suppliers:', suppliers);
  console.log('🔍 Debug Frontend - popularProducts:', popularProducts);
  console.log('🔍 Debug Frontend - brands:', brands);

  // �🚗 Gestion du sélecteur de véhicule
  const handleVehicleSelected = (selection: any) => {
    console.log('🚗 Véhicule sélectionné:', selection);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* 🎯 Hero Section avec sélecteur de véhicule */}
      <section className="relative bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white py-20">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto mb-12">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
              Trouvez vos pièces auto parfaites
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-8">
              Plus de {stats.totalProducts?.toLocaleString() || '50 000'} pièces en stock - Livraison express
            </p>
            
            {/* 🔍 Barre de recherche */}
            <div className="max-w-2xl mx-auto mb-8">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Rechercher par référence, marque, modèle..."
                  className="w-full px-6 py-4 text-lg text-gray-900 bg-white rounded-lg shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-300 pr-32"
                />
                <button className="absolute right-2 top-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                  Rechercher
                </button>
              </div>
              <p className="text-sm text-blue-200 mt-2">
                Ou sélectionnez votre véhicule ci-dessous pour un catalogue personnalisé
              </p>
            </div>
          </div>

          {/* 🚗 Sélecteur de véhicule */}
          <div className="max-w-4xl mx-auto">
            <VehicleSelector onVehicleSelected={handleVehicleSelected} />
          </div>

          {/* 📊 Statistiques */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-400">{stats.totalProducts?.toLocaleString() || '50K'}</div>
              <div className="text-blue-100">Pièces en stock</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">{stats.totalBrands || '40'}+</div>
              <div className="text-blue-100">Marques référencées</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">25,000</div>
              <div className="text-blue-100">Commandes livrées</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-400">{stats.satisfaction}/5</div>
              <div className="text-blue-100">Satisfaction client</div>
            </div>
          </div>
        </div>
      </section>

      {/* 🏷️ Section Marques automobiles */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">Marques populaires</h2>
          <BrandCarousel brands={brands} />
          <div className="mt-12 text-center">
            <p className="text-gray-600 max-w-4xl mx-auto">
              Automecanik vous propose toutes les marques des constructeurs automobiles européens et étrangers vendus en Europe 
              et plus précisément sur le marché français, présentées par ordre alphabétique et selon le logo de la marque constructeur de votre véhicule.
            </p>
          </div>
        </div>
      </section>

      {/* 📁 Section Pièces les plus vendues */}
      {popularProducts?.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold text-gray-800">Les pièces les plus vendues</h2>
              <p className="text-gray-600 mt-4">
                Découvrez nos produits les plus populaires, plébiscités par nos clients
              </p>
            </div>

            <div className="relative bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <Award className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Produits populaires</h3>
                      <p className="text-green-100 text-sm">
                        {popularProducts.length} produits sélectionnés
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6">
                {popularProducts.map((product: any) => (
                  <div 
                    key={product.pg_id} 
                    className="bg-gray-50 rounded-xl p-4 hover:bg-gradient-to-br hover:from-green-50 hover:to-green-100 hover:shadow-lg transition-all duration-300 border-2 border-transparent hover:border-green-200"
                  >
                    <div className="text-center">
                      <div className="w-full h-40 mb-4 bg-white rounded-lg shadow-sm flex items-center justify-center overflow-hidden">
                        <img 
                          src={`/upload/articles/gammes-produits/catalogue/${product.pg_img}`}
                          alt={product.pg_name_meta}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = '/upload/loading-min.gif';
                          }}
                        />
                      </div>
                      <h4 className="font-bold text-gray-900 mb-2 text-sm">
                        {product.sg_title}
                      </h4>
                      <p className="text-gray-600 text-xs mb-3 line-clamp-2">
                        {product.sg_description}
                      </p>
                      <div className="mt-3">
                        <Link
                          to={`/catalogue/gamme/${product.pg_alias}-${product.pg_id}`}
                          className="inline-flex items-center justify-center text-green-600 text-xs font-semibold hover:text-green-800 transition-colors"
                        >
                          <ShoppingCart className="w-3 h-3 mr-1" />
                          Voir les produits
                        </Link>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {product.ba_preview}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 🏗️ Section Catalogue Hiérarchique */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-800">Catalogue par familles</h2>
            <p className="text-gray-600 mt-4">
              Découvrez nos pièces automobiles organisées par familles techniques avec leurs gammes associées
            </p>
          </div>

          <CatalogHierarchySection />
        </div>
      </section>

      {/* 🎯 Section Accès rapide */}
      <section className="py-12 bg-gradient-to-r from-gray-50 to-blue-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8 text-gray-800">Accès rapide</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 max-w-4xl mx-auto">
            {[
              { name: "Freinage", emoji: "🛑", href: "/catalog/freinage" },
              { name: "Moteur", emoji: "⚙️", href: "/catalog/moteur" },
              { name: "Filtration", emoji: "🔧", href: "/catalog/filtration" },
              { name: "Éclairage", emoji: "💡", href: "/catalog/eclairage" },
              { name: "Suspension", emoji: "🚗", href: "/catalog/suspension" },
              { name: "Carrosserie", emoji: "🔨", href: "/catalog/carrosserie" }
            ].map((item) => (
              <Link key={item.name} to={item.href} className="group">
                <Card className="text-center hover:shadow-lg transition-all duration-300 group-hover:scale-105">
                  <CardContent className="p-4">
                    <div className="text-3xl mb-2">{item.emoji}</div>
                    <p className="font-medium text-sm">{item.name}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 🏭 Section Équipementiers d'origine */}
      <section className="py-16 bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-800">
              Nos partenaires équipementiers d'origine
            </h2>
            <p className="text-gray-600 mt-4">
              Les plus grandes marques d'équipementiers automobile vous garantissent la qualité
            </p>
          </div>

          <div className="relative bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                      <path d="m2 17 10 5 10-5"/>
                      <path d="m2 12 10 5 10-5"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Équipementiers de confiance</h3>
                    <p className="text-blue-100 text-sm">{suppliers?.length || 0} marques partenaires</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 p-6">
              {suppliers?.map((supplier: any) => (
                <div 
                  key={supplier.pm_id}
                  className="bg-gray-50 rounded-xl p-4 text-center hover:bg-gradient-to-br hover:from-blue-50 hover:to-blue-100 hover:shadow-lg transition-all duration-300 border-2 border-transparent hover:border-blue-200"
                >
                  <div className="w-full h-20 mb-3 bg-white rounded-lg shadow-sm flex items-center justify-center overflow-hidden">
                    <img 
                      src={supplier.pm_logo} 
                      alt={`Logo ${supplier.pm_name}`} 
                      className="max-w-full max-h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm mb-1">{supplier.pm_name}</h4>
                  <p className="text-gray-600 text-xs line-clamp-2 mb-2">{supplier.pm_description}</p>
                  <div className="text-xs text-blue-600 font-medium">
                    ✓ Équipementier d'origine
                  </div>
                </div>
              ))}
            </div>

            {(!suppliers || suppliers.length === 0) && (
              <div className="text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16 text-gray-400 mx-auto mb-4">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="m2 17 10 5 10-5"/>
                  <path d="m2 12 10 5 10-5"/>
                </svg>
                <p className="text-gray-500">Aucun équipementier disponible</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 📁 Section Présentation Automecanik */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-800">
              Automecanik, votre magasin en ligne des pièces détachées
            </h2>
            <div className="w-24 h-1 bg-blue-600 mx-auto mt-4"></div>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="prose prose-lg text-gray-600 leading-relaxed">
              <p className="mb-6">
                Automecanik vous propose plusieurs références de pièces auto neuves et d'origine avec le meilleur rapport qualité/prix. 
                Toutes vos pièces auto se trouvent dans un catalogue en ligne, groupées dans divers catégories : freinage (plaquettes, disques, étrier de frein...), 
                filtration (filtre à huile, filtre à carburant...), moteur, direction/suspension, transmission, refroidissement (radiateur, pompe à eau...), 
                éclairage, climatisation/ventilation, pièces électriques (alternateur, démarreur, vanne EGR, débitmétre...) et accessoires.
              </p>
              
              <p className="mb-6">
                Quelque soit le type de motorisation essence ou diesel, Automecanik vend pièces auto compatibles avec tous les constructeurs automobiles du marché 
                tels que : Renault, Peugeot, Citroën, Audi, Fiat, Volkswagen, Ford, BMW, Mercedes, Alfa Romeo, Opel, Seat...etc.
              </p>
              
              <p>
                Toutes les pièces disponibles dans notre catalogue sont garanties par les plus grands équipementiers de pièces détachées automobile 
                et conformes aux normes européenne comme Bosch, Valeo, Luk, Sachs, Delphi, Febi, SKF, TRW, SNR, Gates, Dayco, Continental, 
                Magneti Marelli, Walker, Bosal, Bendix, ATE, Hella, Beru, Goodyear, Lizarte...etc.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ✨ Section Pourquoi nous choisir */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">Pourquoi nous choisir ?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: Shield,
                title: "Qualité garantie",
                description: "Toutes nos pièces sont certifiées et bénéficient d'une garantie constructeur",
                color: "text-blue-600"
              },
              {
                icon: Clock,
                title: "Livraison rapide", 
                description: "Expédition sous 24h et livraison express disponible",
                color: "text-green-600"
              },
              {
                icon: Users,
                title: "Support expert",
                description: "Nos mécaniciens vous conseillent pour choisir la bonne pièce",
                color: "text-purple-600"
              },
              {
                icon: Award,
                title: "Prix compétitifs",
                description: "Les meilleurs prix du marché avec notre garantie du prix le plus bas",
                color: "text-orange-600"
              }
            ].map((feature) => (
              <Card key={feature.title} className="text-center hover:shadow-lg transition-shadow">
                <CardHeader>
                  <feature.icon className={`h-12 w-12 ${feature.color} mx-auto mb-4`} />
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 📞 Section Contact */}
      <section className="py-16 bg-gradient-to-r from-blue-900 to-indigo-900 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Une question ? Besoin d'aide ?</h2>
          <p className="text-xl mb-8 text-blue-100">Nos experts sont là pour vous accompagner dans votre recherche</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/contact" 
              className="bg-white text-blue-900 hover:bg-blue-50 py-3 px-6 rounded-lg font-medium transition-colors inline-flex items-center"
            >
              <Phone className="mr-2 h-5 w-5" />
              Nous contacter
            </Link>
            <Link 
              to="/catalogue" 
              className="border border-white text-white hover:bg-white hover:text-blue-900 py-3 px-6 rounded-lg font-medium transition-colors inline-flex items-center"
            >
              <ShoppingCart className="mr-2 h-5 w-5" />
              Voir le catalogue
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
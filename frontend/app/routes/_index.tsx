import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useSearchParams, useLoaderData } from "@remix-run/react";
import { Package, Search, Star, Shield, Clock, Phone, Users, ShoppingCart, TrendingUp, Award } from 'lucide-react';
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export const meta: MetaFunction = () => {
  return [
    { title: "Accueil - Automecanik | Pièces automobiles en ligne" },
    { name: "description", content: "Découvrez notre large gamme de pièces automobiles de qualité. Livraison rapide, prix compétitifs et service client expert." },
  ];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  // Cette page est UNIQUEMENT pour les visiteurs publics
  // Les utilisateurs connectés vont directement à leurs dashboards respectifs
  
  // Récupérer les statistiques publiques pour la landing page
  let stats = {
    totalOrders: 0,
    totalUsers: 0,
    totalSuppliers: 0,
    success: false
  };

  try {
    const response = await fetch('http://localhost:3000/api/dashboard/stats', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      stats = await response.json();
    }
  } catch (error) {
    console.warn('Impossible de récupérer les statistiques publiques:', error);
  }

  // Retourner les données pour la landing page publique
  return json({
    timestamp: new Date().toISOString(),
    stats
  });
}

export default function Index() {
  const [searchParams] = useSearchParams();
  const { stats } = useLoaderData<typeof loader>();
  const welcomeMessage = searchParams.get("welcome") === "true";

  // Formatage des nombres pour affichage
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  return (
    <div className="min-h-screen">
      {welcomeMessage && (
        <div className="container mx-auto px-4 py-4">
          <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg border border-green-200">
            🎉 <strong>Bienvenue !</strong> Votre compte a été créé avec succès et vous êtes maintenant connecté.
          </div>
        </div>
      )}

      {/* Hero Section Modernisée */}
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 text-white py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
            Automecanik
          </h1>
          <p className="text-xl md:text-2xl mb-12 max-w-4xl mx-auto leading-relaxed">
            Votre spécialiste en pièces automobiles depuis plus de 20 ans. 
            Qualité, performance et prix compétitifs pour tous vos véhicules.
          </p>
          
          {/* Statistiques Temps Réel */}
          {stats.success && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <div className="flex items-center justify-center mb-3">
                  <ShoppingCart className="w-8 h-8 text-blue-200" />
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {formatNumber(stats.totalOrders || 0)}
                </div>
                <div className="text-blue-200 text-sm">Commandes traitées</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <div className="flex items-center justify-center mb-3">
                  <Users className="w-8 h-8 text-blue-200" />
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {formatNumber(stats.totalUsers || 0)}
                </div>
                <div className="text-blue-200 text-sm">Clients satisfaits</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <div className="flex items-center justify-center mb-3">
                  <Award className="w-8 h-8 text-blue-200" />
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {formatNumber(stats.totalSuppliers || 0)}+
                </div>
                <div className="text-blue-200 text-sm">Marques partenaires</div>
              </div>
            </div>
          )}
          
          {/* Recherche rapide modernisée */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 max-w-4xl mx-auto mb-10 shadow-2xl">
            <h3 className="text-gray-800 text-lg font-semibold mb-6">Trouvez vos pièces rapidement</h3>
            <div className="flex flex-col md:flex-row gap-4">
              <select className="flex-1 p-4 border border-gray-200 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all">
                <option>Sélectionner la marque</option>
                <option>Renault</option>
                <option>Peugeot</option>
                <option>Citroën</option>
                <option>BMW</option>
                <option>Mercedes</option>
                <option>Audi</option>
                <option>Volkswagen</option>
              </select>
              <input 
                type="text" 
                placeholder="Modèle, année, ou référence..."
                className="flex-1 p-4 border border-gray-200 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <Button size="lg" className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 px-10 py-4 rounded-xl shadow-lg transform hover:scale-105 transition-all">
                <Search className="w-5 h-5 mr-2" />
                Rechercher
              </Button>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link to="/catalogue">
              <Button size="lg" variant="outline" className="text-white border-2 border-white hover:bg-white hover:text-blue-600 px-8 py-4 rounded-xl font-semibold transform hover:scale-105 transition-all">
                <Package className="w-5 h-5 mr-2" />
                Explorer le catalogue
              </Button>
            </Link>
            <Link to="/app">
              <Button size="lg" className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 px-8 py-4 rounded-xl font-semibold transform hover:scale-105 transition-all">
                Accéder à mon espace
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Avantages Modernisés */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">Pourquoi choisir Automecanik ?</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Des avantages qui font la différence pour votre satisfaction</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Shield className="w-10 h-10 text-white" />
                </div>
                <CardTitle className="text-2xl text-gray-800 group-hover:text-blue-600 transition-colors">Qualité garantie</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 leading-relaxed">
                  Toutes nos pièces sont certifiées et bénéficient d'une garantie constructeur. 
                  Qualité OEM et aftermarket premium uniquement.
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Clock className="w-10 h-10 text-white" />
                </div>
                <CardTitle className="text-2xl text-gray-800 group-hover:text-green-600 transition-colors">Livraison rapide</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 leading-relaxed">
                  Expédition sous 24h pour les pièces en stock. 
                  Livraison express disponible partout en France.
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Phone className="w-10 h-10 text-white" />
                </div>
                <CardTitle className="text-2xl text-gray-800 group-hover:text-orange-600 transition-colors">Support expert</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 leading-relaxed">
                  Nos conseillers techniques vous accompagnent dans le choix 
                  de vos pièces. Assistance gratuite par téléphone ou chat.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Performance et Confiance */}
      <section className="py-16 bg-gradient-to-r from-blue-900 to-purple-900 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-12">Nos performances parlent pour nous</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="group">
              <div className="text-4xl font-bold mb-2 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-400" />
                99.2%
              </div>
              <p className="text-blue-200">Taux de satisfaction</p>
            </div>
            <div className="group">
              <div className="text-4xl font-bold mb-2 group-hover:scale-110 transition-transform">24h</div>
              <p className="text-blue-200">Livraison moyenne</p>
            </div>
            <div className="group">
              <div className="text-4xl font-bold mb-2 group-hover:scale-110 transition-transform">20+</div>
              <p className="text-blue-200">Années d'expérience</p>
            </div>
            <div className="group">
              <div className="text-4xl font-bold mb-2 group-hover:scale-110 transition-transform">500k+</div>
              <p className="text-blue-200">Pièces en stock</p>
            </div>
          </div>
        </div>
      </section>

      {/* Catégories populaires modernisées */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">Catégories populaires</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Trouvez rapidement ce dont vous avez besoin parmi nos catégories les plus demandées</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { nom: "Moteur", count: "2,500+", color: "from-red-500 to-red-600", iconColor: "text-red-600" },
              { nom: "Freinage", count: "1,800+", color: "from-blue-500 to-blue-600", iconColor: "text-blue-600" },
              { nom: "Suspension", count: "1,200+", color: "from-green-500 to-green-600", iconColor: "text-green-600" },
              { nom: "Électrique", count: "900+", color: "from-purple-500 to-purple-600", iconColor: "text-purple-600" },
              { nom: "Carrosserie", count: "1,500+", color: "from-orange-500 to-orange-600", iconColor: "text-orange-600" },
              { nom: "Filtration", count: "800+", color: "from-indigo-500 to-indigo-600", iconColor: "text-indigo-600" },
              { nom: "Éclairage", count: "600+", color: "from-pink-500 to-pink-600", iconColor: "text-pink-600" },
              { nom: "Accessoires", count: "1,000+", color: "from-teal-500 to-teal-600", iconColor: "text-teal-600" }
            ].map((categorie) => (
              <Link 
                key={categorie.nom}
                to={`/catalogue?category=${categorie.nom.toLowerCase()}`}
                className="group"
              >
                <Card className="text-center hover:shadow-xl transition-all duration-300 group-hover:scale-105 border-0 bg-white overflow-hidden">
                  <CardContent className="p-6 relative">
                    <div className={`absolute inset-0 bg-gradient-to-br ${categorie.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                    <div className="relative z-10">
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${categorie.color} flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}>
                        <Package className="w-8 h-8 text-white" />
                      </div>
                      <h3 className={`font-bold text-gray-900 mb-2 group-hover:${categorie.iconColor} transition-colors`}>{categorie.nom}</h3>
                      <p className="text-sm text-gray-500 font-medium">{categorie.count} articles</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Témoignages modernisés */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">Ils nous font confiance</h2>
            <div className="flex justify-center items-center gap-3 mb-6">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-7 h-7 text-yellow-400 fill-current" />
                ))}
              </div>
              <span className="ml-3 text-2xl font-bold text-gray-700">4.8/5</span>
              <span className="text-gray-500 text-lg">(2,847 avis)</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                nom: "Michel D.",
                role: "Garage indépendant",
                avis: "Service irréprochable, livraison rapide et pièces conformes. Je recommande pour tous les professionnels.",
                avatar: "M"
              },
              {
                nom: "Sarah L.",
                role: "Particulière",
                avis: "Facile de trouver les bonnes pièces grâce à la recherche par véhicule. Prix très compétitifs !",
                avatar: "S"
              },
              {
                nom: "Jean-Paul M.",
                role: "Mécanicien",
                avis: "Plus de 10 ans de partenariat. Qualité constante et support technique au top. Parfait !",
                avatar: "J"
              }
            ].map((temoignage, index) => (
              <Card key={index} className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-0 bg-white">
                <CardContent className="p-8">
                  <div className="flex mb-6">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-600 mb-6 italic text-lg leading-relaxed">"{temoignage.avis}"</p>
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                      {temoignage.avatar}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-lg">{temoignage.nom}</div>
                      <div className="text-gray-500">{temoignage.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Call to action modernisé */}
      <section className="py-20 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Prêt à trouver vos pièces ?</h2>
          <p className="text-xl mb-12 max-w-3xl mx-auto leading-relaxed">
            Rejoignez des milliers de clients satisfaits et découvrez notre catalogue complet 
            de pièces automobiles de qualité professionnelle
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link to="/catalogue">
              <Button size="lg" variant="outline" className="text-white border-2 border-white hover:bg-white hover:text-purple-600 px-10 py-4 rounded-xl text-lg font-semibold transform hover:scale-105 transition-all">
                <Package className="w-6 h-6 mr-2" />
                Explorer le catalogue
              </Button>
            </Link>
            <Link to="/app">
              <Button size="lg" className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 px-10 py-4 rounded-xl text-lg font-semibold transform hover:scale-105 transition-all shadow-lg">
                <Users className="w-6 h-6 mr-2" />
                Accéder à mon espace
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

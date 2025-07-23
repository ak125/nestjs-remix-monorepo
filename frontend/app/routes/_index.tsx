import { type LoaderFunctionArgs, json, type MetaFunction } from "@remix-run/node";
import { Link, useSearchParams } from "@remix-run/react";
import { Package, Search, Star, Shield, Clock, Phone } from 'lucide-react';
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export const meta: MetaFunction = () => {
  return [
    { title: "Accueil - Automecanik | Pièces automobiles en ligne" },
    { name: "description", content: "Découvrez notre large gamme de pièces automobiles de qualité. Livraison rapide, prix compétitifs et service client expert." },
  ];
};

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  return json({
    timestamp: new Date().toISOString()
  });
};

export default function Index() {
  const [searchParams] = useSearchParams();
  const welcomeMessage = searchParams.get("welcome") === "true";

  return (
    <div className="min-h-screen">
      {welcomeMessage && (
        <div className="container mx-auto px-4 py-4">
          <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg border border-green-200">
            🎉 <strong>Bienvenue !</strong> Votre compte a été créé avec succès et vous êtes maintenant connecté.
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-600 to-blue-800 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Automecanik
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
            Votre spécialiste en pièces automobiles depuis plus de 20 ans. 
            Qualité, performance et prix compétitifs pour tous vos véhicules.
          </p>
          
          {/* Recherche rapide */}
          <div className="bg-white rounded-lg p-6 max-w-4xl mx-auto mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <select className="flex-1 p-3 border border-gray-300 rounded-lg text-gray-900">
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
                className="flex-1 p-3 border border-gray-300 rounded-lg text-gray-900"
              />
              <Button size="lg" className="bg-orange-500 hover:bg-orange-600 px-8">
                <Search className="w-5 h-5 mr-2" />
                Rechercher
              </Button>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/catalogue">
              <Button size="lg" variant="outline" className="text-white border-white hover:bg-white hover:text-blue-600">
                <Package className="w-5 h-5 mr-2" />
                Explorer le catalogue
              </Button>
            </Link>
            <Link to="/login?returnTo=/">
              <Button size="lg" className="bg-green-600 hover:bg-green-700">
                Mon compte
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Avantages */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Pourquoi choisir Automecanik ?</h2>
            <p className="text-lg text-gray-600">Des avantages qui font la différence</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardHeader>
                <Shield className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <CardTitle>Qualité garantie</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Toutes nos pièces sont certifiées et bénéficient d'une garantie constructeur. 
                  Qualité OEM et aftermarket premium uniquement.
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardHeader>
                <Clock className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <CardTitle>Livraison rapide</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Expédition sous 24h pour les pièces en stock. 
                  Livraison express disponible partout en France.
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardHeader>
                <Phone className="w-12 h-12 text-orange-600 mx-auto mb-4" />
                <CardTitle>Support expert</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Nos conseillers techniques vous accompagnent dans le choix 
                  de vos pièces. Assistance gratuite par téléphone ou chat.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Catégories populaires */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Catégories populaires</h2>
            <p className="text-lg text-gray-600">Trouvez rapidement ce dont vous avez besoin</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { nom: "Moteur", count: "2,500+", color: "bg-red-100 text-red-600" },
              { nom: "Freinage", count: "1,800+", color: "bg-blue-100 text-blue-600" },
              { nom: "Suspension", count: "1,200+", color: "bg-green-100 text-green-600" },
              { nom: "Électrique", count: "900+", color: "bg-purple-100 text-purple-600" },
              { nom: "Carrosserie", count: "1,500+", color: "bg-orange-100 text-orange-600" },
              { nom: "Filtration", count: "800+", color: "bg-indigo-100 text-indigo-600" },
              { nom: "Éclairage", count: "600+", color: "bg-pink-100 text-pink-600" },
              { nom: "Accessoires", count: "1,000+", color: "bg-teal-100 text-teal-600" }
            ].map((categorie) => (
              <Link 
                key={categorie.nom}
                to={`/catalogue?category=${categorie.nom.toLowerCase()}`}
                className="group"
              >
                <Card className="text-center hover:shadow-lg transition-shadow group-hover:scale-105 transition-transform">
                  <CardContent className="p-6">
                    <div className={`w-16 h-16 rounded-full ${categorie.color} flex items-center justify-center mx-auto mb-4`}>
                      <Package className="w-8 h-8" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{categorie.nom}</h3>
                    <p className="text-sm text-gray-500">{categorie.count} articles</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Témoignages */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Ils nous font confiance</h2>
            <div className="flex justify-center items-center gap-2 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-6 h-6 text-yellow-400 fill-current" />
              ))}
              <span className="ml-2 text-lg font-semibold text-gray-700">4.8/5</span>
              <span className="text-gray-500">(2,847 avis)</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                nom: "Michel D.",
                role: "Garage indépendant",
                avis: "Service irréprochable, livraison rapide et pièces conformes. Je recommande pour tous les professionnels."
              },
              {
                nom: "Sarah L.",
                role: "Particulière",
                avis: "Facile de trouver les bonnes pièces grâce à la recherche par véhicule. Prix très compétitifs !"
              },
              {
                nom: "Jean-Paul M.",
                role: "Mécanicien",
                avis: "Plus de 10 ans de partenariat. Qualité constante et support technique au top. Parfait !"
              }
            ].map((temoignage, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-600 mb-4 italic">"{temoignage.avis}"</p>
                  <div>
                    <div className="font-semibold text-gray-900">{temoignage.nom}</div>
                    <div className="text-sm text-gray-500">{temoignage.role}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Call to action */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Prêt à trouver vos pièces ?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Rejoignez des milliers de clients satisfaits et découvrez notre catalogue complet
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/catalogue">
              <Button size="lg" variant="outline" className="text-white border-white hover:bg-white hover:text-blue-600">
                Explorer le catalogue
              </Button>
            </Link>
            <Link to="/register">
              <Button size="lg" className="bg-green-600 hover:bg-green-700">
                Créer un compte gratuit
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

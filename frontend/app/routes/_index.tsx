import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { Link, useSearchParams } from "@remix-run/react";
import { Package, ReceiptEuro, Users, BarChart3 } from 'lucide-react';
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  // Optionnel : charger des statistiques d'accueil
  return json({
    timestamp: new Date().toISOString()
  });
};

export default function Index() {
  const [searchParams] = useSearchParams();
  const welcomeMessage = searchParams.get("welcome") === "true";

  return (
    <div className="container mx-auto px-4 py-8">
      {welcomeMessage && (
        <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg border border-green-200">
          🎉 <strong>Bienvenue !</strong> Votre compte a été créé avec succès et vous êtes maintenant connecté.
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Tableau de bord Automecanik
        </h1>
        <p className="text-gray-600">
          Gérez vos commandes, factures et clients en toute simplicité
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Section Commandes */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Commandes
            </CardTitle>
            <CardDescription>
              Gérez vos commandes clients : consultation, création, suivi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Link to="/orders">
                <Button className="w-full" variant="default">
                  Toutes les commandes
                </Button>
              </Link>
              <Link to="/orders/new">
                <Button className="w-full" variant="outline">
                  Nouvelle commande
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Section Factures */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptEuro className="h-5 w-5 text-green-600" />
              Factures
            </CardTitle>
            <CardDescription>
              Gérez vos factures et paiements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button className="w-full" variant="default" disabled>
                Toutes les factures
              </Button>
              <Button className="w-full" variant="outline" disabled>
                Nouvelle facture
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Fonctionnalité en développement
            </p>
          </CardContent>
        </Card>

        {/* Section Clients */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              Clients
            </CardTitle>
            <CardDescription>
              Gérez votre base clients
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button className="w-full" variant="default" disabled>
                Tous les clients
              </Button>
              <Button className="w-full" variant="outline" disabled>
                Nouveau client
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Fonctionnalité en développement
            </p>
          </CardContent>
        </Card>

        {/* Section Statistiques */}
        <Card className="hover:shadow-lg transition-shadow md:col-span-2 lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-orange-600" />
              Statistiques rapides
            </CardTitle>
            <CardDescription>
              Vue d'ensemble de votre activité
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900">Commandes</h3>
                <p className="text-2xl font-bold text-blue-600">-</p>
                <p className="text-sm text-blue-700">Total aujourd'hui</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900">Chiffre d'affaires</h3>
                <p className="text-2xl font-bold text-green-600">-</p>
                <p className="text-sm text-green-700">Ce mois</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-900">Clients actifs</h3>
                <p className="text-2xl font-bold text-purple-600">-</p>
                <p className="text-sm text-purple-700">Cette semaine</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Les statistiques seront disponibles prochainement
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Section d'actions rapides */}
      <div className="mt-8 p-6 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Actions rapides</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/orders/new">
            <Button size="sm" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Nouvelle commande
            </Button>
          </Link>
          <Link to="/orders">
            <Button size="sm" variant="outline" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Voir les commandes
            </Button>
          </Link>
          <Button size="sm" variant="outline" disabled>
            <ReceiptEuro className="h-4 w-4 mr-2" />
            Nouvelle facture
          </Button>
        </div>
      </div>
    </div>
  );
}

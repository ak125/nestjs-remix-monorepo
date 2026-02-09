/**
 * 🚫 PAGE D'ACCÈS REFUSÉ - VERSION MODERNISÉE
 *
 * Combine le meilleur de l'existant + nouvelles fonctionnalités
 * Remplace get.access.response.no.privilege.php (legacy)
 */

import { type MetaFunction } from "@remix-run/node";
import { Link, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { AlertTriangle, Home, Mail, Phone } from "lucide-react";
import { Error404 } from "~/components/errors/Error404";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

export const meta: MetaFunction = () => [
  { title: "Accès non autorisé | Automecanik" },
  { name: "robots", content: "noindex, nofollow" },
];

export default function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full">
        <Card className="shadow-lg">
          <CardContent className="p-8 text-center">
            {/* Icône d'erreur modernisée */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </div>

            {/* Message principal */}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Accès Non Autorisé
            </h1>
            <p className="text-gray-600 mb-8">
              Vous n'avez pas les privilèges nécessaires pour accéder à cette
              ressource. Contactez votre administrateur si vous pensez qu'il
              s'agit d'une erreur.
            </p>

            {/* Actions principales */}
            <div className="space-y-3 mb-6">
              <Button asChild className="w-full">
                <Link to="/">
                  <Home className="w-4 h-4 mr-2" />
                  Retour à l'accueil
                </Link>
              </Button>

              <Button variant="outline" asChild className="w-full">
                <Link to="/_public/aide">
                  <Mail className="w-4 h-4 mr-2" />
                  Centre d'aide
                </Link>
              </Button>
            </div>

            {/* Contact d'urgence */}
            <div className="border-t border-gray-200 pt-6">
              <p className="text-sm text-gray-500 mb-3">
                Besoin d'aide immédiate ?
              </p>
              <div className="flex justify-center space-x-4">
                <a
                  href="tel:+33123456789"
                  className="flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  <Phone className="w-4 h-4 mr-1" />
                  01 23 45 67 89
                </a>
                <a
                  href="mailto:contact@automecanik.com"
                  className="flex items-center text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  <Mail className="w-4 h-4 mr-1" />
                  Email
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}

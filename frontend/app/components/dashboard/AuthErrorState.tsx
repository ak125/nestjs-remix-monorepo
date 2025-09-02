import { Link } from "@remix-run/react";
import { AlertTriangle } from "lucide-react";

import { Button } from "../ui/button";

interface AuthErrorStateProps {
  title?: string;
  description?: string;
  loginUrl?: string;
}

export function AuthErrorState({ 
  title = "Non authentifié",
  description = "Vous devez être connecté pour accéder au dashboard.",
  loginUrl = "/test/login"
}: AuthErrorStateProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center p-6">
        <div className="mx-auto h-16 w-16 mb-6 flex items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </div>
        
        <h1 className="text-xl font-semibold text-gray-900 mb-4">
          {title}
        </h1>
        
        <p className="text-sm text-gray-600 mb-6">
          {description}
        </p>
        
        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link to={loginUrl}>
              Se connecter
            </Link>
          </Button>
          
          <Button variant="outline" asChild className="w-full">
            <Link to="/">
              Retour à l'accueil
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

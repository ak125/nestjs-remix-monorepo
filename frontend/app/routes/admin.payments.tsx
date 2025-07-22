/**
 * Layout pour la section admin payments
 * Fournit la navigation entre les différentes sous-pages
 */

import { Outlet, Link, useLocation } from "@remix-run/react";
import { 
  CreditCard, 
  BarChart3, 
  List,
  ArrowLeft
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

export default function AdminPaymentsLayout() {
  const location = useLocation();
  
  const isActive = (path: string) => {
    if (path === '/admin/payments' && location.pathname === '/admin/payments') {
      return true;
    }
    if (path !== '/admin/payments' && location.pathname.startsWith(path)) {
      return true;
    }
    return false;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* En-tête avec navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <CreditCard className="w-8 h-8 mr-3" />
            Gestion des Paiements
          </h1>
          <p className="text-gray-600 mt-1">
            Administration des paiements et transactions
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour Admin
          </Link>
        </Button>
      </div>

      {/* Navigation des sous-sections */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={isActive('/admin/payments') ? 'default' : 'outline'}
              asChild
            >
              <Link to="/admin/payments">
                <BarChart3 className="w-4 h-4 mr-2" />
                Statistiques
              </Link>
            </Button>
            
            <Button
              variant={isActive('/admin/payments/transactions') ? 'default' : 'outline'}
              asChild
            >
              <Link to="/admin/payments/transactions">
                <List className="w-4 h-4 mr-2" />
                Transactions
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contenu de la sous-page */}
      <Outlet />
    </div>
  );
}

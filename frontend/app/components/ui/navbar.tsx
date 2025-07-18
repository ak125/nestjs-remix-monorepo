/**
 * Component de navigation principal avec différentiation des rôles
 * Affiche différents liens selon le type d'utilisateur
 */

import { Link, useLocation } from "@remix-run/react";
import { 
  Package, 
  User, 
  Settings, 
  LogOut, 
  Home,
  ShoppingCart,
  Users,
  BarChart3,
  Shield
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";

interface NavbarProps {
  user: {
    id: string;
    name: string;
    email: string;
    role?: string;
    isPro?: boolean;
    level?: number;
  } | null;
}

export default function Navbar({ user }: NavbarProps) {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Logique d'accès basée sur l'analyse du système PHP legacy
  // Système dual : 
  // - Clients (___xtr_customer) : level 0-1, isPro pour fonctionnalités étendues
  // - Administrateurs (___config_admin) : level 7-9 pour accès admin
  const isAdmin = user?.level && user.level >= 7; // Administrateurs commerciaux
  const isSuperAdmin = user?.level && user.level >= 9; // Super-administrateurs
  const isProClient = user?.isPro === true; // Client professionnel

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          {/* Logo et branding */}
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center space-x-2">
              <Package className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">OrderHub</span>
            </Link>
            
            {/* Indicateur de rôle */}
            {isAdmin && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                <Shield className="w-3 h-3 mr-1" />
                Admin
              </Badge>
            )}
          </div>

          {/* Navigation principale */}
          <div className="hidden md:flex items-center space-x-6">
            {/* Accueil - Accessible à tous */}
            <Link
              to="/"
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/') && location.pathname === '/'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Accueil</span>
            </Link>

            {/* Section UTILISATEURS STANDARDS */}
            {!isAdmin && (
              <>
                {/* Séparateur visuel */}
                <div className="h-6 w-px bg-gray-300"></div>
                
                <Link
                  to="/my-orders"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/my-orders')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Mes commandes</span>
                </Link>
                
                <Link
                  to="/orders/new"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/orders/new')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>Nouvelle commande</span>
                </Link>
              </>
            )}

            {/* Section ADMINISTRATEURS */}
            {isAdmin && (
              <>
                {/* Séparateur visuel avec label */}
                <div className="flex items-center space-x-2">
                  <div className="h-6 w-px bg-gray-300"></div>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    ADMINISTRATION
                  </span>
                  <div className="h-6 w-px bg-gray-300"></div>
                </div>
                
                <Link
                  to="/admin/orders"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/orders')
                      ? 'bg-red-100 text-red-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-red-50'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>Gestion commandes</span>
                </Link>
                
                <Link
                  to="/admin/customers"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/customers')
                      ? 'bg-red-100 text-red-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-red-50'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Clients</span>
                </Link>
                
                <Link
                  to="/admin/reports"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/reports')
                      ? 'bg-red-100 text-red-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-red-50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Rapports</span>
                </Link>
              </>
            )}

            {/* Section SUPER-ADMINISTRATEURS */}
            {isSuperAdmin && (
              <>
                {/* Séparateur visuel avec label */}
                <div className="flex items-center space-x-2">
                  <div className="h-6 w-px bg-gray-300"></div>
                  <span className="text-xs font-medium text-white bg-red-600 px-2 py-1 rounded">
                    SUPER-ADMIN
                  </span>
                  <div className="h-6 w-px bg-gray-300"></div>
                </div>
                
                <Link
                  to="/admin/staff"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/staff')
                      ? 'bg-red-100 text-red-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-red-50'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Gestion Staff</span>
                </Link>
                
                <Link
                  to="/admin/payment"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/payment')
                      ? 'bg-red-100 text-red-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-red-50'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>Gestion Paiements</span>
                </Link>
              </>
            )}
          </div>

          {/* Menu utilisateur */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <div className="hidden md:block text-right">
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/profile">
                      <User className="w-4 h-4 mr-1" />
                      Profil
                    </Link>
                  </Button>
                  
                  <form action="/logout" method="post" className="inline">
                    <Button variant="outline" size="sm" type="submit">
                      <LogOut className="w-4 h-4 mr-1" />
                      Déconnexion
                    </Button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Button variant="outline" asChild>
                  <Link to="/login">Connexion</Link>
                </Button>
                <Button asChild>
                  <Link to="/register">Inscription</Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation mobile */}
        <div className="md:hidden mt-4">
          <div className="flex flex-wrap gap-2">
            <Link
              to="/"
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/') && location.pathname === '/'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Accueil</span>
            </Link>

            {!isAdmin && (
              <>
                <Link
                  to="/my-orders"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/my-orders')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Mes commandes</span>
                </Link>
                
                <Link
                  to="/orders/new"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/orders/new')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>Nouvelle commande</span>
                </Link>
              </>
            )}

            {isAdmin && (
              <>
                <Link
                  to="/admin/orders"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/orders')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>Gestion</span>
                </Link>
                
                <Link
                  to="/admin/customers"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/customers')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Clients</span>
                </Link>
                
                <Link
                  to="/admin/reports"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/reports')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Rapports</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

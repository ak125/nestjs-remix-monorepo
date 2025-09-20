/**
 * Component de navigation principal avec différentiation des rôles
 * Affiche différents liens selon le type d'utilisateur
 */

import { Link, useLocation } from "@remix-run/react";
import { 
  Package, 
  User, 
  LogOut, 
  Home,
  ShoppingCart,
  Users,
  BarChart3,
  Shield,
  CreditCard,
  Truck,
  UserCog,
  FileText
} from "lucide-react";
import { Badge } from "./badge";
import { Button } from "./button";

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

  // Organisation des niveaux d'accès
  // Niveau 7+ (Admin) : Dashboard, Commandes, Utilisateurs, Rapports
  // Niveau 9 (Super-Admin) : + Staff, Paiements, Fournisseur
  const isAdmin = user?.level && user.level >= 7; // Administrateurs commerciaux
  const isSuperAdmin = user?.level && user.level >= 9; // Super-administrateurs
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isProClient = user?.isPro === true; // Client professionnel - TODO: implémenter fonctionnalités pro

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
                  to="/account/orders"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/account/orders')
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

            {/* Section ADMINISTRATEURS - Niveau 7+ */}
            {isAdmin && (
              <>
                {/* Séparateur visuel avec label */}
                <div className="flex items-center space-x-2">
                  <div className="h-6 w-px bg-gray-300"></div>
                  <span className="text-xs font-medium text-white bg-blue-600 px-2 py-1 rounded">
                    ADMIN (Niveau {user?.level})
                  </span>
                  <div className="h-6 w-px bg-gray-300"></div>
                </div>
                
                {/* Dashboard */}
                <Link
                  to="/admin"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin') && location.pathname === '/admin'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-blue-50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Dashboard</span>
                </Link>
                
                {/* Commandes */}
                <Link
                  to="/admin/orders"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/orders')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-blue-50'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>Commandes</span>
                </Link>
                
                {/* Utilisateurs */}
                <Link
                  to="/admin/users"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/users')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-blue-50'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Utilisateurs</span>
                </Link>
                
                {/* Rapports */}
                <Link
                  to="/admin/reports"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/reports')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-blue-50'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Rapports</span>
                </Link>
              </>
            )}

            {/* Section SUPER-ADMINISTRATEURS - Niveau 9 */}
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
                
                {/* Staff */}
                <Link
                  to="/admin/staff"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/staff')
                      ? 'bg-red-100 text-red-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-red-50'
                  }`}
                >
                  <UserCog className="w-4 h-4" />
                  <span>Staff</span>
                </Link>
                
                {/* Paiements */}
                <Link
                  to="/admin/payments"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/payments')
                      ? 'bg-red-100 text-red-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-red-50'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Paiements</span>
                </Link>
                
                {/* Fournisseurs */}
                <Link
                  to="/admin/suppliers"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/suppliers')
                      ? 'bg-red-100 text-red-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-red-50'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  <span>Fournisseurs</span>
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
                    <Link to="/account/dashboard">
                      <User className="w-4 h-4 mr-1" />
                      Mon Compte
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
                  to="/account/orders"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/account/orders')
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

            {/* Navigation mobile - Section Admin */}
            {isAdmin && (
              <>
                {/* Badge Admin */}
                <div className="w-full">
                  <span className="text-xs font-medium text-white bg-blue-600 px-2 py-1 rounded">
                    ADMIN (Niveau {user?.level})
                  </span>
                </div>
                
                <Link
                  to="/admin"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin') && location.pathname === '/admin'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-blue-50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Dashboard</span>
                </Link>
                
                <Link
                  to="/admin/orders"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/orders')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-blue-50'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>Commandes</span>
                </Link>
                
                <Link
                  to="/admin/users"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/users')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-blue-50'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Utilisateurs</span>
                </Link>
                
                <Link
                  to="/admin/reports"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/reports')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-blue-50'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Rapports</span>
                </Link>
                
                {/* Section Super-Admin mobile */}
                {isSuperAdmin && (
                  <>
                    <div className="w-full">
                      <span className="text-xs font-medium text-white bg-red-600 px-2 py-1 rounded">
                        SUPER-ADMIN
                      </span>
                    </div>
                    
                    <Link
                      to="/admin/staff"
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive('/admin/staff')
                          ? 'bg-red-100 text-red-700'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-red-50'
                      }`}
                    >
                      <UserCog className="w-4 h-4" />
                      <span>Staff</span>
                    </Link>
                    
                    <Link
                      to="/admin/payments"
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive('/admin/payments')
                          ? 'bg-red-100 text-red-700'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-red-50'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Paiements</span>
                    </Link>
                    
                    <Link
                      to="/admin/suppliers"
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive('/admin/suppliers')
                          ? 'bg-red-100 text-red-700'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-red-50'
                      }`}
                    >
                      <Truck className="w-4 h-4" />
                      <span>Fournisseurs</span>
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

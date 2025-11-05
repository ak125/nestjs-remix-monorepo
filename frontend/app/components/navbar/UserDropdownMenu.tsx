/**
 * 👤 User Dropdown Menu - Menu utilisateur moderne avec Shadcn
 * 
 * Remplace les liens simples par un dropdown professionnel
 * Utilise Radix UI pour accessibilité et animations
 * 
 * Features:
 * - Menu compte utilisateur complet
 * - Icônes pour chaque action
 * - Séparateurs visuels
 * - Logout avec confirmation
 * - Badge rôle admin
 * - Responsive design
 */

import { Link } from '@remix-run/react';
import {
  Bell,
  CreditCard,
  Heart,
  LogOut,
  MapPin,
  Package,
  Settings,
  Shield,
  User,
  UserCircle,
} from 'lucide-react';

import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface UserDropdownMenuProps {
  user: {
    firstName?: string;
    lastName?: string;
    email?: string;
    level?: number;
  };
  /** Afficher le nom complet dans le trigger (desktop) */
  showName?: boolean;
  /** Classe CSS additionnelle pour le trigger */
  className?: string;
}

export function UserDropdownMenu({
  user,
  showName = false,
  className = '',
}: UserDropdownMenuProps) {
  const isAdmin = user && (user.level ?? 0) >= 7;
  const isSuperAdmin = user && (user.level ?? 0) >= 9;
  const displayName = user.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user.email || 'Utilisateur';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      >
        <UserCircle className="w-5 h-5" />
        {showName && (
          <span className="text-sm font-medium">{user.firstName}</span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56" align="end" forceMount>
        {/* Header avec info utilisateur */}
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            {user.email && (
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            )}
            {isAdmin && (
              <Badge
                variant="secondary"
                className="w-fit mt-1 bg-blue-100 text-blue-700 border-blue-300"
              >
                <Shield className="w-3 h-3 mr-1" />
                {isSuperAdmin ? 'Super Admin' : 'Admin'}
              </Badge>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Groupe Compte */}
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to="/account/dashboard" className="flex items-center cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>Mon compte</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/orders" className="flex items-center cursor-pointer">
              <Package className="mr-2 h-4 w-4" />
              <span>Mes commandes</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/addresses" className="flex items-center cursor-pointer">
              <MapPin className="mr-2 h-4 w-4" />
              <span>Mes adresses</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/favorites" className="flex items-center cursor-pointer">
              <Heart className="mr-2 h-4 w-4" />
              <span>Favoris</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Groupe Notifications & Préférences */}
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to="/notifications" className="flex items-center cursor-pointer">
              <Bell className="mr-2 h-4 w-4" />
              <span>Notifications</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/settings" className="flex items-center cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span>Paramètres</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/payment-methods" className="flex items-center cursor-pointer">
              <CreditCard className="mr-2 h-4 w-4" />
              <span>Moyens de paiement</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {/* Lien Admin si applicable */}
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                to="/admin"
                className="flex items-center cursor-pointer text-blue-600 font-medium"
              >
                <Shield className="mr-2 h-4 w-4" />
                <span>Administration</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />

        {/* Déconnexion */}
        <DropdownMenuItem asChild>
          <form method="POST" action="/auth/logout" className="w-full">
            <button
              type="submit"
              className="flex items-center w-full cursor-pointer text-red-600"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Déconnexion</span>
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

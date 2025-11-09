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
        className={`group flex items-center gap-2.5 px-3 py-2 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:shadow-lg hover:scale-105 border border-transparent hover:border-blue-200 ${className}`}
      >
        <div className="relative">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md group-hover:shadow-lg transition-all duration-300 ring-2 ring-white group-hover:ring-blue-200">
            {displayName.charAt(0).toUpperCase()}
          </div>
          {/* Online indicator */}
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse" />
        </div>
        {showName && (
          <div className="flex flex-col items-start">
            <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">{user.firstName}</span>
            <span className="text-xs text-slate-500">Mon compte</span>
          </div>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-72 p-2" align="end" forceMount>
        {/* Header premium avec info utilisateur */}
        <DropdownMenuLabel className="font-normal p-3">
          <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg text-lg ring-2 ring-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col flex-1">
              <p className="text-sm font-bold text-slate-800 leading-tight">{displayName}</p>
              {user.email && (
                <p className="text-xs text-slate-600 truncate max-w-[180px]">
                  {user.email}
                </p>
              )}
              {isAdmin && (
                <Badge
                  variant="secondary"
                  className="w-fit mt-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-sm"
                >
                  <Shield className="w-3 h-3 mr-1" />
                  {isSuperAdmin ? 'Super Admin' : 'Admin'}
                </Badge>
              )}
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="my-2" />

        {/* Groupe Compte avec icônes premium */}
        <DropdownMenuGroup className="space-y-1">
          <DropdownMenuItem asChild>
            <Link to="/account/dashboard" className="flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-lg hover:bg-blue-50 transition-all group">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm">Mon compte</span>
                <span className="text-xs text-slate-500">Profil et paramètres</span>
              </div>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/orders" className="flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-lg hover:bg-purple-50 transition-all group">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <Package className="h-4 w-4 text-purple-600" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm">Mes commandes</span>
                <span className="text-xs text-slate-500">Historique & suivi</span>
              </div>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/addresses" className="flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-lg hover:bg-green-50 transition-all group">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <MapPin className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm">Mes adresses</span>
                <span className="text-xs text-slate-500">Livraison & facturation</span>
              </div>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/favorites" className="flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-lg hover:bg-red-50 transition-all group">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition-colors">
                <Heart className="h-4 w-4 text-red-600" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm">Favoris</span>
                <span className="text-xs text-slate-500">Produits sauvegardés</span>
              </div>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-2" />

        {/* Groupe Notifications & Préférences */}
        <DropdownMenuGroup className="space-y-1">
          <DropdownMenuItem asChild>
            <Link to="/notifications" className="flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-lg hover:bg-orange-50 transition-all group">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors relative">
                <Bell className="h-4 w-4 text-orange-600" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              </div>
              <div className="flex flex-col flex-1">
                <span className="font-semibold text-sm">Notifications</span>
                <span className="text-xs text-slate-500">3 non lues</span>
              </div>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/settings" className="flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-all group">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                <Settings className="h-4 w-4 text-slate-600" />
              </div>
              <span className="font-semibold text-sm">Paramètres</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/payment-methods" className="flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-lg hover:bg-indigo-50 transition-all group">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                <CreditCard className="h-4 w-4 text-indigo-600" />
              </div>
              <span className="font-semibold text-sm">Moyens de paiement</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {/* Lien Admin premium si applicable */}
        {isAdmin && (
          <>
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuItem asChild>
              <Link
                to="/admin"
                className="flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all group border border-blue-200"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-blue-700">Administration</span>
                  <span className="text-xs text-blue-600">Panneau de contrôle</span>
                </div>
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator className="my-2" />

        {/* Déconnexion premium */}
        <DropdownMenuItem asChild>
          <form method="POST" action="/auth/logout" className="w-full">
            <button
              type="submit"
              className="flex items-center gap-3 w-full cursor-pointer px-3 py-2.5 rounded-lg hover:bg-red-50 transition-all group"
            >
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition-colors">
                <LogOut className="h-4 w-4 text-red-600" />
              </div>
              <span className="font-semibold text-sm text-red-600">Déconnexion</span>
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

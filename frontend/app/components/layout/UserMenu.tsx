/**
 * 👤 USER MENU - Menu utilisateur amélioré
 * 
 * Menu déroulant pour les actions utilisateur
 */

import { Link } from "@remix-run/react";
import { User, Settings, LogOut, Package, Heart } from "lucide-react";
import { useState } from "react";
import { useOptionalUser } from "../../root";

interface UserMenuProps {
  className?: string;
}

export function UserMenu({ className = "" }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const user = useOptionalUser();

  if (!user) {
    return (
      <Link 
        to="/login" 
        rel="nofollow"
        className={`flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg transition-colors ${className}`}
      >
        <User className="w-5 h-5" />
        <span className="hidden md:inline text-sm">Connexion</span>
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg transition-colors ${className}`}
      >
        <User className="w-5 h-5" />
        <span className="hidden md:inline text-sm">{user.firstName}</span>
      </button>

      {isOpen && (
        <>
          {/* Overlay pour fermer le menu */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu déroulant */}
          <div className="absolute right-0 top-full mt-2 w-48 bg-white shadow-lg rounded-lg border py-2 z-20">
            <div className="px-4 py-2 border-b">
              <p className="text-sm font-medium text-gray-900">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            
            <Link
              to="/account"
              className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <Settings className="w-4 h-4" />
              <span>Mon compte</span>
            </Link>
            
            <Link
              to="/orders"
              className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <Package className="w-4 h-4" />
              <span>Mes commandes</span>
            </Link>
            
            <Link
              to="/favorites"
              className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <Heart className="w-4 h-4" />
              <span>Favoris</span>
            </Link>
            
            <hr className="my-2" />
            
            <Link
              to="/logout"
              className="flex items-center space-x-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <LogOut className="w-4 h-4" />
              <span>Déconnexion</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

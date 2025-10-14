import { Link } from "@remix-run/react";
import { Bell, ReceiptEuro, UserRound, Package, Settings, Headphones, BookOpen, ShoppingCart } from 'lucide-react';
import { useCart } from "../hooks/useCart";
import { useOptionalUser } from "../root";
import { CartSidebar } from "./navbar/CartSidebar";
import { NavbarMobile } from "./navbar/NavbarMobile";
import { Badge } from "./ui/badge";

export const Navbar = ({ logo }: { logo: string }) => {
  const user = useOptionalUser();
  const { summary, isOpen, toggleCart, closeCart } = useCart();
  
  return (
    <nav className="px-3 py-2 bg-blue-600 text-white flex justify-between items-center" aria-label="Navigation principale">
      <div className="flex items-center gap-4">
        {/* 🆕 PHASE 2: Burger Menu Mobile */}
        <NavbarMobile user={user} />
        
        <Link to="/">
          <img 
            src={logo}
            alt="Logo Automecanik"
            className="w-auto h-12 hover:opacity-80 transition-opacity"
          />
        </Link>
        
        {/* Navigation principale */}
        <div className="hidden md:flex gap-6">
          {/* Dashboard conditionnel selon le niveau utilisateur */}
          {user && (
            <Link 
              to={
                (user.level ?? 0) >= 7 ? "/admin" : 
                (user.level ?? 0) >= 3 ? "/dashboard" : 
                "/account/dashboard"
              }
              className="hover:text-blue-200 transition-colors text-sm font-medium"
            >
              Dashboard
            </Link>
          )}
          <Link to="/catalogue" className="hover:text-blue-200 transition-colors text-sm font-medium">
            Catalogue
          </Link>
          <Link to="/marques" className="hover:text-blue-200 transition-colors text-sm font-medium">
            Marques
          </Link>
          <Link 
            to="/blog" 
            className="hover:text-blue-200 transition-colors text-sm font-medium flex items-center gap-1.5"
          >
            <BookOpen className="w-4 h-4" />
            Blog
            <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
              Nouveau
            </span>
          </Link>
          <Link to="/support" className="hover:text-blue-200 transition-colors text-sm font-medium">
            Support
          </Link>
          <Link to="/aide" className="hover:text-blue-200 transition-colors text-sm font-medium">
            Aide
          </Link>
        </div>
      </div>
      
      <div className='flex gap-4 items-center'>
        {user && <span className="text-sm">{user.firstName} {user.lastName}</span>}

        {/* 🆕 PHASE 1 POC: CartSidebar avec consignes */}
        <button
          onClick={toggleCart}
          className="hover:text-blue-200 transition-colors relative"
          aria-label="Panier"
        >
          <ShoppingCart className="flex-shrink-0" size={20} />
          {summary.total_items > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs"
            >
              {summary.total_items}
            </Badge>
          )}
        </button>

        <Link 
          to='/orders' 
          className="hover:text-blue-200 transition-colors"
          aria-label="Commandes"
        >
          <Package className="flex-shrink-0" />
        </Link>

        <Link 
          to='/factures' 
          className="hover:text-blue-200 transition-colors"
          aria-label="Factures"
        >
          <ReceiptEuro className="flex-shrink-0" />
        </Link>

        <Link 
          to='/notifications' 
          className="hover:text-blue-200 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="flex-shrink-0" />
        </Link>

        <Link 
          to='/support' 
          className="hover:text-blue-200 transition-colors"
          aria-label="Support Client"
        >
          <Headphones className="flex-shrink-0" />
        </Link>

        {/* Lien Admin conditionnel */}
        {user && (user.level ?? 0) >= 7 && (
          <Link 
            to='/admin' 
            className="hover:text-blue-200 transition-colors bg-blue-800 px-2 py-1 rounded text-sm"
            aria-label="Administration"
          >
            <Settings className="flex-shrink-0 h-4 w-4" />
          </Link>
        )}

        <Link 
          to={user ? '/account/dashboard' : '/login'} 
          className="hover:text-blue-200 transition-colors"
          aria-label={user ? "Mon compte" : "Connexion"}
        >
          <UserRound className="flex-shrink-0" />
        </Link>

        {/* Système de login/logout simple qui fonctionnait */}
        {user ? (
          <form method='POST' action='/auth/logout'>
            <button 
              type='submit' 
              className="hover:text-blue-200 transition-colors text-sm px-2 py-1 rounded hover:bg-blue-700"
            >
              Se déconnecter
            </button>
          </form>
        ) : (
          <div className="flex gap-2 text-xs">
            <Link className='hover:text-blue-200 transition-colors' to='/login'>Connexion</Link>
            <span>|</span>
            <Link className='hover:text-blue-200 transition-colors' to='/register'>Inscription</Link>
          </div>
        )}
      </div>

      {/* 🆕 PHASE 1 POC: CartSidebar Component */}
      <CartSidebar isOpen={isOpen} onClose={closeCart} />
    </nav>
  );
};
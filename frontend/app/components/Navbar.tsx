import { Link } from "@remix-run/react";
import { Bell, ReceiptEuro, UserRound } from 'lucide-react';
import { useOptionalUser } from "~/root";

export const Navbar = ({ logo }: { logo: string }) => {
  const user = useOptionalUser();
  return (
    <nav className="px-3 py-2 bg-blue-600 text-white flex justify-between items-center" aria-label="Navigation principale">
      <img 
        src={logo}
        alt="Logo Automecanik"
        className="w-auto h-12"
      />
      <div className='flex gap-4'>
        {user ? <span>{user.firstName} {user.lastName}</span> : null}

        <Link 
          to='/' 
          className="hover:text-blue-200 transition-colors"
          aria-label="Factures"
        >
          <ReceiptEuro className="flex-shrink-0" />
        </Link>

        <Link 
          to='/' 
          className="hover:text-blue-200 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="flex-shrink-0" />
        </Link>

        <Link 
          to={user ? '/profile' : '/login'} 
          className="hover:text-blue-200 transition-colors"
          aria-label={user ? "Profil" : "Connexion"}
        >
          <UserRound className="flex-shrink-0" />
        </Link>

        {user ? (
          <form method='POST' action='/auth/logout'>
            <button 
              type='submit' 
              className="hover:text-blue-200 transition-colors"
            >
              Se déconnecter
            </button>
          </form>
        ) : (
          <>
            <Link className='text-xs' to='/login'>Connexion</Link>
            <Link className='text-xs' to='/register'>Inscription</Link>
            <Link className='text-xs' to='/forgot-password'>Mot de passe oublié</Link>
          </>
        )}
            </div>
        </nav>
    );
};
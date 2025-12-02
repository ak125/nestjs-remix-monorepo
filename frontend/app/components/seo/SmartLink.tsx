/**
 * 🔗 SmartLink - Composant SEO pour liens internes
 * 
 * Applique automatiquement rel="nofollow" sur les liens transactionnels
 * pour éviter la fuite de PageRank vers les pages non-indexables.
 * 
 * Paths transactionnels (nofollow automatique):
 * - /login, /connexion
 * - /register, /inscription  
 * - /cart, /panier
 * - /account, /compte
 * - /checkout, /commande
 * - /payment, /paiement
 * 
 * @example
 * // Lien SEO normal (index, follow)
 * <SmartLink to="/pieces/freins-1.html">Freins</SmartLink>
 * 
 * // Lien transactionnel (nofollow automatique)
 * <SmartLink to="/login">Connexion</SmartLink>
 * 
 * // Forcer nofollow manuellement
 * <SmartLink to="/promo" nofollow>Promo</SmartLink>
 */

import { Link, type LinkProps } from '@remix-run/react';
import { forwardRef } from 'react';

// Paths transactionnels qui ne doivent pas recevoir de PageRank
const NOFOLLOW_PATHS = [
  '/login',
  '/connexion',
  '/register', 
  '/inscription',
  '/cart',
  '/panier',
  '/account',
  '/compte',
  '/checkout',
  '/commande',
  '/payment',
  '/paiement',
  '/auth',
  '/logout',
  '/deconnexion',
];

interface SmartLinkProps extends LinkProps {
  /** Forcer rel="nofollow" même si le path n'est pas transactionnel */
  nofollow?: boolean;
  /** Forcer rel="noopener noreferrer" pour liens externes */
  external?: boolean;
  children: React.ReactNode;
}

/**
 * Vérifie si un path est transactionnel (doit avoir nofollow)
 */
function isTransactionalPath(to: string): boolean {
  const path = typeof to === 'string' ? to : '';
  return NOFOLLOW_PATHS.some(nofollowPath => 
    path === nofollowPath || path.startsWith(`${nofollowPath}/`) || path.startsWith(`${nofollowPath}?`)
  );
}

/**
 * Construit l'attribut rel approprié
 */
function buildRel(to: string, nofollow?: boolean, external?: boolean): string | undefined {
  const parts: string[] = [];
  
  // nofollow si path transactionnel ou forcé
  if (nofollow || isTransactionalPath(to)) {
    parts.push('nofollow');
  }
  
  // noopener noreferrer pour liens externes
  if (external) {
    parts.push('noopener', 'noreferrer');
  }
  
  return parts.length > 0 ? parts.join(' ') : undefined;
}

export const SmartLink = forwardRef<HTMLAnchorElement, SmartLinkProps>(
  ({ to, nofollow, external, children, ...props }, ref) => {
    const rel = buildRel(typeof to === 'string' ? to : '', nofollow, external);
    
    return (
      <Link
        ref={ref}
        to={to}
        rel={rel}
        {...props}
      >
        {children}
      </Link>
    );
  }
);

SmartLink.displayName = 'SmartLink';

export default SmartLink;

// Export des utilitaires pour usage externe
export { isTransactionalPath, NOFOLLOW_PATHS };

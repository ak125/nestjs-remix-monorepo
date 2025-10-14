/**
 * 📞 TopBar Component - PHASE 3
 * 
 * Barre d'information au-dessus de la navbar principale.
 * Pattern inspiré du legacy PHP: tagline + phone + user greeting + liens rapides.
 * 
 * Features:
 * - ✅ Tagline site (ex: "Pièces auto à prix pas cher")
 * - ✅ Téléphone cliquable
 * - ✅ Greeting personnalisé utilisateur connecté
 * - ✅ Liens rapides: Aide, Contact, CGV
 * - ✅ Responsive: masqué sur mobile < 768px (économie espace)
 * - ✅ Configuration dynamique possible
 * 
 * @example
 * ```tsx
 * <TopBar 
 *   tagline="Pièces auto à prix pas cher"
 *   phone="01 23 45 67 89"
 *   user={user}
 * />
 * ```
 */

import { Link } from '@remix-run/react';
import { Phone, Mail, FileText } from 'lucide-react';

export interface TopBarConfig {
  tagline?: string;
  phone?: string;
  email?: string;
  showQuickLinks?: boolean;
}

interface TopBarProps {
  config?: TopBarConfig;
  user?: {
    firstName?: string;
    lastName?: string;
    gender?: 'M' | 'F' | 'Autre';
  } | null;
}

const DEFAULT_CONFIG: TopBarConfig = {
  tagline: "Pièces auto à prix pas cher",
  phone: "01 23 45 67 89",
  email: "contact@automecanik.com",
  showQuickLinks: true,
};

export function TopBar({ config = DEFAULT_CONFIG, user }: TopBarProps) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  // 👤 Greeting personnalisé (pattern PHP legacy)
  const getUserGreeting = (): string => {
    if (!user) return '';
    
    const civilite = user.gender === 'F' ? 'Mme' : user.gender === 'M' ? 'M.' : '';
    const nom = user.lastName || '';
    
    return civilite && nom ? `${civilite} ${nom}` : user.firstName || '';
  };

  const greeting = getUserGreeting();

  return (
    <div className="hidden lg:block bg-gray-100 border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-2 text-sm">
          {/* 🎯 Left: Tagline + Phone */}
          <div className="flex items-center gap-4">
            {/* Tagline */}
            {mergedConfig.tagline && (
              <span className="text-gray-700 font-medium">
                {mergedConfig.tagline}
              </span>
            )}
            
            {/* Separator */}
            {mergedConfig.tagline && mergedConfig.phone && (
              <span className="text-gray-300">|</span>
            )}
            
            {/* Phone */}
            {mergedConfig.phone && (
              <a 
                href={`tel:${mergedConfig.phone.replace(/\s/g, '')}`}
                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Phone className="h-4 w-4" />
                <span className="font-medium">{mergedConfig.phone}</span>
              </a>
            )}
          </div>

          {/* 👤 Right: User greeting + Quick links */}
          <div className="flex items-center gap-4">
            {/* User greeting (pattern PHP legacy) */}
            {user && greeting && (
              <>
                <span className="text-gray-700">
                  Bienvenue <span className="font-medium">{greeting}</span> !
                </span>
                <span className="text-gray-300">|</span>
              </>
            )}

            {/* Quick links */}
            {mergedConfig.showQuickLinks && (
              <div className="flex items-center gap-3">
                <Link 
                  to="/aide" 
                  className="text-gray-600 hover:text-blue-600 transition-colors"
                >
                  Aide
                </Link>
                
                <Link 
                  to="/contact" 
                  className="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Contact
                </Link>
                
                <Link 
                  to="/cgv" 
                  className="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" />
                  CGV
                </Link>
              </div>
            )}

            {/* Login/Register (si pas connecté) */}
            {!user && (
              <>
                <span className="text-gray-300">|</span>
                <div className="flex items-center gap-2">
                  <Link 
                    to="/login" 
                    className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    Connexion
                  </Link>
                  <span className="text-gray-300">/</span>
                  <Link 
                    to="/register" 
                    className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    Inscription
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

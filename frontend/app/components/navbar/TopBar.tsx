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
import { Phone, Mail } from 'lucide-react';

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
    <div className="hidden lg:block bg-gradient-to-r from-slate-50 via-blue-50/30 to-slate-50 dark:bg-gradient-to-r dark:from-neutral-900 dark:via-blue-950/30 dark:to-neutral-900 border-b border-blue-100/50 dark:border-neutral-800 transition-all duration-normal">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between py-2.5 text-sm">
          {/* 🎯 Left: Contact info */}
          <div className="flex items-center gap-6">
            {/* Phone avec animation pulse premium */}
            {mergedConfig.phone && (
              <a 
                href={`tel:${mergedConfig.phone.replace(/\s/g, '')}`}
                className="group flex items-center gap-2.5 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-300"
              >
                <div className="relative flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-all duration-300 group-hover:scale-110">
                  <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="absolute inset-0 rounded-lg bg-blue-500 opacity-0 group-hover:opacity-20 group-hover:animate-ping" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Appelez-nous</span>
                  <span className="font-bold tracking-tight">{mergedConfig.phone}</span>
                </div>
              </a>
            )}

            {/* Email */}
            {mergedConfig.email && (
              <>
                <span className="text-slate-300 dark:text-neutral-700">|</span>
                <a 
                  href={`mailto:${mergedConfig.email}`}
                  className="group flex items-center gap-2.5 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-300"
                >
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-all duration-300 group-hover:scale-110">
                    <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Email</span>
                    <span className="font-semibold text-xs">{mergedConfig.email}</span>
                  </div>
                </a>
              </>
            )}

            {/* Badge promo */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200/50 dark:border-green-800/50 rounded-full">
              <span className="text-green-600 dark:text-green-400 text-xl">🚚</span>
              <span className="text-xs font-semibold text-green-700 dark:text-green-300">Livraison gratuite dès 100€</span>
            </div>
          </div>

          {/* 👤 Right: User greeting + Quick links */}
          <div className="flex items-center gap-5">
            {/* User greeting (pattern PHP legacy) */}
            {user && greeting && (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full animate-in fade-in slide-in-from-right-2 duration-500">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {greeting.charAt(0)}
                  </div>
                  <span className="text-slate-700 dark:text-slate-300 text-xs">
                    Bonjour <span className="font-bold text-blue-600 dark:text-blue-400">{greeting}</span>
                  </span>
                </div>
                <span className="text-slate-300 dark:text-neutral-700">|</span>
              </>
            )}

            {/* Quick links - Plus compacts */}
            {mergedConfig.showQuickLinks && (
              <div className="flex items-center gap-4">
                <Link 
                  to="/aide" 
                  className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 font-medium text-xs hover:underline underline-offset-4"
                >
                  Aide
                </Link>
                
                <Link 
                  to="/contact" 
                  className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 font-medium text-xs hover:underline underline-offset-4"
                >
                  Contact
                </Link>
                
                <Link 
                  to="/cgv" 
                  className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 font-medium text-xs hover:underline underline-offset-4"
                >
                  CGV
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

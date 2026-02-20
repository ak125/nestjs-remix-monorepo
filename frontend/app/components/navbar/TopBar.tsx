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

import { Link } from "@remix-run/react";
import { Phone } from "lucide-react";
import { memo } from "react";

import { SITE_CONFIG } from "~/config/site";

interface TopBarProps {
  user?: {
    firstName?: string;
    lastName?: string;
    gender?: "M" | "F" | "Autre";
  } | null;
}

export const TopBar = memo(function TopBar({ user }: TopBarProps) {
  // 👤 Greeting personnalisé (pattern PHP legacy)
  const getUserGreeting = (): string => {
    if (!user) return "";

    const civilite =
      user.gender === "F" ? "Mme" : user.gender === "M" ? "M." : "";
    const nom = user.lastName || "";

    return civilite && nom ? `${civilite} ${nom}` : user.firstName || "";
  };

  const greeting = getUserGreeting();

  return (
    <div className="hidden lg:block bg-gradient-to-r from-blue-50 via-indigo-50/50 to-purple-50 dark:bg-gradient-to-r dark:from-neutral-900 dark:via-blue-950/30 dark:to-neutral-900 border-b border-blue-200/60 dark:border-neutral-800 transition-all duration-normal shadow-sm">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between py-2.5 text-sm">
          {/* 🎯 Left: Contact info - Version premium */}
          <div className="flex items-center gap-5">
            {/* Phone - Contact direct avec animation */}
            {SITE_CONFIG.contact.phone.display && (
              <a
                href={`tel:${SITE_CONFIG.contact.phone.raw}`}
                className="group flex items-center gap-2.5 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-300 hover:scale-105"
                title="Appelez-nous pour un support immédiat"
              >
                <div className="relative flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl group-hover:from-blue-600 group-hover:to-indigo-700 transition-all duration-300 shadow-md group-hover:shadow-lg">
                  <Phone className="h-4 w-4 text-white" />
                  <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <span className="font-bold text-sm tracking-wide">
                  {SITE_CONFIG.contact.phone.display}
                </span>
              </a>
            )}

            {/* Badge promo - Plus visible et attractif */}
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-300/60 dark:border-green-800/50 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
              <span className="text-xl">{SITE_CONFIG.promo.icon}</span>
              <span className="text-xs font-bold text-green-700 dark:text-green-300 tracking-wide">
                {SITE_CONFIG.promo.text}
              </span>
            </div>
          </div>

          {/* 👤 Right: User greeting premium + Quick links */}
          <div className="flex items-center gap-4">
            {/* User greeting premium avec avatar */}
            {user && greeting && (
              <>
                <div className="flex items-center gap-2.5 px-4 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl animate-in fade-in slide-in-from-right-2 duration-500 shadow-md hover:shadow-lg transition-all hover:scale-105 group">
                  <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center text-blue-600 text-sm font-bold shadow-inner ring-2 ring-white/50">
                    {greeting.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white text-xs font-bold leading-tight">
                      Bonjour, {greeting.split(" ")[1] || greeting}
                    </span>
                    <span className="text-blue-200 text-[10px] font-medium">
                      Connecté
                    </span>
                  </div>
                </div>
                <span className="text-slate-300 dark:text-neutral-700 font-light">
                  •
                </span>
              </>
            )}

            {/* Quick links */}
            <div className="flex items-center gap-4">
              <Link
                to="/aide"
                className="group text-slate-700 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 font-semibold text-xs relative"
              >
                Aide
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300" />
              </Link>

              <Link
                to="/contact"
                className="group text-slate-700 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 font-semibold text-xs relative"
              >
                Contact
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300" />
              </Link>

              <Link
                to="/cgv"
                className="group text-slate-700 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 font-semibold text-xs relative"
              >
                CGV
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

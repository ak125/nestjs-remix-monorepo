import { Link, Outlet, useLocation } from "@remix-run/react";
import { Phone } from "lucide-react";

/**
 * Layout tunnel auth : header navy premium + footer navy
 * Utilise sur /login, /register, /forgot-password
 */
export const handle = {
  hideGlobalNavbar: true,
  hideGlobalFooter: true,
  hideBottomNav: true,
};

export default function AuthLayout() {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";
  const isRegisterPage = location.pathname === "/register";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header navy — aligné sur la charte homepage */}
      <header className="border-b border-white/[0.08] bg-v9-navy">
        <div className="max-w-[1280px] mx-auto px-5 lg:px-8 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="font-v9-heading font-extrabold text-base tracking-tight select-none hover:opacity-80 transition-opacity"
          >
            <span className="text-white">AUTO</span>
            <span className="text-cta">MECANIK</span>
          </Link>

          <div className="flex items-center gap-5 text-sm">
            <a
              href="tel:+33148479627"
              className="hidden sm:flex items-center gap-1.5 text-white/60 hover:text-white transition-colors"
            >
              <Phone className="w-4 h-4" />
              <span>01 48 47 96 27</span>
            </a>
            {!isLoginPage && (
              <Link
                to="/login"
                className="text-white/60 hover:text-white font-medium transition-colors"
              >
                Se connecter
              </Link>
            )}
            {!isRegisterPage && isLoginPage && (
              <Link
                to="/register"
                className="text-white/60 hover:text-white font-medium transition-colors"
              >
                Créer un compte
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer navy — aligné sur la charte homepage */}
      <footer className="border-t border-white/[0.08] bg-v9-navy py-4">
        <div className="max-w-[1280px] mx-auto px-5 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/50">
          <span>&copy; {new Date().getFullYear()} AutoMecanik</span>
          <div className="flex items-center gap-3">
            <Link to="/cgv" className="hover:text-white/80 transition-colors">
              CGV
            </Link>
            <span className="text-white/20">|</span>
            <Link
              to="/confidentialite"
              className="hover:text-white/80 transition-colors"
            >
              Confidentialité
            </Link>
            <span className="text-white/20">|</span>
            <Link
              to="/mentions-legales"
              className="hover:text-white/80 transition-colors"
            >
              Mentions légales
            </Link>
            <span className="text-white/20">|</span>
            <Link
              to="/contact"
              className="hover:text-white/80 transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

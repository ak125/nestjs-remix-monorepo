import { Link, NavLink } from "@remix-run/react";
import {
  Facebook,
  Home,
  Instagram,
  LayoutGrid,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Search,
  ShoppingCart,
  User,
  Youtube,
} from "lucide-react";
export const Footer = () => {
  return (
    <>
      {/* Footer principal desktop */}
      <footer className="bg-[#0d1b3e] text-white py-12 hidden md:block">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            {/* Colonne 1: À propos */}
            <div>
              <h3 className="text-xl font-bold mb-4 text-primary">À propos</h3>
              <p className="text-neutral-400 mb-4 leading-relaxed">
                Votre spécialiste de pièces détachées automobiles neuves et
                d'origine. Plus de 500 000 références pour toutes les marques et
                modèles.
              </p>
              <div className="flex gap-3">
                <a
                  href="https://www.facebook.com/Automecanik63"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Suivez-nous sur Facebook"
                  className="bg-white/10 hover:bg-primary transition-colors p-2.5 rounded-full"
                >
                  <Facebook size={20} />
                </a>
                <a
                  href="https://linkedin.com/company/automecanik"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Suivez-nous sur LinkedIn"
                  className="bg-white/10 hover:bg-primary transition-colors p-2.5 rounded-full"
                >
                  <Linkedin size={20} />
                </a>
                <a
                  href="https://www.instagram.com/automecanik.co"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Suivez-nous sur Instagram"
                  className="bg-white/10 hover:bg-primary transition-colors p-2.5 rounded-full"
                >
                  <Instagram size={20} />
                </a>
                <a
                  href="https://www.youtube.com/@automecanik8508"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Suivez-nous sur YouTube"
                  className="bg-white/10 hover:bg-primary transition-colors p-2.5 rounded-full"
                >
                  <Youtube size={20} />
                </a>
              </div>
            </div>

            {/* Colonne 2: Liens utiles */}
            <div>
              <h3 className="text-xl font-bold mb-4 text-primary">
                Liens utiles
              </h3>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/#catalogue"
                    className="text-neutral-400 hover:text-primary transition-colors"
                  >
                    Catalogue pièces
                  </Link>
                </li>
                <li>
                  <Link
                    to="/#toutes-les-marques"
                    className="text-neutral-400 hover:text-primary transition-colors"
                  >
                    Constructeurs
                  </Link>
                </li>
                <li>
                  <Link
                    to="/blog-pieces-auto"
                    className="text-neutral-400 hover:text-primary transition-colors"
                  >
                    Blog & Conseils
                  </Link>
                </li>
                <li>
                  <Link
                    to="/diagnostic-auto"
                    className="text-neutral-400 hover:text-primary transition-colors"
                  >
                    Diagnostic auto
                  </Link>
                </li>
                <li>
                  <Link
                    to="/contact"
                    className="text-neutral-400 hover:text-primary transition-colors"
                  >
                    Contact
                  </Link>
                </li>
                <li>
                  <Link
                    to="/plan-du-site"
                    className="text-neutral-400 hover:text-primary transition-colors"
                  >
                    Plan du site
                  </Link>
                </li>
              </ul>
            </div>

            {/* Colonne 3: Informations légales */}
            <div>
              <h3 className="text-xl font-bold mb-4 text-primary">
                Informations légales
              </h3>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/legal/cgv"
                    className="text-neutral-400 hover:text-primary transition-colors"
                  >
                    CGV
                  </Link>
                </li>
                <li>
                  <Link
                    to="/legal/privacy"
                    className="text-neutral-400 hover:text-primary transition-colors"
                  >
                    Politique de confidentialité
                  </Link>
                </li>
                <li>
                  <Link
                    to="/legal/cookies"
                    className="text-neutral-400 hover:text-primary transition-colors"
                  >
                    Gestion des cookies
                  </Link>
                </li>
                <li>
                  <Link
                    to="/legal/legal-notice"
                    className="text-neutral-400 hover:text-primary transition-colors"
                  >
                    Mentions légales
                  </Link>
                </li>
              </ul>
            </div>

            {/* Colonne 4: Contact */}
            <div>
              <h3 className="text-xl font-bold mb-4 text-primary">Contact</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <MapPin
                    size={20}
                    className="text-primary flex-shrink-0 mt-0.5"
                  />
                  <span className="text-neutral-400 text-sm">
                    184 avenue Aristide Briand
                    <br />
                    93320 Les Pavillons-sous-Bois
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone size={20} className="text-primary flex-shrink-0" />
                  <a
                    href="tel:+33177695892"
                    className="text-neutral-400 hover:text-primary transition-colors"
                  >
                    01 77 69 58 92
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <Mail size={20} className="text-primary flex-shrink-0" />
                  <a
                    href="mailto:contact@automecanik.com"
                    className="text-neutral-400 hover:text-primary transition-colors"
                  >
                    contact@automecanik.com
                  </a>
                </li>
              </ul>
              <div className="mt-4">
                <p className="text-sm text-neutral-400">
                  Service client disponible
                  <br />
                  <span className="text-white">Lun - Ven: 8h - 18h</span>
                </p>
              </div>
            </div>
          </div>

          {/* Ligne de séparation */}
          <div className="border-t border-white/15 pt-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-neutral-400 text-sm">
                © {new Date().getFullYear()} Automecanik. Tous droits réservés.
              </p>
              <div className="flex gap-4 text-sm">
                <Link
                  to="/legal/cgv"
                  className="text-neutral-400 hover:text-primary transition-colors"
                >
                  CGV
                </Link>
                <span className="text-neutral-600">•</span>
                <Link
                  to="/legal/privacy"
                  className="text-neutral-400 hover:text-primary transition-colors"
                >
                  Confidentialité
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Navigation mobile en bas (conservée pour mobile) */}
      <footer className="md:hidden fixed bottom-0 left-0 right-0 z-40 overflow-hidden px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-2 bg-lightTurquoise border-t border-lightTurquoise/50">
        <FooterLinkItem href="/" icon={<Home />} label="Accueil" />
        <FooterLinkItem
          href="/#catalogue"
          icon={<LayoutGrid />}
          label="Catalogue"
        />
        <FooterLinkItem href="/search" icon={<Search />} label="Recherche" />
        <FooterLinkItem href="/login" icon={<User />} label="Compte" />
        <FooterLinkItem href="/cart" icon={<ShoppingCart />} label="Panier" />
      </footer>
    </>
  );
};

const FooterLinkItem = ({
  icon,
  label,
  href,
}: {
  label: string;
  icon: React.ReactNode;
  href: string;
}) => {
  return (
    <NavLink
      className={({ isActive }) =>
        `flex flex-col items-center justify-center text-xs min-h-[44px] min-w-[44px] ${isActive ? "text-vert" : "text-bleu"}`
      }
      to={href}
    >
      {icon} <span className="text-bleu">{label}</span>
    </NavLink>
  );
};

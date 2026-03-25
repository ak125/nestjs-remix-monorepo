import { Link } from "@remix-run/react";
import {
  Facebook,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Youtube,
} from "lucide-react";
import { SITE_CONFIG } from "~/config/site";

const USEFUL_LINKS = [
  { label: "Catalogue pièces", href: "/#catalogue" },
  { label: "Constructeurs", href: "/#marques" },
  { label: "Diagnostic auto", href: "/diagnostic-auto" },
  { label: "Blog & Conseils", href: "/blog-pieces-auto" },
  { label: "Contact", href: "/contact" },
  { label: "Plan du site", href: "/plan-du-site" },
];

const LEGAL_LINKS = [
  { label: "CGV", href: "/legal/cgv" },
  { label: "Politique de confidentialité", href: "/legal/privacy" },
  { label: "Gestion des cookies", href: "/legal/cookies" },
  { label: "Mentions légales", href: "/legal/legal-notice" },
];

const SOCIAL_LINKS = [
  { label: "Facebook", href: SITE_CONFIG.social.facebook, Icon: Facebook },
  { label: "Instagram", href: SITE_CONFIG.social.instagram, Icon: Instagram },
  { label: "YouTube", href: SITE_CONFIG.social.youtube, Icon: Youtube },
];

export default function Footer() {
  return (
    <footer className="bg-navy text-white pb-20 lg:pb-0">
      {/* ── Desktop: 4-col grid ── */}
      <div className="hidden md:block py-12">
        <div className="max-w-[1280px] mx-auto px-5 lg:px-8">
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-8 mb-8">
            {/* Col 1 — À propos */}
            <div>
              <h3 className="text-[16px] font-extrabold font-heading mb-4 text-white">
                À propos
              </h3>
              <p className="text-[13px] text-white/60 mb-4 leading-relaxed">
                Votre spécialiste de pièces détachées automobiles neuves et
                d&apos;origine. Plus de 500 000 références pour toutes les
                marques et modèles.
              </p>
              <div className="flex gap-2.5">
                {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-11 h-11 rounded-full bg-white/[0.08] hover:bg-cta flex items-center justify-center transition-colors"
                  >
                    <Icon size={16} />
                  </a>
                ))}
              </div>
            </div>

            {/* Col 2 — Liens utiles */}
            <div>
              <h3 className="text-[16px] font-extrabold font-heading mb-4 text-white">
                Liens utiles
              </h3>
              <ul className="space-y-1">
                {USEFUL_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="no-style no-visited inline-flex items-center min-h-[44px] text-[13px] text-white/60 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 3 — Informations légales */}
            <div>
              <h3 className="text-[16px] font-extrabold font-heading mb-4 text-white">
                Informations légales
              </h3>
              <ul className="space-y-1">
                {LEGAL_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="no-style no-visited inline-flex items-center min-h-[44px] text-[13px] text-white/60 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 4 — Contact */}
            <div>
              <h3 className="text-[16px] font-extrabold font-heading mb-4 text-white">
                Contact
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2.5">
                  <MapPin size={16} className="text-cta flex-shrink-0 mt-0.5" />
                  <span className="text-[13px] text-white/60">
                    184 avenue Aristide Briand
                    <br />
                    93320 Les Pavillons-sous-Bois
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Phone size={16} className="text-cta flex-shrink-0" />
                  <a
                    href={`tel:${SITE_CONFIG.contact.phone.raw}`}
                    className="text-[13px] text-white/60 hover:text-white transition-colors"
                  >
                    {SITE_CONFIG.contact.phone.display}
                  </a>
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail size={16} className="text-cta flex-shrink-0" />
                  <a
                    href={`mailto:${SITE_CONFIG.contact.email}`}
                    className="text-[13px] text-white/60 hover:text-white transition-colors"
                  >
                    {SITE_CONFIG.contact.email}
                  </a>
                </li>
              </ul>
              <div className="mt-3">
                <p className="text-[12px] text-white/30">
                  Service client disponible
                  <br />
                  <span className="text-white/60 font-medium">
                    {SITE_CONFIG.contact.phone.hours}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Copyright desktop */}
          <div className="border-t border-white/[0.08] pt-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-[12px] text-white/30" suppressHydrationWarning>
                © {new Date().getFullYear()} AutoMecanik. Tous droits réservés.
              </p>
              <div className="flex gap-4 text-[12px]">
                <Link
                  to="/legal/cgv"
                  className="no-style no-visited text-white/30 hover:text-white transition-colors"
                >
                  CGV
                </Link>
                <span className="text-white/15">·</span>
                <Link
                  to="/legal/privacy"
                  className="no-style no-visited text-white/30 hover:text-white transition-colors"
                >
                  Confidentialité
                </Link>
                <span className="text-white/15">·</span>
                <span className="text-white/30">
                  Paiement sécurisé · Livraison 24-48h
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile: compact stacked ── */}
      <div className="md:hidden px-5 py-8">
        {/* Brand + socials */}
        <div className="text-center mb-6">
          <div className="text-[18px] font-extrabold font-heading tracking-[-0.02em]">
            AutoMecanik
          </div>
          <p className="text-[12px] text-white/40 mt-1">
            Pièces auto de qualité · Livraison rapide
          </p>
          <div className="flex justify-center gap-3 mt-3">
            {SOCIAL_LINKS.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="w-11 h-11 rounded-full bg-white/[0.08] hover:bg-cta flex items-center justify-center transition-colors"
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>

        {/* Links 2-col */}
        <div className="grid grid-cols-2 gap-5 py-5 border-t border-white/[0.06]">
          <div>
            <div className="text-xs font-bold text-white/25 uppercase tracking-widest mb-1">
              Navigation
            </div>
            <ul>
              {USEFUL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="no-style no-visited inline-flex items-center min-h-[44px] text-xs text-white/55 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-bold text-white/25 uppercase tracking-widest mb-1">
              Informations
            </div>
            <ul>
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="no-style no-visited inline-flex items-center min-h-[44px] text-xs text-white/55 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Contact compact */}
        <div className="py-4 border-t border-white/[0.06]">
          <a
            href={`tel:${SITE_CONFIG.contact.phone.raw}`}
            className="flex items-center gap-2 min-h-[44px] text-xs text-white/55 hover:text-white transition-colors"
          >
            <Phone size={14} className="text-cta" />
            {SITE_CONFIG.contact.phone.display}
          </a>
          <a
            href={`mailto:${SITE_CONFIG.contact.email}`}
            className="flex items-center gap-2 min-h-[44px] text-xs text-white/55 hover:text-white transition-colors"
          >
            <Mail size={14} className="text-cta" />
            {SITE_CONFIG.contact.email}
          </a>
        </div>

        {/* Copyright mobile */}
        <div className="pt-4 border-t border-white/[0.06] text-center">
          <p className="text-[10px] text-white/20" suppressHydrationWarning>
            © {new Date().getFullYear()} AutoMecanik · Paiement sécurisé ·
            Livraison 24-48h
          </p>
        </div>
      </div>
    </footer>
  );
}

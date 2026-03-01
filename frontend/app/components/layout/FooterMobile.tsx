import { Link } from "@remix-run/react";
import {
  Facebook,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Youtube,
} from "lucide-react";
import { memo, useState } from "react";
import { cn } from "~/lib/utils";

/**
 * FooterMobile — Full-featured footer for mobile devices.
 *
 * Replaces the `hidden md:block` desktop-only footer with a proper
 * mobile-friendly footer that uses collapsible sections for navigation.
 *
 * Displayed only on mobile (md:hidden). The desktop footer remains separate.
 */

interface FooterSection {
  title: string;
  links: Array<{ label: string; href: string }>;
}

const FOOTER_SECTIONS: FooterSection[] = [
  {
    title: "Catalogue",
    links: [
      { label: "Toutes les pièces", href: "/#catalogue" },
      { label: "Par constructeur", href: "/#marques" },
      { label: "Diagnostic auto", href: "/diagnostic-auto" },
      { label: "Blog & Conseils", href: "/blog-pieces-auto" },
    ],
  },
  {
    title: "Informations",
    links: [
      { label: "CGV", href: "/legal/cgv" },
      { label: "Confidentialité", href: "/legal/privacy" },
      { label: "Mentions légales", href: "/legal/legal-notice" },
      { label: "Cookies", href: "/legal/cookies" },
    ],
  },
];

function CollapsibleSection({ title, links }: FooterSection) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-white/10">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 px-1 text-sm font-semibold text-white touch-target"
        aria-expanded={open}
      >
        {title}
        <svg
          className={cn(
            "w-4 h-4 text-white/50 transition-transform duration-200",
            open && "rotate-180",
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <div className="pb-3 pl-1 space-y-2">
          {links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="block text-sm text-white/60 hover:text-white transition-colors py-1 touch-target"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export const FooterMobile = memo(function FooterMobile() {
  return (
    <footer className="md:hidden bg-navy text-white pb-24">
      {/* pb-24 accounts for the fixed bottom nav bar */}
      <div className="px-page py-8">
        {/* Collapsible sections */}
        {FOOTER_SECTIONS.map((section) => (
          <CollapsibleSection key={section.title} {...section} />
        ))}

        {/* Contact info — always visible */}
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold text-white">Contact</h3>
          <div className="space-y-2">
            <a
              href="tel:+33177695892"
              className="flex items-center gap-2.5 text-sm text-white/60 hover:text-white transition-colors touch-target"
            >
              <Phone className="w-4 h-4 text-cta flex-shrink-0" />
              01 77 69 58 92
            </a>
            <a
              href="mailto:contact@automecanik.com"
              className="flex items-center gap-2.5 text-sm text-white/60 hover:text-white transition-colors touch-target"
            >
              <Mail className="w-4 h-4 text-cta flex-shrink-0" />
              contact@automecanik.com
            </a>
            <div className="flex items-start gap-2.5 text-sm text-white/60">
              <MapPin className="w-4 h-4 text-cta flex-shrink-0 mt-0.5" />
              <span>
                184 av. Aristide Briand
                <br />
                93320 Les Pavillons-sous-Bois
              </span>
            </div>
          </div>
        </div>

        {/* Social links */}
        <div className="flex gap-3 mt-6">
          <a
            href="https://www.facebook.com/Automecanik63"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-cta flex items-center justify-center transition-colors"
          >
            <Facebook className="w-4 h-4" />
          </a>
          <a
            href="https://www.instagram.com/automecanik.co"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-cta flex items-center justify-center transition-colors"
          >
            <Instagram className="w-4 h-4" />
          </a>
          <a
            href="https://www.youtube.com/@automecanik8508"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="YouTube"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-cta flex items-center justify-center transition-colors"
          >
            <Youtube className="w-4 h-4" />
          </a>
        </div>

        {/* Copyright */}
        <div className="mt-6 pt-4 border-t border-white/10">
          <p className="text-xs text-white/40" suppressHydrationWarning>
            © {new Date().getFullYear()} Automecanik. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
});

export default FooterMobile;

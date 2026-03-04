import { Link } from "@remix-run/react";
import { Mail, MapPin, Phone } from "lucide-react";

const NAV_LINKS = [
  { label: "Catalogue pièces auto", href: "/pieces" },
  { label: "Constructeurs", href: "/constructeurs" },
  { label: "Diagnostic auto", href: "/diagnostic-auto" },
  { label: "Blog & Guides", href: "/blog-pieces-auto" },
  { label: "Conseils entretien", href: "/blog-pieces-auto/conseils" },
  { label: "Mon compte", href: "/account/dashboard" },
];

const LEGAL_LINKS = [
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "CGV", href: "/cgv" },
  { label: "Politique de confidentialité", href: "/politique-confidentialite" },
  { label: "Cookies", href: "/politique-cookies" },
];

export default function FooterV9() {
  return (
    <footer className="bg-[#0d1b2a] text-white pb-20 lg:pb-0">
      {/* Contact banner */}
      <div className="border-b border-white/[0.08]">
        <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-5 flex flex-col lg:flex-row items-center justify-between gap-3">
          <div className="text-[15px] font-bold font-v9-heading text-center lg:text-left">
            Besoin d&apos;aide pour trouver votre pièce ?
          </div>
          <a
            href="tel:+33970193419"
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-400 rounded-xl text-[14px] font-bold transition-all hover:-translate-y-0.5 shadow-lg shadow-orange-500/20"
          >
            <Phone size={16} /> 09 70 19 34 19
          </a>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Col 1 — About */}
          <div className="col-span-2 lg:col-span-1">
            <div className="text-[18px] font-extrabold font-v9-heading mb-3">
              AutoMecanik
            </div>
            <p className="text-[13px] text-white/50 leading-relaxed mb-4">
              Pièces auto de qualité, équipementiers d&apos;origine. Livraison
              rapide partout en France.
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] font-bold text-white/30">
              <span className="bg-white/[0.06] px-2 py-1 rounded">Bosch</span>
              <span className="bg-white/[0.06] px-2 py-1 rounded">Valeo</span>
              <span className="bg-white/[0.06] px-2 py-1 rounded">LuK</span>
              <span className="bg-white/[0.06] px-2 py-1 rounded">TRW</span>
              <span className="bg-white/[0.06] px-2 py-1 rounded">SKF</span>
              <span className="bg-white/[0.06] px-2 py-1 rounded">SNR</span>
            </div>
          </div>

          {/* Col 2 — Navigation */}
          <div>
            <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">
              Navigation
            </div>
            <ul className="space-y-2">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-[13px] text-white/50 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Legal */}
          <div>
            <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">
              Informations
            </div>
            <ul className="space-y-2">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-[13px] text-white/50 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Contact */}
          <div>
            <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">
              Contact
            </div>
            <ul className="space-y-3 text-[13px] text-white/50">
              <li className="flex items-start gap-2">
                <MapPin
                  size={14}
                  className="text-white/30 mt-0.5 flex-shrink-0"
                />
                <span>France métropolitaine</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={14} className="text-white/30 flex-shrink-0" />
                <a
                  href="tel:+33970193419"
                  className="hover:text-white transition-colors"
                >
                  09 70 19 34 19
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={14} className="text-white/30 flex-shrink-0" />
                <a
                  href="mailto:contact@automecanik.com"
                  className="hover:text-white transition-colors"
                >
                  contact@automecanik.com
                </a>
              </li>
              <li className="text-[12px] text-white/30 mt-2">
                Lun–Ven : 9h–18h
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-white/[0.06]">
        <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-4 flex flex-col lg:flex-row items-center justify-between gap-2 text-[11px] text-white/25">
          <span>
            © {new Date().getFullYear()} AutoMecanik. Tous droits réservés.
          </span>
          <span>Paiement sécurisé · Livraison 24-48h</span>
        </div>
      </div>
    </footer>
  );
}

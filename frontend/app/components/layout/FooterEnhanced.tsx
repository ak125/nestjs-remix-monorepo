/**
 * 🦶 FOOTER ENHANCED - Footer moderne et responsive
 *
 * Remplace le Footer basique par un système complet :
 * ✅ Backend API integration
 * ✅ 3 variantes (complete/simple/minimal)
 * ✅ Responsive design
 * ✅ Newsletter et social
 */

import { Link, useFetcher } from "@remix-run/react";
import {
  Mail,
  Phone,
  MapPin,
  Facebook,
  Instagram,
  Linkedin,
  ArrowRight,
  Heart,
  Youtube,
} from "lucide-react";
import { memo, useState, useEffect } from "react";
import { Button } from "~/components/ui/button";

interface FooterData {
  company: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  links: Array<{
    title: string;
    items: Array<{
      label: string;
      url: string;
      external?: boolean;
    }>;
  }>;
  social?: Array<{
    platform: string;
    url: string;
    icon: string;
  }>;
  legal?: Array<{
    label: string;
    url: string;
  }>;
  copyright: string;
  showNewsletter?: boolean;
}

interface FooterEnhancedProps {
  variant?: "complete" | "simple" | "minimal";
  context?: "admin" | "commercial" | "public";
  theme?: string;
  className?: string;
  staticData?: FooterData;
  showNewsletter?: boolean;
  showSocial?: boolean;
  config?: any;
  isEditable?: boolean;
}

export const FooterEnhanced = memo(function FooterEnhanced({
  variant = "complete",
  context = "public",
  theme = "default",
  className = "",
  staticData,
  showNewsletter = true,
  showSocial = true,
}: FooterEnhancedProps) {
  const [footerData, setFooterData] = useState<FooterData | null>(
    staticData || null,
  );
  const [loading, setLoading] = useState(!staticData);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  const fetcher = useFetcher();

  // 🔌 Connexion API backend
  useEffect(() => {
    if (!staticData) {
      fetcher.load(`/api/layout/footer?context=${context}`);
    }
  }, [context, staticData, fetcher]);

  // Mise à jour des données
  useEffect(() => {
    if (
      fetcher.data &&
      typeof fetcher.data === "object" &&
      fetcher.data !== null
    ) {
      const data = fetcher.data as any;
      if (!data.error) {
        setFooterData(data as FooterData);
        setLoading(false);
      }
    }
  }, [fetcher.data]);

  // Données de fallback
  const fallbackData: FooterData = {
    company: {
      name: "Pièces Auto",
      address: "123 Rue de l'Automobile, 75001 Paris",
      phone: "+33 1 23 45 67 89",
      email: "contact@pieces-auto.fr",
    },
    links: [
      {
        title: "Navigation",
        items: [
          { label: "Accueil", url: "/" },
          { label: "Catalogue", url: "/catalogue" },
          { label: "Marques", url: "/marques" },
          { label: "Aide", url: "/aide" },
        ],
      },
      {
        title: "Services",
        items: [
          { label: "Livraison", url: "/livraison" },
          { label: "Retours", url: "/retours" },
          { label: "Garantie", url: "/garantie" },
          { label: "Support", url: "/support" },
        ],
      },
      {
        title: "Mon Compte",
        items: [
          { label: "Connexion", url: "/login" },
          { label: "Mes Commandes", url: "/orders" },
          { label: "Favoris", url: "/favorites" },
          { label: "Mon Garage", url: "/garage" },
        ],
      },
    ],
    social: [
      {
        platform: "facebook",
        url: "https://www.facebook.com/Automecanik63",
        icon: "facebook",
      },
      {
        platform: "instagram",
        url: "https://www.instagram.com/automecanik.co",
        icon: "instagram",
      },
      {
        platform: "linkedin",
        url: "https://linkedin.com/company/automecanik",
        icon: "linkedin",
      },
      {
        platform: "youtube",
        url: "https://www.youtube.com/@automecanik8508",
        icon: "youtube",
      },
    ],
    legal: [
      { label: "CGV", url: "/cgv" },
      { label: "Mentions Légales", url: "/mentions" },
      { label: "Confidentialité", url: "/privacy" },
      { label: "Cookies", url: "/cookies" },
    ],
    copyright: `© ${new Date().getFullYear()} Pièces Auto - Tous droits réservés`,
    showNewsletter: true,
  };

  const data = footerData || fallbackData;

  // Gestion newsletter
  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail) return;

    setNewsletterStatus("loading");

    // Simulation API newsletter
    setTimeout(() => {
      setNewsletterStatus("success");
      setNewsletterEmail("");
      setTimeout(() => setNewsletterStatus("idle"), 3000);
    }, 1000);
  };

  // Icônes sociales
  const getSocialIcon = (iconName: string) => {
    switch (iconName) {
      case "facebook":
        return <Facebook className="w-5 h-5" />;
      case "instagram":
        return <Instagram className="w-5 h-5" />;
      case "linkedin":
        return <Linkedin className="w-5 h-5" />;
      case "youtube":
        return <Youtube className="w-5 h-5" />;
      default:
        return null;
    }
  };

  // 🎨 Footer Minimal
  if (variant === "minimal") {
    return (
      <footer
        className={`footer footer--minimal bg-gray-100 border-t ${className} ${theme === "dark" ? "dark" : ""}`}
      >
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-600">
            <div className="mb-4 md:mb-0">
              <span className="font-medium">{data.company.name}</span>
            </div>
            <div className="flex items-center space-x-4">
              {data.legal?.slice(0, 3).map((item, index) => (
                <Link
                  key={index}
                  to={item.url}
                  className="hover:text-gray-900 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-4 md:mt-0">
              <span>{data.copyright}</span>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  // 🎨 Footer Simple
  if (variant === "simple") {
    return (
      <footer
        className={`footer footer--simple bg-gray-50 border-t ${className} ${theme === "dark" ? "dark" : ""}`}
      >
        <div className="container mx-auto px-4 py-8">
          {/* Informations principales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Entreprise */}
            <div>
              <h3 className="font-bold text-lg mb-4">{data.company.name}</h3>
              <div className="space-y-2 text-sm text-gray-600">
                {data.company.phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4" />
                    <span>{data.company.phone}</span>
                  </div>
                )}
                {data.company.email && (
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4" />
                    <span>{data.company.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation rapide */}
            <div>
              <h4 className="font-semibold mb-4">Navigation</h4>
              <div className="space-y-2">
                {data.links[0]?.items.slice(0, 4).map((item, index) => (
                  <Link
                    key={index}
                    to={item.url}
                    className="block text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Social */}
            {showSocial && data.social && (
              <div>
                <h4 className="font-semibold mb-4">Nous suivre</h4>
                <div className="flex space-x-4">
                  {data.social.map((social, index) => (
                    <a
                      key={index}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {getSocialIcon(social.icon)}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Copyright */}
          <div className="border-t pt-6 text-center text-sm text-gray-500">
            {data.copyright}
          </div>
        </div>
      </footer>
    );
  }

  // 🎨 Footer Complete (par défaut)
  return (
    <footer
      className={`footer footer--complete bg-gray-900 text-white ${className} ${theme === "dark" ? "dark" : ""}`}
    >
      {/* Section principale */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Informations entreprise */}
          <div className="lg:col-span-1">
            <h3 className="font-bold text-xl mb-6">{data.company.name}</h3>
            <div className="space-y-4 text-gray-300">
              {data.company.address && (
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 mt-1 flex-shrink-0" />
                  <span className="text-sm">{data.company.address}</span>
                </div>
              )}
              {data.company.phone && (
                <div className="flex items-center space-x-3">
                  <Phone className="w-5 h-5" />
                  <span className="text-sm">{data.company.phone}</span>
                </div>
              )}
              {data.company.email && (
                <div className="flex items-center space-x-3">
                  <Mail className="w-5 h-5" />
                  <span className="text-sm">{data.company.email}</span>
                </div>
              )}
            </div>

            {/* Réseaux sociaux */}
            {showSocial && data.social && (
              <div className="mt-6">
                <h4 className="font-medium mb-4">Nous suivre</h4>
                <div className="flex space-x-4">
                  {data.social.map((social, index) => (
                    <a
                      key={index}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gray-800 p-2 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      {getSocialIcon(social.icon)}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Liens organisés */}
          {data.links.map((section, index) => (
            <div key={index}>
              <h4 className="font-semibold mb-6">{section.title}</h4>
              <div className="space-y-3">
                {section.items.map((item, itemIndex) => (
                  <Link
                    key={itemIndex}
                    to={item.url}
                    className="block text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {/* Newsletter */}
          {showNewsletter && data.showNewsletter && (
            <div>
              <h4 className="font-semibold mb-6">Newsletter</h4>
              <p className="text-sm text-gray-300 mb-4">
                Recevez nos dernières offres et actualités
              </p>

              <form onSubmit={handleNewsletterSubmit} className="space-y-3">
                <div className="flex">
                  <input
                    type="email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="Votre email"
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-l-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    disabled={newsletterStatus === "loading"}
                  />
                  <Button
                    className="disabled: px-4 py-2 rounded-r-lg"
                    variant="blue"
                    type="submit"
                    disabled={
                      newsletterStatus === "loading" || !newsletterEmail
                    }
                  >
                    {newsletterStatus === "loading" ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ArrowRight className="w-5 h-5" />
                    )}
                  </Button>
                </div>

                {newsletterStatus === "success" && (
                  <p className="text-green-400 text-sm">
                    ✅ Inscription réussie !
                  </p>
                )}
                {newsletterStatus === "error" && (
                  <p className="text-red-400 text-sm">
                    ❌ Erreur, veuillez réessayer
                  </p>
                )}
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Section légale */}
      <div className="border-t border-gray-800">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
            <div className="mb-4 md:mb-0 flex items-center">
              <span>{data.copyright}</span>
              <Heart className="w-4 h-4 mx-2 text-red-500" />
              <span>Made in France</span>
            </div>

            <div className="flex flex-wrap justify-center md:justify-end space-x-6">
              {data.legal?.map((item, index) => (
                <Link
                  key={index}
                  to={item.url}
                  className="hover:text-white transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
          <div className="text-white text-sm">Chargement du footer...</div>
        </div>
      )}
    </footer>
  );
});

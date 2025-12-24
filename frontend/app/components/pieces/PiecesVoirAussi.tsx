/**
 * PiecesVoirAussi - Section maillage interne SEO
 *
 * Version Shadcn UI avec:
 * - Badge component pour les liens
 * - Lucide icons
 * - URLs pré-calculées du loader (pas de construction client)
 * - Schema.org ItemList pour SEO
 */

import { Link } from "@remix-run/react";
import { Link2 } from "lucide-react";

import { type GammeData, type VehicleData } from "../../types/pieces-route.types";
import { type VoirAussiLinks } from "../../utils/url-builder.utils";
import { Badge } from "../ui/badge";

interface PiecesVoirAussiProps {
  links: VoirAussiLinks;
  gamme: GammeData;
  vehicle: VehicleData;
  onLinkClick: (url: string, anchorText: string) => void;
}

export function PiecesVoirAussi({
  links,
  gamme,
  vehicle,
  onLinkClick,
}: PiecesVoirAussiProps) {
  // 4 liens SEO avec validation inline simple
  const seoLinks = [
    {
      url: links.gammeUrl,
      label: `Toutes les ${gamme.name}`,
      title: `Gamme complète ${gamme.name}`,
    },
    {
      url: links.constructeurUrl,
      label: `Pièces ${vehicle.marque}`,
      title: `Catalogue ${vehicle.marque}`,
    },
    {
      url: links.modeleUrl,
      label: `${vehicle.marque} ${vehicle.modele}`,
      title: `Pièces ${vehicle.marque} ${vehicle.modele}`,
    },
    {
      url: links.catalogueUrl,
      label: "Catalogue complet",
      title: "Toutes les pièces auto",
    },
  ].filter(link => link.url && link.url.startsWith('/'));

  // Schema.org ItemList pour SEO
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Voir aussi",
    "description": `Liens utiles pour ${gamme.name} ${vehicle.marque} ${vehicle.modele}`,
    "numberOfItems": seoLinks.length,
    "itemListElement": seoLinks.map((link, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": link.label,
      "url": `https://www.automecanik.com${link.url}`,
    })),
  };

  return (
    <section className="container mx-auto px-4 mt-8 mb-12">
      {/* Schema.org JSON-LD pour SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />

      <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Link2 className="w-5 h-5 text-blue-600" />
          Voir aussi
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {seoLinks.map((link) => (
            <Link
              key={link.url}
              to={link.url}
              prefetch="intent"
              onClick={() => onLinkClick(link.url, link.label)}
              title={link.title}
              className="group"
            >
              <Badge
                variant="outline"
                className="w-full justify-start gap-2 py-2 px-3 hover:bg-blue-50 hover:border-blue-200 transition-colors cursor-pointer"
              >
                <span className="text-gray-400 group-hover:text-blue-500">→</span>
                <span className="text-gray-700 group-hover:text-blue-700 truncate">
                  {link.label}
                </span>
              </Badge>
            </Link>
          ))}
        </div>

        {seoLinks.length === 0 && (
          <p className="text-sm text-gray-500 italic">
            Aucun lien disponible pour cette configuration.
          </p>
        )}
      </div>
    </section>
  );
}

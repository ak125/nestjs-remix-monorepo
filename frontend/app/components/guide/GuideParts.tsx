/**
 * GuideParts — Dedicated S7 "Pièces complémentaires" component.
 * Parses the parts list from HTML and renders as visual link cards.
 */

import { Link } from "@remix-run/react";
import { Package, ArrowRight } from "lucide-react";
import { type GammeConseil } from "~/components/blog/conseil/section-config";
import { GuideCard } from "./GuideCard";

interface GuidePartsProps {
  section: GammeConseil;
  pgAlias?: string;
  pgId?: number;
}

interface PartLink {
  name: string;
  href: string;
}

/** Extract part links from S7 HTML content: <a href="/pieces/...">name</a> */
function parsePartLinks(html: string): PartLink[] {
  const regex = /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  const parts: PartLink[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    // Clean name: remove #LinkGamme_XXX# markers
    const name = match[2].replace(/#LinkGamme_\d+#/g, "").trim();
    if (name && href) {
      parts.push({ name, href });
    }
  }
  return parts;
}

export function GuideParts({ section, pgAlias, pgId }: GuidePartsProps) {
  const parts = parsePartLinks(section.content);

  return (
    <GuideCard
      title={section.title}
      anchor={section.anchor}
      icon={Package}
      label="Pièces complémentaires"
      gradient="from-green-600 to-emerald-600"
      border="border-green-200"
      labelColor="text-green-100"
      bodyBg="bg-green-50/30"
      sources={section.sources}
    >
      {parts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {parts.map((part) => (
            <Link
              key={part.href}
              to={part.href}
              prefetch="intent"
              className="group flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-green-100 hover:border-green-300 hover:shadow-sm transition-all"
            >
              <div className="flex-shrink-0 p-1.5 bg-green-100 rounded-md group-hover:bg-green-200 transition-colors">
                <Package className="w-4 h-4 text-green-700" />
              </div>
              <span className="flex-1 text-sm font-medium text-gray-800 group-hover:text-green-800 capitalize">
                {part.name}
              </span>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition-colors" />
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Aucune pièce complémentaire répertoriée.
        </p>
      )}
      {pgAlias && pgId && (
        <div className="mt-4 pt-3 border-t border-green-100">
          <Link
            to={`/pieces/${pgAlias}-${pgId}.html`}
            prefetch="intent"
            className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:text-green-900 font-medium transition-colors"
          >
            Voir toutes les pièces compatibles
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </GuideCard>
  );
}

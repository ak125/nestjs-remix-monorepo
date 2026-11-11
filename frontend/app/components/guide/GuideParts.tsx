/**
 * GuideParts — Dedicated S7 "Pièces complémentaires" component.
 * Parses the parts list from HTML and renders as visual link cards.
 */

import { Package, ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { type GammeConseil } from "~/components/blog/conseil/section-config";
import { buildGammeUrl } from "~/utils/url-builder.utils";
import { GuideCard } from "./GuideCard";

interface GuidePartsProps {
  section: GammeConseil;
  pgAlias?: string;
  pgId?: number;
}

/** A part of the list. No `href` when no gamme page can be served for it. */
interface PartItem {
  name: string;
  href?: string;
}

/**
 * A link, or a part name the backend left without link
 * (`<span data-gamme-link="unresolved">`), in document order. The label may
 * carry inline markup (`<strong>`, `<b>`).
 */
const PART_RE =
  /<a\s[^>]*?href="([^"]+)"[^>]*>([\s\S]*?)<\/a>|<span data-gamme-link="unresolved">([\s\S]*?)<\/span>/gi;

/**
 * A gamme page is only served at `/pieces/{alias}-{id}.html` (vehicle pages
 * add segments). A `/pieces/…` target written without identifier answers 410:
 * it is never rendered as a link.
 */
function isServableHref(href: string): boolean {
  if (!href.startsWith("/pieces/")) return true;
  const target = href.slice("/pieces/".length);
  if (/^[a-z0-9-]+-\d+\.html$/.test(target)) return true;
  return target.includes("/") && target.endsWith(".html");
}

/**
 * Remove inline markup from a label. Repeated until nothing is left to remove,
 * so that no tag can be rebuilt from the fragments around a removed one. The
 * label is rendered as text either way, never as HTML.
 */
function stripTags(html: string): string {
  let text = html;
  let previous: string;
  do {
    previous = text;
    text = text.replace(/<[^>]+>/g, "");
  } while (text !== previous);
  return text;
}

/** Extract the parts of the S7 HTML content, once each. */
function parseParts(html: string): PartItem[] {
  const parts = new Map<string, PartItem>();
  for (const match of html.matchAll(PART_RE)) {
    const href = match[1];
    // Clean name: remove inline markup and #LinkGamme_XXX# markers
    const name = stripTags(match[2] ?? match[3])
      .replace(/#LinkGamme_\d+#/g, "")
      .trim();
    if (!name) continue;
    const part: PartItem =
      href && isServableHref(href) ? { name, href } : { name };
    const key = part.href ?? `name:${name.toLowerCase()}`;
    if (!parts.has(key)) parts.set(key, part);
  }
  return [...parts.values()];
}

const PART_CARD =
  "flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-green-100";

export function GuideParts({ section, pgAlias, pgId }: GuidePartsProps) {
  const parts = parseParts(section.content);
  const gammeUrl = buildGammeUrl(pgAlias, pgId);

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
          {parts.map((part) =>
            part.href ? (
              <Link
                key={part.href}
                to={part.href}
                prefetch="intent"
                className={`group ${PART_CARD} hover:border-green-300 hover:shadow-sm transition-all`}
              >
                <div className="shrink-0 p-1.5 bg-green-100 rounded-md group-hover:bg-green-200 transition-colors">
                  <Package className="w-4 h-4 text-green-700" />
                </div>
                <span className="flex-1 text-sm font-medium text-gray-800 group-hover:text-green-800 capitalize">
                  {part.name}
                </span>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition-colors" />
              </Link>
            ) : (
              <div key={`name:${part.name}`} className={PART_CARD}>
                <div className="shrink-0 p-1.5 bg-green-100 rounded-md">
                  <Package className="w-4 h-4 text-green-700" />
                </div>
                <span className="flex-1 text-sm font-medium text-gray-800 capitalize">
                  {part.name}
                </span>
              </div>
            ),
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Aucune pièce complémentaire répertoriée.
        </p>
      )}
      {gammeUrl && (
        <div className="mt-4 pt-3 border-t border-green-100">
          <Link
            to={gammeUrl}
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

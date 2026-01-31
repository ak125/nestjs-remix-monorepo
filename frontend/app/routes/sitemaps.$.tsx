/**
 * Route: /sitemaps/*
 * Sert les sous-sitemaps:
 * - /sitemaps/stable/sitemap-stable-pieces-1.xml
 * - /sitemaps/familles/sitemap-filtres.xml
 * - /sitemaps/hot/sitemap-hot-pieces-1.xml
 */
import { promises as fs } from "fs";
import * as path from "path";
import { type LoaderFunctionArgs } from "@remix-run/node";

const SITEMAP_DIR = process.env.SITEMAP_OUTPUT_DIR || "/var/www/sitemaps";

export async function loader({ params }: LoaderFunctionArgs) {
  const subPath = params["*"] || "";

  // Sécurité: empêcher path traversal
  if (subPath.includes("..")) {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><error>Invalid path</error>',
      {
        status: 400,
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      },
    );
  }

  const filePath = path.join(SITEMAP_DIR, subPath);

  try {
    const xml = await fs.readFile(filePath, "utf-8");

    // Cache différent selon type de contenu
    // - hot: 1h (contenu prioritaire, change souvent)
    // - familles: 12h (contenu thématique, change modérément)
    // - stable: 24h (contenu standard)
    // - cold: 7j (contenu peu prioritaire)
    let cacheMaxAge = 86400; // default 24h
    if (subPath.includes("hot")) {
      cacheMaxAge = 3600; // 1h
    } else if (subPath.includes("familles")) {
      cacheMaxAge = 43200; // 12h
    } else if (subPath.includes("cold")) {
      cacheMaxAge = 604800; // 7j
    }

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": `public, max-age=${cacheMaxAge}, s-maxage=${cacheMaxAge * 2}`,
      },
    });
  } catch {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><error>Sitemap not found: ${subPath}</error>`,
      {
        status: 404,
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      },
    );
  }
}

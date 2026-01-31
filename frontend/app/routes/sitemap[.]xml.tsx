/**
 * Route: /sitemap.xml
 * Sert l'index principal des sitemaps depuis /var/www/sitemaps/
 */
import { promises as fs } from "fs";

const SITEMAP_DIR = process.env.SITEMAP_OUTPUT_DIR || "/var/www/sitemaps";

export async function loader() {
  try {
    const xml = await fs.readFile(`${SITEMAP_DIR}/sitemap.xml`, "utf-8");
    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><error>Sitemap index not found</error>',
      {
        status: 404,
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      },
    );
  }
}

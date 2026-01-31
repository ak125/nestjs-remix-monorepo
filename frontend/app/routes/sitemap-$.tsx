/**
 * Route: /sitemap-*.xml
 * Sert les sitemaps racine: /sitemap-racine.xml, /sitemap-categories.xml, etc.
 */
import { promises as fs } from "fs";
import { type LoaderFunctionArgs } from "@remix-run/node";

const SITEMAP_DIR = process.env.SITEMAP_OUTPUT_DIR || "/var/www/sitemaps";

export async function loader({ params }: LoaderFunctionArgs) {
  const filename = `sitemap-${params["*"]}`;

  // Sécurité: empêcher path traversal et valider extension
  if (filename.includes("..") || !filename.endsWith(".xml")) {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><error>Invalid sitemap request</error>',
      {
        status: 400,
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      },
    );
  }

  try {
    const xml = await fs.readFile(`${SITEMAP_DIR}/${filename}`, "utf-8");
    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><error>Sitemap ${filename} not found</error>`,
      {
        status: 404,
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      },
    );
  }
}

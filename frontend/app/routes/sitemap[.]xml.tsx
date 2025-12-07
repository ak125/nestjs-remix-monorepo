// app/routes/sitemap[.]xml.tsx
/**
 * 🗺️ SITEMAP INDEX PRINCIPAL - Google Search Console Ready
 * 
 * Structure finale pour soumission GSC:
 * - sitemap-racine.xml (homepage)
 * - sitemap-gamme-produits.xml (~105 gammes pièces)
 * - sitemap-constructeurs.xml (~117 marques)
 * - sitemap-modeles.xml (~8,000 modèles)
 * - sitemap-types-1.xml (motorisations partie 1)
 * - sitemap-types-2.xml (motorisations partie 2)
 * - sitemap-blog.xml (~88 articles)
 * 
 * 📊 URLs totales estimées: ~25,000+
 * 
 * Note: Génération directe côté Remix pour éviter
 * les problèmes de routage avec le backend v2
 */
import { type LoaderFunctionArgs } from "@remix-run/node";
import { getSitemapHeaders } from "~/lib/sitemap-fetch";

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();
  const today = new Date().toISOString().split('T')[0];
  const baseUrl = 'https://www.automecanik.com';
  
  // Liste des sitemaps réellement disponibles au niveau racine
  const sitemaps = [
    { loc: '/sitemap-racine.xml', comment: '1 URL : Homepage' },
    { loc: '/sitemap-gamme-produits.xml', comment: '~105 URLs : Gammes pièces auto' },
    { loc: '/sitemap-constructeurs.xml', comment: '~117 URLs : Marques/Constructeurs' },
    { loc: '/sitemap-modeles.xml', comment: 'Modèles automobiles' },
    { loc: '/sitemap-types-1.xml', comment: 'Motorisations partie 1' },
    { loc: '/sitemap-types-2.xml', comment: 'Motorisations partie 2' },
    { loc: '/sitemap-blog.xml', comment: '~88 URLs : Articles conseils et guides' },
  ];
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map(sitemap => `  <!-- ${sitemap.comment} -->
  <sitemap>
    <loc>${baseUrl}${sitemap.loc}</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>`;
  
  const duration = Date.now() - startTime;
  
  return new Response(xml, {
    headers: getSitemapHeaders({ responseTime: duration }),
  });
}

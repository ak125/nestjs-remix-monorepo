/**
 * Script de génération de sitemaps statiques
 *
 * Usage: npm run sitemap:generate
 *
 * Génère des fichiers XML statiques depuis les tables Supabase:
 * - __sitemap_p_link (714k URLs pièces)
 * - __sitemap_marque (35 constructeurs)
 * - __sitemap_motorisation (12k types/motorisations)
 * - __sitemap_blog (109 articles)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Charger les variables d'environnement uniquement si non définies (CI utilise les secrets GitHub)
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  dotenv.config({ path: path.join(__dirname, '../.env') });
}

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Erreur: SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env');
  process.exit(1);
}

const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, '../../public/sitemaps');
const BASE_URL = 'https://www.automecanik.com';
const URLS_PER_FILE = 50000;

// Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface PieceLink {
  map_id: number;
  map_pg_alias: string;
  map_pg_id: number;
  map_marque_alias: string;
  map_marque_id: number;
  map_modele_alias: string;
  map_modele_id: number;
  map_type_alias: string;
  map_type_id: number;
  map_has_item: number;
}

// NOTE: MarqueLink et MotorisationLink supprimés - remplacés par sitemap-vehicules.xml (V6)

interface BlogLink {
  map_id: string;
  map_alias: string;
  map_date: string;
}

function generateUrl(piece: PieceLink): string {
  // Format: /{type_alias}-{type_id}.html (alias + ID, format PHP original)
  return `${BASE_URL}/pieces/${piece.map_pg_alias}-${piece.map_pg_id}/${piece.map_marque_alias}-${piece.map_marque_id}/${piece.map_modele_alias}-${piece.map_modele_id}/${piece.map_type_alias}-${piece.map_type_id}.html`;
}

function generateSitemapXml(urls: { loc: string; priority: string; changefreq: string }[]): string {
  const urlEntries = urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

function generateSitemapIndex(sitemaps: string[]): string {
  const today = new Date().toISOString().split('T')[0];
  const entries = sitemaps.map(name => `  <sitemap>
    <loc>${BASE_URL}/${name}</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`;
}

// ============================================
// FONCTIONS DE FETCH
// ============================================
// NOTE: fetchMarques() et fetchMotorisations() supprimées
// Les marques, modèles et types sont maintenant générés par
// SitemapUnifiedService V6 dans sitemap-vehicules.xml

async function fetchBlogArticles(): Promise<BlogLink[]> {
  console.log('Chargement des articles depuis __sitemap_blog...');
  const { data, error } = await supabase
    .from('__sitemap_blog')
    .select('map_id, map_alias, map_date')
    .order('map_date', { ascending: false });

  if (error) {
    console.error('Erreur Supabase (blog):', error.message);
    return [];
  }
  console.log(`  ${data?.length || 0} articles chargés`);
  return data || [];
}

async function fetchAllPieces(): Promise<PieceLink[]> {
  console.log('Chargement des URLs depuis __sitemap_p_link...');

  const allPieces: PieceLink[] = [];
  const batchSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('__sitemap_p_link')
      .select('map_id, map_pg_alias, map_pg_id, map_marque_alias, map_marque_id, map_modele_alias, map_modele_id, map_type_alias, map_type_id, map_has_item')
      .range(offset, offset + batchSize - 1)
      .order('map_id');

    if (error) {
      console.error('Erreur Supabase:', error.message);
      break;
    }

    if (data && data.length > 0) {
      allPieces.push(...data);
      offset += batchSize;
      hasMore = data.length === batchSize;

      if (offset % 10000 === 0) {
        console.log(`  ${offset.toLocaleString()} URLs chargées...`);
      }
    } else {
      hasMore = false;
    }
  }

  console.log(`Total: ${allPieces.length.toLocaleString()} URLs chargées`);
  return allPieces;
}

async function generateSitemaps(): Promise<void> {
  console.log('=== Génération des sitemaps statiques ===\n');

  // Créer le répertoire de sortie
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const allSitemapFiles: string[] = [];

  // ============================================
  // NOTE: sitemap-constructeurs.xml et sitemap-types.xml sont OBSOLÈTES
  // Ils sont remplacés par sitemap-vehicules.xml généré par SitemapUnifiedService V6
  // qui inclut: marques (35) + modèles (973) + types (12756) = 13764 URLs
  // ============================================

  // ============================================
  // 1. SITEMAP BLOG (109 articles)
  // ============================================
  console.log('\n--- Blog ---');
  const articles = await fetchBlogArticles();
  if (articles.length > 0) {
    const blogUrls = articles
      .filter(a => a.map_alias) // Filtrer les alias vides
      .map(a => ({
        loc: `${BASE_URL}/blog-pieces-auto/${a.map_alias}`,
        priority: '0.6',
        changefreq: 'monthly',
      }));

    const blogXml = generateSitemapXml(blogUrls);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'sitemap-blog.xml'), blogXml);
    allSitemapFiles.push('sitemap-blog.xml');
    console.log(`Généré: sitemap-blog.xml (${blogUrls.length} URLs)`);
  }

  // ============================================
  // 2. SITEMAPS PIÈCES (714k URLs en shards)
  // ============================================
  console.log('\n--- Pièces ---');
  const pieces = await fetchAllPieces();

  if (pieces.length === 0) {
    console.error('Aucune URL pièces trouvée!');
  } else {
    // Filtrer les entrées valides
    const validPieces = pieces.filter(p =>
      p.map_pg_alias && p.map_marque_alias && p.map_modele_alias && p.map_type_alias
    );
    console.log(`URLs pièces valides: ${validPieces.length.toLocaleString()}`);

    // Générer les sitemaps par batch de 50k
    const numFiles = Math.ceil(validPieces.length / URLS_PER_FILE);

    for (let i = 0; i < numFiles; i++) {
      const start = i * URLS_PER_FILE;
      const end = Math.min(start + URLS_PER_FILE, validPieces.length);
      const batch = validPieces.slice(start, end);

      const urls = batch.map(piece => ({
        loc: generateUrl(piece),
        priority: piece.map_has_item > 0 ? '0.7' : '0.5',
        changefreq: piece.map_has_item > 0 ? 'weekly' : 'monthly',
      }));

      const filename = `sitemap-pieces-${i + 1}.xml`;
      const filepath = path.join(OUTPUT_DIR, filename);
      const xml = generateSitemapXml(urls);

      fs.writeFileSync(filepath, xml);
      allSitemapFiles.push(filename);
      console.log(`Généré: ${filename} (${urls.length.toLocaleString()} URLs)`);
    }
  }

  // ============================================
  // 3. INDEX PRINCIPAL
  // ============================================
  console.log('\n--- Index ---');
  const indexXml = generateSitemapIndex(allSitemapFiles);
  const indexPath = path.join(OUTPUT_DIR, 'sitemap.xml');
  fs.writeFileSync(indexPath, indexXml);
  console.log(`Index généré: sitemap.xml (${allSitemapFiles.length} sitemaps)`);

  // Créer les symlinks dans frontend/public (uniquement en développement local)
  // En production (OUTPUT_DIR défini), Caddy sert directement depuis /srv/sitemaps
  if (!process.env.OUTPUT_DIR) {
    const frontendPublicDir = path.join(__dirname, '../../frontend/public');
    console.log('\n=== Création des symlinks (développement local) ===');

    // Symlink pour le dossier sitemaps
    const sitemapsFolderLink = path.join(frontendPublicDir, 'sitemaps');
    try {
      if (fs.existsSync(sitemapsFolderLink)) fs.unlinkSync(sitemapsFolderLink);
      fs.symlinkSync('../../public/sitemaps', sitemapsFolderLink);
      console.log('Symlink créé: frontend/public/sitemaps');
    } catch (e) {
      console.log('Symlink sitemaps ignoré (peut-être déjà existant)');
    }

    // Symlinks individuels pour chaque sitemap
    const allSitemaps = ['sitemap.xml', ...allSitemapFiles];
    for (const filename of allSitemaps) {
      const linkPath = path.join(frontendPublicDir, filename);
      const targetPath = `../../public/sitemaps/${filename}`;
      try {
        if (fs.existsSync(linkPath)) fs.unlinkSync(linkPath);
        fs.symlinkSync(targetPath, linkPath);
      } catch (e) {
        // Ignorer les erreurs
      }
    }
    console.log(`${allSitemaps.length} symlinks créés dans frontend/public/`);
  } else {
    console.log('\n=== Mode production: symlinks ignorés (Caddy sert directement) ===');
  }

  // Résumé
  console.log('\n=== Résumé ===');
  console.log(`Répertoire: ${OUTPUT_DIR}`);
  console.log(`Fichiers générés: ${allSitemapFiles.length + 1}`);
}

// Exécution
generateSitemaps()
  .then(() => {
    console.log('\nGénération terminée avec succès!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Erreur:', err);
    process.exit(1);
  });

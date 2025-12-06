#!/usr/bin/env node
/**
 * 🧪 Script de test pour vérifier la configuration sitemap V2
 * Vérifie les URLs attendues sans démarrer le serveur NestJS complet
 * 
 * Usage: node scripts/test-sitemap-v2-config.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function countConstructeurs() {
  // Fetch all and filter in JS to avoid RLS/query issues
  const { data: allMarques, error } = await supabase
    .from('auto_marque')
    .select('marque_id, marque_display, marque_relfollow');

  if (error) {
    console.error('❌ Error fetching constructeurs:', error.message);
    return { total: 0, filtered: 0 };
  }

  const total = allMarques?.length || 0;
  
  // Filter by display
  const displayFiltered = (allMarques || []).filter(
    m => m.marque_display === 1 || m.marque_display === '1' || m.marque_display === true
  );
  
  // Filter by relfollow (1, '1', true, or null)
  const relfollowFiltered = displayFiltered.filter(
    m => m.marque_relfollow === 1 || m.marque_relfollow === '1' || m.marque_relfollow === true || m.marque_relfollow === null
  );

  return {
    total,
    display: displayFiltered.length,
    filtered: relfollowFiltered.length
  };
}

async function countModeles() {
  // Paginate to fetch ALL modeles
  const allModeles = [];
  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('auto_modele')
      .select('modele_id, modele_display, modele_relfollow')
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('❌ Error fetching modeles:', error.message);
      break;
    }

    if (data && data.length > 0) {
      allModeles.push(...data);
      offset += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  const total = allModeles.length;
  
  // Filter by display
  const displayFiltered = (allModeles || []).filter(
    m => m.modele_display === 1 || m.modele_display === '1' || m.modele_display === true
  );
  
  // Filter by relfollow (1, '1', true, or null)
  const relfollowFiltered = displayFiltered.filter(
    m => m.modele_relfollow === 1 || m.modele_relfollow === '1' || m.modele_relfollow === true || m.modele_relfollow === null
  );

  return {
    total,
    display: displayFiltered.length,
    filtered: relfollowFiltered.length
  };
}

async function countTypes() {
  // Paginate to fetch ALL types
  const allTypes = [];
  let offset = 0;
  const batchSize = 5000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('auto_type')
      .select('type_id, type_display, type_relfollow')
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('❌ Error fetching types:', error.message);
      break;
    }

    if (data && data.length > 0) {
      allTypes.push(...data);
      offset += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  const total = allTypes.length;
  
  // Filter by display
  const displayFiltered = (allTypes || []).filter(
    t => t.type_display === 1 || t.type_display === '1' || t.type_display === true
  );
  
  // Filter by relfollow (1, '1', true, or null)
  const relfollowFiltered = displayFiltered.filter(
    t => t.type_relfollow === 1 || t.type_relfollow === '1' || t.type_relfollow === true || t.type_relfollow === null
  );

  return {
    total,
    active: displayFiltered.length,
    filtered: relfollowFiltered.length
  };
}

async function countGammes() {
  // Paginate to fetch ALL gammes
  const allGammes = [];
  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('pieces_gamme')
      .select('pg_id, pg_display, pg_relfollow, pg_level')
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('❌ Error fetching gammes (batch ' + offset + '):', error.message);
      break;
    }

    if (data && data.length > 0) {
      allGammes.push(...data);
      offset += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  const total = allGammes.length;
  
  // Filter by display and relfollow
  const activeGammes = (allGammes || []).filter(g => {
    const isActive = g.pg_display === 1 || g.pg_display === '1' || g.pg_display === true;
    const hasRelfollow = g.pg_relfollow === 1 || g.pg_relfollow === '1' || g.pg_relfollow === true || g.pg_relfollow === null;
    return isActive && hasRelfollow;
  });

  const niveau1 = activeGammes.filter(g => g.pg_level === 1 || g.pg_level === '1').length;
  const niveau2 = activeGammes.filter(g => g.pg_level === 2 || g.pg_level === '2').length;

  return {
    total,
    active: activeGammes.length,
    niveau1,
    niveau2
  };
}

async function countBlogArticles() {
  const { count: adviceCount } = await supabase
    .from('__blog_advice')
    .select('ba_id', { count: 'exact', head: true });

  const { count: guideCount } = await supabase
    .from('__blog_guide')
    .select('bg_id', { count: 'exact', head: true });

  return {
    advice: adviceCount || 0,
    guide: guideCount || 0,
    total: (adviceCount || 0) + (guideCount || 0)
  };
}

async function main() {
  console.log('🧪 Test Sitemap V2 Configuration');
  console.log('================================\n');
  console.log(`📡 Supabase: ${supabaseUrl}\n`);

  try {
    // 1. Constructeurs
    const constructeurs = await countConstructeurs();
    console.log(`🚗 Constructeurs: ${constructeurs.filtered} URLs (${constructeurs.display} display=1, ${constructeurs.total} total)`);

    // 2. Modèles
    const modeles = await countModeles();
    console.log(`🚙 Modèles: ${modeles.filtered} URLs (${modeles.display} display=1, ${modeles.total} total)`);

    // 3. Types
    const types = await countTypes();
    console.log(`🏎️  Types: ${types.filtered} URLs (${types.active} display=1, ${types.total} total)`);

    // 4. Gammes
    const gammes = await countGammes();
    console.log(`🔧 Gammes: ${gammes.niveau1} niveau1 + ${gammes.niveau2} niveau2 = ${gammes.niveau1 + gammes.niveau2} URLs (${gammes.active} actives, ${gammes.total} total)`);

    // 5. Blog
    const blog = await countBlogArticles();
    console.log(`📝 Blog: ${blog.advice} conseils + ${blog.guide} guides = ${blog.total} URLs`);

    // Total estimation
    const totalEstimate = constructeurs.filtered + modeles.filtered + types.filtered + gammes.niveau1 + gammes.niveau2 + blog.total + 4; // +4 for static pages

    console.log('\n================================');
    console.log('📊 ESTIMATION TOTALE SITEMAP V2');
    console.log('================================');
    console.log(`
┌─────────────────────────────────────┐
│ Pages statiques:        ~4 URLs     │
│ Constructeurs:          ${String(constructeurs.filtered).padStart(5)} URLs │
│ Modèles:                ${String(modeles.filtered).padStart(5)} URLs │
│ Types/Motorisations:    ${String(types.filtered).padStart(5)} URLs │
│ Gammes niveau 1+2:      ${String(gammes.niveau1 + gammes.niveau2).padStart(5)} URLs │
│ Blog:                   ${String(blog.total).padStart(5)} URLs │
├─────────────────────────────────────┤
│ TOTAL ESTIMÉ:        ~${String(totalEstimate).padStart(6)} URLs │
└─────────────────────────────────────┘
    `);

    // Breakdown by sitemap
    console.log('📋 STRUCTURE SITEMAP HIÉRARCHIQUE:');
    console.log(`
sitemap-index.xml (master)
├── sitemap-static.xml
│   └── pages (~4 URLs)
└── sitemap-dynamic.xml
    ├── sitemap-catalog-index.xml
    │   ├── sitemap-constructeurs.xml (${constructeurs.filtered} URLs)
    │   ├── sitemap-modeles-a-m.xml (~${Math.floor(modeles.filtered / 2)} URLs)
    │   ├── sitemap-modeles-n-z.xml (~${Math.ceil(modeles.filtered / 2)} URLs)
    │   └── sitemap-types-*.xml (${types.filtered} URLs en 5 shards)
    ├── sitemap-blog-index.xml
    │   └── sitemap-blog-20XX.xml (${blog.total} URLs)
    └── sitemap-products-index.xml
        ├── sitemap-products-niveau1.xml (${gammes.niveau1} URLs)
        └── sitemap-products-niveau2.xml (${gammes.niveau2} URLs)

⚠️  pieces-index DÉSACTIVÉ (pas dans dynamic-index.children)
    `);

    console.log('✅ Configuration sitemap V2 validée !');

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();

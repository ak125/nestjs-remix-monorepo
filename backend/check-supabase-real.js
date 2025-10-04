/**
 * 🔍 Vérification DIRECTE via SQL PostgreSQL
 * Liste TOUTES les tables réellement présentes dans le schéma public
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_KEY non définie');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getAllTablesFromPostgres() {
  console.log(`\n🔍 REQUÊTE SQL DIRECTE - Liste TOUTES les tables du schéma public\n`);
  
  try {
    // Requête SQL pour lister TOUTES les tables
    const { data, error } = await client.rpc('exec_sql', {
      query: `
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename;
      `
    });

    if (error) {
      console.log(`⚠️  RPC exec_sql non disponible, essayons une autre méthode...`);
      console.log(`   Erreur: ${error.message}`);
      return await fallbackMethod();
    }

    console.log(`✅ ${data.length} tables trouvées dans le schéma public:\n`);
    data.forEach(row => {
      console.log(`   - ${row.tablename.padEnd(40)} (${row.size})`);
    });

    return data;

  } catch (err) {
    console.log(`❌ Erreur: ${err.message}`);
    return await fallbackMethod();
  }
}

async function fallbackMethod() {
  console.log(`\n📋 MÉTHODE ALTERNATIVE - Test des tables une par une\n`);
  
  // Liste exhaustive de toutes les tables possibles
  const allPossibleTables = [
    // AUTO
    'auto_marque',
    'auto_modele', 
    'auto_modele_group',
    'auto_type',
    '__cross_gamme_car_new',
    'auto_famille',
    'auto_gamme',
    
    // BLOG
    'blog_articles',
    'blog_conseil',
    '__blog_constructeur',
    '__blog_constructeur_modele',
    'blog_categories',
    'blog_tags',
    
    // PIECES
    'pieces_generique',
    'pieces_categorie',
    'pieces_gamme',
    '__pg_new',
    
    // AUTRES
    'search_index',
    'seo_metadata',
    'users',
    'sessions',
  ];

  const results = [];

  for (const tableName of allPossibleTables) {
    try {
      const { data, error, count } = await client
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (!error) {
        results.push({ 
          tableName, 
          exists: true, 
          count: count || 0,
          accessible: true
        });
        console.log(`✅ ${tableName.padEnd(35)} - ${count || 0} lignes`);
      } else if (error.message.includes('does not exist')) {
        console.log(`❌ ${tableName.padEnd(35)} - N'EXISTE PAS`);
      } else {
        results.push({ 
          tableName, 
          exists: true, 
          count: 0,
          accessible: false,
          error: error.message
        });
        console.log(`⚠️  ${tableName.padEnd(35)} - Erreur: ${error.message}`);
      }
    } catch (err) {
      console.log(`❌ ${tableName.padEnd(35)} - Exception: ${err.message}`);
    }
  }

  return results;
}

async function analyzeResults(results) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 ANALYSE COMPLÈTE`);
  console.log('='.repeat(80));

  const existing = results.filter(r => r.exists || r.count > 0);
  const withData = results.filter(r => r.count > 0);
  const empty = results.filter(r => r.exists && r.count === 0);

  console.log(`\n✅ Tables existantes: ${existing.length}`);
  console.log(`📊 Tables avec données: ${withData.length}`);
  console.log(`📭 Tables vides: ${empty.length}`);

  console.log(`\n📊 TABLES AVEC DONNÉES:`);
  withData.forEach(t => {
    console.log(`   - ${t.tableName.padEnd(35)} ${t.count.toString().padStart(7)} lignes`);
  });

  console.log(`\n📭 TABLES VIDES:`);
  empty.forEach(t => {
    console.log(`   - ${t.tableName}`);
  });

  // Analyse spécifique blog vs manufacturers
  const hasBlogConstructeur = results.find(r => r.tableName === '__blog_constructeur');
  const hasAutoMarque = results.find(r => r.tableName === 'auto_marque');

  console.log(`\n🎯 VERDICT FINAL:`);
  console.log(`${'='.repeat(80)}`);
  
  if (hasBlogConstructeur && hasBlogConstructeur.count > 0) {
    console.log(`✅ __blog_constructeur EXISTE avec ${hasBlogConstructeur.count} lignes`);
    console.log(`   → Utiliser /api/blog/constructeurs`);
  } else if (hasAutoMarque && hasAutoMarque.count > 0) {
    console.log(`❌ __blog_constructeur ${hasBlogConstructeur ? 'VIDE' : "N'EXISTE PAS"}`);
    console.log(`✅ auto_marque EXISTE avec ${hasAutoMarque.count} lignes`);
    console.log(`\n💡 RECOMMANDATION:`);
    console.log(`   → Utiliser /api/manufacturers au lieu de /api/blog/constructeurs`);
    console.log(`   → Une seule source de données (auto_marque)`);
    console.log(`   → Pas de duplication`);
  }
}

async function main() {
  console.log(`🚀 VÉRIFICATION RÉELLE SUPABASE POSTGRESQL\n`);
  
  const results = await getAllTablesFromPostgres();
  
  if (Array.isArray(results)) {
    await analyzeResults(results);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ Vérification terminée`);
  console.log('='.repeat(80));
}

main().catch(console.error);

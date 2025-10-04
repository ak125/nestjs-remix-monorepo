/**
 * 🔍 Script de vérification COMPLÈTE de toutes les tables Supabase
 * Liste toutes les tables accessibles et leurs colonnes
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_KEY non définie');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

// Liste des tables à vérifier (basé sur le code)
const TABLES_TO_CHECK = [
  // Tables AUTO (données techniques)
  'auto_marque',
  'auto_modele',
  'auto_modele_group',
  'auto_type',
  '__cross_gamme_car_new',
  
  // Tables BLOG
  'blog_articles',
  '__blog_constructeur',
  '__blog_constructeur_modele',
  'blog_conseil',
  
  // Tables PIECES
  'pieces_generique',
  'pieces_categorie',
  
  // Tables SEARCH
  'search_index',
  
  // Tables META
  'seo_metadata',
];

async function checkTable(tableName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 TABLE: ${tableName}`);
  console.log('='.repeat(80));

  try {
    // Essayer de compter les lignes
    const { count, error: countError } = await client
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (countError) {
      if (countError.message.includes('does not exist')) {
        console.log(`❌ TABLE N'EXISTE PAS`);
        return { exists: false, count: 0 };
      }
      console.log(`⚠️  Erreur count: ${countError.message}`);
      return { exists: false, count: 0, error: countError.message };
    }

    console.log(`✅ TABLE EXISTE - ${count || 0} lignes`);

    // Récupérer une ligne pour voir les colonnes
    const { data, error } = await client
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`⚠️  Erreur lecture: ${error.message}`);
      return { exists: true, count: count || 0, columns: [] };
    }

    if (!data || data.length === 0) {
      console.log(`📊 Colonnes: (impossible à déterminer - table vide)`);
      return { exists: true, count: 0, columns: [] };
    }

    const columns = Object.keys(data[0]);
    console.log(`📊 ${columns.length} colonnes:`);
    
    // Grouper par préfixe
    const grouped = {};
    columns.forEach(col => {
      const prefix = col.split('_')[0];
      if (!grouped[prefix]) grouped[prefix] = [];
      grouped[prefix].push(col);
    });

    Object.entries(grouped).forEach(([prefix, cols]) => {
      console.log(`  ${prefix}_*: ${cols.join(', ')}`);
    });

    // Échantillon de données
    console.log(`\n💾 Échantillon (première ligne):`);
    Object.entries(data[0]).slice(0, 5).forEach(([key, value]) => {
      const display = value === null ? 'NULL' : 
                     typeof value === 'string' ? `"${value.substring(0, 40)}${value.length > 40 ? '...' : ''}"` :
                     JSON.stringify(value);
      console.log(`  ${key}: ${display}`);
    });

    return { exists: true, count, columns };

  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
    return { exists: false, count: 0, error: err.message };
  }
}

async function analyzeArchitecture(results) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 ANALYSE ARCHITECTURE`);
  console.log('='.repeat(80));

  const autoTables = results.filter(r => r.name.startsWith('auto_'));
  const blogTables = results.filter(r => r.name.includes('blog'));
  const existingTables = results.filter(r => r.exists);
  const missingTables = results.filter(r => !r.exists);

  console.log(`\n✅ Tables existantes: ${existingTables.length}/${results.length}`);
  existingTables.forEach(t => {
    console.log(`   - ${t.name.padEnd(35)} ${(t.count || 0).toString().padStart(6)} lignes`);
  });

  console.log(`\n❌ Tables manquantes: ${missingTables.length}/${results.length}`);
  missingTables.forEach(t => {
    console.log(`   - ${t.name}`);
  });

  console.log(`\n🏭 Tables AUTO (techniques): ${autoTables.filter(t => t.exists).length}`);
  console.log(`📝 Tables BLOG (contenu): ${blogTables.filter(t => t.exists).length}`);

  // Recommandation
  console.log(`\n💡 RECOMMANDATION:`);
  
  const hasBlogConstructeur = results.find(r => r.name === '__blog_constructeur')?.exists;
  const hasAutoMarque = results.find(r => r.name === 'auto_marque')?.exists;
  
  if (!hasBlogConstructeur && hasAutoMarque) {
    console.log(`
   ⚠️  La table __blog_constructeur N'EXISTE PAS
   ✅ La table auto_marque EXISTE avec ${results.find(r => r.name === 'auto_marque')?.count} lignes
   
   🎯 SOLUTION: Utiliser directement /api/manufacturers au lieu de /api/blog/constructeurs
   
   Modifier le frontend:
   - AVANT: const apiUrl = new URL(\`\${API_BASE_URL}/api/blog/constructeurs\`);
   - APRÈS: const apiUrl = new URL(\`\${API_BASE_URL}/api/manufacturers\`);
   
   Avantages:
   ✅ Pas de duplication de données
   ✅ Une seule source de vérité (auto_marque)
   ✅ API déjà fonctionnelle
   ✅ Données réelles (117 marques)
    `);
  }
}

async function main() {
  console.log(`\n🚀 VÉRIFICATION COMPLÈTE SUPABASE\n`);

  const results = [];

  for (const tableName of TABLES_TO_CHECK) {
    const result = await checkTable(tableName);
    results.push({ name: tableName, ...result });
  }

  await analyzeArchitecture(results);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ Vérification terminée - ${results.length} tables analysées`);
  console.log('='.repeat(80));
}

main().catch(console.error);

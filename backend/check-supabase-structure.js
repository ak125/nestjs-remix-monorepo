/**
 * 🔍 Script de vérification de la structure Supabase
 * Inspecte les colonnes réelles des tables auto_*
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_KEY non définie');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTableStructure(tableName, limit = 1) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 TABLE: ${tableName}`);
  console.log('='.repeat(80));

  try {
    const { data, error } = await client
      .from(tableName)
      .select('*')
      .limit(limit);

    if (error) {
      console.error(`❌ Erreur:`, error.message);
      return null;
    }

    if (!data || data.length === 0) {
      console.warn(`⚠️  Aucune donnée trouvée dans ${tableName}`);
      return null;
    }

    const columns = Object.keys(data[0]);
    console.log(`✅ ${columns.length} colonnes trouvées:\n`);

    // Grouper par préfixe
    const grouped = {};
    columns.forEach(col => {
      const prefix = col.split('_')[0];
      if (!grouped[prefix]) grouped[prefix] = [];
      grouped[prefix].push(col);
    });

    Object.entries(grouped).forEach(([prefix, cols]) => {
      console.log(`  ${prefix}_*:`);
      cols.forEach(col => {
        const value = data[0][col];
        const type = typeof value;
        const sample = value === null ? 'NULL' : 
                      type === 'string' ? `"${value.substring(0, 30)}${value.length > 30 ? '...' : ''}"` :
                      type === 'number' ? value :
                      type === 'boolean' ? value :
                      JSON.stringify(value).substring(0, 30);
        console.log(`    - ${col.padEnd(25)} (${type.padEnd(8)}) = ${sample}`);
      });
    });

    return data[0];
  } catch (err) {
    console.error(`❌ Exception:`, err.message);
    return null;
  }
}

async function checkRelationships() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔗 VÉRIFICATION DES RELATIONS`);
  console.log('='.repeat(80));

  try {
    // Tester une jointure type → modele
    const { data, error } = await client
      .from('auto_type')
      .select(`
        type_id,
        type_name,
        type_modele_id,
        auto_modele (
          modele_id,
          modele_name
        )
      `)
      .limit(1);

    if (error) {
      console.error(`❌ Jointure auto_type → auto_modele ÉCHOUE:`, error.message);
      console.log(`\n💡 SOLUTION: Les FK ne sont pas configurées dans Supabase PostgREST`);
      console.log(`   → Il faut utiliser des requêtes séparées avec jointure manuelle`);
    } else {
      console.log(`✅ Jointure auto_type → auto_modele FONCTIONNE`);
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error(`❌ Exception:`, err.message);
  }
}

async function checkImageColumns() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🖼️  VÉRIFICATION DES COLONNES IMAGES`);
  console.log('='.repeat(80));

  // Vérifier marque_logo
  const { data: marques } = await client
    .from('auto_marque')
    .select('marque_id, marque_name, marque_logo')
    .not('marque_logo', 'is', null)
    .limit(5);

  console.log(`\n✅ Marques avec logo (${marques?.length || 0}):`);
  marques?.forEach(m => {
    console.log(`   - ${m.marque_name}: ${m.marque_logo}`);
  });

  // Vérifier modele_pic
  const { data: modeles } = await client
    .from('auto_modele')
    .select('modele_id, modele_name, modele_pic')
    .not('modele_pic', 'is', null)
    .limit(5);

  console.log(`\n✅ Modèles avec image (${modeles?.length || 0}):`);
  modeles?.forEach(m => {
    console.log(`   - ${m.modele_name}: ${m.modele_pic}`);
  });

  // Vérifier si type a une colonne image
  const { data: types } = await client
    .from('auto_type')
    .select('*')
    .limit(1);

  const typeColumns = types?.[0] ? Object.keys(types[0]) : [];
  const imageColumn = typeColumns.find(c => c.includes('pic') || c.includes('image') || c.includes('photo'));
  
  console.log(`\n📊 Colonne image dans auto_type: ${imageColumn || '❌ AUCUNE'}`);
  if (!imageColumn) {
    console.log(`   → Les images doivent venir de auto_modele.modele_pic`);
  }
}

async function main() {
  console.log(`\n🚀 VÉRIFICATION STRUCTURE SUPABASE\n`);

  // 1. Structure des tables
  await checkTableStructure('auto_marque', 2);
  await checkTableStructure('auto_modele_group', 2);
  await checkTableStructure('auto_modele', 2);
  await checkTableStructure('auto_type', 2);

  // 2. Relations FK
  await checkRelationships();

  // 3. Colonnes images
  await checkImageColumns();

  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ Vérification terminée`);
  console.log('='.repeat(80));
}

main().catch(console.error);

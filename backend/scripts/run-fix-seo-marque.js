#!/usr/bin/env node
/**
 * 🧹 Exécution du nettoyage HTML entities dans __seo_marque
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function executeSqlFile() {
  console.log('🧹 Nettoyage des entités HTML dans __seo_marque\n');

  const sqlPath = path.join(__dirname, 'fix-seo-marque-html-entities.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Séparer les requêtes (simpliste mais suffisant)
  const queries = sql
    .split(';')
    .map(q => q.trim())
    .filter(q => q && !q.startsWith('--'));

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    if (!query) continue;

    console.log(`\n📝 Requête ${i + 1}/${queries.length}:`);
    console.log(query.substring(0, 100) + '...\n');

    try {
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql_query: query 
      });

      if (error) {
        // Si RPC exec_sql n'existe pas, utiliser méthode alternative
        console.log('⚠️  RPC exec_sql non disponible, utilisation directe...');
        
        // Pour les SELECT, utiliser .from()
        if (query.trim().toUpperCase().startsWith('SELECT')) {
          const { data: selectData, error: selectError } = await supabase
            .from('__seo_marque')
            .select('*');
          
          if (selectError) {
            console.error('❌ Erreur:', selectError.message);
          } else {
            console.log('✅ Résultats:', selectData?.length || 0, 'lignes');
          }
        } else {
          console.error('❌ Erreur:', error.message);
          console.log('💡 Exécuter manuellement dans Supabase SQL Editor');
        }
      } else {
        console.log('✅ Succès');
        if (data) {
          console.log('📊 Résultat:', JSON.stringify(data).substring(0, 200));
        }
      }
    } catch (err) {
      console.error('❌ Exception:', err.message);
    }
  }

  console.log('\n✅ Script terminé');
  console.log('\n💡 Pour vérifier les résultats:');
  console.log('   curl http://localhost:3000/api/brands/brand/renault | jq .data.seo\n');
}

executeSqlFile().catch(console.error);

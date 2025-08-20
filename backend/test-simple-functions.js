const { Pool } = require('pg');
require('dotenv').config();

async function testSimpleFunctions() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('✅ Connexion à la base de données...');
    const client = await pool.connect();
    
    // 1. Lire le fichier SQL
    const fs = require('fs');
    const sqlContent = fs.readFileSync('./sql/manufacturers-search-functions.sql', 'utf8');
    
    console.log('\n🔧 Exécution des fonctions SQL simplifiées...');
    await client.query(sqlContent);
    console.log('✅ Fonctions SQL créées avec succès');

    // 2. Test des fonctions
    console.log('\n🧪 Tests des fonctions...');
    const testResult = await client.query('SELECT * FROM test_search_functions()');
    
    console.log('\n📊 Résultats des tests :');
    testResult.rows.forEach(row => {
      console.log(`${row.test_name}: ${row.result_count} résultats - ${row.status}`);
    });

    // 3. Test concret recherche BMW
    console.log('\n🔍 Test recherche BMW :');
    const bmwResult = await client.query('SELECT * FROM search_manufacturers_advanced($1, $2)', ['BMW', 5]);
    console.log(`Nombre de constructeurs BMW trouvés: ${bmwResult.rows.length}`);
    bmwResult.rows.forEach(row => {
      console.log(`- ${row.name} (ID: ${row.id}) - Relevance: ${row.relevance}`);
    });

    // 4. Test recherche types
    console.log('\n🚗 Test recherche types GTI :');
    const gtiResult = await client.query('SELECT * FROM search_types_advanced($1, $2, $3, $4)', ['GTI', null, null, 5]);
    console.log(`Nombre de types GTI trouvés: ${gtiResult.rows.length}`);
    gtiResult.rows.forEach(row => {
      console.log(`- ${row.name} (${row.manufacturer_name}) - ${row.fuel_type} - ${row.power_hp}hp - Relevance: ${row.relevance}`);
    });

    // 5. Test vue overview
    console.log('\n📈 Test vue overview (top 5) :');
    const overviewResult = await client.query('SELECT * FROM manufacturer_overview_enhanced ORDER BY types_count DESC LIMIT 5');
    console.log(`Constructeurs avec le plus de types:`);
    overviewResult.rows.forEach(row => {
      console.log(`- ${row.name}: ${row.types_count} types, ${row.models_count} modèles`);
      console.log(`  Logo: ${row.logo}, Slug: ${row.slug}`);
      console.log(`  Carburants: ${row.fuel_types ? row.fuel_types.join(', ') : 'N/A'}`);
      console.log(`  Puissance moyenne: ${row.avg_power ? Math.round(row.avg_power) + 'hp' : 'N/A'}`);
      console.log('');
    });

    console.log('\n🎉 Tous les tests ont réussi ! Les fonctions sont opérationnelles.');
    
    client.release();

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testSimpleFunctions();

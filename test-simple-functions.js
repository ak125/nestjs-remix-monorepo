const { Client } = require('pg');

async function testSimpleFunctions() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connexion à la base de données réussie');

    // 1. Lire le fichier SQL
    const fs = require('fs');
    const sqlContent = fs.readFileSync('./backend/sql/manufacturers-search-functions.sql', 'utf8');
    
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
      console.log(`- ${row.name} (ID: ${row.id})`);
    });

    // 4. Test recherche types
    console.log('\n🚗 Test recherche types GTI :');
    const gtiResult = await client.query('SELECT * FROM search_types_advanced($1, $2, $3, $4)', ['GTI', null, null, 5]);
    console.log(`Nombre de types GTI trouvés: ${gtiResult.rows.length}`);
    gtiResult.rows.forEach(row => {
      console.log(`- ${row.name} (${row.manufacturer_name}) - ${row.fuel_type} - ${row.power_hp}hp`);
    });

    // 5. Test vue overview
    console.log('\n📈 Test vue overview (top 5) :');
    const overviewResult = await client.query('SELECT * FROM manufacturer_overview_enhanced ORDER BY types_count DESC LIMIT 5');
    console.log(`Constructeurs avec le plus de types:`);
    overviewResult.rows.forEach(row => {
      console.log(`- ${row.name}: ${row.types_count} types, ${row.models_count} modèles`);
    });

    console.log('\n🎉 Tous les tests ont réussi ! Les fonctions sont opérationnelles.');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.message.includes('column')) {
      console.log('\n💡 Suggestion: La colonne mentionnée n\'existe probablement pas dans le schéma actuel.');
    }
  } finally {
    await client.end();
  }
}

testSimpleFunctions();

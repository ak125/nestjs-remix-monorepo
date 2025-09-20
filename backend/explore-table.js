const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function exploreTable(tableName) {
  console.log(`🔍 Exploring table: ${tableName}`);
  
  try {
    // Récupérer une ligne pour voir la structure
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('\n📋 Table structure (columns found):');
      Object.keys(data[0]).forEach(column => {
        console.log(`  - ${column}: ${typeof data[0][column]} (${data[0][column]})`);
      });
    } else {
      console.log('⚠️ No data found in table');
    }

  } catch (error) {
    console.error('❌ Error exploring table:', error);
  }
}

// Explorer la table ___xtr_order
exploreTable('___xtr_order');

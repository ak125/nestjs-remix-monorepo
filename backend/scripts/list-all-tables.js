#!/usr/bin/env node
const https = require('https');

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY';

// Liste des tables potentielles basées sur la structure du projet
const POTENTIAL_TABLES = [
  '__cross_gamme_car',
  '__cross_gamme_car_new',
  '__seo_family_gamme_car',
  '__seo_family_gamme_car_switch',
  '__seo_gamme_car',
  '__seo_gamme_car_switch',
  'auto_type',
  'auto_modele',
  'auto_marque',
];

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'cxpojprgwgubzjyqzmoq.supabase.co',
      path: path,
      method: 'GET',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function checkTable(tableName) {
  try {
    const result = await makeRequest(`/rest/v1/${tableName}?select=*&limit=1`);
    if (result.status === 200) {
      const data = JSON.parse(result.body);
      if (data && data.length > 0) {
        const columns = Object.keys(data[0]);
        return { exists: true, columns };
      }
    }
    return { exists: false };
  } catch (err) {
    return { exists: false };
  }
}

async function main() {
  console.log('📋 LISTE DES TABLES DISPONIBLES\n');
  console.log('═'.repeat(70));
  
  for (const tableName of POTENTIAL_TABLES) {
    const result = await checkTable(tableName);
    
    if (result.exists) {
      console.log(`\n✅ ${tableName}`);
      console.log(`   Colonnes: ${result.columns.join(', ')}`);
    } else {
      console.log(`\n❌ ${tableName} (non trouvée)`);
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log('\n' + '═'.repeat(70));
}

main().catch(err => {
  console.error('💥 Erreur:', err.message);
});

#!/usr/bin/env node
const https = require('https');

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY';

const TABLES_TO_SEARCH = [
  { name: '__seo_family_gamme_car_switch', textColumns: ['sfgcs_content', 'sfgcs_alias'] },
  { name: '__seo_family_gamme_car', textColumns: ['sfgc_content', 'sfgc_title'] },
  { name: '__seo_gamme_car', textColumns: ['sgc_content', 'sgc_title', 'sgc_text1', 'sgc_text2'] },
  { name: '__cross_gamme_car_new', textColumns: ['cgc_description', 'cgc_advice', 'cgc_text'] },
  { name: '__blog_advice', textColumns: ['ba_preview', 'ba_content', 'ba_h1'] },
];

const SEARCH_TERMS = [
  'contrôler régulièrement',
  'vérifier leurs usures',
  'contrôler la limite',
  'changer en cas de bruit'
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
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body ? JSON.parse(body) : []);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function searchInTable(table, searchTerm) {
  const results = [];
  
  for (const column of table.textColumns) {
    try {
      const encodedTerm = encodeURIComponent(searchTerm);
      const data = await makeRequest(
        `/rest/v1/${table.name}?select=*&${column}=ilike.*${encodedTerm}*&limit=3`
      );
      
      if (data && data.length > 0) {
        results.push({
          table: table.name,
          column: column,
          count: data.length,
          samples: data.map(row => ({
            id: Object.values(row)[0],
            text: row[column]?.substring(0, 150)
          }))
        });
      }
    } catch (err) {
      // Ignorer les erreurs
    }
  }
  
  return results;
}

async function main() {
  console.log('🔍 RECHERCHE GLOBALE DANS LA BASE DE DONNÉES\n');
  console.log('═'.repeat(70));
  
  for (const searchTerm of SEARCH_TERMS) {
    console.log(`\n🔎 Recherche: "${searchTerm}"\n`);
    
    let found = false;
    for (const table of TABLES_TO_SEARCH) {
      const results = await searchInTable(table, searchTerm);
      
      if (results.length > 0) {
        found = true;
        results.forEach(result => {
          console.log(`✅ Table: ${result.table}.${result.column}`);
          result.samples.forEach((sample, idx) => {
            console.log(`   ${idx + 1}. ID ${sample.id}: "${sample.text}..."`);
          });
        });
      }
    }
    
    if (!found) {
      console.log(`   ❌ Aucun résultat trouvé`);
    }
  }
  
  console.log('\n' + '═'.repeat(70));
}

main().catch(err => {
  console.error('💥 Erreur:', err.message);
  process.exit(1);
});

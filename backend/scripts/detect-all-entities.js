#!/usr/bin/env node
/**
 * Script de détection des entités HTML dans TOUTES les tables Supabase
 * 
 * Ce script analyse toutes les tables pour trouver les colonnes texte
 * contenant des entités HTML corrompues
 */

const https = require('https');

const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY';

// Tables à analyser (basées sur la structure de votre projet)
const TABLES_TO_CHECK = [
  // Blog
  { name: '__blog_advice', columns: ['ba_h1', 'ba_preview', 'ba_content', 'ba_descrip', 'ba_keywords'] },
  
  // SEO
  { name: '__seo_family_gamme_car_switch', columns: ['sfgcs_content'] },
  { name: '__seo_gamme', columns: ['sg_title', 'sg_descrip', 'sg_keywords', 'sg_h1'] },
  { name: '__seo_gamme_conseils', columns: ['sgc_title', 'sgc_content'] },
  { name: '__seo_gamme_informations', columns: ['sgi_content'] },
  { name: '__seo_equip_gamme', columns: ['seg_content'] },
  
  // Catalogue
  { name: '__main_catalogue', columns: ['mc_name', 'mc_description', 'mc_meta_description'] },
  
  // Produits
  { name: '__produits_gamme', columns: ['pg_name', 'pg_description', 'pg_h1', 'pg_title', 'pg_keywords'] },
  
  // Marques/Équipementiers
  { name: '__produits_marque', columns: ['pm_name', 'pm_description'] },
];

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'cxpojprgwgubzjyqzmoq.supabase.co',
      path: path,
      method: method,
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body ? JSON.parse(body) : null);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function checkTable(tableName, columns) {
  console.log(`\n📊 Analyse de la table: ${tableName}`);
  console.log(`   Colonnes: ${columns.join(', ')}`);
  
  const results = {};
  
  for (const column of columns) {
    try {
      // Chercher les lignes avec des entités HTML dans cette colonne
      const data = await makeRequest(
        'GET',
        `/rest/v1/${tableName}?select=${column}&${column}=ilike.*%26*&limit=3`
      );
      
      if (data && data.length > 0) {
        results[column] = data.length;
        console.log(`   ✅ ${column}: ${data.length} lignes avec entités HTML`);
        
        // Afficher un exemple
        if (data[0][column]) {
          const preview = data[0][column].substring(0, 100).replace(/\n/g, ' ');
          console.log(`      Exemple: "${preview}..."`);
        }
      }
    } catch (err) {
      if (err.message.includes('404') || err.message.includes('42P01')) {
        console.log(`   ⚠️  Table ${tableName} non trouvée`);
        return null;
      } else if (err.message.includes('42703')) {
        console.log(`   ⚠️  Colonne ${column} non trouvée`);
      } else {
        console.log(`   ❌ Erreur ${column}: ${err.message}`);
      }
    }
  }
  
  return Object.keys(results).length > 0 ? results : null;
}

async function main() {
  console.log('🔍 ANALYSE GLOBALE DES ENTITÉS HTML DANS LA BASE DE DONNÉES\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const corruptedTables = [];
  
  for (const table of TABLES_TO_CHECK) {
    const results = await checkTable(table.name, table.columns);
    if (results) {
      corruptedTables.push({ ...table, results });
    }
    await new Promise(r => setTimeout(r, 500)); // Rate limiting
  }
  
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('📈 RÉSUMÉ GLOBAL');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (corruptedTables.length === 0) {
    console.log('✅ Aucune table avec des entités HTML trouvée !');
  } else {
    console.log(`❌ ${corruptedTables.length} tables contiennent des entités HTML:\n`);
    
    corruptedTables.forEach(table => {
      console.log(`📋 ${table.name}:`);
      Object.entries(table.results).forEach(([col, count]) => {
        console.log(`   • ${col}: ${count}+ lignes corrompues`);
      });
    });
    
    console.log('\n💡 Pour corriger toutes ces tables, exécutez:');
    console.log('   node scripts/fix-all-entities.js');
  }
  
  console.log('\n');
}

main().catch(err => {
  console.error('💥 Erreur fatale:', err.message);
  process.exit(1);
});

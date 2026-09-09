#!/usr/bin/env node
/**
 * Script de test et monitoring des entités HTML
 * 
 * Ce script vérifie régulièrement que la base de données
 * ne contient pas d'entités HTML corrompues
 * 
 * Usage:
 *   node scripts/test-html-entities.js
 * 
 * Exit codes:
 *   0 - Aucune entité trouvée (succès)
 *   1 - Entités HTML détectées (échec)
 */

const https = require('https');

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY manquante — exporter la cle sb_secret_ avant de lancer ce script.',
  );
}

const CRITICAL_TABLES = [
  { name: '__blog_advice', columns: ['ba_preview', 'ba_content', 'ba_descrip'] },
  { name: '__seo_family_gamme_car_switch', columns: ['sfgcs_content'] },
  { name: '__seo_gamme', columns: ['sg_descrip'] },
  { name: '__seo_equip_gamme', columns: ['seg_content'] },
];

function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'cxpojprgwgubzjyqzmoq.supabase.co',
      path: path,
      method: method,
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
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

async function checkTable(table) {
  const results = [];
  
  for (const column of table.columns) {
    try {
      // Chercher les entités HTML (pas les & simples)
      // Pattern: &xxx; ou &#xxx; mais pas & seul
      const data = await makeRequest(
        'GET',
        `/rest/v1/${table.name}?select=${column}&${column}=like.*%26[a-z]*%3B*&limit=5`
      );
      
      if (data && data.length > 0) {
        // Filtrer pour ne garder que les vraies entités HTML
        const withEntities = data.filter(row => {
          const text = row[column];
          // Détecter &xxx; ou &#xxx; mais pas & seul
          return text && /&[a-zA-Z]+;|&#\d+;|&#x[0-9a-fA-F]+;/.test(text);
        });
        
        if (withEntities.length > 0) {
          results.push({
            table: table.name,
            column: column,
            count: withEntities.length,
            sample: withEntities[0][column]?.substring(0, 100)
          });
        }
      }
    } catch (err) {
      // Ignorer les erreurs de tables non trouvées
    }
  }
  
  return results;
}

async function main() {
  console.log('🔍 Test des entités HTML dans la base de données\n');
  console.log('═'.repeat(60));
  
  const allIssues = [];
  
  for (const table of CRITICAL_TABLES) {
    const issues = await checkTable(table);
    allIssues.push(...issues);
  }
  
  if (allIssues.length === 0) {
    console.log('✅ SUCCÈS : Aucune entité HTML détectée !');
    console.log('   La base de données est propre.');
    console.log('═'.repeat(60));
    process.exit(0);
  } else {
    console.log(`❌ ÉCHEC : ${allIssues.length} problème(s) détecté(s)\n`);
    
    allIssues.forEach((issue, idx) => {
      console.log(`${idx + 1}. Table: ${issue.table}, Colonne: ${issue.column}`);
      console.log(`   Nombre: ${issue.count} ligne(s)`);
      console.log(`   Exemple: "${issue.sample}..."\n`);
    });
    
    console.log('═'.repeat(60));
    console.log('💡 Pour corriger, exécutez:');
    console.log('   node scripts/fix-all-entities.js');
    console.log('═'.repeat(60));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('💥 Erreur:', err.message);
  process.exit(2);
});

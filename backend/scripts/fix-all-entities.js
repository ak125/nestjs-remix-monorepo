#!/usr/bin/env node
/**
 * Script de correction GLOBALE des entités HTML dans TOUTES les tables Supabase
 * 
 * Tables corrigées:
 * - __blog_advice (ba_preview, ba_content, ba_descrip)
 * - __seo_family_gamme_car_switch (sfgcs_content)
 * - __seo_gamme (sg_descrip)
 * - __seo_equip_gamme (seg_content)
 * 
 * Usage: node scripts/fix-all-entities.js
 */

const https = require('https');

const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY';

// Configuration des tables à corriger
const TABLES_CONFIG = [
  {
    name: '__blog_advice',
    idColumn: 'ba_id',
    columns: ['ba_h1', 'ba_preview', 'ba_content', 'ba_descrip', 'ba_keywords']
  },
  {
    name: '__seo_family_gamme_car_switch',
    idColumn: 'sfgcs_id',
    columns: ['sfgcs_content']
  },
  {
    name: '__seo_gamme',
    idColumn: 'sg_id',
    columns: ['sg_title', 'sg_descrip', 'sg_keywords', 'sg_h1']
  },
  {
    name: '__seo_equip_gamme',
    idColumn: 'seg_id',
    columns: ['seg_content']
  },
];

function decodeHtmlEntities(text) {
  if (!text || typeof text !== 'string') return text;
  
  const entities = {
    // Voyelles accentuées minuscules
    '&eacute;': 'é', '&egrave;': 'è', '&ecirc;': 'ê', '&euml;': 'ë',
    '&agrave;': 'à', '&acirc;': 'â', '&auml;': 'ä',
    '&ocirc;': 'ô', '&ouml;': 'ö', '&ograve;': 'ò',
    '&icirc;': 'î', '&iuml;': 'ï', '&igrave;': 'ì',
    '&ucirc;': 'û', '&ugrave;': 'ù', '&uuml;': 'ü',
    // Voyelles accentuées majuscules
    '&Eacute;': 'É', '&Egrave;': 'È', '&Ecirc;': 'Ê', '&Euml;': 'Ë',
    '&Agrave;': 'À', '&Acirc;': 'Â', '&Auml;': 'Ä',
    '&Ocirc;': 'Ô', '&Ouml;': 'Ö', '&Ograve;': 'Ò',
    '&Icirc;': 'Î', '&Iuml;': 'Ï', '&Igrave;': 'Ì',
    '&Ucirc;': 'Û', '&Ugrave;': 'Ù', '&Uuml;': 'Ü',
    // Cédille
    '&ccedil;': 'ç', '&Ccedil;': 'Ç',
    // Guillemets et apostrophes
    '&rsquo;': "'", '&lsquo;': "'", '&#39;': "'", '&apos;': "'",
    '&rdquo;': '"', '&ldquo;': '"', '&#34;': '"', '&quot;': '"',
    '&laquo;': '«', '&raquo;': '»',
    // Ponctuation et symboles
    '&hellip;': '…', '&mdash;': '—', '&ndash;': '–',
    '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
    '&deg;': '°', '&plusmn;': '±', '&times;': '×', '&divide;': '÷',
    '&euro;': '€', '&pound;': '£', '&yen;': '¥', '&cent;': '¢',
    // Entités tronquées (corrompues)
    '&ea': 'é', '&e': 'e', '&ag': 'à', '&r': 'r',
  };

  let decoded = text;
  
  // D'abord les entités nommées
  Object.entries(entities).forEach(([entity, char]) => {
    decoded = decoded.split(entity).join(char);
  });
  
  // Puis les entités numériques décimales (&#NNN;)
  decoded = decoded.replace(/&#(\d+);/g, (match, code) => {
    return String.fromCharCode(parseInt(code, 10));
  });
  
  // Entités hexadécimales (&#xNNN;)
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });
  
  return decoded;
}

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

async function fixTable(tableConfig) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📋 Table: ${tableConfig.name}`);
  console.log(`${'═'.repeat(60)}\n`);
  
  let totalFixed = 0;
  let totalErrors = 0;
  
  for (const column of tableConfig.columns) {
    console.log(`🔍 Traitement de la colonne: ${column}`);
    
    try {
      // Récupérer toutes les lignes avec des entités HTML
      const selectColumns = `${tableConfig.idColumn},${column}`;
      const rows = await makeRequest(
        'GET',
        `/rest/v1/${tableConfig.name}?select=${selectColumns}&${column}=ilike.*%26*`
      );
      
      if (!rows || rows.length === 0) {
        console.log(`   ✅ Aucune entité HTML à corriger\n`);
        continue;
      }
      
      console.log(`   📊 ${rows.length} lignes à corriger`);
      
      let fixed = 0;
      let errors = 0;
      
      for (const row of rows) {
        const originalValue = row[column];
        if (!originalValue) continue;
        
        const cleanedValue = decodeHtmlEntities(originalValue);
        
        if (cleanedValue !== originalValue) {
          try {
            const updateData = { [column]: cleanedValue };
            await makeRequest(
              'PATCH',
              `/rest/v1/${tableConfig.name}?${tableConfig.idColumn}=eq.${row[tableConfig.idColumn]}`,
              updateData
            );
            fixed++;
            
            if (fixed % 50 === 0) {
              console.log(`   ⏳ ${fixed}/${rows.length} lignes corrigées...`);
            }
          } catch (err) {
            console.error(`   ❌ Erreur ID ${row[tableConfig.idColumn]}: ${err.message}`);
            errors++;
          }
        }
      }
      
      console.log(`   ✅ ${fixed} lignes corrigées, ${errors} erreurs\n`);
      totalFixed += fixed;
      totalErrors += errors;
      
    } catch (err) {
      console.error(`   ❌ Erreur colonne ${column}: ${err.message}\n`);
      totalErrors++;
    }
  }
  
  return { fixed: totalFixed, errors: totalErrors };
}

async function main() {
  console.log('🚀 CORRECTION GLOBALE DES ENTITÉS HTML');
  console.log('═'.repeat(60));
  console.log(`Tables à traiter: ${TABLES_CONFIG.length}`);
  console.log(`Démarrage: ${new Date().toLocaleTimeString()}`);
  console.log('═'.repeat(60));
  
  console.log('\n⏸️  Démarrage dans 5 secondes... (Ctrl+C pour annuler)\n');
  await new Promise(r => setTimeout(r, 5000));
  
  const globalStats = {
    tablesProcessed: 0,
    totalFixed: 0,
    totalErrors: 0
  };
  
  for (const tableConfig of TABLES_CONFIG) {
    const result = await fixTable(tableConfig);
    globalStats.tablesProcessed++;
    globalStats.totalFixed += result.fixed;
    globalStats.totalErrors += result.errors;
    
    // Rate limiting entre les tables
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('✅ CORRECTION TERMINÉE');
  console.log('═'.repeat(60));
  console.log(`📊 Statistiques globales:`);
  console.log(`   • Tables traitées: ${globalStats.tablesProcessed}`);
  console.log(`   • Lignes corrigées: ${globalStats.totalFixed}`);
  console.log(`   • Erreurs: ${globalStats.totalErrors}`);
  console.log(`   • Terminé: ${new Date().toLocaleTimeString()}`);
  console.log('═'.repeat(60));
  
  console.log('\n💡 Prochaines étapes:');
  console.log('   1. Vider le cache Redis: redis-cli FLUSHDB');
  console.log('   2. Redémarrer le backend: npm run dev');
  console.log('   3. Tester les pages concernées\n');
}

main().catch(err => {
  console.error('💥 Erreur fatale:', err.message);
  process.exit(1);
});

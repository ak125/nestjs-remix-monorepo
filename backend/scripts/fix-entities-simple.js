#!/usr/bin/env node
/**
 * Script simple de correction des entités HTML
 * Usage: node scripts/fix-entities-simple.js
 */

const https = require('https');

const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY';

function decodeHtmlEntities(text) {
  const entities = {
    '&eacute;': 'é', '&egrave;': 'è', '&ecirc;': 'ê', '&euml;': 'ë',
    '&Eacute;': 'É', '&Egrave;': 'È', '&Ecirc;': 'Ê',
    '&agrave;': 'à', '&acirc;': 'â', '&auml;': 'ä',
    '&Agrave;': 'À', '&Acirc;': 'Â',
    '&ocirc;': 'ô', '&ouml;': 'ö', '&ograve;': 'ò',
    '&icirc;': 'î', '&iuml;': 'ï', '&igrave;': 'ì',
    '&ucirc;': 'û', '&ugrave;': 'ù', '&uuml;': 'ü',
    '&ccedil;': 'ç', '&Ccedil;': 'Ç',
    '&rsquo;': "'", '&lsquo;': "'", '&#39;': "'",
    '&rdquo;': '"', '&ldquo;': '"', '&#34;': '"',
    '&laquo;': '«', '&raquo;': '»',
    '&hellip;': '…', '&mdash;': '—', '&ndash;': '–',
    '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
    '&deg;': '°', '&plusmn;': '±', '&times;': '×',
    // Entités tronquées (probablement corrompues)
    '&ea': 'é', '&e': 'e',
  };

  let decoded = text;
  // D'abord les entités nommées
  Object.entries(entities).forEach(([entity, char]) => {
    decoded = decoded.split(entity).join(char);
  });
  
  // Puis les entités numériques génériques (&#NNN;)
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

async function main() {
  console.log('🚀 Correction des entités HTML dans __seo_family_gamme_car_switch\n');

  // Étape 1: Récupérer les fragments corrompus
  console.log('📥 Récupération des 312 fragments corrompus...');
  const fragments = await makeRequest(
    'GET',
    '/rest/v1/__seo_family_gamme_car_switch?select=sfgcs_id,sfgcs_content&sfgcs_content=ilike.*%26*'
  );

  console.log(`✅ ${fragments.length} fragments récupérés\n`);

  // Exemples AVANT
  console.log('📝 Exemples AVANT correction:');
  fragments.slice(0, 3).forEach((f, i) => {
    console.log(`  ${i+1}. ID ${f.sfgcs_id}: "${f.sfgcs_content.substring(0, 80)}..."`);
  });

  console.log('\n⚠️  Correction dans 5 secondes... (Ctrl+C pour annuler)\n');
  await new Promise(r => setTimeout(r, 5000));

  // Étape 2: Correction
  console.log('🔄 Correction en cours...');
  let success = 0;
  let errors = 0;

  for (const fragment of fragments) {
    const cleaned = decodeHtmlEntities(fragment.sfgcs_content);
    
    if (cleaned !== fragment.sfgcs_content) {
      try {
        await makeRequest(
          'PATCH',
          `/rest/v1/__seo_family_gamme_car_switch?sfgcs_id=eq.${fragment.sfgcs_id}`,
          { sfgcs_content: cleaned }
        );
        success++;
        if (success % 20 === 0) console.log(`   ✅ ${success} fragments corrigés...`);
      } catch (err) {
        console.error(`   ❌ Erreur ID ${fragment.sfgcs_id}:`, err.message);
        errors++;
      }
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('✅ CORRECTION TERMINÉE');
  console.log(`   • ${success} fragments corrigés`);
  console.log(`   • ${errors} erreurs`);
  console.log('═══════════════════════════════════════\n');

  // Vérification
  console.log('🔍 Vérification finale...');
  const remaining = await makeRequest(
    'GET',
    '/rest/v1/__seo_family_gamme_car_switch?select=sfgcs_id&sfgcs_content=ilike.*%26*&limit=1'
  );

  if (remaining.length > 0) {
    console.log(`⚠️  Il reste encore des entités HTML à corriger`);
  } else {
    console.log('✅ Toutes les entités HTML ont été corrigées !');
  }

  console.log('\n🎉 Script terminé !\n');
}

main().catch(err => {
  console.error('💥 Erreur:', err.message);
  process.exit(1);
});

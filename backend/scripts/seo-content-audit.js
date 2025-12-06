#!/usr/bin/env node
/**
 * 🔍 AUDIT COMPLET DU CONTENU SEO
 * 
 * Vérifie et corrige le contenu de toutes les gammes + véhicules
 * 
 * Usage:
 *   node scripts/seo-content-audit.js              # Audit uniquement
 *   node scripts/seo-content-audit.js --fix        # Audit + corrections automatiques
 *   node scripts/seo-content-audit.js --test 378   # Test une gamme spécifique
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BACKEND_URL = 'http://localhost:3000';
const args = process.argv.slice(2);
const FIX_MODE = args.includes('--fix');
const TEST_GAMME = args.find(a => a.match(/^\d+$/)) || (args.includes('--test') ? args[args.indexOf('--test') + 1] : null);

// ============================================
// RÈGLES DE CORRECTION
// ============================================

const FIX_RULES = [
  // GRAMMAIRE
  { 
    pattern: /qui\s+doit\s+être/gi, 
    replace: 'qui doivent être', 
    desc: '"qui doit être" → "qui doivent être"',
    category: 'grammaire'
  },
  { 
    pattern: /quoi\s+doivent/gi, 
    replace: 'qui doivent', 
    desc: '"quoi doivent" → "qui doivent"',
    category: 'grammaire'
  },
  
  // PONCTUATION
  { 
    pattern: /,\s*\.\s*/g, 
    replace: '. ', 
    desc: 'Virgule suivie de point ", ."',
    category: 'ponctuation'
  },
  { 
    pattern: /,\s*,/g, 
    replace: ',', 
    desc: 'Double virgule ",,"',
    category: 'ponctuation'
  },
  { 
    pattern: /\.\s*\./g, 
    replace: '.', 
    desc: 'Double point ".."',
    category: 'ponctuation'
  },
  { 
    pattern: /\s{2,}/g, 
    replace: ' ', 
    desc: 'Espaces multiples',
    category: 'ponctuation'
  },
  { 
    pattern: /\s+,/g, 
    replace: ',', 
    desc: 'Espace avant virgule',
    category: 'ponctuation'
  },
  { 
    pattern: /\s+\./g, 
    replace: '.', 
    desc: 'Espace avant point',
    category: 'ponctuation'
  },

  // HTML
  { 
    pattern: /<p>\s*<\/p>/gi, 
    replace: '', 
    desc: 'Paragraphes vides <p></p>',
    category: 'html'
  },
  
  // ENTITÉS HTML (si pas encore corrigées)
  { pattern: /&eacute;/g, replace: 'é', desc: '&eacute;', category: 'entities' },
  { pattern: /&egrave;/g, replace: 'è', desc: '&egrave;', category: 'entities' },
  { pattern: /&agrave;/g, replace: 'à', desc: '&agrave;', category: 'entities' },
  { pattern: /&ccedil;/g, replace: 'ç', desc: '&ccedil;', category: 'entities' },
  { pattern: /&#39;/g, replace: "'", desc: '&#39;', category: 'entities' },
  { pattern: /&nbsp;/g, replace: ' ', desc: '&nbsp;', category: 'entities' },
];

// RÈGLES DE DÉTECTION SEULEMENT (pas de correction auto)
const DETECT_RULES = [
  {
    pattern: /#CompSwitch[^#]*#/g,
    desc: 'Marqueur #CompSwitch# non résolu',
    severity: 'error'
  },
  {
    pattern: /#LinkGammeCar_\d+#/g,
    desc: 'Marqueur #LinkGammeCar# non résolu',
    severity: 'error'
  },
  {
    pattern: /#V[A-Za-z]+#/g,
    desc: 'Variable #VXxx# non résolue',
    severity: 'error'
  },
  {
    pattern: /\s+(de|et|pour|avec)\s*\.?\s*$/gm,
    desc: 'Fin de phrase incomplète',
    severity: 'warning'
  }
];

// ============================================
// RAPPORT
// ============================================

const REPORT = {
  totalTemplates: 0,
  issuesFound: 0,
  issuesFixed: 0,
  byCategory: {},
  templatesWithIssues: [],
  unresolvedMarkers: []
};

// ============================================
// FONCTIONS
// ============================================

function detectIssues(text, source) {
  if (!text) return [];
  const issues = [];
  
  // Règles de correction (détectables)
  for (const rule of FIX_RULES) {
    if (rule.pattern.test(text)) {
      issues.push({
        ...rule,
        source,
        canFix: true
      });
      // Reset regex lastIndex
      rule.pattern.lastIndex = 0;
    }
  }
  
  // Règles de détection seule
  for (const rule of DETECT_RULES) {
    const matches = text.match(rule.pattern);
    if (matches) {
      issues.push({
        ...rule,
        source,
        canFix: false,
        matches: matches.slice(0, 3)
      });
    }
  }
  
  return issues;
}

function applyFixes(text) {
  if (!text) return { text, fixes: [] };
  
  let result = text;
  const fixes = [];
  
  for (const rule of FIX_RULES) {
    const before = result;
    result = result.replace(rule.pattern, rule.replace);
    if (result !== before) {
      fixes.push(rule.desc);
    }
  }
  
  return { text: result, fixes };
}

// ============================================
// AUDIT DES TEMPLATES
// ============================================

async function auditTemplates() {
  console.log('\n📋 AUDIT DES TEMPLATES SEO EN BASE\n');
  console.log('='.repeat(60));
  
  const { data: templates, error } = await supabase
    .from('__seo_gamme_car')
    .select('sgc_pg_id, sgc_h1, sgc_content, sgc_preview, sgc_descrip, sgc_title');
  
  if (error) {
    console.error('❌ Erreur:', error.message);
    return;
  }
  
  REPORT.totalTemplates = templates.length;
  console.log(`📊 Total templates: ${templates.length}\n`);
  
  const FIELDS = ['sgc_h1', 'sgc_content', 'sgc_preview', 'sgc_descrip', 'sgc_title'];
  let displayCount = 0;
  
  for (const template of templates) {
    const allIssues = [];
    const updates = {};
    
    for (const field of FIELDS) {
      const text = template[field];
      if (!text) continue;
      
      const issues = detectIssues(text, field);
      allIssues.push(...issues);
      
      if (FIX_MODE) {
        const { text: fixed, fixes } = applyFixes(text);
        if (fixed !== text) {
          updates[field] = fixed;
        }
      }
    }
    
    if (allIssues.length > 0) {
      REPORT.issuesFound++;
      REPORT.templatesWithIssues.push({
        pgId: template.sgc_pg_id,
        issues: allIssues
      });
      
      // Comptage par catégorie
      allIssues.forEach(issue => {
        const cat = issue.category || 'autre';
        REPORT.byCategory[cat] = (REPORT.byCategory[cat] || 0) + 1;
      });
      
      // Afficher les 30 premiers
      if (displayCount < 30) {
        displayCount++;
        console.log(`\n🔍 pg_id=${template.sgc_pg_id}`);
        
        const uniqueDescs = [...new Set(allIssues.map(i => i.desc))];
        uniqueDescs.forEach(desc => {
          const issue = allIssues.find(i => i.desc === desc);
          const icon = issue.severity === 'error' ? '❌' : issue.canFix ? '⚠️' : '⚡';
          console.log(`   ${icon} ${desc}`);
        });
      }
      
      // Appliquer les corrections
      if (FIX_MODE && Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('__seo_gamme_car')
          .update(updates)
          .eq('sgc_pg_id', template.sgc_pg_id);
        
        if (!updateError) {
          REPORT.issuesFixed++;
        } else {
          console.error(`   ❌ Erreur update:`, updateError.message);
        }
      }
    }
  }
  
  if (displayCount >= 30 && REPORT.issuesFound > 30) {
    console.log(`\n... et ${REPORT.issuesFound - 30} autres templates avec problèmes`);
  }
}

// ============================================
// AUDIT DES SWITCHES
// ============================================

async function auditSwitches() {
  console.log('\n\n📋 AUDIT DES SWITCHES\n');
  console.log('='.repeat(60));
  
  const { data: switches, error } = await supabase
    .from('__seo_gamme_car_switch')
    .select('SGCS_ID, SGCS_PG_ID, SGCS_ALIAS, SGCS_SWITCH');
  
  if (error) {
    console.error('❌ Erreur:', error.message);
    return;
  }
  
  console.log(`📊 Total switches: ${switches.length}`);
  
  // Grouper par alias
  const byAlias = {};
  switches.forEach(s => {
    byAlias[s.SGCS_ALIAS] = byAlias[s.SGCS_ALIAS] || [];
    byAlias[s.SGCS_ALIAS].push(s);
  });
  
  Object.keys(byAlias).sort().forEach(alias => {
    console.log(`   - Alias ${alias}: ${byAlias[alias].length} switches`);
  });
  
  // Vérifier problèmes dans switches
  let switchIssues = 0;
  const switchUpdates = [];
  
  for (const sw of switches) {
    const text = sw.SGCS_SWITCH;
    if (!text) continue;
    
    const issues = detectIssues(text, 'switch');
    if (issues.length > 0) {
      switchIssues++;
      
      if (FIX_MODE) {
        const { text: fixed } = applyFixes(text);
        if (fixed !== text) {
          switchUpdates.push({ id: sw.SGCS_ID, text: fixed });
        }
      }
    }
  }
  
  console.log(`\n⚠️ Switches avec problèmes: ${switchIssues}`);
  
  // Appliquer les corrections sur switches
  if (FIX_MODE && switchUpdates.length > 0) {
    console.log(`🔧 Correction de ${switchUpdates.length} switches...`);
    
    for (const upd of switchUpdates) {
      await supabase
        .from('__seo_gamme_car_switch')
        .update({ SGCS_SWITCH: upd.text })
        .eq('SGCS_ID', upd.id);
    }
    
    console.log(`✅ ${switchUpdates.length} switches corrigés`);
  }
}

// ============================================
// TEST CONTENU GÉNÉRÉ (LIVE API)
// ============================================

async function testGeneratedContent() {
  if (!TEST_GAMME) return;
  
  console.log(`\n\n📋 TEST CONTENU GÉNÉRÉ - GAMME ${TEST_GAMME}\n`);
  console.log('='.repeat(60));
  
  // Récupérer quelques types pour tester
  const { data: types } = await supabase
    .from('type')
    .select('type_id, type_marque_id, type_name')
    .limit(5);
  
  if (!types || types.length === 0) {
    console.log('⚠️ Aucun type trouvé');
    return;
  }
  
  console.log(`🔄 Test avec ${types.length} véhicules...\n`);
  
  for (const type of types) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/catalog/gammes/${TEST_GAMME}/seo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type_id: type.type_id, 
          marque_id: type.type_marque_id 
        })
      });
      
      if (!response.ok) {
        console.log(`   ⚠️ type=${type.type_id}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const content = data.content || '';
      const issues = detectIssues(content, 'API content');
      
      if (issues.length > 0) {
        console.log(`\n❌ type=${type.type_id} (${type.type_name}):`);
        issues.forEach(i => console.log(`   - ${i.desc}`));
        
        // Afficher un extrait du contenu problématique
        const plainText = content.replace(/<[^>]+>/g, '').substring(0, 200);
        console.log(`   📝 "${plainText}..."`);
      } else {
        console.log(`   ✅ type=${type.type_id}: OK`);
      }
    } catch (err) {
      console.log(`   ❌ type=${type.type_id}: ${err.message}`);
    }
  }
}

// ============================================
// COUVERTURE DES LIENS
// ============================================

async function checkLinkCoverage() {
  console.log('\n\n📋 COUVERTURE DES LIENS INTERNES\n');
  console.log('='.repeat(60));
  
  const { data: templates } = await supabase
    .from('__seo_gamme_car')
    .select('sgc_pg_id, sgc_content');
  
  let withLinks = 0;
  const withoutLinks = [];
  
  templates?.forEach(t => {
    const content = t.sgc_content || '';
    if (/#LinkGammeCar_\d+#/.test(content) || /#LinkGamme_\d+#/.test(content)) {
      withLinks++;
    } else {
      withoutLinks.push(t.sgc_pg_id);
    }
  });
  
  const total = templates?.length || 0;
  const percent = total > 0 ? ((withLinks / total) * 100).toFixed(1) : 0;
  
  console.log(`✅ Templates AVEC liens: ${withLinks}/${total} (${percent}%)`);
  console.log(`⚠️ Templates SANS liens: ${withoutLinks.length}`);
  
  if (withoutLinks.length > 0 && withoutLinks.length <= 15) {
    console.log(`   pg_ids: ${withoutLinks.join(', ')}`);
  } else if (withoutLinks.length > 15) {
    console.log(`   pg_ids: ${withoutLinks.slice(0, 15).join(', ')}...`);
  }
}

// ============================================
// RAPPORT FINAL
// ============================================

function printReport() {
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 RAPPORT FINAL');
  console.log('='.repeat(60));
  
  console.log(`\n🔧 Mode: ${FIX_MODE ? 'CORRECTION' : 'LECTURE SEULE'}`);
  console.log(`📋 Templates analysés: ${REPORT.totalTemplates}`);
  console.log(`⚠️ Templates avec problèmes: ${REPORT.issuesFound}`);
  
  if (FIX_MODE) {
    console.log(`✅ Templates corrigés: ${REPORT.issuesFixed}`);
  }
  
  if (Object.keys(REPORT.byCategory).length > 0) {
    console.log('\n📈 Par catégorie:');
    Object.entries(REPORT.byCategory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        console.log(`   - ${cat}: ${count}`);
      });
  }
  
  if (!FIX_MODE && REPORT.issuesFound > 0) {
    console.log('\n💡 Pour corriger automatiquement:');
    console.log('   node scripts/seo-content-audit.js --fix');
  }
  
  if (FIX_MODE) {
    console.log('\n🔄 N\'oubliez pas de vider le cache Redis:');
    console.log('   docker exec redis-dev redis-cli FLUSHDB');
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🔍 AUDIT COMPLET DU CONTENU SEO');
  console.log('='.repeat(60));
  console.log(`Mode: ${FIX_MODE ? '🔧 CORRECTION AUTOMATIQUE' : '👁️ LECTURE SEULE'}`);
  if (TEST_GAMME) console.log(`Test gamme: ${TEST_GAMME}`);
  
  await auditTemplates();
  await auditSwitches();
  await checkLinkCoverage();
  
  if (TEST_GAMME) {
    await testGeneratedContent();
  }
  
  printReport();
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Erreur:', err);
    process.exit(1);
  });

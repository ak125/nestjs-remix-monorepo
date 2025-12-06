#!/usr/bin/env node
/**
 * Diagnostic Sitemap - Vérifie l'accès aux données avec SERVICE_ROLE_KEY
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function diagnose() {
  console.log('🔍 DIAGNOSTIC SITEMAP DATA\n');
  console.log('Using SERVICE_ROLE_KEY to bypass RLS\n');

  // 1. Blog Advice
  const { data: advice, error: adviceErr, count: adviceCount } = await supabase
    .from('__blog_advice')
    .select('ba_id, ba_alias, ba_date', { count: 'exact' });
  
  if (adviceErr) {
    console.log('❌ __blog_advice ERROR:', adviceErr.message);
  } else {
    console.log('✅ __blog_advice:', advice.length, 'rows');
    if (advice.length > 0) {
      console.log('   Sample:', JSON.stringify(advice[0]));
    }
  }

  // 2. Blog Guide
  const { data: guide, error: guideErr } = await supabase
    .from('__blog_guide')
    .select('bg_id, bg_alias, bg_date');
  
  if (guideErr) {
    console.log('❌ __blog_guide ERROR:', guideErr.message);
  } else {
    console.log('✅ __blog_guide:', guide.length, 'rows');
    if (guide.length > 0) {
      console.log('   Sample:', JSON.stringify(guide[0]));
    }
  }

  // 3. Pieces Gamme (all)
  const { data: gamme, error: gammeErr } = await supabase
    .from('pieces_gamme')
    .select('pg_id, pg_display, pg_level, pg_relfollow, pg_alias');

  if (gammeErr) {
    console.log('❌ pieces_gamme ERROR:', gammeErr.message);
  } else {
    const active = gamme.filter(g => g.pg_display === '1' || g.pg_display === 1);
    const n1 = active.filter(g => {
      const isLevel = g.pg_level === '1' || g.pg_level === 1;
      const hasRelfollow = g.pg_relfollow === '1' || g.pg_relfollow === 1 || g.pg_relfollow === null;
      return isLevel && hasRelfollow;
    });
    const n2 = active.filter(g => {
      const isLevel = g.pg_level === '2' || g.pg_level === 2;
      const hasRelfollow = g.pg_relfollow === '1' || g.pg_relfollow === 1 || g.pg_relfollow === null;
      return isLevel && hasRelfollow;
    });
    
    console.log('✅ pieces_gamme:', gamme.length, 'total,', active.length, 'active');
    console.log('   Niveau 1 (avec relfollow):', n1.length);
    console.log('   Niveau 2 (avec relfollow):', n2.length);
  }

  // 4. Constructeurs
  const { data: marques, error: marqueErr } = await supabase
    .from('auto_marque')
    .select('marque_id, marque_alias, marque_display, marque_relfollow');

  if (marqueErr) {
    console.log('❌ auto_marque ERROR:', marqueErr.message);
  } else {
    const active = marques.filter(m => m.marque_display === 1 || m.marque_display === '1');
    const filtered = active.filter(m => m.marque_relfollow === 1 || m.marque_relfollow === '1' || m.marque_relfollow === null);
    console.log('✅ auto_marque:', marques.length, 'total,', active.length, 'active,', filtered.length, 'with relfollow');
  }

  // Summary
  console.log('\n📊 RÉSUMÉ:');
  console.log('===========');
  console.log('Le service NestJS utilise SERVICE_ROLE_KEY qui bypass RLS.');
  console.log('Si le sitemap est vide, vérifier les logs du serveur NestJS.');
}

diagnose().catch(console.error);

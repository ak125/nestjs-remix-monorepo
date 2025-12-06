#!/usr/bin/env node
/**
 * Script pour récupérer les OEM AUDI de la page Audi A4 + Plaquettes de frein
 * Contourne le timeout en utilisant une requête directe
 */

require('dotenv').config({ path: '../backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getOemAudi() {
  console.log('🔍 Recherche des références OEM AUDI...');
  console.log('📍 Page: Audi A4 1.9 TDI (type=18225) + Plaquettes de frein (gamme=402)\n');
  
  const startTime = Date.now();
  
  try {
    // Appel RPC
    const { data, error } = await supabase.rpc('get_oem_refs_for_vehicle', {
      p_type_id: 18225,
      p_pg_id: 402,
      p_marque_name: 'AUDI'
    });
    
    const duration = Date.now() - startTime;
    
    if (error) {
      console.error('❌ Erreur:', error.message);
      return;
    }
    
    console.log('✅ Résultat:');
    console.log(JSON.stringify(data, null, 2));
    console.log(`\n⏱️ Temps d'exécution: ${duration}ms`);
    
    if (data.oemRefs && data.oemRefs.length > 0) {
      console.log('\n📋 Liste des références OEM AUDI:');
      data.oemRefs.forEach((ref, i) => {
        console.log(`  ${i + 1}. ${ref}`);
      });
    }
    
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }
}

getOemAudi();

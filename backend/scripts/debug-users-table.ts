#!/usr/bin/env ts-node
/**
 * 🔍 Test Direct de la Table ___xtr_customer
 * Vérifier pourquoi l'API Users ne retourne pas de données
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugUsersTable() {
  console.log('🔍 DEBUG TABLE ___xtr_customer');
  console.log('===============================\n');

  try {
    // 1. Compter tous les utilisateurs
    console.log('1. Comptage total des utilisateurs:');
    const { count: totalCount, error: countError } = await supabase
      .from('___xtr_customer')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Erreur comptage total:', countError);
    } else {
      console.log(`✅ Total utilisateurs: ${totalCount}`);
    }

    // 2. Compter les utilisateurs actifs
    console.log('\n2. Comptage utilisateurs actifs (cst_activ = "1"):');
    const { count: activeCount, error: activeError } = await supabase
      .from('___xtr_customer')
      .select('*', { count: 'exact', head: true })
      .eq('cst_activ', '1');
    
    if (activeError) {
      console.error('❌ Erreur comptage actifs:', activeError);
    } else {
      console.log(`✅ Utilisateurs actifs: ${activeCount}`);
    }

    // 3. Vérifier les valeurs de cst_activ
    console.log('\n3. Analyse des valeurs de cst_activ:');
    const { data: activValues, error: valuesError } = await supabase
      .from('___xtr_customer')
      .select('cst_activ')
      .limit(10);
    
    if (valuesError) {
      console.error('❌ Erreur valeurs cst_activ:', valuesError);
    } else {
      const uniqueValues = [...new Set(activValues?.map(u => u.cst_activ))];
      console.log(`✅ Valeurs uniques de cst_activ: ${uniqueValues.join(', ')}`);
    }

    // 4. Récupérer quelques utilisateurs sans filtre
    console.log('\n4. Échantillon d\'utilisateurs (sans filtre):');
    const { data: sampleUsers, error: sampleError } = await supabase
      .from('___xtr_customer')
      .select('cst_id, cst_mail, cst_name, cst_fname, cst_activ')
      .limit(5);
    
    if (sampleError) {
      console.error('❌ Erreur échantillon:', sampleError);
    } else {
      console.log('✅ Échantillon d\'utilisateurs:');
      sampleUsers?.forEach(user => {
        console.log(`  ID: ${user.cst_id}, Email: ${user.cst_mail}, Actif: "${user.cst_activ}"`);
      });
    }

    // 5. Test de la requête exacte du service
    console.log('\n5. Test requête exacte du service:');
    const { data: serviceData, error: serviceError } = await supabase
      .from('___xtr_customer')
      .select('cst_id, cst_mail, cst_name, cst_fname, cst_city, cst_level, cst_activ')
      .eq('cst_activ', '1')
      .order('cst_id', { ascending: false })
      .range(0, 4); // 5 premiers

    if (serviceError) {
      console.error('❌ Erreur requête service:', serviceError);
    } else {
      console.log(`✅ Requête service retourne: ${serviceData?.length || 0} utilisateurs`);
      if (serviceData && serviceData.length > 0) {
        console.log('  Premier utilisateur:', serviceData[0]);
      }
    }

    // 6. Test avec différentes valeurs de cst_activ
    console.log('\n6. Test avec cst_activ = "1" (string) vs 1 (number):');
    
    // Test string "1"
    const { data: stringData, error: stringError } = await supabase
      .from('___xtr_customer')
      .select('cst_id, cst_activ')
      .eq('cst_activ', '1')
      .limit(3);

    console.log(`String "1": ${stringData?.length || 0} résultats`);

    // Test number 1
    const { data: numberData, error: numberError } = await supabase
      .from('___xtr_customer')
      .select('cst_id, cst_activ')
      .eq('cst_activ', 1)
      .limit(3);

    console.log(`Number 1: ${numberData?.length || 0} résultats`);

    // Test true
    const { data: boolData, error: boolError } = await supabase
      .from('___xtr_customer')
      .select('cst_id, cst_activ')
      .eq('cst_activ', true)
      .limit(3);

    console.log(`Boolean true: ${boolData?.length || 0} résultats`);

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }

  process.exit(0);
}

debugUsersTable();

#!/usr/bin/env node

/**
 * Script pour analyser la structure de la table users dans Supabase
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase réelle
const supabaseUrl = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY';

async function analyzeDatabase() {
  try {
    console.log('🔍 Analyse de la structure de la base de données...');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Lister toutes les tables
    console.log('\n📋 Tables disponibles:');
    const { data: tables, error: tablesError } = await supabase.rpc('list_tables');
    
    if (tablesError) {
      console.log('⚠️ Impossible de lister les tables avec RPC, essai alternatif...');
    } else {
      console.log('Tables:', tables);
    }

    // 2. Essayer de récupérer un échantillon de la table users
    console.log('\n👤 Analyse de la table users:');
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (usersError) {
      console.error('❌ Erreur lecture users:', usersError);
    } else {
      if (usersData && usersData.length > 0) {
        console.log('✅ Structure de la table users (colonnes détectées):');
        const columns = Object.keys(usersData[0]);
        columns.forEach(col => console.log(`   📄 ${col}: ${typeof usersData[0][col]}`));
      } else {
        console.log('⚠️ Table users vide, essai d\'insertion test...');
      }
    }

    // 3. Essayer de voir la table staff
    console.log('\n👥 Analyse de la table staff:');
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .limit(1);

    if (staffError) {
      console.log('❌ Table staff non accessible:', staffError.message);
    } else {
      console.log('✅ Table staff trouvée');
      if (staffData && staffData.length > 0) {
        const staffColumns = Object.keys(staffData[0]);
        console.log('Colonnes staff:', staffColumns);
      }
    }

    // 4. Tenter une insertion minimale pour voir les colonnes requises
    console.log('\n🧪 Test d\'insertion minimale pour découvrir la structure...');
    const { data: testInsert, error: testError } = await supabase
      .from('users')
      .insert({
        email: 'test-structure@example.com'
      })
      .select();

    if (testError) {
      console.log('📝 Erreur d\'insertion (révèle la structure attendue):');
      console.log('Code:', testError.code);
      console.log('Message:', testError.message);
      console.log('Details:', testError.details);
    } else {
      console.log('✅ Insertion test réussie:', testInsert);
      
      // Supprimer le test
      await supabase
        .from('users')
        .delete()
        .eq('email', 'test-structure@example.com');
    }

  } catch (error) {
    console.error('💥 Erreur:', error);
  }
}

analyzeDatabase();

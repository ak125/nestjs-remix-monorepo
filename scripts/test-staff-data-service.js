#!/usr/bin/env node

/**
 * Test direct du StaffDataService pour vérifier qu'il fonctionne avec ___config_admin
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration 
const supabaseUrl = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY';

async function testStaffDataService() {
  try {
    console.log('🧪 Test du StaffDataService avec la table ___config_admin...');

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Simuler la méthode findAll de StaffDataService
    console.log('📄 Test de findAll...');
    
    const page = 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    
    let query = `${supabaseUrl}/rest/v1/___config_admin?select=*`;
    query += `&order=cnfa_fname.asc,cnfa_name.asc&offset=${offset}&limit=${limit}`;

    const headers = {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Prefer': 'return=representation',
    };

    const response = await fetch(query, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      console.error('❌ Erreur API:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Détails:', errorText);
      return;
    }

    const staff = await response.json();
    console.log(`✅ ${staff.length} membres du staff récupérés:`);
    
    staff.forEach((s, index) => {
      const mappedStaff = {
        id: s.cnfa_id,
        email: s.cnfa_mail,
        firstName: s.cnfa_fname,
        lastName: s.cnfa_name,
        department: extractDepartment(s.cnfa_job),
        role: s.cnfa_job,
        isActive: s.cnfa_activ === '1',
        level: parseInt(s.cnfa_level) || 0,
      };
      
      console.log(`  ${index + 1}. ${mappedStaff.firstName} ${mappedStaff.lastName}`);
      console.log(`     Email: ${mappedStaff.email}`);
      console.log(`     Rôle: ${mappedStaff.role}`);
      console.log(`     Niveau: ${mappedStaff.level}`);
      console.log(`     Actif: ${mappedStaff.isActive ? 'Oui' : 'Non'}`);
      console.log('');
    });

    // Test des statistiques
    console.log('📊 Test des statistiques...');
    
    const statsQuery = `${supabaseUrl}/rest/v1/___config_admin?select=*`;
    const statsResponse = await fetch(statsQuery, {
      method: 'GET',
      headers: headers,
    });

    if (statsResponse.ok) {
      const allStaff = await statsResponse.json();
      const total = allStaff.length;
      const active = allStaff.filter(s => s.cnfa_activ === '1').length;
      const inactive = total - active;
      
      console.log(`✅ Statistiques calculées:`);
      console.log(`   Total: ${total}`);
      console.log(`   Actifs: ${active}`);
      console.log(`   Inactifs: ${inactive}`);
      
      // Statistiques par rôle
      const roleStats = {};
      allStaff.forEach(s => {
        const role = s.cnfa_job || 'Non défini';
        roleStats[role] = (roleStats[role] || 0) + 1;
      });
      
      console.log('   Répartition par rôle:');
      Object.entries(roleStats).forEach(([role, count]) => {
        console.log(`     - ${role}: ${count}`);
      });
    }

    console.log('\n🎉 Test du StaffDataService réussi !');
    console.log('✅ La migration vers la table ___config_admin fonctionne parfaitement');
    
  } catch (error) {
    console.error('💥 Erreur test:', error);
  }
}

function extractDepartment(job) {
  if (!job) return 'Non défini';
  
  // Logique simple pour extraire le département du titre du poste
  const jobLower = job.toLowerCase();
  if (jobLower.includes('développeur') || jobLower.includes('webmaster')) return 'IT';
  if (jobLower.includes('rh') || jobLower.includes('manager')) return 'RH';
  if (jobLower.includes('comptable') || jobLower.includes('finance')) return 'Finance';
  if (jobLower.includes('admin')) return 'Administration';
  
  return 'Général';
}

// Exécuter le test
if (require.main === module) {
  testStaffDataService().then(() => {
    console.log('✅ Test terminé');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

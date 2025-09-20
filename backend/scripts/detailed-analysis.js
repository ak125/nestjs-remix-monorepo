/**
 * Analyse détaillée des tables existantes
 */

const { createClient } = require('@supabase/supabase-js');

async function detailedAnalysis() {
  console.log('🔍 === ANALYSE DÉTAILLÉE - STRUCTURE EXISTANTE ===');
  
  const supabaseUrl = process.env.SUPABASE_URL || "https://cxpojprgwgubzjyqzmoq.supabase.co";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY";
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Analyser les adresses de facturation existantes
    console.log('\n📋 1. ADRESSES DE FACTURATION (___xtr_customer_billing_address):');
    const { data: billingAddresses, count: billingCount } = await supabase
      .from('___xtr_customer_billing_address')
      .select('*', { count: 'exact' })
      .limit(3);
    
    console.log(`📊 Total adresses de facturation: ${billingCount}`);
    if (billingAddresses && billingAddresses.length > 0) {
      console.log('\n✅ Structure existante:');
      Object.keys(billingAddresses[0]).forEach(col => {
        const value = billingAddresses[0][col];
        console.log(`   - ${col}: ${typeof value} = ${value || 'null'}`);
      });
      
      console.log('\n📝 Exemples:');
      billingAddresses.forEach((addr, index) => {
        console.log(`   ${index + 1}. Client: ${addr.cba_cst_id}, Nom: ${addr.cba_fname} ${addr.cba_name}, Ville: ${addr.cba_city}`);
      });
    }

    // 2. Analyser les adresses de livraison existantes
    console.log('\n📋 2. ADRESSES DE LIVRAISON (___xtr_customer_delivery_address):');
    const { data: deliveryAddresses, count: deliveryCount } = await supabase
      .from('___xtr_customer_delivery_address')
      .select('*', { count: 'exact' })
      .limit(3);
    
    console.log(`📊 Total adresses de livraison: ${deliveryCount}`);
    if (deliveryAddresses && deliveryAddresses.length > 0) {
      console.log('\n✅ Structure existante:');
      Object.keys(deliveryAddresses[0]).forEach(col => {
        const value = deliveryAddresses[0][col];
        console.log(`   - ${col}: ${typeof value} = ${value || 'null'}`);
      });
      
      console.log('\n📝 Exemples:');
      deliveryAddresses.forEach((addr, index) => {
        console.log(`   ${index + 1}. Client: ${addr.cda_cst_id}, Nom: ${addr.cda_fname} ${addr.cda_name}, Ville: ${addr.cda_city}`);
      });
    }

    // 3. Analyser la table users moderne
    console.log('\n📋 3. TABLE USERS MODERNE:');
    const { data: modernUsers, count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .limit(3);
    
    console.log(`📊 Total utilisateurs modernes: ${usersCount}`);
    if (modernUsers && modernUsers.length > 0) {
      console.log('\n✅ Structure moderne:');
      Object.keys(modernUsers[0]).forEach(col => {
        const value = modernUsers[0][col];
        console.log(`   - ${col}: ${typeof value} = ${value || 'null'}`);
      });
      
      console.log('\n📝 Exemples:');
      modernUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ID: ${user.id}, Email: ${user.email}, Nom: ${user.name}`);
      });
    }

    // 4. Comparer les structures
    console.log('\n📋 4. COMPARAISON DES STRUCTURES:');
    console.log('\n🔄 MAPPING NÉCESSAIRE:');
    console.log('   Legacy ___xtr_customer -> Table moderne:');
    console.log('   ├─ cst_id -> id');
    console.log('   ├─ cst_mail -> email');
    console.log('   ├─ cst_pswd -> password');
    console.log('   ├─ cst_fname -> firstname');
    console.log('   ├─ cst_name -> lastname');
    console.log('   ├─ cst_civility -> civility');
    console.log('   ├─ cst_tel -> phone');
    console.log('   ├─ cst_activ -> is_active');
    console.log('   └─ cst_is_pro -> is_pro');

    console.log('\n🏠 ADRESSES:');
    console.log('   ├─ ___xtr_customer_billing_address (existante)');
    console.log('   └─ ___xtr_customer_delivery_address (existante)');

    console.log('\n💬 MESSAGES:');
    console.log('   └─ ___xtr_msg (existante, 80 messages)');

    // 5. Vérifier les contraintes
    console.log('\n📋 5. VÉRIFICATION DES CONTRAINTES:');
    
    // Test de cohérence entre tables
    const { data: customerIds } = await supabase
      .from('___xtr_customer')
      .select('cst_id')
      .limit(5);

    if (customerIds && customerIds.length > 0) {
      const testIds = customerIds.map(c => c.cst_id);
      
      // Vérifier les adresses de facturation pour ces clients
      const { data: billingForCustomers } = await supabase
        .from('___xtr_customer_billing_address')
        .select('cba_cst_id')
        .in('cba_cst_id', testIds);

      // Vérifier les adresses de livraison pour ces clients  
      const { data: deliveryForCustomers } = await supabase
        .from('___xtr_customer_delivery_address')
        .select('cda_cst_id')
        .in('cda_cst_id', testIds);

      console.log(`✅ Clients testés: ${testIds.length}`);
      console.log(`📦 Avec adresses de facturation: ${billingForCustomers?.length || 0}`);
      console.log(`🚚 Avec adresses de livraison: ${deliveryForCustomers?.length || 0}`);
    }

  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse détaillée:', error);
  }

  console.log('\n✅ === FIN DE L\'ANALYSE DÉTAILLÉE ===');
}

// Exécuter l'analyse
detailedAnalysis().catch(console.error);

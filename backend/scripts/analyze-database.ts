/**
 * Script d'analyse des tables existantes
 * Pour comprendre la structure actuelle avant migration
 */

import { SupabaseServiceFacade } from '../src/database/supabase-service-facade';

async function analyzeDatabase() {
  console.log('🔍 === ANALYSE DES TABLES EXISTANTES ===');
  
  const supabase = new SupabaseServiceFacade();
  const client = supabase.client;

  try {
    // 1. Analyser la structure de ___xtr_customer
    console.log('\n📋 1. STRUCTURE ___xtr_customer:');
    const { data: customers, error: customerError } = await client
      .from('___xtr_customer')
      .select('*')
      .limit(1);
    
    if (customerError) {
      console.error('❌ Erreur ___xtr_customer:', customerError);
    } else if (customers && customers.length > 0) {
      console.log('✅ Colonnes trouvées:');
      Object.keys(customers[0]).forEach(col => {
        console.log(`   - ${col}: ${typeof customers[0][col]} = ${customers[0][col]}`);
      });
    }

    // 2. Compter les utilisateurs
    const { count: customerCount, error: countError } = await client
      .from('___xtr_customer')
      .select('*', { count: 'exact', head: true });
    
    if (!countError) {
      console.log(`\n📊 Total utilisateurs: ${customerCount}`);
    }

    // 3. Analyser la structure de ___xtr_msg
    console.log('\n📋 2. STRUCTURE ___xtr_msg:');
    const { data: messages, error: msgError } = await client
      .from('___xtr_msg')
      .select('*')
      .limit(1);
    
    if (msgError) {
      console.error('❌ Erreur ___xtr_msg:', msgError);
    } else if (messages && messages.length > 0) {
      console.log('✅ Colonnes trouvées:');
      Object.keys(messages[0]).forEach(col => {
        console.log(`   - ${col}: ${typeof messages[0][col]} = ${messages[0][col]}`);
      });
    }

    // 4. Compter les messages
    const { count: msgCount, error: msgCountError } = await client
      .from('___xtr_msg')
      .select('*', { count: 'exact', head: true });
    
    if (!msgCountError) {
      console.log(`\n📊 Total messages: ${msgCount}`);
    }

    // 5. Vérifier les tables d'adresses
    console.log('\n📋 3. VÉRIFICATION TABLES ADRESSES:');
    
    // Essayer d'accéder aux tables d'adresses potentielles
    const addressTables = [
      '___xtr_customer_billing_address',
      '___xtr_customer_delivery_address',
      '___xtr_address',
      '___xtr_customer_address'
    ];

    for (const table of addressTables) {
      try {
        const { data, error } = await client
          .from(table)
          .select('*')
          .limit(1);
        
        if (!error) {
          console.log(`✅ Table ${table} existe`);
          if (data && data.length > 0) {
            console.log('   Colonnes:', Object.keys(data[0]).join(', '));
          }
        }
      } catch (err) {
        console.log(`❌ Table ${table} n'existe pas`);
      }
    }

    // 6. Vérifier les tables de sécurité
    console.log('\n📋 4. VÉRIFICATION TABLES SÉCURITÉ:');
    
    const securityTables = [
      'password_reset_tokens',
      'user_sessions',
      '___xtr_reset_tokens',
      '___xtr_sessions'
    ];

    for (const table of securityTables) {
      try {
        const { data, error } = await client
          .from(table)
          .select('*')
          .limit(1);
        
        if (!error) {
          console.log(`✅ Table ${table} existe`);
          if (data && data.length > 0) {
            console.log('   Colonnes:', Object.keys(data[0]).join(', '));
          }
        }
      } catch (err) {
        console.log(`❌ Table ${table} n'existe pas`);
      }
    }

    // 7. Analyser quelques exemples de données
    console.log('\n📋 5. EXEMPLES DE DONNÉES:');
    
    const { data: sampleCustomers } = await client
      .from('___xtr_customer')
      .select('*')
      .limit(3);
    
    if (sampleCustomers) {
      console.log('\n👤 Exemples d\'utilisateurs:');
      sampleCustomers.forEach((customer, index) => {
        console.log(`   ${index + 1}. ID: ${customer.cst_id || customer.id}, Email: ${customer.cst_mail || customer.email}`);
      });
    }

    const { data: sampleMessages } = await client
      .from('___xtr_msg')
      .select('*')
      .limit(3);
    
    if (sampleMessages) {
      console.log('\n💬 Exemples de messages:');
      sampleMessages.forEach((msg, index) => {
        console.log(`   ${index + 1}. ID: ${msg.msg_id || msg.id}, Sujet: ${msg.msg_subject || msg.subject}`);
      });
    }

  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse:', error);
  }

  console.log('\n✅ === FIN DE L\'ANALYSE ===');
}

// Exécuter l'analyse
analyzeDatabase().catch(console.error);

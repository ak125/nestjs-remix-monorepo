/**
 * Script d'analyse des tables existantes
 * Pour comprendre la structure actuelle avant migration
 */

const { createClient } = require('@supabase/supabase-js');

async function analyzeDatabase() {
  console.log('🔍 === ANALYSE DES TABLES EXISTANTES ===');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables d\'environnement Supabase manquantes');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Analyser la structure de ___xtr_customer
    console.log('\n📋 1. STRUCTURE ___xtr_customer:');
    const { data: customers, error: customerError } = await supabase
      .from('___xtr_customer')
      .select('*')
      .limit(1);
    
    if (customerError) {
      console.error('❌ Erreur ___xtr_customer:', customerError);
    } else if (customers && customers.length > 0) {
      console.log('✅ Colonnes trouvées:');
      Object.keys(customers[0]).forEach(col => {
        const value = customers[0][col];
        const type = typeof value;
        const sample = value !== null ? value : 'null';
        console.log(`   - ${col}: ${type} = ${sample}`);
      });
    }

    // 2. Compter les utilisateurs
    const { count: customerCount, error: countError } = await supabase
      .from('___xtr_customer')
      .select('*', { count: 'exact', head: true });
    
    if (!countError) {
      console.log(`\n📊 Total utilisateurs: ${customerCount}`);
    }

    // 3. Analyser la structure de ___xtr_msg
    console.log('\n📋 2. STRUCTURE ___xtr_msg:');
    const { data: messages, error: msgError } = await supabase
      .from('___xtr_msg')
      .select('*')
      .limit(1);
    
    if (msgError) {
      console.error('❌ Erreur ___xtr_msg:', msgError);
    } else if (messages && messages.length > 0) {
      console.log('✅ Colonnes trouvées:');
      Object.keys(messages[0]).forEach(col => {
        const value = messages[0][col];
        const type = typeof value;
        const sample = value !== null ? value : 'null';
        console.log(`   - ${col}: ${type} = ${sample}`);
      });
    }

    // 4. Compter les messages
    const { count: msgCount, error: msgCountError } = await supabase
      .from('___xtr_msg')
      .select('*', { count: 'exact', head: true });
    
    if (!msgCountError) {
      console.log(`\n📊 Total messages: ${msgCount}`);
    }

    // 5. Vérifier les tables d'adresses potentielles
    console.log('\n📋 3. VÉRIFICATION TABLES ADRESSES:');
    
    const addressTables = [
      '___xtr_customer_billing_address',
      '___xtr_customer_delivery_address',
      '___xtr_address',
      '___xtr_customer_address'
    ];

    for (const table of addressTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (!error && data !== null) {
          console.log(`✅ Table ${table} existe`);
          if (data.length > 0) {
            console.log('   Colonnes:', Object.keys(data[0]).join(', '));
          } else {
            console.log('   Table vide');
          }
        } else {
          console.log(`❌ Table ${table} n'existe pas ou erreur:`, error?.message);
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
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (!error && data !== null) {
          console.log(`✅ Table ${table} existe`);
          if (data.length > 0) {
            console.log('   Colonnes:', Object.keys(data[0]).join(', '));
          } else {
            console.log('   Table vide');
          }
        } else {
          console.log(`❌ Table ${table} n'existe pas ou erreur:`, error?.message);
        }
      } catch (err) {
        console.log(`❌ Table ${table} n'existe pas`);
      }
    }

    // 7. Analyser quelques exemples de données
    console.log('\n📋 5. EXEMPLES DE DONNÉES:');
    
    const { data: sampleCustomers } = await supabase
      .from('___xtr_customer')
      .select('*')
      .limit(3);
    
    if (sampleCustomers && sampleCustomers.length > 0) {
      console.log('\n👤 Exemples d\'utilisateurs:');
      sampleCustomers.forEach((customer, index) => {
        const id = customer.cst_id || customer.id;
        const email = customer.cst_mail || customer.email;
        const name = customer.cst_name || customer.name || customer.cst_fname;
        console.log(`   ${index + 1}. ID: ${id}, Email: ${email}, Nom: ${name}`);
      });
    }

    const { data: sampleMessages } = await supabase
      .from('___xtr_msg')
      .select('*')
      .limit(3);
    
    if (sampleMessages && sampleMessages.length > 0) {
      console.log('\n💬 Exemples de messages:');
      sampleMessages.forEach((msg, index) => {
        const id = msg.msg_id || msg.id;
        const subject = msg.msg_subject || msg.subject;
        const customerId = msg.msg_cst_id || msg.customer_id;
        console.log(`   ${index + 1}. ID: ${id}, Sujet: ${subject}, Client: ${customerId}`);
      });
    }

    // 8. Vérifier d'autres tables potentielles
    console.log('\n📋 6. AUTRES TABLES UTILISATEURS:');
    const otherTables = [
      '___xtr_cst', // Version courte possible
      'customers', // Version anglaise
      'users', // Table standard
      '___xtr_user'
    ];

    for (const table of otherTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (!error && data !== null) {
          console.log(`✅ Table ${table} existe`);
          if (data.length > 0) {
            console.log('   Colonnes:', Object.keys(data[0]).join(', '));
          }
        }
      } catch (err) {
        // Ignorer silencieusement
      }
    }

  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse:', error);
  }

  console.log('\n✅ === FIN DE L\'ANALYSE ===');
}

// Exécuter l'analyse
analyzeDatabase().catch(console.error);

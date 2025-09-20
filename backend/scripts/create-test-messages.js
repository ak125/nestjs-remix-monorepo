#!/usr/bin/env node

/**
 * Script de création de messages de test
 * Usage: node scripts/create-test-messages.js
 */

// Configuration Supabase 
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztzxtixohjsdlmkqudfn.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0enh0aXhvaGpzZGxta3F1ZGZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzIxMDQ0MSwiZXhwIjoyMDQ4Nzg2NDQxfQ.Tfa8EYnqpyInxDKfUxHUqFp-dJ_p8Uj1cFEH4MQzNhA';

async function createTestMessages() {
  try {
    console.log('🚀 Création de messages de test...');

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const userId = 'usr_1752842636126_j88bat3bh'; // L'utilisateur connecté
    
    // Messages de test à créer
    const testMessages = [
      {
        customer_id: userId,
        type: 'system',
        title: 'Bienvenue sur la plateforme !',
        content: 'Nous sommes ravis de vous accueillir. N\'hésitez pas à nous contacter si vous avez des questions.',
        msg_open: true,
        msg_close: false, // Non lu
      },
      {
        customer_id: userId,
        type: 'support',
        title: 'Votre demande de support a été reçue',
        content: 'Nous avons bien reçu votre demande de support. Notre équipe va traiter votre demande dans les plus brefs délais.',
        msg_open: true,
        msg_close: true, // Lu
      },
      {
        customer_id: userId,
        type: 'notification',
        title: 'Mise à jour de vos informations',
        content: 'Vos informations de profil ont été mises à jour avec succès. Si ce n\'était pas vous, contactez-nous immédiatement.',
        msg_open: true,
        msg_close: false, // Non lu
      },
      {
        customer_id: userId,
        type: 'system',
        title: 'Nouvelle fonctionnalité disponible',
        content: 'Une nouvelle fonctionnalité de messagerie en temps réel est maintenant disponible ! Découvrez les notifications instantanées.',
        msg_open: true,
        msg_close: false, // Non lu
      },
      {
        customer_id: userId,
        type: 'support',
        title: 'Votre ticket #12345 a été résolu',
        content: 'Votre demande de support concernant le problème de connexion a été résolue. Le problème venait d\'un cache obsolète.',
        msg_open: false, // Fermé
        msg_close: true, // Lu
      }
    ];

    console.log(`📝 Création de ${testMessages.length} messages de test...`);

    for (let i = 0; i < testMessages.length; i++) {
      const message = testMessages[i];
      
      console.log(`📧 Création du message ${i + 1}: "${message.title}"`);
      
      const { data, error } = await supabase
        .from('___xtr_msg')
        .insert([message])
        .select();

      if (error) {
        console.error(`❌ Erreur création message ${i + 1}:`, error);
      } else {
        console.log(`✅ Message ${i + 1} créé avec l'ID:`, data[0].id);
      }

      // Petit délai entre les créations
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('🎉 Tous les messages de test ont été créés !');
    console.log('🔍 Vérification des messages créés...');

    // Vérifier les messages créés
    const { data: allMessages, error: checkError } = await supabase
      .from('___xtr_msg')
      .select('*')
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });

    if (checkError) {
      console.error('❌ Erreur vérification:', checkError);
    } else {
      console.log(`📊 Total de messages pour l'utilisateur ${userId}: ${allMessages.length}`);
      allMessages.forEach((msg, index) => {
        console.log(`  ${index + 1}. ${msg.title} (${msg.type}) - ${msg.msg_close ? 'Lu' : 'Non lu'} - ${msg.msg_open ? 'Ouvert' : 'Fermé'}`);
      });
    }

  } catch (error) {
    console.error('💥 Erreur générale:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  createTestMessages();
}

module.exports = { createTestMessages };

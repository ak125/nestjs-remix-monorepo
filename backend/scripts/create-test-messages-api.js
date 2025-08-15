#!/usr/bin/env node

/**
 * Script de création de messages de test via l'API locale
 * Usage: node scripts/create-test-messages-api.js
 */

const http = require('http');

async function createMessageViaAPI(messageData) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(messageData);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function createTestMessages() {
  try {
    console.log('🚀 Création de messages de test via API...');

    const userId = 'usr_1752842636126_j88bat3bh'; // L'utilisateur connecté
    
    // Messages de test à créer
    const testMessages = [
      {
        customerId: userId,
        staffId: 'staff_admin',
        subject: 'Bienvenue sur la plateforme !',
        content: 'Nous sommes ravis de vous accueillir. N\'hésitez pas à nous contacter si vous avez des questions.',
        priority: 'normal'
      },
      {
        customerId: userId,
        staffId: 'staff_support',
        subject: 'Votre demande de support a été reçue',
        content: 'Nous avons bien reçu votre demande de support. Notre équipe va traiter votre demande dans les plus brefs délais.',
        priority: 'high'
      },
      {
        customerId: userId,
        staffId: 'staff_admin',
        subject: 'Mise à jour de vos informations',
        content: 'Vos informations de profil ont été mises à jour avec succès. Si ce n\'était pas vous, contactez-nous immédiatement.',
        priority: 'normal'
      },
      {
        customerId: userId,
        staffId: 'staff_admin',
        subject: 'Nouvelle fonctionnalité disponible',
        content: 'Une nouvelle fonctionnalité de messagerie en temps réel est maintenant disponible ! Découvrez les notifications instantanées.',
        priority: 'low'
      },
      {
        customerId: userId,
        staffId: 'staff_support',
        subject: 'Votre ticket #12345 a été résolu',
        content: 'Votre demande de support concernant le problème de connexion a été résolue. Le problème venait d\'un cache obsolète.',
        priority: 'normal'
      }
    ];

    console.log(`📝 Création de ${testMessages.length} messages de test...`);

    for (let i = 0; i < testMessages.length; i++) {
      const message = testMessages[i];
      
      console.log(`📧 Création du message ${i + 1}: "${message.subject}"`);
      
      try {
        const response = await createMessageViaAPI(message);
        
        if (response.success) {
          console.log(`✅ Message ${i + 1} créé avec l'ID:`, response.data.id);
        } else {
          console.error(`❌ Erreur création message ${i + 1}:`, response.message || response);
        }
      } catch (error) {
        console.error(`❌ Erreur création message ${i + 1}:`, error.message);
      }

      // Petit délai entre les créations
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('🎉 Tentative de création terminée !');

    // Vérifier les messages via l'API
    console.log('🔍 Vérification des messages via API...');
    
    try {
      const response = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'localhost',
          port: 3000,
          path: `/api/messages?customer=${userId}`,
          method: 'GET',
        };

        const req = http.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              const response = JSON.parse(data);
              resolve(response);
            } catch (error) {
              reject(error);
            }
          });
        });

        req.on('error', (error) => {
          reject(error);
        });

        req.end();
      });

      if (response.success) {
        console.log(`📊 Total de messages pour l'utilisateur: ${response.data.messages.length}`);
        response.data.messages.forEach((msg, index) => {
          console.log(`  ${index + 1}. ${msg.title} (${msg.type})`);
        });
      } else {
        console.error('❌ Erreur vérification:', response);
      }
    } catch (error) {
      console.error('❌ Erreur vérification via API:', error.message);
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

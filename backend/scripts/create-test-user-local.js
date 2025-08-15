#!/usr/bin/env node

/**
 * Script de création d'un utilisateur normal via l'API locale
 * Usage: node scripts/create-test-user-local.js
 */

const fetch = require('node-fetch');

async function createTestUser() {
  try {
    console.log('🚀 Création de l\'utilisateur de test via API locale...');

    // Données de l'utilisateur
    const userData = {
      email: 'auto@example.com',
      password: '123456',
      firstName: 'Auto',
      lastName: 'Utilisateur',
      phone: '0123456789',
      isPro: false,
      level: 1,
      civility: 'M.',
      billingAddress: {
        firstName: 'Auto',
        lastName: 'Utilisateur',
        address1: '123 Rue de Test',
        postalCode: '12345',
        city: 'Test City',
        country: 'FR'
      }
    };

    console.log('📝 Tentative de création pour:', userData.email);

    // Appel à l'API locale NestJS
    const response = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(userData)
    });

    const responseText = await response.text();
    console.log('📡 Réponse API:', response.status, responseText);

    if (!response.ok) {
      console.error('❌ Erreur lors de la création:', response.status, responseText);
      return;
    }

    const result = JSON.parse(responseText);
    console.log('✅ Utilisateur créé avec succès !');
    console.log('📧 Email:', userData.email);
    console.log('🔑 Mot de passe:', userData.password);
    console.log('👤 Résultat:', result);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

// Exécution du script
createTestUser();

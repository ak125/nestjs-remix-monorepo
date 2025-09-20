// 🐛 Script de débogage pour le sélecteur de véhicules
// À exécuter dans la console du navigateur sur localhost:3000

console.log('🔧 DEBUG: Démarrage du test du sélecteur de véhicules');

// 1. Tester l'API des marques
console.log('📋 Test 1: Récupération des marques');
fetch('/api/vehicles/brands')
  .then(r => r.json())
  .then(data => {
    console.log('✅ Marques récupérées:', data.data.length);
    const lada = data.data.find(b => b.marque_name === 'LADA');
    console.log('🚗 LADA trouvée:', lada);
    
    if (lada) {
      // 2. Tester l'API des années pour LADA
      console.log('📅 Test 2: Récupération des années pour LADA (ID: ' + lada.marque_id + ')');
      return fetch('/api/vehicles/brands/' + lada.marque_id + '/years');
    }
  })
  .then(r => r?.json())
  .then(data => {
    if (data) {
      console.log('✅ Années pour LADA:', data);
      console.log('📊 Format des données:', data.data?.[0]);
      console.log('🔢 Nombre d\'années:', data.total);
    }
  })
  .catch(err => {
    console.error('❌ Erreur:', err);
  });

// 3. Simuler la sélection de LADA dans le sélecteur
setTimeout(() => {
  console.log('🎯 Test 3: Simulation sélection LADA dans l\'interface');
  
  const selector = document.querySelector('select[class*="w-full p-3 border"]');
  if (selector) {
    console.log('🔍 Sélecteur trouvé:', selector);
    
    // Trouver l'option LADA
    const ladaOption = Array.from(selector.options).find(opt => opt.textContent.includes('LADA'));
    if (ladaOption) {
      console.log('🎯 Option LADA trouvée:', ladaOption.value);
      
      // Simuler la sélection
      selector.value = ladaOption.value;
      
      // Déclencher l'événement change
      const event = new Event('change', { bubbles: true });
      selector.dispatchEvent(event);
      
      console.log('✅ Événement change déclenché pour LADA');
      
      // Attendre et vérifier si le sélecteur d'année apparaît
      setTimeout(() => {
        const yearSelector = document.querySelector('select[class*="w-full p-3 border"]:not(:first-child)');
        if (yearSelector) {
          console.log('📅 Sélecteur d\'année trouvé:', yearSelector);
          console.log('🔢 Options d\'année:', yearSelector.options.length);
          Array.from(yearSelector.options).forEach((opt, i) => {
            if (i < 5) console.log(`   ${i}: ${opt.textContent}`);
          });
        } else {
          console.warn('⚠️ Sélecteur d\'année non trouvé');
        }
      }, 2000);
      
    } else {
      console.warn('⚠️ Option LADA non trouvée');
    }
  } else {
    console.warn('⚠️ Sélecteur principal non trouvé');
  }
}, 1000);

// 4. Observer les requêtes réseau
console.log('🌐 Test 4: Surveillance des requêtes réseau');
const originalFetch = window.fetch;
window.fetch = function(...args) {
  if (args[0].includes('/api/vehicles/')) {
    console.log('🌐 Requête API détectée:', args[0]);
  }
  return originalFetch.apply(this, args)
    .then(response => {
      if (args[0].includes('/api/vehicles/')) {
        console.log('📨 Réponse API:', response.status, args[0]);
      }
      return response;
    });
};

console.log('🔧 Tests configurés. Surveillez la console pour les résultats.');
// Test debug pour vérifier le sélecteur de véhicule
console.log('🚗 Test du sélecteur de véhicule');

// Test de l'API directement
fetch('/api/vehicles/brands')
  .then(response => response.json())
  .then(data => {
    console.log('✅ API Response:', data);
    console.log('🔢 Nombre de marques:', data.data?.length);
    
    if (data.data && data.data.length > 0) {
      console.log('📊 Première marque:', data.data[0]);
      console.log('🏷️ Format attendu:', {
        marque_id: data.data[0].id,
        marque_name: data.data[0].name,
        is_featured: data.data[0].isFavorite
      });
    }
  })
  .catch(error => {
    console.error('❌ Erreur API:', error);
  });

// Vérifier le composant
setTimeout(() => {
  const selects = document.querySelectorAll('select');
  console.log('🔍 Sélecteurs trouvés:', selects.length);
  
  selects.forEach((select, index) => {
    console.log(`📝 Sélecteur ${index + 1}:`, {
      options: select.options.length,
      value: select.value,
      firstOption: select.options[1]?.textContent
    });
  });
}, 2000);
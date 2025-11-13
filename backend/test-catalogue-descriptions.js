const http = require('http');

http.get('http://localhost:3000/api/gamme-rest-optimized/402/page-data', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const catalogue = json.data?.catalogue || [];
    
    console.log(`\n📦 Total items: ${catalogue.length}\n`);
    
    // Afficher les 5 premiers items
    catalogue.slice(0, 5).forEach((item, i) => {
      console.log(`${i + 1}. ${item.name}`);
      console.log(`   Description: ${item.description.substring(0, 120)}...`);
      console.log(`   Meta: ${item.meta_description}\n`);
    });
    
    // Chercher spécifiquement les items avec descriptions SEO
    const seoItems = ['Mâchoires de frein', 'Répartiteur de freinage', 'Étrier de frein', 'Disque de frein'];
    console.log(`\n🔍 Vérification des items avec descriptions SEO connues:\n`);
    seoItems.forEach(name => {
      const item = catalogue.find(i => i.name === name);
      if (item) {
        console.log(`✅ ${name}:`);
        console.log(`   ${item.description.substring(0, 120)}...\n`);
      } else {
        console.log(`❌ ${name}: Non trouvé\n`);
      }
    });
  });
}).on('error', console.error);

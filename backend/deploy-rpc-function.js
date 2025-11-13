const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Lire le fichier SQL
const sqlFilePath = path.join(__dirname, 'prisma/supabase-functions/get_gamme_page_data_optimized.sql');
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

console.log('🚀 Déploiement de la fonction RPC optimisée...');
console.log(`📄 Fichier: ${sqlFilePath}`);
console.log(`📦 Taille: ${sqlContent.length} caractères\n`);

// Exécuter le SQL
supabase.rpc('exec_sql', { sql: sqlContent })
  .then(({ data, error }) => {
    if (error) {
      console.error('❌ Erreur lors du déploiement:', error);
      process.exit(1);
    }
    console.log('✅ Fonction RPC déployée avec succès!');
    console.log('📊 Résultat:', data);
  })
  .catch((error) => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });

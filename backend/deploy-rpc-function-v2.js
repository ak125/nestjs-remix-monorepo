#!/usr/bin/env node
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

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
});

// Lire le fichier SQL
const sqlFilePath = path.join(__dirname, 'prisma/supabase-functions/get_gamme_page_data_optimized.sql');
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

console.log('🚀 Déploiement de la fonction RPC optimisée...');
console.log(`📄 Fichier: ${sqlFilePath}`);
console.log(`📦 Taille: ${sqlContent.length} caractères\n`);

// Utiliser PostgrestClient pour exécuter le SQL directement
const deployFunction = async () => {
  try {
    // Méthode 1: Via fetch direct à l'API PostgreSQL de Supabase
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'params=single-object',
      },
      body: JSON.stringify({ query: sqlContent }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur HTTP:', response.status, errorText);
      
      // Fallback: essayer de créer la fonction via une requête directe
      console.log('\n🔄 Tentative alternative via SQL direct...\n');
      
      // Diviser en statements individuels
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      console.log(`📊 ${statements.length} instructions SQL à exécuter\n`);
      
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i] + ';';
        if (stmt.toLowerCase().includes('create') || 
            stmt.toLowerCase().includes('grant') || 
            stmt.toLowerCase().includes('comment')) {
          console.log(`⚡ Exécution ${i + 1}/${statements.length}...`);
          console.log(`📝 ${stmt.substring(0, 80)}...`);
          
          // Utiliser la méthode rpc() du client Supabase
          const { data, error } = await supabase.rpc('exec', { sql: stmt });
          
          if (error) {
            console.error(`❌ Erreur sur instruction ${i + 1}:`, error);
          } else {
            console.log(`✅ Instruction ${i + 1} exécutée`);
          }
        }
      }
      
      console.log('\n✅ Déploiement alternatif terminé!');
      return;
    }

    const result = await response.json();
    console.log('✅ Fonction RPC déployée avec succès!');
    console.log('📊 Résultat:', result);
  } catch (error) {
    console.error('❌ Erreur lors du déploiement:', error.message);
    console.error(error);
    process.exit(1);
  }
};

deployFunction();

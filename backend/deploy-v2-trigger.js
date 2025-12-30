#!/usr/bin/env node
/**
 * Deploy V2 Uniqueness Trigger to Supabase
 *
 * Usage: node deploy-v2-trigger.js
 *
 * Requires environment variables:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "❌ Variables d'environnement manquantes: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY",
  );
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
const sqlFilePath = path.join(__dirname, 'sql/020-trigger-v2-uniqueness.sql');

if (!fs.existsSync(sqlFilePath)) {
  console.error(`❌ Fichier SQL non trouvé: ${sqlFilePath}`);
  process.exit(1);
}

const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

console.log('🚀 Déploiement du trigger V2 Uniqueness...');
console.log(`📄 Fichier: ${sqlFilePath}`);
console.log(`📦 Taille: ${sqlContent.length} caractères\n`);

// Extraire les statements SQL (ignorer les commentaires et les tests)
const extractStatements = (sql) => {
  // Retirer les blocs de commentaires multi-lignes /* ... */
  const withoutBlockComments = sql.replace(/\/\*[\s\S]*?\*\//g, '');

  // Diviser en statements
  return withoutBlockComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => {
      if (!s || s.length === 0) return false;
      // Ignorer les lignes de commentaires simples
      const lines = s.split('\n').filter((l) => !l.trim().startsWith('--'));
      return lines.join('\n').trim().length > 0;
    });
};

const deployTrigger = async () => {
  try {
    const statements = extractStatements(sqlContent);
    console.log(`📊 ${statements.length} instructions SQL à exécuter\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;

      // Afficher un aperçu du statement
      const preview = stmt.substring(0, 60).replace(/\n/g, ' ');
      console.log(`⚡ [${i + 1}/${statements.length}] ${preview}...`);

      try {
        // Exécuter via RPC exec (nécessite une fonction exec dans Supabase)
        const { data, error } = await supabase.rpc('exec', { sql: stmt + ';' });

        if (error) {
          console.error(`   ❌ Erreur:`, error.message);
          errorCount++;
        } else {
          console.log(`   ✅ OK`);
          successCount++;
        }
      } catch (err) {
        console.error(`   ❌ Exception:`, err.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Résultat: ${successCount} succès, ${errorCount} erreurs`);

    if (errorCount === 0) {
      console.log('✅ Trigger V2 Uniqueness déployé avec succès!');
      console.log('\n📝 Le trigger va maintenant:');
      console.log('   - Vérifier unicité V2 par gamme_id + energy');
      console.log('   - Rejeter les INSERT/UPDATE qui violent cette règle');
    } else {
      console.log('⚠️  Déploiement terminé avec des erreurs');
      console.log(
        '💡 Note: Certaines erreurs peuvent être normales (ex: DROP TRIGGER IF NOT EXISTS)',
      );
    }
  } catch (error) {
    console.error('❌ Erreur fatale lors du déploiement:', error.message);
    console.error(error);
    process.exit(1);
  }
};

deployTrigger();

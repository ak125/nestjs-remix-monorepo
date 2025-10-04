/**
 * Script pour analyser les niveaux de marque_display
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMzQwODg2MywiZXhwIjoyMDM4OTg0ODYzfQ.ZgaPKeyUd5mq6hRdwLFhIgEtFJYx5FQ9AiS20LnCcTE';

const client = createClient(supabaseUrl, supabaseKey);

async function analyzeDisplayLevels() {
  console.log('🔍 Analyse des niveaux marque_display...\n');

  const { data, error } = await client
    .from('auto_marque')
    .select('marque_id, marque_name, marque_display, marque_logo')
    .order('marque_display', { ascending: false })
    .order('marque_name', { ascending: true });

  if (error) {
    console.error('❌ Erreur:', error);
    return;
  }

  // Grouper par niveau de display
  const grouped = {};
  const stats = {};

  data.forEach(m => {
    const level = m.marque_display ?? 0;
    if (!grouped[level]) {
      grouped[level] = [];
      stats[level] = 0;
    }
    grouped[level].push({
      name: m.marque_name,
      logo: m.marque_logo ? '✅' : '❌',
    });
    stats[level]++;
  });

  console.log('📊 STATISTIQUES PAR NIVEAU:\n');
  console.log(`Total marques: ${data.length}\n`);

  Object.keys(grouped)
    .sort((a, b) => Number(b) - Number(a))
    .forEach(level => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📌 Display = ${level} : ${stats[level]} marques`);
      console.log(`${'='.repeat(60)}\n`);
      
      grouped[level].forEach(m => {
        console.log(`  ${m.logo} ${m.name}`);
      });
    });

  console.log('\n\n💡 RECOMMANDATION:');
  console.log('Pour afficher toutes les marques principales, utiliser:');
  console.log('.gte("marque_display", 1) pour display >= 1');
  console.log('OU');
  console.log('.in("marque_display", [1, 2]) pour les niveaux spécifiques');
}

analyzeDisplayLevels()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err);
    process.exit(1);
  });

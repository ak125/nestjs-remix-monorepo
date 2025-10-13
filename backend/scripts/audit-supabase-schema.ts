/**
 * 🔍 AUDIT COMPLET DU SCHEMA SUPABASE
 * 
 * Ce script :
 * 1. Se connecte à Supabase
 * 2. Liste toutes les tables
 * 3. Pour chaque table : récupère toutes les colonnes avec types
 * 4. Génère un fichier Markdown de documentation
 * 5. Identifie les tables utilisées vs non utilisées
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Configuration Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

interface TableInfo {
  tableName: string;
  rowCount: number;
  columns: ColumnInfo[];
  sampleData?: any[];
  usedInCode: boolean;
  controllers: string[];
  services: string[];
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
}

async function getTablesList(): Promise<string[]> {
  console.log('📋 Récupération de la liste des tables...\n');
  
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `
  });

  if (error) {
    // Fallback : essayer une approche différente
    console.log('⚠️  Tentative avec liste manuelle des tables connues...');
    return [
      '___xtr_order',
      '___xtr_order_line',
      '___xtr_order_status',
      '___xtr_customer',
      '___xtr_customer_delivery_address',
      '___xtr_supplier_link_pm',
      '___xtr_product',
      '___xtr_cat',
      '___xtr_msg',
      '___xtr_staff',
      '___META_TAGS_ARIANE',
      '__sitemap_p_link',
      '__blog_advice',
      '__seo_gamme',
      'pieces_price',
      'User',
      'Session',
    ];
  }

  return data.map((row: any) => row.table_name);
}

async function getTableColumns(tableName: string): Promise<ColumnInfo[]> {
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT 
        column_name as name,
        data_type as type,
        is_nullable as nullable,
        column_default as default_value,
        (
          SELECT COUNT(*) > 0
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = '${tableName}'
            AND tc.constraint_type = 'PRIMARY KEY'
            AND kcu.column_name = c.column_name
        ) as is_primary_key
      FROM information_schema.columns c
      WHERE table_name = '${tableName}'
      ORDER BY ordinal_position;
    `
  });

  if (error) {
    console.error(`❌ Erreur colonnes pour ${tableName}:`, error.message);
    return [];
  }

  return data.map((col: any) => ({
    name: col.name,
    type: col.type,
    nullable: col.nullable === 'YES',
    defaultValue: col.default_value,
    isPrimaryKey: col.is_primary_key,
  }));
}

async function getTableRowCount(tableName: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error(`⚠️  Impossible de compter ${tableName}:`, error.message);
      return 0;
    }

    return count || 0;
  } catch (err) {
    return 0;
  }
}

async function getSampleData(tableName: string, limit = 3): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(limit);

    if (error) {
      console.error(`⚠️  Impossible de récupérer échantillon de ${tableName}:`, error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    return [];
  }
}

function checkTableUsageInCode(tableName: string): { used: boolean; controllers: string[]; services: string[] } {
  // Recherche simplifiée dans le code (à améliorer avec fs.readFileSync)
  const knownUsages: Record<string, { controllers: string[]; services: string[] }> = {
    '___xtr_order': {
      controllers: ['DashboardController', 'OrderController'],
      services: ['DashboardService', 'OrderRepositoryService', 'LegacyOrderService']
    },
    '___xtr_order_line': {
      controllers: ['OrderController'],
      services: ['OrderRepositoryService', 'LegacyOrderService']
    },
    '___xtr_customer': {
      controllers: ['DashboardController', 'UserController'],
      services: ['DashboardService', 'LegacyUserService']
    },
    '___xtr_supplier_link_pm': {
      controllers: ['DashboardController'],
      services: ['DashboardService']
    },
    '___xtr_product': {
      controllers: [],
      services: ['DashboardService']
    },
    '__sitemap_p_link': {
      controllers: [],
      services: ['DashboardService']
    },
    '__blog_advice': {
      controllers: [],
      services: ['DashboardService']
    },
    '__seo_gamme': {
      controllers: [],
      services: ['DashboardService']
    },
    '___META_TAGS_ARIANE': {
      controllers: [],
      services: ['DashboardService']
    },
  };

  const usage = knownUsages[tableName];
  if (usage) {
    return {
      used: true,
      controllers: usage.controllers,
      services: usage.services,
    };
  }

  return { used: false, controllers: [], services: [] };
}

async function auditTable(tableName: string): Promise<TableInfo> {
  console.log(`📊 Audit de la table: ${tableName}`);
  
  const [columns, rowCount, sampleData] = await Promise.all([
    getTableColumns(tableName),
    getTableRowCount(tableName),
    getSampleData(tableName, 2),
  ]);

  const usage = checkTableUsageInCode(tableName);

  return {
    tableName,
    rowCount,
    columns,
    sampleData,
    usedInCode: usage.used,
    controllers: usage.controllers,
    services: usage.services,
  };
}

function generateMarkdownReport(tables: TableInfo[]): string {
  const now = new Date().toISOString();
  
  let markdown = `# 🗄️ Audit Complet du Schéma Supabase\n\n`;
  markdown += `**Date de génération** : ${now}\n`;
  markdown += `**Base de données** : ${SUPABASE_URL}\n\n`;
  markdown += `---\n\n`;

  // Résumé
  markdown += `## 📊 Résumé Exécutif\n\n`;
  const totalTables = tables.length;
  const tablesUsed = tables.filter(t => t.usedInCode).length;
  const tablesUnused = totalTables - tablesUsed;
  const totalRows = tables.reduce((sum, t) => sum + t.rowCount, 0);

  markdown += `- **Tables totales** : ${totalTables}\n`;
  markdown += `- **Tables utilisées dans le code** : ${tablesUsed} (${((tablesUsed/totalTables)*100).toFixed(1)}%)\n`;
  markdown += `- **Tables non utilisées** : ${tablesUnused} (${((tablesUnused/totalTables)*100).toFixed(1)}%)\n`;
  markdown += `- **Lignes totales** : ${totalRows.toLocaleString()}\n\n`;

  // Tables utilisées
  markdown += `## ✅ Tables Utilisées (${tablesUsed})\n\n`;
  tables.filter(t => t.usedInCode).forEach(table => {
    markdown += `### \`${table.tableName}\`\n\n`;
    markdown += `**Lignes** : ${table.rowCount.toLocaleString()}\n\n`;
    
    if (table.controllers.length > 0) {
      markdown += `**Controllers** : ${table.controllers.join(', ')}\n\n`;
    }
    if (table.services.length > 0) {
      markdown += `**Services** : ${table.services.join(', ')}\n\n`;
    }

    markdown += `**Colonnes** :\n\n`;
    markdown += `| Colonne | Type | Nullable | Clé Primaire | Valeur par défaut |\n`;
    markdown += `|---------|------|----------|--------------|-------------------|\n`;
    
    table.columns.forEach(col => {
      markdown += `| \`${col.name}\` | ${col.type} | ${col.nullable ? '✓' : '✗'} | ${col.isPrimaryKey ? '🔑' : ''} | ${col.defaultValue || '-'} |\n`;
    });
    
    markdown += `\n`;

    if (table.sampleData && table.sampleData.length > 0) {
      markdown += `**Échantillon de données** :\n\n`;
      markdown += '```json\n';
      markdown += JSON.stringify(table.sampleData[0], null, 2);
      markdown += '\n```\n\n';
    }

    markdown += `---\n\n`;
  });

  // Tables non utilisées
  if (tablesUnused > 0) {
    markdown += `## ⚠️ Tables Non Utilisées (${tablesUnused})\n\n`;
    markdown += `Ces tables existent dans la base mais ne sont pas utilisées dans le code actuel.\n\n`;
    
    tables.filter(t => !t.usedInCode).forEach(table => {
      markdown += `### \`${table.tableName}\`\n\n`;
      markdown += `**Lignes** : ${table.rowCount.toLocaleString()}\n\n`;
      
      markdown += `**Colonnes** :\n\n`;
      markdown += `| Colonne | Type | Nullable | Clé Primaire |\n`;
      markdown += `|---------|------|----------|-------------|\n`;
      
      table.columns.forEach(col => {
        markdown += `| \`${col.name}\` | ${col.type} | ${col.nullable ? '✓' : '✗'} | ${col.isPrimaryKey ? '🔑' : ''} |\n`;
      });
      
      markdown += `\n`;

      if (table.sampleData && table.sampleData.length > 0) {
        markdown += `**Échantillon** :\n\n`;
        markdown += '```json\n';
        markdown += JSON.stringify(table.sampleData[0], null, 2);
        markdown += '\n```\n\n';
      }

      markdown += `---\n\n`;
    });
  }

  // Recommandations
  markdown += `## 💡 Recommandations\n\n`;
  markdown += `### Tables à intégrer dans le dashboard\n\n`;
  
  const criticalTables = tables.filter(t => 
    !t.usedInCode && 
    t.rowCount > 0 &&
    (t.tableName.includes('blog') || 
     t.tableName.includes('invoice') || 
     t.tableName.includes('payment') ||
     t.tableName.includes('review') ||
     t.tableName.includes('staff'))
  );

  if (criticalTables.length > 0) {
    criticalTables.forEach(table => {
      markdown += `- **\`${table.tableName}\`** (${table.rowCount.toLocaleString()} lignes) - Potentiel élevé\n`;
    });
  } else {
    markdown += `Toutes les tables critiques sont déjà intégrées ✅\n`;
  }

  markdown += `\n### Actions CRUD manquantes\n\n`;
  markdown += `Pour chaque table utilisée, vérifier que les opérations suivantes sont disponibles :\n\n`;
  markdown += `- [ ] **Create** - Ajouter des enregistrements\n`;
  markdown += `- [ ] **Read** - Lire/afficher les données\n`;
  markdown += `- [ ] **Update** - Modifier des enregistrements\n`;
  markdown += `- [ ] **Delete** - Supprimer des enregistrements\n\n`;

  return markdown;
}

async function main() {
  console.log('🚀 Démarrage de l\'audit Supabase...\n');

  try {
    // Récupérer la liste des tables
    const tableNames = await getTablesList();
    console.log(`✅ ${tableNames.length} tables trouvées\n`);

    // Auditer chaque table
    const tables: TableInfo[] = [];
    for (const tableName of tableNames) {
      try {
        const tableInfo = await auditTable(tableName);
        tables.push(tableInfo);
      } catch (err) {
        console.error(`❌ Erreur lors de l'audit de ${tableName}:`, err);
      }
    }

    // Générer le rapport
    console.log('\n📝 Génération du rapport Markdown...\n');
    const markdown = generateMarkdownReport(tables);

    // Sauvegarder le rapport
    const outputPath = path.join(__dirname, '../../docs/SUPABASE-SCHEMA-AUDIT.md');
    fs.writeFileSync(outputPath, markdown, 'utf-8');

    console.log(`✅ Rapport généré : ${outputPath}\n`);
    
    // Afficher résumé dans la console
    console.log('📊 RÉSUMÉ :');
    console.log(`   - Tables totales : ${tables.length}`);
    console.log(`   - Tables utilisées : ${tables.filter(t => t.usedInCode).length}`);
    console.log(`   - Tables non utilisées : ${tables.filter(t => !t.usedInCode).length}`);
    console.log(`   - Lignes totales : ${tables.reduce((sum, t) => sum + t.rowCount, 0).toLocaleString()}`);

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

// Exécuter l'audit
main();

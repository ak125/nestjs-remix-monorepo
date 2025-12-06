#!/usr/bin/env tsx
/**
 * 🏗️ GÉNÉRATEUR DE SCHÉMAS ZOD
 * 
 * Parse les interfaces TypeScript de types.ts
 * et génère automatiquement les schémas Zod correspondants
 * 
 * Usage: npm run generate:zod
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Mapping des types TypeScript vers Zod
 */
const typeToZod: Record<string, string> = {
  string: 'z.string()',
  number: 'z.number()',
  boolean: 'z.boolean()',
  Date: 'z.date()',
  'unknown': 'z.unknown()',
  'Json': 'z.unknown()', // Pour les colonnes JSON
};

/**
 * Parse une interface TypeScript et génère le schéma Zod
 */
function parseInterface(content: string, interfaceName: string): string {
  // Trouve l'interface dans le contenu
  const interfaceRegex = new RegExp(
    `export interface ${interfaceName}\\s*\\{([^}]+)\\}`,
    's'
  );
  const match = content.match(interfaceRegex);
  
  if (!match) {
    console.warn(`⚠️ Interface ${interfaceName} introuvable`);
    return '';
  }

  const interfaceBody = match[1];
  const fields: string[] = [];

  // Parse chaque ligne de l'interface
  const lines = interfaceBody.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Skip les commentaires
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      continue;
    }

    // Parse: fieldName?: type | null
    const fieldMatch = line.match(/^\s*(\w+)(\??):\s*([^;]+)/);
    if (!fieldMatch) continue;

    const [, fieldName, optional, typeStr] = fieldMatch;
    const isOptional = optional === '?';
    const isNullable = typeStr.includes('| null');
    
    // Extrait le type de base (sans | null)
    const baseType = typeStr.replace(/\s*\|\s*null\s*/, '').trim();
    
    // Convertit le type TypeScript en Zod
    let zodType = typeToZod[baseType] || 'z.unknown()';
    
    // Gère les types spéciaux
    if (baseType.startsWith('{')) {
      zodType = 'z.record(z.unknown())'; // Pour les objets
    }

    // Applique les modificateurs
    if (isNullable) {
      zodType += '.nullable()';
    }
    if (isOptional) {
      zodType += '.optional()';
    }

    fields.push(`  ${fieldName}: ${zodType}`);
  }

  const schemaName = interfaceName + 'Schema';
  
  return `
/**
 * Schéma Zod pour ${interfaceName}
 * @generated Auto-généré depuis types.ts
 */
export const ${schemaName} = z.object({
${fields.join(',\n')}
});

export type ${interfaceName}Validated = z.infer<typeof ${schemaName}>;
`;
}

/**
 * Extrait tous les noms d'interfaces exportées
 */
function extractInterfaceNames(content: string): string[] {
  const regex = /export interface (\w+)\s*\{/g;
  const names: string[] = [];
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    names.push(match[1]);
  }
  
  return names;
}

/**
 * Génère le fichier schemas.ts complet
 */
function generateSchemasFile(): void {
  console.log('🔨 Génération des schémas Zod...\n');

  // Lit le fichier types.ts
  const typesPath = path.join(__dirname, '../src/types.ts');
  const typesContent = fs.readFileSync(typesPath, 'utf-8');

  // Extrait les noms d'interfaces
  const interfaceNames = extractInterfaceNames(typesContent);
  console.log(`📋 ${interfaceNames.length} interfaces trouvées\n`);

  // Tables principales à prioriser
  const priorityTables = [
    'Pieces',
    'PiecesPrice',
    'PiecesMarque',
    'PiecesMediaImg',
    'PiecesCriteria',
    'PiecesCriteriaLink',
    'AutoMarque',
    'AutoModele',
    'AutoType',
  ];

  // Génère les schémas
  const schemas: string[] = [];
  let processedCount = 0;

  // D'abord les tables prioritaires
  for (const name of priorityTables) {
    if (interfaceNames.includes(name)) {
      const schema = parseInterface(typesContent, name);
      if (schema) {
        schemas.push(schema);
        processedCount++;
        console.log(`✅ ${name}`);
      }
    }
  }

  console.log(`\n⚙️ Traitement des ${interfaceNames.length - processedCount} autres tables...\n`);

  // Puis le reste (sans dupliquer)
  for (const name of interfaceNames) {
    if (!priorityTables.includes(name)) {
      const schema = parseInterface(typesContent, name);
      if (schema) {
        schemas.push(schema);
        processedCount++;
      }
    }
  }

  // Génère le fichier final
  const output = `/**
 * 🔐 SCHÉMAS ZOD - VALIDATION RUNTIME
 * 
 * @generated Généré automatiquement par scripts/generate-zod-schemas.ts
 * @command npm run generate:zod
 * 
 * ⚠️ NE PAS MODIFIER MANUELLEMENT
 * Utiliser 'npm run generate:zod' pour regénérer
 */

import { z } from 'zod';
${schemas.join('\n')}

/**
 * 📦 EXPORT PAR CATÉGORIE
 */

// Schémas pièces automobiles
export const PiecesSchemas = {
  Pieces: PiecesSchema,
  PiecesPrice: PiecesPriceSchema,
  PiecesMarque: PiecesMarqueSchema,
  PiecesMediaImg: PiecesMediaImgSchema,
  PiecesCriteria: PiecesCriteriaSchema,
  PiecesCriteriaLink: PiecesCriteriaLinkSchema,
} as const;

// Schémas véhicules
export const AutoSchemas = {
  AutoMarque: AutoMarqueSchema,
  AutoModele: AutoModeleSchema,
  AutoType: AutoTypeSchema,
} as const;

// Export de tous les schémas
export const AllSchemas = {
  ...PiecesSchemas,
  ...AutoSchemas,
} as const;
`;

  // Écrit le fichier
  const outputPath = path.join(__dirname, '../src/schemas.ts');
  fs.writeFileSync(outputPath, output, 'utf-8');

  console.log(`\n✨ ${processedCount} schémas générés avec succès !`);
  console.log(`📄 Fichier: ${outputPath}\n`);
}

// Exécution
try {
  generateSchemasFile();
  process.exit(0);
} catch (error) {
  console.error('❌ Erreur:', error);
  process.exit(1);
}

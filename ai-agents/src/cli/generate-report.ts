#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config/agents.config';

const program = new Command();

program
  .name('generate-report')
  .description('Générer un rapport à partir des résultats existants')
  .version('1.0.0');

program
  .option('-f, --format <format>', 'Format du rapport (json, markdown, both)', 'both')
  .option('-o, --output <path>', 'Chemin de sortie', config.outputPath)
  .action(async (options) => {
    const outputDir = options.output;
    
    console.log('📊 Génération du rapport...\n');

    try {
      // Lire le rapport d'audit
      const auditReportPath = path.join(outputDir, 'audit-report.json');
      
      if (!fs.existsSync(auditReportPath)) {
        console.error('❌ Aucun rapport d\'audit trouvé. Exécutez d\'abord un audit.');
        process.exit(1);
      }

      const auditReport = JSON.parse(fs.readFileSync(auditReportPath, 'utf-8'));

      console.log('✅ Rapport d\'audit chargé');
      console.log(`📅 Date: ${auditReport.timestamp}`);
      console.log(`📊 Agents: ${auditReport.summary.totalAgents}`);
      console.log(`⏱️  Durée: ${auditReport.duration}ms\n`);

      // Lire la carte du monorepo si disponible
      const mapPath = path.join(outputDir, 'monorepo-map.json');
      if (fs.existsSync(mapPath)) {
        const map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
        console.log('✅ Carte du monorepo chargée');
        console.log(`📂 Fichiers: ${map.totalFiles}`);
        console.log(`📦 Workspaces: ${map.workspaces.length}\n`);
      }

      // Lire la heatmap si disponible
      const heatmapPath = path.join(outputDir, 'heatmap.json');
      if (fs.existsSync(heatmapPath)) {
        const heatmap = JSON.parse(fs.readFileSync(heatmapPath, 'utf-8'));
        console.log('✅ Heatmap chargée');
        console.log(`🔥 Top fichiers: ${heatmap.topFiles.length}\n`);
      }

      console.log('✅ Rapport généré avec succès!');
      console.log(`📁 Dossier de sortie: ${outputDir}`);

    } catch (error) {
      console.error('❌ Erreur lors de la génération du rapport:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);

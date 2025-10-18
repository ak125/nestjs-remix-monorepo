import { IAgent, AuditReport, AgentResult } from '../types';
import { config } from '../config/agents.config';
import { CartographeMonorepoAgent } from '../agents/cartographe-monorepo.agent';
import { ChasseurFichiersMassifsAgent } from '../agents/chasseur-fichiers-massifs.agent';
// NOTE: Import dynamique pour éviter les side-effects de jscpd au chargement
// import { DetecteurDoublonsAgent } from '../agents/detecteur-doublons.agent';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Driver IA - Orchestrateur d'agents
 * 
 * Ce driver coordonne l'exécution de tous les agents IA et agrège leurs résultats.
 */
export class AIDriver {
  private agents: Map<string, IAgent> = new Map();
  private agentFactories: Map<string, () => Promise<IAgent>> = new Map();

  constructor() {
    this.registerAgents();
  }

  /**
   * Enregistrer tous les agents disponibles
   */
  private registerAgents(): void {
    // Agent 1: Cartographe Monorepo
    const cartographe = new CartographeMonorepoAgent();
    this.agents.set('cartographe', cartographe);

    // Agent 2: Chasseur de Fichiers Massifs
    const chasseurFichiers = new ChasseurFichiersMassifsAgent(config.rootPath);
    this.agents.set('fichiers-massifs', chasseurFichiers);

    // Agent 3: Détecteur de Doublons (lazy import pour éviter side-effects)
    this.agentFactories.set('detecteur-doublons', async () => {
      const { DetecteurDoublonsAgent } = await import('../agents/detecteur-doublons.agent');
      return new DetecteurDoublonsAgent(config.rootPath);
    });

    // Agent 4: Graphe Imports & Cycles (lazy loading)
    this.agentFactories.set('graphe-imports', async () => {
      const { GrapheImportsCyclesAgent } = await import('../agents/graphe-imports-cycles.agent');
      return new GrapheImportsCyclesAgent(config.rootPath);
    });

    // Agent 10: Perf & Observabilité (lazy loading)
    this.agentFactories.set('perf-observabilite', async () => {
      const { PerfObservabiliteAgent } = await import('../agents/perf-observabilite.agent');
      return new PerfObservabiliteAgent(config.rootPath);
    });

    // Futurs agents à ajouter ici
    // Agent 4: Graphe Imports & Cycles
    // etc.
  }

  /**
   * Exécuter tous les agents activés
   */
  async executeAll(): Promise<AuditReport> {
    console.log('🤖 Démarrage du Driver IA...\n');
    const startTime = Date.now();

    const results: AgentResult[] = [];
    const enabledAgents = config.agents.filter(a => a.enabled);

    console.log(`📋 ${enabledAgents.length} agent(s) à exécuter\n`);

    if (config.parallel) {
      // Exécution parallèle
      const promises = enabledAgents.map(async agentConfig => {
        let agent = this.agents.get(agentConfig.type);
        
        // Si l'agent n'est pas encore instancié, vérifier si une factory existe
        if (!agent) {
          const factory = this.agentFactories.get(agentConfig.type);
          if (factory) {
            agent = await factory();
            this.agents.set(agentConfig.type, agent);
          } else {
            console.warn(`⚠️  Agent "${agentConfig.type}" non trouvé`);
            return null;
          }
        }
        
        return agent.execute();
      });

      const settled = await Promise.allSettled(promises.filter(p => p !== null) as Promise<AgentResult | null>[]);
      
      for (const result of settled) {
        if (result.status === 'fulfilled' && result.value !== null) {
          results.push(result.value);
        } else if (result.status === 'rejected') {
          console.error('❌ Erreur agent:', result.reason);
        }
      }
    } else {
      // Exécution séquentielle
      for (const agentConfig of enabledAgents) {
        let agent = this.agents.get(agentConfig.type);
        
        // Si l'agent n'est pas encore instancié, vérifier si une factory existe
        if (!agent) {
          const factory = this.agentFactories.get(agentConfig.type);
          if (factory) {
            // Lazy loading de l'agent
            agent = await factory();
            this.agents.set(agentConfig.type, agent);
          } else {
            console.warn(`⚠️  Agent "${agentConfig.type}" non trouvé`);
            continue;
          }
        }

        console.log(`\n▶️  Exécution de l'agent: ${agent.name}`);
        console.log('─'.repeat(50));
        
        try {
          const result = await agent.execute();
          results.push(result);
        } catch (error) {
          console.error(`❌ Erreur lors de l'exécution de ${agent.name}:`, error);
        }

        console.log('─'.repeat(50));
      }
    }

    const duration = Date.now() - startTime;

    // Agréger les KPIs
    const allKPIs = results.flatMap(r => r.kpis);

    // Créer le rapport d'audit
    const report: AuditReport = {
      timestamp: new Date(),
      duration,
      agents: results,
      summary: {
        totalAgents: results.length,
        successCount: results.filter(r => r.status === 'success').length,
        errorCount: results.filter(r => r.status === 'error').length,
        warningCount: results.filter(r => r.status === 'warning').length,
      },
      kpis: allKPIs,
    };

    // Sauvegarder le rapport
    await this.saveReport(report);

    console.log('\n✅ Driver IA terminé!');
    console.log(`⏱️  Durée totale: ${duration}ms`);
    console.log(`📊 Agents exécutés: ${results.length}`);
    console.log(`✅ Succès: ${report.summary.successCount}`);
    console.log(`❌ Erreurs: ${report.summary.errorCount}`);
    console.log(`⚠️  Warnings: ${report.summary.warningCount}`);

    return report;
  }

  /**
   * Exécuter un agent spécifique
   */
  async executeAgent(agentType: string): Promise<AgentResult> {
    const agent = this.agents.get(agentType);
    
    if (!agent) {
      throw new Error(`Agent "${agentType}" non trouvé`);
    }

    console.log(`\n🤖 Exécution de l'agent: ${agent.name}\n`);
    
    const result = await agent.execute();
    
    console.log(`\n✅ Agent "${agent.name}" terminé`);
    console.log(`📊 Statut: ${result.status}`);
    console.log(`⏱️  Durée: ${result.duration}ms`);
    
    return result;
  }

  /**
   * Lister tous les agents disponibles
   */
  listAgents(): Array<{ name: string; type: string; description: string }> {
    return Array.from(this.agents.values()).map(agent => ({
      name: agent.name,
      type: agent.type,
      description: agent.description,
    }));
  }

  /**
   * Sauvegarder le rapport d'audit
   */
  private async saveReport(report: AuditReport): Promise<void> {
    const outputDir = config.outputPath;
    await fs.promises.mkdir(outputDir, { recursive: true });

    // Rapport JSON
    const jsonPath = path.join(outputDir, 'audit-report.json');
    await fs.promises.writeFile(jsonPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Rapport JSON sauvegardé: ${jsonPath}`);

    // Rapport Markdown
    const mdPath = path.join(outputDir, 'audit-report.md');
    const markdown = this.generateMarkdownReport(report);
    await fs.promises.writeFile(mdPath, markdown);
    console.log(`💾 Rapport Markdown sauvegardé: ${mdPath}`);
  }

  /**
   * Générer un rapport markdown
   */
  private generateMarkdownReport(report: AuditReport): string {
    let md = '# 🤖 Rapport d\'Audit - Driver IA\n\n';
    md += `**Date**: ${report.timestamp.toISOString()}\n`;
    md += `**Durée**: ${report.duration}ms\n\n`;

    // Résumé
    md += '## 📊 Résumé\n\n';
    md += `- **Agents exécutés**: ${report.summary.totalAgents}\n`;
    md += `- **✅ Succès**: ${report.summary.successCount}\n`;
    md += `- **❌ Erreurs**: ${report.summary.errorCount}\n`;
    md += `- **⚠️  Warnings**: ${report.summary.warningCount}\n\n`;

    // Résultats par agent
    md += '## 🎯 Résultats par Agent\n\n';
    
    for (const result of report.agents) {
      const statusEmoji = result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : '⚠️';
      
      md += `### ${statusEmoji} ${result.agentName}\n\n`;
      md += `- **Type**: ${result.agentType}\n`;
      md += `- **Statut**: ${result.status}\n`;
      md += `- **Durée**: ${result.duration}ms\n`;
      md += `- **KPIs**: ${result.kpis.length}\n\n`;

      if (result.errors && result.errors.length > 0) {
        md += '**Erreurs**:\n';
        for (const error of result.errors) {
          md += `- ${error}\n`;
        }
        md += '\n';
      }

      if (result.warnings && result.warnings.length > 0) {
        md += '**Warnings**:\n';
        for (const warning of result.warnings) {
          md += `- ${warning}\n`;
        }
        md += '\n';
      }
    }

    // KPIs globaux
    md += '## 📈 KPIs Globaux\n\n';
    md += '| KPI | Valeur | Statut |\n';
    md += '|-----|--------|--------|\n';
    
    for (const kpi of report.kpis) {
      const statusEmoji = kpi.status === 'ok' ? '✅' : kpi.status === 'warning' ? '⚠️' : '❌';
      const value = kpi.unit ? `${kpi.value} ${kpi.unit}` : kpi.value;
      md += `| ${kpi.name} | ${value} | ${statusEmoji} |\n`;
    }

    return md;
  }
}

// Exécution directe si ce fichier est lancé
if (require.main === module) {
  const driver = new AIDriver();
  
  console.log('🤖 AI Driver - Système d\'Agents IA\n');
  console.log('📋 Agents disponibles:');
  
  for (const agent of driver.listAgents()) {
    console.log(`  - ${agent.name} (${agent.type}): ${agent.description}`);
  }
  
  console.log('\n');
  
  driver.executeAll().then(report => {
    console.log('\n🎉 Audit terminé avec succès!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Erreur lors de l\'audit:', error);
    process.exit(1);
  });
}

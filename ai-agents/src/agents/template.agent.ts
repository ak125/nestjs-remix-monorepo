import { IAgent, AgentResult, AgentStatus } from '../types';
import { config } from '../config/agents.config';

/**
 * Template pour créer un nouvel agent
 * 
 * INSTRUCTIONS :
 * 1. Renommer la classe (ex: OptimizerAgent, SecurityAgent)
 * 2. Mettre à jour name, type, description
 * 3. Implémenter la méthode execute()
 * 4. Ajouter l'agent dans AIDriver (src/core/ai-driver.ts)
 * 5. Ajouter la configuration dans agents.config.ts
 */
export class TemplateAgent implements IAgent {
  name = 'Nom de l\'Agent'; // Ex: "Optimiseur de Code"
  type = 'cartographe' as const; // Ex: 'optimizer', 'security', etc. - Utilisez un type existant ou ajoutez-le dans types/index.ts
  description = 'Description de l\'agent'; // Ex: "Analyser le code pour identifier..."
  version = '1.0.0';

  private status: AgentStatus = 'idle';

  constructor() {
    // Récupérer la configuration de l'agent
    const agentConfig = config.agents.find(a => a.type === this.type);
    const options = agentConfig?.options || {};

    // Initialiser avec les options
    console.log(`🤖 ${this.name} initialisé avec les options:`, options);
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  async execute(): Promise<AgentResult> {
    const startTime = Date.now();
    this.status = 'running';

    try {
      console.log(`🚀 [${this.name}] Démarrage...`);

      // ============================================
      // TODO: Implémenter la logique de l'agent ici
      // ============================================

      // Exemple d'étapes :
      // 1. Collecter les données
      console.log('📊 Collecte des données...');
      const data = await this.collectData();

      // 2. Analyser
      console.log('🔍 Analyse...');
      const analysis = await this.analyze(data);

      // 3. Générer les KPIs
      console.log('📈 Calcul des KPIs...');
      const kpis = this.calculateKPIs(analysis);

      // 4. Sauvegarder les résultats
      console.log('💾 Sauvegarde des résultats...');
      await this.saveResults(analysis);

      // ============================================

      const duration = Date.now() - startTime;
      this.status = 'completed';

      console.log(`✅ [${this.name}] Terminé en ${duration}ms`);

      return {
        agentName: this.name,
        agentType: this.type,
        status: 'success',
        timestamp: new Date(),
        duration,
        data: {
          // Vos données ici
          analysis,
        },
        kpis,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.status = 'error';

      console.error(`❌ [${this.name}] Erreur:`, error);

      return {
        agentName: this.name,
        agentType: this.type,
        status: 'error',
        timestamp: new Date(),
        duration,
        data: null,
        errors: [error instanceof Error ? error.message : String(error)],
        kpis: [],
      };
    }
  }

  /**
   * Collecter les données nécessaires
   */
  private async collectData(): Promise<any> {
    // TODO: Implémenter la collecte de données
    return {};
  }

  /**
   * Analyser les données collectées
   */
  private async analyze(data: any): Promise<any> {
    // TODO: Implémenter l'analyse
    return {};
  }

  /**
   * Calculer les KPIs
   */
  private calculateKPIs(analysis: any): any[] {
    // TODO: Implémenter le calcul des KPIs
    return [
      {
        name: 'Exemple KPI',
        value: 100,
        unit: '%',
        status: 'ok',
      },
    ];
  }

  /**
   * Sauvegarder les résultats
   */
  private async saveResults(analysis: any): Promise<void> {
    // TODO: Sauvegarder dans reports/
    // Exemple :
    // const outputPath = path.join(config.outputPath, 'mon-agent-results.json');
    // await fs.promises.writeFile(outputPath, JSON.stringify(analysis, null, 2));
  }
}

// Exécution directe si ce fichier est lancé
if (require.main === module) {
  const agent = new TemplateAgent();
  agent.execute().then(result => {
    console.log('\n📋 Résultat:', result.status);
    console.log('⏱️  Durée:', result.duration, 'ms');
    console.log('📊 KPIs:', result.kpis.length);
  });
}

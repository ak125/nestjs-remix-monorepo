/**
 * DiagnosticEngine Module — Moteur de raisonnement mecanique
 *
 * Slice 2 : 5 engines deterministes.
 * Tables : __diag_system, __diag_symptom, __diag_cause,
 *          __diag_symptom_cause_link, __diag_safety_rule,
 *          __diag_maintenance_operation, __diag_maintenance_symptom_link,
 *          __diag_session
 */
import { Module, Logger } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
// Conditional import — RagProxyModule may not be loaded (RAG_ENABLED=false)
import { RagProxyModule } from '../rag-proxy/rag-proxy.module';
import { DiagnosticEngineController } from './diagnostic-engine.controller';
import { DiagnosticEngineOrchestrator } from './diagnostic-engine.orchestrator';
import { DiagnosticEngineDataService } from './diagnostic-engine.data-service';
import { SignalInterpretationEngine } from './engines/signal-interpretation.engine';
import { HypothesisScoringEngine } from './engines/hypothesis-scoring.engine';
import { RiskSafetyEngine } from './engines/risk-safety.engine';
import { CatalogOrientationEngine } from './engines/catalog-orientation.engine';
import { MaintenanceIntelligenceEngine } from './engines/maintenance-intelligence.engine';
import { RagEnrichmentEngine } from './engines/rag-enrichment.engine';
import { MaintenanceCalculatorService } from './services/maintenance-calculator.service';

@Module({
  imports: [
    DatabaseModule,
    ...(process.env.RAG_ENABLED === 'true' ? [RagProxyModule] : []),
  ],
  controllers: [DiagnosticEngineController],
  providers: [
    DiagnosticEngineOrchestrator,
    DiagnosticEngineDataService,
    SignalInterpretationEngine,
    HypothesisScoringEngine,
    RiskSafetyEngine,
    CatalogOrientationEngine,
    MaintenanceIntelligenceEngine,
    RagEnrichmentEngine,
    MaintenanceCalculatorService,
  ],
  exports: [
    DiagnosticEngineOrchestrator,
    DiagnosticEngineDataService,
    MaintenanceCalculatorService,
  ],
})
export class DiagnosticEngineModule {
  private readonly logger = new Logger(DiagnosticEngineModule.name);

  constructor() {
    this.logger.log('DiagnosticEngine Module actif (Slice 2+8 — 6 engines)');
  }
}

/**
 * AgenticEngine Module — Moteur agentique AutoMecanik
 *
 * Phase 2: Real LLM-powered planning, solving, critiquing.
 * Pattern: DiagnosticEngineModule (autonomous module, ≤4 deps per service)
 *
 * Tables: __agentic_runs, __agentic_branches, __agentic_steps,
 *         __agentic_evidence, __agentic_checkpoints, __agentic_gate_results
 */
import { Module, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from '../../database/database.module';
import { FeatureFlagsModule } from '../../config/feature-flags.module';
import { AiContentModule } from '../ai-content/ai-content.module';
import { AgenticEngineController } from './agentic-engine.controller';
import { AgenticDataService } from './services/agentic-data.service';
import { EvidenceLedgerService } from './services/evidence-ledger.service';
import { RunManagerService } from './services/run-manager.service';
import { PlannerService } from './services/planner.service';
import { SolverService } from './services/solver.service';
import { CriticService } from './services/critic.service';
import { VerifierService } from './services/verifier.service';
import { ArbiterService } from './services/arbiter.service';
import { AGENTIC_QUEUE_NAME } from './constants/agentic.constants';

@Module({
  imports: [
    DatabaseModule,
    FeatureFlagsModule,
    AiContentModule,
    BullModule.registerQueue({ name: AGENTIC_QUEUE_NAME }),
  ],
  controllers: [AgenticEngineController],
  providers: [
    AgenticDataService,
    EvidenceLedgerService,
    RunManagerService,
    PlannerService,
    SolverService,
    CriticService,
    VerifierService,
    ArbiterService,
  ],
  exports: [
    RunManagerService,
    AgenticDataService,
    PlannerService,
    SolverService,
    CriticService,
  ],
})
export class AgenticEngineModule {
  private readonly logger = new Logger(AgenticEngineModule.name);

  constructor() {
    this.logger.log(
      'AgenticEngine Module actif (Phase 2 — LLM plan/solve/critique)',
    );
  }
}

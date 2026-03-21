/**
 * AgenticEngine Module — Moteur agentique AutoMecanik
 *
 * Agent-Native: les appels LLM sont faits par les agents Claude Code
 * (agentic-planner, agentic-solver, agentic-critic) qui ecrivent
 * directement en DB via MCP Supabase.
 *
 * Les services NestJS ne font que la gestion d'etat, l'evidence trail,
 * et le monitoring via API REST.
 *
 * Tables: __agentic_runs, __agentic_branches, __agentic_steps,
 *         __agentic_evidence, __agentic_checkpoints, __agentic_gate_results
 */
import { Module, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from '../../database/database.module';
import { FeatureFlagsModule } from '../../config/feature-flags.module';
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
      'AgenticEngine Module actif (Agent-Native — plan/solve/critique via Claude Code agents)',
    );
  }
}

/**
 * 🧪 TEST MATRIX - Index
 * 
 * Centralized export for all test gates (M1-M7)
 * 
 * @version 2.0.0
 * @date 2025-10-18
 */

export { default as M1Contracts, runM1ContractsGate } from './m1-contracts';
export { default as M5Budgets, runM5BudgetsGate } from './m5-budgets';
export { default as M6Graph, runM6GraphGate } from './m6-graph';
export { default as M7DiffCoverage, runM7DiffCoverageGate } from './m7-diff-coverage';

/**
 * M2 - Mutation Testing (TODO)
 * M3 - Perceptual UI (TODO)
 * M4 - Shadow Traffic (TODO)
 * 
 * Ces gates seront implémentés en Phase 2-3
 */

export const TEST_MATRIX_GATES = {
  M1: 'Contracts & Invariants',
  M2: 'Mutation Testing',
  M3: 'Perceptual UI',
  M4: 'Shadow Traffic Replay',
  M5: 'Budget Perf & Build',
  M6: 'Graph & Layers',
  M7: 'Diff-Coverage',
} as const;

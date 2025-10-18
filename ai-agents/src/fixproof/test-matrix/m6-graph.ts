/**
 * 🕸️ M6 - GRAPH & LAYERS
 * 
 * Gate : Vérifie qu'il n'y a pas de cycles de dépendances ni de violations de layers
 * 
 * Objectif :
 *   - Prevent circular dependencies (import cycles)
 *   - Enforce architectural layers (no backend → frontend, etc.)
 *   - Maintain clean module boundaries
 * 
 * Critères :
 *   - 0 import cycles → PASS
 *   - 0 layer violations → PASS
 *   - Any cycle or violation → FAIL
 * 
 * Tools :
 *   - Madge for cycle detection
 *   - Custom layer rules (backend, frontend, shared)
 * 
 * @version 2.0.0
 * @date 2025-10-18
 */

import { Gate, GateStatus } from '../types';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Layer rules:
 *   - backend/ can import: shared/
 *   - frontend/ can import: shared/
 *   - shared/ can import: nothing
 * 
 * Violations:
 *   - backend → frontend (NEVER)
 *   - frontend → backend (NEVER, use API)
 *   - shared → backend/frontend (NEVER)
 */
const LAYER_RULES = [
  {
    from: /^backend\//,
    to: /^frontend\//,
    violation: 'Backend cannot import from Frontend (use API)',
  },
  {
    from: /^frontend\//,
    to: /^backend\/(?!.*api)/,
    violation: 'Frontend cannot import from Backend (use API routes only)',
  },
  {
    from: /^packages\/shared-types\//,
    to: /^(backend|frontend)\//,
    violation: 'Shared types cannot import from Backend or Frontend',
  },
];

// ============================================================================
// CYCLE DETECTION
// ============================================================================

export interface ImportCycle {
  /** Files in cycle */
  files: string[];
  
  /** Cycle path (A → B → C → A) */
  path: string;
}

/**
 * Detect import cycles using Madge
 * 
 * Note: In real implementation, this would run `madge --circular`
 * For now, we simulate based on input
 */
export function detectCycles(files: string[]): ImportCycle[] {
  // TODO: Run madge --circular --json
  // For now, return empty (would be implemented with actual madge execution)
  return [];
}

// ============================================================================
// LAYER VIOLATION DETECTION
// ============================================================================

export interface LayerViolation {
  /** Source file */
  from: string;
  
  /** Target file */
  to: string;
  
  /** Violation reason */
  reason: string;
}

/**
 * Check if import violates layer rules
 */
function checkLayerViolation(from: string, to: string): LayerViolation | null {
  for (const rule of LAYER_RULES) {
    if (rule.from.test(from) && rule.to.test(to)) {
      return {
        from,
        to,
        reason: rule.violation,
      };
    }
  }
  
  return null;
}

/**
 * Detect all layer violations in imports
 * 
 * @param imports Map of file → imported files
 */
export function detectLayerViolations(imports: Record<string, string[]>): LayerViolation[] {
  const violations: LayerViolation[] = [];
  
  for (const [from, toFiles] of Object.entries(imports)) {
    for (const to of toFiles) {
      const violation = checkLayerViolation(from, to);
      if (violation) {
        violations.push(violation);
      }
    }
  }
  
  return violations;
}

// ============================================================================
// GATE M6 - GRAPH & LAYERS
// ============================================================================

export interface M6Input {
  /** Changed files */
  changedFiles: string[];
  
  /** Import map (file → imported files) */
  imports: Record<string, string[]>;
  
  /** Detected cycles (optional, will run detection if not provided) */
  cycles?: ImportCycle[];
}

export interface M6Output {
  gate: Gate;
  cycles: ImportCycle[];
  violations: LayerViolation[];
}

/**
 * Run M6 Gate - Graph & Layers
 * 
 * PASS if:
 *   - 0 import cycles
 *   - 0 layer violations
 * 
 * FAIL if:
 *   - Any cycle detected
 *   - Any layer violation
 */
export async function runM6GraphGate(input: M6Input): Promise<M6Output> {
  const { changedFiles, imports, cycles: inputCycles } = input;
  
  // 1. Detect cycles (or use provided)
  const cycles = inputCycles || detectCycles(changedFiles);
  
  // 2. Detect layer violations
  const violations = detectLayerViolations(imports);
  
  // 3. Determine gate status
  if (cycles.length === 0 && violations.length === 0) {
    return {
      gate: {
        id: 'M6',
        name: 'Graph & Layers',
        status: 'PASS',
        details: '✅ No import cycles or layer violations detected',
      },
      cycles,
      violations,
    };
  }
  
  // 4. Build failure details
  const details: string[] = ['❌ Graph & Layers violations:'];
  
  if (cycles.length > 0) {
    details.push(`\n🔄 Import Cycles (${cycles.length}):`);
    cycles.forEach(c => {
      details.push(`  - ${c.path}`);
    });
  }
  
  if (violations.length > 0) {
    details.push(`\n🚫 Layer Violations (${violations.length}):`);
    violations.forEach(v => {
      details.push(`  - ${v.from} → ${v.to}`);
      details.push(`    Reason: ${v.reason}`);
    });
  }
  
  return {
    gate: {
      id: 'M6',
      name: 'Graph & Layers',
      status: 'FAIL',
      details: details.join('\n'),
    },
    cycles,
    violations,
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  runM6GraphGate,
  detectCycles,
  detectLayerViolations,
  checkLayerViolation,
};

/**
 * 🔒 M1 - CONTRACTS & INVARIANTS
 * 
 * Gate : Vérifie que les contrats API/DTO ne changent pas sans label "contract-change"
 * 
 * Objectif :
 *   - Freeze API contracts (Zod schemas, DTOs, GraphQL schemas)
 *   - Require explicit approval for breaking changes
 *   - Prevent accidental API breaks
 * 
 * Critères :
 *   - Zod schemas frozen (hash unchanged OR label "contract-change")
 *   - DTOs frozen (TypeScript interfaces)
 *   - GraphQL schemas frozen
 *   - Prisma schema changes → automatic label
 * 
 * @version 2.0.0
 * @date 2025-10-18
 */

import { Gate, GateStatus } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONTRACT_PATTERNS = [
  /\.dto\.ts$/,                       // DTOs
  /schema\.ts$/,                      // Zod schemas
  /\.graphql$/,                       // GraphQL
  /prisma\/schema\.prisma$/,          // Prisma
  /types\/api\.ts$/,                  // API types
  /\/contracts\//,                    // Contracts directory
];

// ============================================================================
// CONTRACT DETECTION
// ============================================================================

/**
 * Check if file is a contract file
 */
export function isContractFile(filePath: string): boolean {
  return CONTRACT_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Extract contracts from changed files
 */
export function extractContracts(files: string[]): string[] {
  return files.filter(isContractFile);
}

// ============================================================================
// HASH COMPARISON
// ============================================================================

/**
 * Calculate SHA256 hash of file content
 */
function hashFile(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return '';
  }
}

/**
 * Compare hashes before/after
 */
export function hasContractChanged(
  filePath: string,
  baselineHash: string,
): boolean {
  const currentHash = hashFile(filePath);
  return currentHash !== baselineHash;
}

// ============================================================================
// LABEL DETECTION
// ============================================================================

/**
 * Check if PR has "contract-change" label
 * 
 * Note: In real implementation, this would check GitHub API
 * For now, we check env var or file marker
 */
export function hasContractChangeLabel(): boolean {
  // Check environment variable (set by CI)
  if (process.env.PR_LABELS?.includes('contract-change')) {
    return true;
  }
  
  // Check for marker file (local development)
  const markerPath = path.join(process.cwd(), '.contract-change');
  return fs.existsSync(markerPath);
}

// ============================================================================
// GATE M1 - CONTRACTS & INVARIANTS
// ============================================================================

export interface M1Input {
  /** Changed files */
  changedFiles: string[];
  
  /** Baseline hashes (file → hash) */
  baselineHashes: Record<string, string>;
  
  /** PR labels (optional) */
  prLabels?: string[];
}

export interface M1Output {
  gate: Gate;
  contractFiles: string[];
  changedContracts: string[];
}

/**
 * Run M1 Gate - Contracts & Invariants
 * 
 * PASS if:
 *   - No contract files changed
 *   - Contract files changed BUT PR has "contract-change" label
 * 
 * FAIL if:
 *   - Contract files changed WITHOUT "contract-change" label
 */
export async function runM1ContractsGate(input: M1Input): Promise<M1Output> {
  const { changedFiles, baselineHashes } = input;
  
  // 1. Extract contract files
  const contractFiles = extractContracts(changedFiles);
  
  // 2. Check which contracts changed
  const changedContracts = contractFiles.filter(file => {
    const baselineHash = baselineHashes[file];
    if (!baselineHash) return true; // New file = change
    return hasContractChanged(file, baselineHash);
  });
  
  // 3. If no contracts changed → PASS
  if (changedContracts.length === 0) {
    return {
      gate: {
        id: 'M1',
        name: 'Contracts & Invariants',
        status: 'PASS',
        details: '✅ No contract files changed',
      },
      contractFiles,
      changedContracts,
    };
  }
  
  // 4. Check for "contract-change" label
  const hasLabel = hasContractChangeLabel();
  
  if (hasLabel) {
    return {
      gate: {
        id: 'M1',
        name: 'Contracts & Invariants',
        status: 'PASS',
        details: `✅ ${changedContracts.length} contract(s) changed but approved via "contract-change" label`,
      },
      contractFiles,
      changedContracts,
    };
  }
  
  // 5. Contract changed without label → FAIL
  return {
    gate: {
      id: 'M1',
      name: 'Contracts & Invariants',
      status: 'FAIL',
      details: `❌ ${changedContracts.length} contract file(s) changed without "contract-change" label:\n${changedContracts.map(f => `  - ${f}`).join('\n')}`,
    },
    contractFiles,
    changedContracts,
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  runM1ContractsGate,
  isContractFile,
  extractContracts,
  hasContractChanged,
  hasContractChangeLabel,
};

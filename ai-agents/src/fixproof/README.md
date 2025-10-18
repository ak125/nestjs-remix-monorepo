# 🔧 Système Fix+Proof - Architecture

**Version** : 2.0.0  
**Date** : 18 Octobre 2025  
**Paradigme** : Prove-Then-Deploy, Zero-Trust, SLO-Driven

## 📋 Vue d'Ensemble

Le système **Fix+Proof** ajoute des capacités de **correction automatique** aux 12 agents de détection existants (A1-A12). Il implémente un pipeline Zero-Trust avec :

- **15 agents correcteurs** (F0-F15) : Générer patches atomiques (≤200 lignes)
- **7 gates formels** (M1-M7) : Preuves avant deploy
- **Decision Matrix** : R (Risk) / C (Confidence) → Auto/Review/Reject
- **Ring-Based Canary** : 0.5% → 5% → 25% → 100% avec auto-halt
- **Evidence-Based** : Logs, hashes, metrics, screenshots pour audit trail

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DETECTION AGENTS (A1-A12)                    │
│  Input: Codebase Analysis → Output: Constat (issues detected)  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                 F0 - ORCHESTRATEUR DÉTERMINISTE                 │
│  Plan patches atomiques (≤200L), generate tests M1-M7, calc R/C│
└─────────────────────┬───────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┬─────────────┐
        ▼             ▼             ▼             ▼
   ┌────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │ F1-F7  │   │  M1-M7  │   │   F15   │   │ F8-F14  │
   │ Fixes  │   │  Gates  │   │  Risk   │   │Security │
   └────┬───┘   └────┬────┘   └────┬────┘   └────┬────┘
        │            │             │             │
        └────────────┴─────────────┴─────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     F15 - DECISION MATRIX                       │
│  R≤30 & C≥95 & M✅ → CANARY_AUTO                               │
│  30<R≤60 OR 90≤C<95 → REVIEW_REQUIRED                          │
│  R>60 OR C<90 OR M❌ → REJECT_NEEDS_HUMAN                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┬─────────────┐
        ▼             ▼             ▼             ▼
   CANARY_AUTO   REVIEW_REQ    REJECT_HUMAN   PR Draft
        │             │             │             │
        ▼             ▼             ▼             ▼
   F10 Ring      Human Gate    Issue "needs-  Evidence
   0.5%→100%     + Manual      human" label   + Rollback
   Auto-Halt     Approval                     Plan
```

## 🤖 Agents Correcteurs (F0-F15)

### **Tier 1: AUTO (Safe)**
- **F1** : Dead-Code Surgeon
- **F2** : Lint/Unused/Format
- **F7** : Config & Scripts Sanitizer

### **Tier 2: ASSISTÉ (Moderate)**
- **F3** : Duplication Extractor
- **F4** : Massive Splitter
- **F5** : Cycle Breaker
- **F6** : CSS Dedup & Componentizer

### **Tier 3: SRE-Grade (New)**
- **F8** : Contract Synthesizer
- **F9** : SBOM & Vuln Sentinel
- **F10** : Ring/Canary Controller
- **F11** : Observability Verifier
- **F12** : Semantic Refactor Verifier
- **F13** : Data Impact Simulator
- **F14** : Coverage Diff Enforcer
- **F15** : Change Risk Scorer

## 🧪 Test Matrix (M1-M7)

### **Phase 1 (Implemented)** ✅
- **M1** : Contracts & Invariants (freeze API contracts)
- **M5** : Budget Perf & Build (p95 API/SSR, bundle, build time)
- **M6** : Graph & Layers (0 cycles, 0 violations)
- **M7** : Diff-Coverage (≥80% on modified lines)

### **Phase 2 (TODO)** ⏳
- **M2** : Mutation Testing (score ≥80%, Stryker.js)
- **M3** : Perceptual UI (SSIM ≥0.99, a11y ≥90)

### **Phase 3 (TODO)** ⏳
- **M4** : Shadow Traffic Replay (10k requests, delta <1%)

## 🎯 Decision Logic (F15)

### **Risk Score (R)**
```typescript
R = 0.4 × surface +           // Lines changed, files affected
    0.3 × criticality +       // auth/, payment/ = 90, styles/ = 20
    0.2 × historicalBugs +    // Bug ratio last 90 days
    0.1 × instability         // Commits per month
```

**Heuristiques** :
- `Files ≤3 & lines ≤100` → surface = 10
- `Files >5 OR lines >200` → surface = 50+
- `auth/, payment/` → criticality = 90
- `Bug ratio >50%` → historicalBugs = 80

### **Confidence Score (C)**
```typescript
C = 0.4 × tests +             // Pass rate (100% = 100, 95% = 90)
    0.3 × performance +       // Delta p95 (≤5% = 100, >15% = 30)
    0.2 × diffCoverage +      // ≥90% = 100, <70% = score
    0.1 × evidence            // Complete evidence = 100
```

**Heuristiques** :
- `Tests 100% pass` → tests = 100
- `p95 delta ≤5%` → performance = 100
- `Diff-cov ≥90%` → diffCoverage = 100
- `Logs + hashes + metrics + screenshots` → evidence = 100

### **Decision Table**
| R     | C     | Gates     | Action               |
|-------|-------|-----------|----------------------|
| ≤30   | ≥95   | ALL ✅    | **CANARY_AUTO**      |
| 31-60 | 90-94 | MIXED     | **REVIEW_REQUIRED**  |
| >60   | <90   | ANY ❌    | **REJECT_NEEDS_HUMAN** |

## 🚦 Canary Controller (F10)

### **Ring Sequence**
```typescript
0.5% → 15min → Monitor (p95, errors, 404s)
  ↓ (If green)
5% → 30min → Expanded monitoring
  ↓ (If green)
25% → 1h → Full observability
  ↓ (If green)
100% → Complete ✅
```

### **Auto-Halt Conditions**
```typescript
if (
  p95 > baseline × 1.10 ||      // +10% latency
  errorRate > 0.005 ||           // 0.5%
  critical404 ≥ 1                // Any 404 on critical routes
) {
  rollback_to_baseline_within_30min();
}
```

## 📊 DORA Metrics

**Targets** :
- ✅ **Lead Time** : <24h (commit → deploy)
- ✅ **Change Failure Rate** : <5%
- ✅ **MTTR** : <30min (rollback SLA)
- ✅ **Deploy Frequency** : Daily (automated canary)

## 📁 Structure Fichiers

```
ai-agents/src/fixproof/
├── types.ts                        # ✅ Core interfaces (AtomicPatch, RiskScore, etc.)
├── agents/
│   ├── f0-orchestrator.agent.ts    # ⏳ TODO - Plan patches
│   ├── f1-dead-code.agent.ts       # ⏳ TODO - Remove unused code
│   ├── f2-lint-format.agent.ts     # ⏳ TODO - Cosmetic fixes
│   ├── f3-duplication.agent.ts     # ⏳ TODO - Extract duplicates
│   ├── f4-splitter.agent.ts        # ⏳ TODO - Split massive files
│   ├── f5-cycle-breaker.agent.ts   # ⏳ TODO - Resolve cycles
│   ├── f6-css-dedup.agent.ts       # ⏳ TODO - Tailwind patterns
│   ├── f7-config-sanitizer.agent.ts # ⏳ TODO - Align configs
│   ├── f8-contract-synth.agent.ts  # ⏳ TODO - Freeze contracts
│   ├── f9-sbom-vuln.agent.ts       # ⏳ TODO - Security scan
│   ├── f10-canary.agent.ts         # ⏳ TODO - Progressive deploy
│   ├── f11-observability.agent.ts  # ⏳ TODO - SLO assertions
│   ├── f12-semantic-verify.agent.ts # ⏳ TODO - Fuzzing
│   ├── f13-data-impact.agent.ts    # ⏳ TODO - DB replay
│   ├── f14-coverage-diff.agent.ts  # ⏳ TODO - Enforce ≥80%
│   └── f15-risk-scorer.agent.ts    # ✅ DONE - R/C calculation
├── test-matrix/
│   ├── index.ts                    # ✅ Exports
│   ├── m1-contracts.ts             # ✅ DONE - Freeze API contracts
│   ├── m2-mutation.ts              # ⏳ TODO - Stryker.js
│   ├── m3-perceptual.ts            # ⏳ TODO - SSIM visual diff
│   ├── m4-shadow.ts                # ⏳ TODO - Traffic replay
│   ├── m5-budgets.ts               # ✅ DONE - Perf budgets
│   ├── m6-graph.ts                 # ✅ DONE - Cycles & layers
│   └── m7-diff-coverage.ts         # ✅ DONE - ≥80% diff-cov
└── README.md                       # ✅ This file
```

## 🚀 Usage

### **Example: Run F15 Risk Scorer**
```typescript
import { runF15RiskScorer } from './agents/f15-risk-scorer.agent';
import { runM1ContractsGate } from './test-matrix/m1-contracts';

// 1. Run test gates
const m1 = await runM1ContractsGate({
  changedFiles: ['backend/src/api/users.dto.ts'],
  baselineHashes: { 'backend/src/api/users.dto.ts': 'abc123...' },
});

// 2. Calculate R/C scores + decision
const result = await runF15RiskScorer({
  patches: [{
    id: 'patch-1',
    scope: 'duplication',
    files: ['backend/src/utils/format.ts'],
    linesChanged: 120,
    kpiTarget: 'duplication-5',
    baselineHash: 'def456...',
    rollbackTag: 'v1.2.3',
    diff: '...',
  }],
  gitHistory: [
    { file: 'backend/src/utils/format.ts', bugs: 2, commits: 10 },
  ],
  tests: { passed: 95, total: 100 },
  performance: {
    baseline_p95_API: 150,
    current_p95_API: 160,
    baseline_p95_SSR: 200,
    current_p95_SSR: 210,
  },
  diffCoverage: 85,
  evidence: [{
    timestamp: '2025-10-18T10:00:00Z',
    agent: 'F3-Duplication',
    action: 'extract-function',
    files: ['backend/src/utils/format.ts'],
    hashes: { 'backend/src/utils/format.ts': { before: 'abc', after: 'def' } },
    metrics: { coverage: 85 },
    logs: ['Extracted formatDate function'],
  }],
  testMatrix: {
    m1_contracts: m1.gate,
    // ... other gates
  },
});

// 3. Decision
console.log(result.decision.action); // "CANARY_AUTO" | "REVIEW_REQUIRED" | "REJECT_NEEDS_HUMAN"
console.log(`Risk: ${result.risk.overall} | Confidence: ${result.confidence.overall}`);
```

## 📈 Metrics & Observability

### **Evidence Required**
- ✅ **Logs** : Agent actions, timestamps
- ✅ **Hashes** : SHA256 before/after files
- ✅ **Metrics** : p95, bundle size, coverage
- ✅ **Screenshots** : UI before/after (M3 perceptual)

### **Audit Trail**
All evidence stored in:
```
ai-agents/reports/fixproof/
├── evidence/
│   ├── 2025-10-18_10-00-00_patch-1.json
│   ├── 2025-10-18_10-00-00_screenshots/
│   └── ...
├── canary-logs/
│   ├── 2025-10-18_ring-0.5.json
│   ├── 2025-10-18_ring-5.json
│   └── ...
└── rollback-plans/
    └── 2025-10-18_patch-1_rollback.sh
```

## 🛡️ Safety Guarantees

### **Zero-Trust Principles**
1. **No auto-merge without proofs** : M1-M7 must pass
2. **Atomic patches** : ≤200 lines, ≤5 files
3. **Rollback SLA** : <30min (F10 canary halt)
4. **Human override** : Always possible via GitHub PR

### **Circuit Breakers**
- ❌ **HALT** if p95 > baseline × 1.10
- ❌ **HALT** if errorRate > 0.5%
- ❌ **HALT** if critical 404 ≥ 1
- ❌ **REJECT** if any M-Gate fails

## 🧪 Testing Strategy

### **Unit Tests**
- Each agent (F0-F15) : 80%+ coverage
- Each gate (M1-M7) : 90%+ coverage

### **Integration Tests**
- F0 → F15 pipeline : End-to-end
- Canary controller : Simulated traffic

### **Mutation Tests**
- M2 gate : Ensure tests detect changes

## 📞 Support

**Questions** : See [AI-AGENTS-DOCUMENTATION.md](../../AI-AGENTS-DOCUMENTATION.md)  
**Issues** : Create GitHub issue with logs  
**Contributions** : PRs welcome (follow architecture)

---

**Version** : 2.0.0  
**Author** : Driven AI System  
**Date** : 18 Octobre 2025  
**License** : Proprietary

🎉 **Phase 1 Complete - Foundation Ready for Phase 2!**

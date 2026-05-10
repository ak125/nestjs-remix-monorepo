/**
 * inject-agent-role.ts — script idempotent d'injection de la clé `role:` dans
 * le frontmatter des `.claude/agents/**\/*.md` (ADR-037).
 *
 * Usage : `npx tsx scripts/seo/inject-agent-role.ts`
 *
 * Comportement :
 *  - Pour chaque agent listé dans `MAPPING`, lit son frontmatter via gray-matter
 *  - Si la clé `role` est absente, l'injecte avec la valeur cible
 *  - Si la clé `role` est présente et correspond à la cible, ne fait rien (idempotent)
 *  - Si la clé `role` est présente et diffère → ERREUR explicite (refus de
 *    réécrire silencieusement une décision humaine)
 *
 * Le mapping est figé par l'ADR-037, section "Plan de migration, Phase 1".
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import matter from 'gray-matter';

import { RoleId } from '../../backend/src/config/role-ids';

interface MigrationEntry {
  filename: string;
  role: RoleId;
  rationale: string;
}

const SOURCE_DIR = 'workspaces/seo-batch/.claude/agents';

/**
 * Mapping figé par ADR-037 :
 *  - 24 agents R0-R8 résolus comme aujourd'hui par filename suffix matching
 *  - 12 agents historiquement `unmappableAgents` figés via cet ADR
 *  - 3 agents R3 auto-résolus depuis #235 via DEPRECATED_ROLES filter
 */
const MAPPING: MigrationEntry[] = [
  // ── R0_HOME (NON_WRITING)
  {
    filename: 'r0-home-execution.md',
    role: RoleId.R0_HOME,
    rationale: 'execution agent for R0 home page',
  },
  {
    filename: 'r0-home-validator.md',
    role: RoleId.R0_HOME,
    rationale: 'validator for R0 home page',
  },

  // ── R1_ROUTER
  {
    filename: 'r1-content-batch.md',
    role: RoleId.R1_ROUTER,
    rationale: 'R1 content writer',
  },
  {
    filename: 'r1-keyword-planner.md',
    role: RoleId.R1_ROUTER,
    rationale: 'R1 KW planner',
  },
  {
    filename: 'r1-router-validator.md',
    role: RoleId.R1_ROUTER,
    rationale: 'R1 validator',
  },

  // ── R2_PRODUCT
  {
    filename: 'r2-keyword-planner.md',
    role: RoleId.R2_PRODUCT,
    rationale: 'R2 KW planner',
  },
  {
    filename: 'r2-product-validator.md',
    role: RoleId.R2_PRODUCT,
    rationale: 'R2 validator',
  },

  // ── R3_CONSEILS (R3_GUIDE deprecated, R3 prefix maps R3_CONSEILS)
  {
    filename: 'r3-conseils-validator.md',
    role: RoleId.R3_CONSEILS,
    rationale: 'R3_CONSEILS validator (suffix match)',
  },
  {
    filename: 'r3-image-prompt.md',
    role: RoleId.R3_CONSEILS,
    rationale: 'auto-resolved by DEPRECATED_ROLES filter (R3_GUIDE excluded)',
  },
  {
    filename: 'r3-keyword-plan-batch.md',
    role: RoleId.R3_CONSEILS,
    rationale: 'auto-resolved by DEPRECATED_ROLES filter (R3_GUIDE excluded)',
  },
  {
    filename: 'r3-keyword-planner.md',
    role: RoleId.R3_CONSEILS,
    rationale: 'auto-resolved by DEPRECATED_ROLES filter (R3_GUIDE excluded)',
  },

  // ── R4_REFERENCE
  {
    filename: 'r4-content-batch.md',
    role: RoleId.R4_REFERENCE,
    rationale: 'R4 content writer',
  },
  {
    filename: 'r4-keyword-planner.md',
    role: RoleId.R4_REFERENCE,
    rationale: 'R4 KW planner',
  },
  {
    filename: 'r4-reference-execution.md',
    role: RoleId.R4_REFERENCE,
    rationale: 'R4 execution',
  },
  {
    filename: 'r4-reference-validator.md',
    role: RoleId.R4_REFERENCE,
    rationale: 'R4 validator',
  },

  // ── R5_DIAGNOSTIC
  {
    filename: 'r5-diagnostic-execution.md',
    role: RoleId.R5_DIAGNOSTIC,
    rationale: 'R5 execution',
  },
  {
    filename: 'r5-diagnostic-validator.md',
    role: RoleId.R5_DIAGNOSTIC,
    rationale: 'R5 validator',
  },
  {
    filename: 'r5-keyword-planner.md',
    role: RoleId.R5_DIAGNOSTIC,
    rationale: 'R5 KW planner',
  },

  // ── R6_GUIDE_ACHAT (3 figés par ADR-037 mapping)
  {
    filename: 'r6-content-batch.md',
    role: RoleId.R6_GUIDE_ACHAT,
    rationale: 'ADR-037: ambiguous R6 prefix, content-batch writes buying guide content',
  },
  {
    filename: 'r6-guide-achat-validator.md',
    role: RoleId.R6_GUIDE_ACHAT,
    rationale: 'R6_GUIDE_ACHAT validator (suffix match)',
  },
  {
    filename: 'r6-image-prompt.md',
    role: RoleId.R6_GUIDE_ACHAT,
    rationale: 'ADR-037: ambiguous R6 prefix, generates buying guide images',
  },
  {
    filename: 'r6-keyword-planner.md',
    role: RoleId.R6_GUIDE_ACHAT,
    rationale: 'ADR-037: ambiguous R6 prefix, plans buying guide KWs',
  },

  // ── R6_SUPPORT (NON_WRITING)
  {
    filename: 'r6-support-validator.md',
    role: RoleId.R6_SUPPORT,
    rationale: 'R6_SUPPORT validator (suffix match)',
  },

  // ── R7_BRAND
  {
    filename: 'r7-brand-execution.md',
    role: RoleId.R7_BRAND,
    rationale: 'R7 execution',
  },
  {
    filename: 'r7-brand-rag-generator.md',
    role: RoleId.R7_BRAND,
    rationale: 'R7 RAG generator',
  },
  {
    filename: 'r7-brand-validator.md',
    role: RoleId.R7_BRAND,
    rationale: 'R7 validator',
  },
  {
    filename: 'r7-keyword-planner.md',
    role: RoleId.R7_BRAND,
    rationale: 'R7 KW planner',
  },

  // ── R8_VEHICLE
  {
    filename: 'r8-keyword-planner.md',
    role: RoleId.R8_VEHICLE,
    rationale: 'R8 KW planner',
  },
  {
    filename: 'r8-vehicle-execution.md',
    role: RoleId.R8_VEHICLE,
    rationale: 'R8 execution',
  },
  {
    filename: 'r8-vehicle-validator.md',
    role: RoleId.R8_VEHICLE,
    rationale: 'R8 validator',
  },

  // ── AGENTIC_ENGINE (orchestrateurs moteur agentique — ADR-037)
  {
    filename: 'agentic-critic.md',
    role: RoleId.AGENTIC_ENGINE,
    rationale: 'ADR-037: phase CRITIQUING du moteur agentique',
  },
  {
    filename: 'agentic-planner.md',
    role: RoleId.AGENTIC_ENGINE,
    rationale: 'ADR-037: planner du moteur agentique',
  },
  {
    filename: 'agentic-solver.md',
    role: RoleId.AGENTIC_ENGINE,
    rationale: 'ADR-037: solver du moteur agentique',
  },

  // ── FOUNDATION (utilitaires partagés cross-rôle — ADR-037)
  {
    filename: 'blog-hub-planner.md',
    role: RoleId.FOUNDATION,
    rationale: 'ADR-037: blog hub planner cross-rôle',
  },
  {
    filename: 'brief-enricher.md',
    role: RoleId.FOUNDATION,
    rationale: 'ADR-037: enrichissement de briefs cross-rôle',
  },
  {
    filename: 'keyword-planner.md',
    role: RoleId.FOUNDATION,
    rationale: 'ADR-037: planner KW générique partagé',
  },
  {
    filename: 'phase1-auditor.md',
    role: RoleId.FOUNDATION,
    rationale: 'ADR-037: auditeur de phase pré-execution',
  },
  {
    filename: 'research-agent.md',
    role: RoleId.FOUNDATION,
    rationale: 'ADR-037: recherche/discovery cross-rôle',
  },

  // ── R3_CONSEILS (mapping figé par ADR-037)
  {
    filename: 'conseil-batch.md',
    role: RoleId.R3_CONSEILS,
    rationale: 'ADR-037: produit du contenu R3_CONSEILS',
  },
];

interface InjectionStats {
  injected: number;
  alreadyCorrect: number;
  notFound: string[];
  conflicts: Array<{ filename: string; existingRole: string; targetRole: string }>;
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(__dirname, '../..');
  const dir = path.resolve(repoRoot, SOURCE_DIR);

  const stats: InjectionStats = {
    injected: 0,
    alreadyCorrect: 0,
    notFound: [],
    conflicts: [],
  };

  for (const entry of MAPPING) {
    const filePath = path.join(dir, entry.filename);
    let raw: string;
    try {
      // No prior existsSync check: readFileSync throws ENOENT if missing,
      // which is then mapped to `notFound`. Avoids TOCTOU race
      // (CodeQL js/file-system-race) between existsSync and writeFileSync.
      raw = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        stats.notFound.push(entry.filename);
        continue;
      }
      throw e;
    }

    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;
    const existingRole = data.role;

    if (existingRole === entry.role) {
      stats.alreadyCorrect++;
      continue;
    }
    if (typeof existingRole === 'string' && existingRole !== entry.role) {
      stats.conflicts.push({
        filename: entry.filename,
        existingRole,
        targetRole: entry.role,
      });
      continue;
    }

    const updatedData = { ...data, role: entry.role };
    const out = matter.stringify(parsed.content, updatedData);
    fs.writeFileSync(filePath, out, 'utf-8');
    stats.injected++;
    console.log(`[inject-agent-role] ${entry.filename} -> ${entry.role}`);
  }

  console.log('---');
  console.log(`[inject-agent-role] injected:        ${stats.injected}`);
  console.log(`[inject-agent-role] already correct: ${stats.alreadyCorrect}`);
  if (stats.notFound.length) {
    console.log(
      `[inject-agent-role] NOT FOUND (${stats.notFound.length}): ${stats.notFound.join(', ')}`,
    );
  }
  if (stats.conflicts.length) {
    console.error(
      `[inject-agent-role] CONFLICTS (${stats.conflicts.length}): refusing to overwrite human choices`,
    );
    for (const c of stats.conflicts) {
      console.error(
        `  - ${c.filename}: existing role="${c.existingRole}", expected="${c.targetRole}"`,
      );
    }
    process.exit(2);
  }
}

main().catch((err) => {
  console.error('[inject-agent-role] failed', err);
  process.exit(1);
});

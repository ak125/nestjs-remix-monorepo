import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { z } from 'zod';

/**
 * Prompt Registry MINIMAL — schema validation (Zod canon, pas Ajv/JSON-Schema).
 *
 * Cf. spec docs/superpowers/specs/2026-05-23-ai-additive-layer-phase-0-and-1-design.md §4.4
 * 5 champs uniquement : {prompt, intent, r_role, target_url, funnel_stage}.
 */

const PromptEntry = z
  .object({
    prompt: z.string().min(5),
    intent: z.enum([
      'diagnostic',
      'compatibility',
      'advice',
      'compare',
      'local',
      'transaction',
    ]),
    r_role: z.string().regex(/^R[0-9]$/),
    target_url: z.string().regex(/^\//),
    funnel_stage: z.enum(['TOFU', 'MOFU', 'BOFU']),
  })
  .strict();

const PromptRegistry = z.array(PromptEntry).min(20);

describe('workspaces/ai-probe/prompts.yaml', () => {
  const REGISTRY_PATH = path.resolve(
    __dirname,
    '../../../../workspaces/ai-probe/prompts.yaml',
  );
  let data: unknown;

  beforeAll(() => {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
    data = yaml.load(raw);
  });

  it('validates against the Zod prompt registry schema', () => {
    const result = PromptRegistry.safeParse(data);
    if (!result.success) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });

  it('contains at least 20 prompts', () => {
    expect(Array.isArray(data)).toBe(true);
    expect((data as unknown[]).length).toBeGreaterThanOrEqual(20);
  });

  it('has no duplicate target_url', () => {
    const result = PromptRegistry.parse(data);
    const urls = result.map((p) => p.target_url);
    const unique = new Set(urls);
    expect(unique.size).toBe(urls.length);
  });
});

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { z } from 'zod';

const ROOT = path.resolve(__dirname, '../../../..');
// Codes courts d'annotation de la probe, pas des RoleId de sortie runtime.
// Lire la table canonique : R9/G* ne sont pas des rôles métier actuellement définis.
const matrix = fs.readFileSync(
  path.join(ROOT, '.spec/00-canon/role-matrix.md'),
  'utf-8',
);
const canonicalRoles = new Set(
  [...matrix.matchAll(/^\| (R\d+) \|/gm)].map((match) => match[1]),
);

/** Cinq champs conservés. null = non qualifié, jamais une URL ou un rôle inventé. */
const PromptEntry = z
  .object({
    prompt: z.string().trim().min(5),
    intent: z.enum([
      'diagnostic',
      'compatibility',
      'advice',
      'compare',
      'local',
      'transaction',
    ]),
    r_role: z
      .string()
      .refine(
        (role) => canonicalRoles.has(role),
        'Rôle absent de la table canonique',
      )
      .nullable(),
    // Syntaxe uniquement : ceci ne prouve ni page servie, ni canonical, ni contenu.
    target_url: z
      .string()
      .regex(/^\/(?!\/)[^\s?#\\]+$/)
      .nullable(),
    funnel_stage: z.enum(['TOFU', 'MOFU', 'BOFU']),
  })
  .strict()
  .superRefine((entry, ctx) => {
    // Application des promesses de role-matrix.md aux intentions de cette probe.
    const rolesByIntent: Record<typeof entry.intent, (string | null)[]> = {
      diagnostic: ['R5'],
      compatibility: ['R1', 'R2', 'R6'],
      advice: ['R3', 'R6'],
      compare: ['R2', 'R6', null],
      local: [null],
      transaction: ['R2'],
    };
    if (!rolesByIntent[entry.intent].includes(entry.r_role)) {
      ctx.addIssue({
        code: 'custom',
        path: ['r_role'],
        message: 'Promesse du rôle incompatible avec cette intention de probe',
      });
    }
    if (entry.r_role === null && entry.target_url !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['target_url'],
        message: 'Qualifier le rôle avant de désigner une cible',
      });
    }
  });

const PromptRegistry = z.array(PromptEntry).min(20);
const data: unknown = yaml.load(
  fs.readFileSync(path.join(ROOT, 'workspaces/ai-probe/prompts.yaml'), 'utf-8'),
);

describe('workspaces/ai-probe/prompts.yaml', () => {
  it('reads the business roles from the canonical matrix', () => {
    expect([...canonicalRoles]).toEqual([
      'R0',
      'R1',
      'R2',
      'R3',
      'R4',
      'R5',
      'R6',
      'R7',
      'R8',
    ]);
  });

  it('validates the registry without claiming that targets are served', () => {
    expect(() => PromptRegistry.parse(data)).not.toThrow();
  });

  it('keeps at least 20 distinct prompts, even when targets are unknown', () => {
    const entries = PromptRegistry.parse(data);
    expect(entries.length).toBeGreaterThanOrEqual(20);
    const prompts = entries.map((entry) =>
      entry.prompt.toLocaleLowerCase('fr'),
    );
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  it('does not count unknown targets as duplicate URLs', () => {
    const urls = PromptRegistry.parse(data)
      .map((entry) => entry.target_url)
      .filter((url): url is string => url !== null);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it.each([
    ['Quelle huile pour C4 Picasso HDI ?', 'R6'],
    ['Meilleur amortisseur Clio 3 phase 2 ?', 'R6'],
    ['Comparatif huile moteur 5W30 vs 5W40 ?', 'R6'],
    ['Oscaro vs Mister Auto — quelle différence ?', null],
    ['Garage Citroën agréé à Lyon ?', null],
    ['Spécialiste turbo diesel Marseille ?', null],
  ])('qualifies the dominant promise: %s', (prompt, role) => {
    const entry = PromptRegistry.parse(data).find(
      (row) => row.prompt === prompt,
    );
    expect(entry).toBeDefined();
    expect(entry?.r_role).toBe(role);
  });

  it('keeps the manual Opportunity Lens target list aligned with qualified targets', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'scripts/analytics/opportunity-lens.sql'),
      'utf-8',
    );
    const array = sql.match(/SELECT unnest\(ARRAY\[([\s\S]*?)\]::text\[\]\)/);
    expect(array).not.toBeNull();
    const sqlUrls = [...array![1].matchAll(/'([^']+)'/g)].map(
      (match) => match[1],
    );
    const registryUrls = PromptRegistry.parse(data)
      .map((entry) => entry.target_url)
      .filter((url): url is string => url !== null);
    expect(sqlUrls.sort()).toEqual([...new Set(registryUrls)].sort());
  });
});

describe('rejected probe annotations', () => {
  const valid = {
    prompt: 'Comment remplacer un filtre ?',
    intent: 'advice',
    r_role: 'R3',
    target_url: null,
    funnel_stage: 'TOFU',
  };

  it.each(['R9', 'R10', 'G1', 'R3_GUIDE', 'Local'])(
    'rejects role %s',
    (role) => {
      expect(PromptEntry.safeParse({ ...valid, r_role: role }).success).toBe(
        false,
      );
    },
  );

  it.each([
    ['local', 'R7'],
    ['diagnostic', 'R3'],
    ['compare', 'R3'],
    ['advice', 'R2'],
    ['transaction', 'R8'],
  ])('rejects intent %s with role %s', (intent, role) => {
    expect(
      PromptEntry.safeParse({ ...valid, intent, r_role: role }).success,
    ).toBe(false);
  });

  it('requires an explicit unknown, not a missing field or an empty URL', () => {
    const { target_url: _target, ...missing } = valid;
    expect(PromptEntry.safeParse(valid).success).toBe(true);
    expect(PromptEntry.safeParse(missing).success).toBe(false);
    expect(PromptEntry.safeParse({ ...valid, target_url: '' }).success).toBe(
      false,
    );
  });

  it('does not attach a URL to an unclassified local observation', () => {
    const local = { ...valid, intent: 'local', r_role: null };
    expect(PromptEntry.safeParse(local).success).toBe(true);
    expect(
      PromptEntry.safeParse({ ...local, target_url: '/local' }).success,
    ).toBe(false);
  });

  it.each([
    '//example.org',
    'https://example.org',
    '/x?r=1',
    '/x#section',
    '/a b',
    '/a\\b',
  ])('rejects non-canonical path syntax %s', (url) => {
    expect(PromptEntry.safeParse({ ...valid, target_url: url }).success).toBe(
      false,
    );
  });

  it('rejects a sixth field instead of silently dropping it', () => {
    expect(PromptEntry.safeParse({ ...valid, published: true }).success).toBe(
      false,
    );
  });
});

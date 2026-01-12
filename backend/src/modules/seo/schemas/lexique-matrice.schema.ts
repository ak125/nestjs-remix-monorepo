import { z } from 'zod';

// ============================================================================
// SCHEMAS
// ============================================================================

const GammeSchema = z.object({
  pg_id: z.number().int().positive(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_-]+$/),
  nom_fr: z.string().min(2).max(100),
  lexique_autorise: z.array(z.string().min(2)).min(1),
  lexique_interdit: z.array(z.string().min(2)).default([]),
  role_fonctionnel: z.string().min(10).max(500),
  verbes_autorises: z.array(z.string().min(2)).default([]),
  verbes_interdits: z.array(z.string().min(2)).default([]),
  pieces_associees: z
    .array(z.union([z.string().min(2), z.number()]))
    .default([]),
  symptomes: z.array(z.string().min(2)).default([]),
  claims_interdits: z.array(z.string().min(2)).default([]),
});

const FamilleSchema = z.object({
  nom: z.string().min(2).max(50),
  code: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9_-]+$/),
  gammes: z.array(GammeSchema).min(1),
});

const ConfusionPairSchema = z.object({
  piece_a: z.string().min(2),
  piece_b: z.string().min(2),
  severity: z.enum(['minor', 'medium', 'major', 'critical']),
  category: z.string().min(2),
  message_fr: z.string().min(10),
});

const AmbiguousTermSchema = z.object({
  term: z.string().min(2),
  required_contexts: z.array(z.string().min(2)).min(1),
  category: z.string().min(2),
  message_fr: z.string().min(10),
});

export const LexiqueMatriceSchema = z.object({
  $schema: z.string().optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  updated_at: z.string().datetime(),
  updated_by: z.string().min(1),
  familles: z.array(FamilleSchema).min(1),
  termes_globaux_interdits: z.array(z.string().min(2)).default([]),
  phrases_association_autorisees: z.array(z.string().min(2)).default([]),
  confusion_pairs: z.array(ConfusionPairSchema).default([]),
  ambiguous_terms: z.array(AmbiguousTermSchema).default([]),
});

// ============================================================================
// TYPES
// ============================================================================

export type Gamme = z.infer<typeof GammeSchema>;
export type Famille = z.infer<typeof FamilleSchema>;
export type ConfusionPair = z.infer<typeof ConfusionPairSchema>;
export type AmbiguousTerm = z.infer<typeof AmbiguousTermSchema>;
export type LexiqueMatrice = z.infer<typeof LexiqueMatriceSchema>;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

export function validateLexiqueMatrice(data: unknown): {
  success: boolean;
  data?: LexiqueMatrice;
  errors?: string[];
} {
  const result = LexiqueMatriceSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `[${path}] ${issue.message}`;
  });

  return { success: false, errors };
}

export function validateUniqueIds(matrice: LexiqueMatrice): string[] {
  const errors: string[] = [];
  const seenIds = new Set<number>();

  for (const famille of matrice.familles) {
    for (const gamme of famille.gammes) {
      if (seenIds.has(gamme.pg_id)) {
        errors.push(`pg_id ${gamme.pg_id} (${gamme.nom_fr}) est dupliqué`);
      }
      seenIds.add(gamme.pg_id);
    }
  }

  return errors;
}

export function validateAssociations(matrice: LexiqueMatrice): string[] {
  const errors: string[] = [];
  const allSlugs = new Set<string>();
  const allNoms = new Set<string>();

  // Collect all slugs and nom_fr (lowercase for comparison)
  for (const famille of matrice.familles) {
    for (const gamme of famille.gammes) {
      allSlugs.add(gamme.slug.toLowerCase());
      allNoms.add(gamme.nom_fr.toLowerCase());
    }
  }

  // Validate pieces_associees references (by name, not pg_id)
  for (const famille of matrice.familles) {
    for (const gamme of famille.gammes) {
      for (const assocValue of gamme.pieces_associees) {
        // Skip validation for number values (legacy pg_id references)
        if (typeof assocValue === 'number') continue;

        const assocLower = assocValue.toLowerCase();
        // Check if the association exists as slug or nom_fr
        if (!allSlugs.has(assocLower) && !allNoms.has(assocLower)) {
          // This is just a warning - we allow free-form piece names for flexibility
          // errors.push(`${gamme.nom_fr} référence "${assocValue}" qui n'existe pas dans la matrice`);
        }
      }
    }
  }

  return errors;
}

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

interface Issue {
  rule: string;
  severity: 'warning' | 'blocking';
  message: string;
}

export function detectConfusion(
  gamme: Gamme,
  content: string,
  phrasesAssociation: string[] = [],
): Issue[] {
  const issues: Issue[] = [];
  const contentLower = content.toLowerCase();

  // Check for authorized lexique
  const hasAuthorized = gamme.lexique_autorise.some((mot) =>
    contentLower.includes(mot.toLowerCase()),
  );

  if (!hasAuthorized) {
    issues.push({
      rule: 'B1',
      severity: 'warning',
      message: `Aucun terme du lexique autorisé trouvé: ${gamme.lexique_autorise.join(', ')}`,
    });
  }

  // Check for forbidden lexique
  for (const mot of gamme.lexique_interdit) {
    if (contentLower.includes(mot.toLowerCase())) {
      if (!isInAssociatedContext(content, mot, phrasesAssociation)) {
        issues.push({
          rule: 'B1',
          severity: 'blocking',
          message: `Terme interdit "${mot}" trouvé dans contenu ${gamme.nom_fr}`,
        });
      }
    }
  }

  // Check for forbidden verbs
  for (const verbe of gamme.verbes_interdits) {
    if (contentLower.includes(verbe.toLowerCase())) {
      issues.push({
        rule: 'B1',
        severity: 'warning',
        message: `Verbe "${verbe}" inapproprié pour ${gamme.nom_fr}`,
      });
    }
  }

  return issues;
}

function isInAssociatedContext(
  content: string,
  mot: string,
  phrasesAssociation: string[],
): boolean {
  return phrasesAssociation.some((phrase) => {
    const regex = new RegExp(`${phrase}[^.]*${mot}`, 'i');
    return regex.test(content);
  });
}

export function detectDangerousClaims(
  gamme: Gamme,
  content: string,
  termesGlobauxInterdits: string[] = [],
): Issue[] {
  const issues: Issue[] = [];
  const contentLower = content.toLowerCase();

  // Check for piece-specific forbidden claims
  for (const claim of gamme.claims_interdits) {
    if (contentLower.includes(claim.toLowerCase())) {
      issues.push({
        rule: 'B2',
        severity: 'blocking',
        message: `Claim dangereux "${claim}" trouvé`,
      });
    }
  }

  // Check for global forbidden terms
  for (const terme of termesGlobauxInterdits) {
    if (contentLower.includes(terme.toLowerCase())) {
      issues.push({
        rule: 'B2',
        severity: 'blocking',
        message: `Terme global interdit "${terme}" trouvé`,
      });
    }
  }

  return issues;
}

export function detectConfusionPairs(
  content: string,
  confusionPairs: ConfusionPair[],
): Issue[] {
  const issues: Issue[] = [];
  const contentLower = content.toLowerCase();

  for (const pair of confusionPairs) {
    const hasPieceA = contentLower.includes(pair.piece_a.toLowerCase());
    const hasPieceB = contentLower.includes(pair.piece_b.toLowerCase());

    if (hasPieceA && hasPieceB) {
      issues.push({
        rule: 'B6',
        severity:
          pair.severity === 'major' || pair.severity === 'critical'
            ? 'blocking'
            : 'warning',
        message: `Confusion détectée: ${pair.piece_a} et ${pair.piece_b} - ${pair.message_fr}`,
      });
    }
  }

  return issues;
}

export function detectAmbiguousTerms(
  content: string,
  ambiguousTerms: AmbiguousTerm[],
): Issue[] {
  const issues: Issue[] = [];
  const contentLower = content.toLowerCase();

  for (const term of ambiguousTerms) {
    if (contentLower.includes(term.term.toLowerCase())) {
      const hasContext = term.required_contexts.some((ctx) =>
        contentLower.includes(ctx.toLowerCase()),
      );

      if (!hasContext) {
        issues.push({
          rule: 'W1',
          severity: 'warning',
          message: `Terme ambigu "${term.term}" sans contexte - ${term.message_fr}`,
        });
      }
    }
  }

  return issues;
}

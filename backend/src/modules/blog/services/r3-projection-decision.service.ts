/**
 * R3ProjectionDecisionService — chaîne de décision DARK du consumer R3 (P2-R3-D, ADR-059).
 *
 * Décide, pour une gamme, si le BODY servi doit venir de la **projection** (RAW → WIKI → exports
 * → projection) ou rester **legacy**. Ne rend RIEN : le rendu md→HTML est hors périmètre (P2-R3-E).
 *
 * Ordre imposé — chaque étape est un gate fail-closed franchi AVANT la suivante :
 *   1. résoudre l'`entityKey` canonique (`gamme:<alias>`, forme namespacée attendue par la RPC) ;
 *   2. master flag `SEO_PROJECTION_READ_V1` ;
 *   3. allowlist EXACTE `<ROLE>@<entity_id>` (rôle + entité, jamais l'entité seule) ;
 *   4. seulement alors, appeler le reader ;
 *   5. mapper avec les sections requises du pack `standard` ;
 *   6. servir la projection UNIQUEMENT si `ready` ;
 *   7. sinon fallback legacy observable.
 *
 * **Invariant** : master flag OFF **ou** paire non allowlistée ⇒ **0 appel RPC**. Les deux flags
 * étant OFF/vides par défaut, l'état mergé de cette PR est : 100 % legacy, 0 RPC, 0 lecture.
 *
 * **Atomicité BODY** : le verdict porte sur la page entière. Jamais « S1 projection + S2 legacy » —
 * une projection incomplète ou invalide fait basculer le BODY ENTIER sur le legacy.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PACK_DEFINITIONS } from '@config/conseil-pack.constants';
import { FeatureFlagsService } from '@config/feature-flags.service';
import {
  mapR3Projection,
  R3_MAPPER_ROLE,
  type R3Slot,
} from '@modules/seo-projection/projection-r3.mapper';
import { SeoProjectionReaderService } from '@modules/seo-projection/seo-projection-reader.service';

/** Rôle de projection servant les pages conseil R3. */
export const R3_PROJECTION_ROLE = R3_MAPPER_ROLE;

/** Pack de complétude du pilote R3 (résolu SERVEUR — jamais depuis la requête publique). */
const R3_PACK = PACK_DEFINITIONS.standard;

export type R3BodySource = 'projection' | 'legacy';

/** Causes de repli — toutes observables, aucune muette. */
export type R3FallbackReason =
  | 'MASTER_OFF'
  | 'NOT_ALLOWLISTED'
  | 'RPC_ERROR'
  | 'RPC_EXCEPTION'
  | 'PROJECTION_ABSENT'
  | 'MAPPER_INVALID'
  | 'MAPPER_INCOMPLETE';

export interface R3ProjectionDecision {
  entityKey: string;
  projectionRole: typeof R3_PROJECTION_ROLE;
  bodySource: R3BodySource;
  /** `null` seulement si `bodySource === 'projection'`. */
  fallbackReason: R3FallbackReason | null;
  mappedCount: number;
  invalidCount: number;
  /**
   * Slots projetés — présents UNIQUEMENT si `bodySource === 'projection'`. Transportés verbatim
   * depuis le mapper (aucune reformulation intermédiaire). `null` sur tout repli legacy, pour
   * qu'aucune projection partielle ne puisse fuiter dans un BODY legacy.
   */
  slots: Record<string, R3Slot> | null;
}

/** `entity_id` canonique namespacé — même forme que la clé d'écriture et le `p_entity_id` de la RPC. */
function toEntityKey(pgAlias: string): string {
  return `gamme:${pgAlias}`;
}

/** Jeton d'allowlist : la PAIRE rôle+entité, jamais l'entité seule. */
function toCanaryToken(entityKey: string): string {
  return `${R3_PROJECTION_ROLE}@${entityKey}`;
}

@Injectable()
export class R3ProjectionDecisionService {
  private readonly logger = new Logger(R3ProjectionDecisionService.name);

  constructor(
    private readonly reader: SeoProjectionReaderService,
    private readonly flags: FeatureFlagsService,
  ) {}

  /**
   * La paire (R3_CONSEILS, gamme:<alias>) est-elle ciblée par la canary ? **Synchrone, 0 RPC** :
   * appelable avant toute lecture de cache pour décider du bypass sans coût réseau.
   */
  isTargeted(pgAlias: string): boolean {
    return this.isTargetedKey(toEntityKey(pgAlias));
  }

  private isTargetedKey(entityKey: string): boolean {
    if (!this.flags.seoProjectionReadV1) return false;
    return this.flags.seoProjectionReadCanary.includes(
      toCanaryToken(entityKey),
    );
  }

  async decide(pgAlias: string): Promise<R3ProjectionDecision> {
    // 1. Identité canonique.
    const entityKey = toEntityKey(pgAlias);

    // 2. Master flag — prime sur l'allowlist (une paire allowlistée reste inerte si le master est OFF).
    if (!this.flags.seoProjectionReadV1) {
      return this.fallback(entityKey, 'MASTER_OFF');
    }

    // 3. Allowlist exacte rôle + entité.
    if (!this.isTargetedKey(entityKey)) {
      return this.fallback(entityKey, 'NOT_ALLOWLISTED');
    }

    // 4. Lecture (le SEUL chemin atteignant la RPC).
    const { envelope, degradeReason } = await this.reader.readActiveProjection(
      entityKey,
      R3_PROJECTION_ROLE,
    );
    if (envelope === null) {
      return this.fallback(entityKey, this.toReaderFallback(degradeReason));
    }

    // 5. Mapping + complétude jugée sur le pack résolu côté serveur.
    const result = mapR3Projection(envelope, {
      requiredSections: R3_PACK.requiredSections,
    });

    // 6/7. Atomicité : ready ⇒ BODY projection ; sinon BODY legacy ENTIER.
    if (!result.ready) {
      const structurallyInvalid = result.invalid.some(
        (entry) =>
          entry.kind === 'block_contract_invalid' ||
          entry.kind === 'slot_collision',
      );
      return this.fallback(
        entityKey,
        structurallyInvalid ? 'MAPPER_INVALID' : 'MAPPER_INCOMPLETE',
        result.mapped.length,
        result.invalid.length,
      );
    }

    return this.emit({
      entityKey,
      projectionRole: R3_PROJECTION_ROLE,
      bodySource: 'projection',
      fallbackReason: null,
      mappedCount: result.mapped.length,
      invalidCount: result.invalid.length,
      slots: result.slots,
    });
  }

  /**
   * Traduit la dégradation du reader (contrat C0 : `RPC error: …` · `RPC exception` ·
   * `projection absente`) en cause typée. Une chaîne inattendue n'est jamais absorbée en
   * silence : elle est journalisée en warn puis classée `RPC_ERROR` (repli conservateur).
   */
  private toReaderFallback(degradeReason: string | null): R3FallbackReason {
    if (degradeReason === 'projection absente') return 'PROJECTION_ABSENT';
    if (degradeReason?.startsWith('RPC exception')) return 'RPC_EXCEPTION';
    if (!degradeReason?.startsWith('RPC error')) {
      this.logger.warn({
        msg: 'dégradation reader hors contrat connu — classée RPC_ERROR',
        degrade_reason: degradeReason,
      });
    }
    return 'RPC_ERROR';
  }

  private fallback(
    entityKey: string,
    fallbackReason: R3FallbackReason,
    mappedCount = 0,
    invalidCount = 0,
  ): R3ProjectionDecision {
    return this.emit({
      entityKey,
      projectionRole: R3_PROJECTION_ROLE,
      bodySource: 'legacy',
      fallbackReason,
      mappedCount,
      invalidCount,
      slots: null,
    });
  }

  /** Point d'émission unique du journal structuré de décision. */
  private emit(decision: R3ProjectionDecision): R3ProjectionDecision {
    this.logger.log({
      entity_key: decision.entityKey,
      projection_role: decision.projectionRole,
      decision: decision.bodySource,
      fallback_reason: decision.fallbackReason,
      mapped_count: decision.mappedCount,
      invalid_count: decision.invalidCount,
    });
    return decision;
  }
}

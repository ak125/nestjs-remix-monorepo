/**
 * R3ProjectionDecisionService — chaîne de décision du consumer R3 (P2-R3-D/E, ADR-059, ADR-106).
 *
 * Décide, pour une gamme, si le corps de la page conseil est servi depuis la projection
 * (RAW → WIKI → exports → projection) ou depuis le legacy. Ne rend rien lui-même : le rendu des
 * slots est fait par le service de page (presenter + renderer Markdown gouverné, ADR-106 D6).
 *
 * **Deux champs, couplés par le type** (union discriminée sur `projectionStatus`) :
 *   - `READY_FOR_RENDER` ⇒ `servedBodySource: 'projection'`, `slots` non nuls, aucune cause ;
 *   - `FALLBACK` ⇒ `servedBodySource: 'legacy'`, `slots: null`, cause typée obligatoire.
 * Aucun état intermédiaire n'est représentable (prête mais non servie, servie sans slots…).
 *
 * Ordre imposé — chaque étape est un gate fail-closed franchi AVANT la suivante :
 *   1. résoudre l'`entityKey` canonique (`gamme:<alias>`, forme namespacée attendue par la RPC) ;
 *   2. master flag `SEO_PROJECTION_READ_V1` ;
 *   3. allowlist EXACTE `<ROLE>@<entity_id>` (rôle + entité, jamais l'entité seule) ;
 *   4. seulement alors, appeler le reader ;
 *   5. mapper sous le contrat de rendu ADR-106 (requis = tier M d'ADR-086, portés par la table du
 *      mapper — jamais par le pack conseil, règle du chemin d'écriture historique) ;
 *   6. `READY_FOR_RENDER` UNIQUEMENT si le mapper est `ready` ;
 *   7. sinon `FALLBACK` avec cause observable.
 *
 * **Invariant** : master flag OFF **ou** paire non allowlistée ⇒ **0 appel RPC**. Les deux flags
 * étant OFF/vides par défaut, l'état mergé de cette PR est : 100 % legacy, 0 RPC, 0 lecture.
 *
 * **Atomicité BODY** : le verdict porte sur la page entière. Jamais « S1 projection + S2 legacy » —
 * une projection incomplète ou invalide disqualifie la projection ENTIÈRE.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { PlannableSection } from '@config/keyword-plan.constants';
import { FeatureFlagsService } from '@config/feature-flags.service';
import {
  mapR3Projection,
  R3_MAPPER_ROLE,
  R3_RENDER_CONTRACT_VERSION,
  type R3InvalidEntry,
  type R3Slot,
} from '@modules/seo-projection/projection-r3.mapper';
import { SeoProjectionReaderService } from '@modules/seo-projection/seo-projection-reader.service';

/** Rôle de projection servant les pages conseil R3. */
export const R3_PROJECTION_ROLE = R3_MAPPER_ROLE;

/**
 * Verdict de la chaîne. `READY_FOR_RENDER` = le mapper a produit un DTO complet et conforme au
 * contrat de rendu ADR-106 ; le corps de la page est alors servi depuis la projection.
 */
export type R3ProjectionStatus = 'READY_FOR_RENDER' | 'FALLBACK';

/** Source RÉELLEMENT rendue — `'projection'` si et seulement si `READY_FOR_RENDER`. */
export type R3ServedBodySource = 'legacy' | 'projection';

/** Causes de repli — toutes observables, aucune muette. */
export type R3FallbackReason =
  | 'MASTER_OFF'
  | 'NOT_ALLOWLISTED'
  | 'RPC_ERROR'
  | 'RPC_EXCEPTION'
  | 'PROJECTION_ABSENT'
  | 'MAPPER_INVALID'
  | 'MAPPER_INCOMPLETE';

interface R3ProjectionDecisionBase {
  entityKey: string;
  projectionRole: typeof R3_PROJECTION_ROLE;
  mappedCount: number;
  invalidCount: number;
}

/** Projection prête : le corps est servi depuis les slots (verbatim du mapper). */
export interface R3ProjectionReady extends R3ProjectionDecisionBase {
  projectionStatus: 'READY_FOR_RENDER';
  servedBodySource: 'projection';
  fallbackReason: null;
  slots: Partial<Record<PlannableSection, R3Slot>>;
}

/**
 * Repli : corps legacy. `slots: null` — aucune projection partielle ne peut fuiter (atomicité
 * BODY : une projection incomplète ou invalide est écartée en entier).
 */
export interface R3ProjectionFallback extends R3ProjectionDecisionBase {
  projectionStatus: 'FALLBACK';
  servedBodySource: 'legacy';
  fallbackReason: R3FallbackReason;
  slots: null;
}

export type R3ProjectionDecision = R3ProjectionReady | R3ProjectionFallback;

/** `entity_id` canonique namespacé — même forme que la clé d'écriture et le `p_entity_id` de la RPC. */
function toEntityKey(pgAlias: string): string {
  return `gamme:${pgAlias}`;
}

/** Jeton d'allowlist : la PAIRE rôle+entité, jamais l'entité seule. */
function toCanaryToken(entityKey: string): string {
  return `${R3_PROJECTION_ROLE}@${entityKey}`;
}

/**
 * Classe un verdict `ready: false` du mapper — **fail-closed par construction**.
 *
 * Seul un manque de CONTENU (`required_slot_missing` exclusivement : composant obligatoire non
 * livré par le WIKI) est une projection « incomplète ». Tout le reste est un contrat INVALIDE :
 *   - `block_contract_invalid` / `slot_collision` — données hors contrat ;
 *   - toute invalidité FUTURE ajoutée au mapper — inconnue ⇒ INVALID, jamais absorbée en silence.
 *
 * Pure et exportée : testable sans monter le service ni fabriquer une enveloppe par cas.
 */
export function classifyMapperFallback(
  invalid: readonly R3InvalidEntry[],
): R3FallbackReason {
  const incompleteOnly =
    invalid.length > 0 &&
    invalid.every((entry) => entry.kind === 'required_slot_missing');
  return incompleteOnly ? 'MAPPER_INCOMPLETE' : 'MAPPER_INVALID';
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

    // 5. Mapping + complétude jugée par le contrat de rendu ADR-106 (table unique du mapper).
    const result = mapR3Projection(envelope);

    // 6/7. Atomicité : ready ⇒ corps projeté ; sinon FALLBACK (la projection ENTIÈRE est écartée).
    if (!result.ready) {
      return this.fallback(
        entityKey,
        classifyMapperFallback(result.invalid),
        result.mapped.length,
        result.invalid.length,
      );
    }

    return this.emit({
      entityKey,
      projectionRole: R3_PROJECTION_ROLE,
      projectionStatus: 'READY_FOR_RENDER',
      servedBodySource: 'projection',
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
      projectionStatus: 'FALLBACK',
      servedBodySource: 'legacy',
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
      projection_status: decision.projectionStatus,
      served_body_source: decision.servedBodySource,
      fallback_reason: decision.fallbackReason,
      mapped_count: decision.mappedCount,
      invalid_count: decision.invalidCount,
      render_contract_version: R3_RENDER_CONTRACT_VERSION,
    });
    return decision;
  }
}

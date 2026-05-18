/**
 * ADR-066 — R2 Composition Service (Gate 2 — Pure compose function)
 *
 * Synchronous, pure function : `compose(R1Signals, R8Signals, MotorDelta, Cluster)
 * → R2PagePlanV2` (no I/O, no LLM, no DB).
 *
 * Builds the section ordering + content scaffolding for a R2 page. The actual
 * **content rendering** (S_HERO h1 text, S_FAQ_SPECIFIC Q/A, etc.) is delegated
 * to PR 2 V1.5 LLM step (Anthropic call). PR 1 produces the **structural plan**.
 *
 * Sections (10) per ADR-066 :
 *   S_HERO, S_COMPAT_SCOPE, S_MOTOR_DELTA, S_SELECTION_GUIDE, S_PRODUCT_GROUPS,
 *   S_COMPAT_DETAIL, S_OEM_COMPACT, S_FAQ_SPECIFIC, S_REASSURANCE, S_RELATED_GUIDES.
 *
 * Discipline canon : the only place where commercial signals (prix, promo, stock,
 * panier, livraison, ajouter au panier) are scaffolded is S_REASSURANCE. The
 * Rego policy r2-content-write.rego enforces this at write time.
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  Cluster,
  MotorDelta,
  R1Signals,
  R8Signals,
} from '../schemas/r2-composition.schema';
import type { R2PagePlanV2 } from '../schemas/r2-v2-contract.schema';

@Injectable()
export class R2CompositionService {
  private readonly logger = new Logger(R2CompositionService.name);

  /**
   * Build the structural page plan (sections + ordering + scaffolding).
   * Pure : no I/O. Idempotent : same input always yields same output.
   *
   * Output feeds into LLM-driven section content generation (PR 2 V1.5).
   * PR 1 only validates that the plan respects contract invariants
   * (h1 length, block ordering, motorDeltaTraits non-empty).
   */
  compose(
    r1: R1Signals,
    r8: R8Signals,
    motor: MotorDelta,
    cluster: Cluster,
  ): R2PagePlanV2 {
    const h1 = this.buildHeroH1(motor, cluster);
    const title = this.buildSeoTitle(motor, cluster, r1);

    const orderedBlocks: R2PagePlanV2['orderedBlocks'] = [
      'S_HERO',
      'S_COMPAT_SCOPE',
      'S_MOTOR_DELTA',
      'S_SELECTION_GUIDE',
      'S_PRODUCT_GROUPS',
      'S_COMPAT_DETAIL',
      'S_OEM_COMPACT',
      'S_FAQ_SPECIFIC',
      'S_REASSURANCE',
      'S_RELATED_GUIDES',
    ];

    // Specific blocks = all per-motor blocks (not boilerplate)
    const specificBlocks: R2PagePlanV2['specificBlocks'] = [
      'S_HERO',
      'S_COMPAT_SCOPE',
      'S_MOTOR_DELTA',
      'S_FAQ_SPECIFIC',
    ];

    return {
      h1,
      title,
      orderedBlocks,
      specificBlocks,
      compatibilitySummary: this.buildCompatSummary(motor),
      selectionGuide: this.buildSelectionGuide(r1, motor),
      catalogSignals: this.buildCatalogSignals(motor, cluster),
      subgroups: this.buildSubgroups(r8),
      faqQuestions: this.buildFaqQuestions(r1, motor),
      motorDeltaTraits: this.buildMotorDeltaTraits(motor),
    };
  }

  // ── Section builders (pure) ─────────────────────────────────────────────────

  private buildHeroH1(motor: MotorDelta, cluster: Cluster): string {
    // h1 = "{gamme} {marque} {modele} {motor_label}" — capped 75 chars (per contract V1)
    const motorLabel = this.buildMotorLabel(motor);
    return `Gamme ${cluster.gammeId} ${motorLabel}`.slice(0, 75);
  }

  private buildSeoTitle(
    motor: MotorDelta,
    _cluster: Cluster,
    r1: R1Signals,
  ): string {
    const motorLabel = this.buildMotorLabel(motor);
    return `${r1.keywordPlan.primaryKw} pour ${motorLabel}`.slice(0, 100);
  }

  private buildMotorLabel(motor: MotorDelta): string {
    const parts: string[] = [];
    if (motor.literage) parts.push(motor.literage);
    parts.push(motor.fuelType);
    if (motor.powerHp) parts.push(`${motor.powerHp}ch`);
    if (motor.productionYearFrom && motor.productionYearTo) {
      parts.push(`${motor.productionYearFrom}-${motor.productionYearTo}`);
    }
    return parts.join(' ');
  }

  private buildCompatSummary(motor: MotorDelta): string[] {
    const items: string[] = [];
    items.push(`Motorisation : ${motor.fuelType}`);
    if (motor.powerHp) items.push(`Puissance : ${motor.powerHp} ch`);
    if (motor.engineCode) items.push(`Code moteur : ${motor.engineCode}`);
    if (motor.productionYearFrom && motor.productionYearTo) {
      items.push(
        `Production : ${motor.productionYearFrom}-${motor.productionYearTo}`,
      );
    }
    return items;
  }

  private buildSelectionGuide(r1: R1Signals, _motor: MotorDelta): string[] {
    // Pull from R1 RAG selection criteria + filter out commercial signals (defense in depth).
    return r1.keywordPlan.selectionCriteria.filter(
      (s) => !this.hasCommercialSignal(s),
    );
  }

  private buildCatalogSignals(motor: MotorDelta, _cluster: Cluster): string[] {
    if (motor.uniqueProductFamilies.length === 0) {
      return ['Catalogue partagé avec véhicules de la même famille'];
    }
    return [
      `${motor.uniqueProductFamilies.length} famille(s) produit spécifique(s) à cette motorisation`,
      ...motor.uniqueProductFamilies.map((f) => `Famille spécifique : ${f}`),
    ];
  }

  private buildSubgroups(r8: R8Signals): string[] {
    return r8.neighborPages
      .map((p) => `Voisin INDEX : type_id=${p.typeId}`)
      .slice(0, 5);
  }

  private buildFaqQuestions(r1: R1Signals, _motor: MotorDelta): string[] {
    return r1.keywordPlan.faqQuestions.slice(0, 5);
  }

  /**
   * NEW V2 section : motor-specific traits used by S_MOTOR_DELTA.
   * Pulls boolean deltas + unique families to drive content variation per motor.
   */
  private buildMotorDeltaTraits(motor: MotorDelta): string[] {
    const traits: string[] = [];
    if (motor.hasPowerDelta)
      traits.push(`puissance distincte (${motor.powerHp} ch)`);
    if (motor.hasEngineDelta && motor.engineCode)
      traits.push(`code moteur unique (${motor.engineCode})`);
    if (motor.hasPeriodDelta) traits.push('période de production distincte');
    if (motor.hasFuelDelta)
      traits.push(`carburant distinct (${motor.fuelType})`);
    if (motor.hasBodyDelta && motor.bodyType)
      traits.push(`carrosserie spécifique (${motor.bodyType})`);
    if (motor.uniqueProductFamilies.length > 0) {
      traits.push(
        `${motor.uniqueProductFamilies.length} pièce(s) exclusive(s)`,
      );
    }
    return traits;
  }

  private hasCommercialSignal(text: string): boolean {
    const lower = text.toLowerCase();
    return /prix|promo|stock|panier|livraison/.test(lower);
  }
}

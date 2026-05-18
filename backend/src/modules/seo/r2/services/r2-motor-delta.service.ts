/**
 * ADR-066 — R2 Motor Delta Service
 *
 * Pure function service computing `MotorDelta` for a given (pg_id, type_id)
 * by comparing the target motorisation against its nearest sibling in the same
 * cluster (modele_id × pg_id).
 *
 * Outputs 5 binary deltas (power, engine, period, fuel, body) + uniqueProductFamilies
 * + productCount. Used as primary input to R2EligibilityService Gate 1 and
 * S_MOTOR_DELTA section content composer.
 *
 * Inputs assumed loaded by caller (R2DataLoaderService PR 2 V1.5).
 */

import { Injectable } from '@nestjs/common';
import type { MotorDelta } from '../schemas/r2-composition.schema';
import type { FuelTypeEnum } from '../../../../config/r2-content-contract.schema';
import { z } from 'zod';

type FuelType = z.infer<typeof FuelTypeEnum>;

export interface MotorInputRow {
  typeId: number;
  fuelType: FuelType;
  powerHp: number | null;
  engineCode: string | null;
  literage: string | null;
  bodyType: string | null;
  productionYearFrom: number | null;
  productionYearTo: number | null;
  productCount: number;
  productFamilies: string[]; // distinct family slugs available for this type
}

/**
 * Threshold for `hasPowerDelta` : difference must exceed 15 HP to be considered
 * meaningful (not just a marketing tier rebadge of same engine).
 */
const POWER_DELTA_HP_THRESHOLD = 15;

@Injectable()
export class R2MotorDeltaService {
  /**
   * Compute MotorDelta : target motorisation vs nearest sibling in cluster.
   *
   * Pure : no I/O. Determined entirely by inputs.
   */
  compute(target: MotorInputRow, siblings: MotorInputRow[]): MotorDelta {
    // Pick the nearest sibling : same fuel if possible, otherwise any sibling
    // with the closest power. If no siblings, all deltas are true (isolated motor).
    const sibling = this.nearestSibling(target, siblings);

    if (!sibling) {
      // Isolated motorisation = maximally distinct from cluster.
      return {
        typeId: target.typeId,
        fuelType: target.fuelType,
        powerHp: target.powerHp,
        engineCode: target.engineCode,
        literage: target.literage,
        bodyType: target.bodyType,
        productionYearFrom: target.productionYearFrom,
        productionYearTo: target.productionYearTo,
        hasPowerDelta: true,
        hasEngineDelta: true,
        hasPeriodDelta: true,
        hasFuelDelta: true,
        hasBodyDelta: true,
        uniqueProductFamilies: [...target.productFamilies].sort(),
        productCount: target.productCount,
      };
    }

    const hasPowerDelta =
      target.powerHp !== null &&
      sibling.powerHp !== null &&
      Math.abs(target.powerHp - sibling.powerHp) > POWER_DELTA_HP_THRESHOLD;

    const hasEngineDelta =
      (target.engineCode ?? '').trim() !== (sibling.engineCode ?? '').trim() &&
      Boolean(target.engineCode);

    const hasPeriodDelta = this.yearRangesDisjoint(
      target.productionYearFrom,
      target.productionYearTo,
      sibling.productionYearFrom,
      sibling.productionYearTo,
    );

    const hasFuelDelta = target.fuelType !== sibling.fuelType;

    const hasBodyDelta =
      (target.bodyType ?? '').trim() !== (sibling.bodyType ?? '').trim() &&
      Boolean(target.bodyType);

    // unique families = families present in target but NOT in sibling.
    const siblingFamilies = new Set(sibling.productFamilies);
    const uniqueProductFamilies = target.productFamilies
      .filter((f) => !siblingFamilies.has(f))
      .sort();

    return {
      typeId: target.typeId,
      fuelType: target.fuelType,
      powerHp: target.powerHp,
      engineCode: target.engineCode,
      literage: target.literage,
      bodyType: target.bodyType,
      productionYearFrom: target.productionYearFrom,
      productionYearTo: target.productionYearTo,
      hasPowerDelta,
      hasEngineDelta,
      hasPeriodDelta,
      hasFuelDelta,
      hasBodyDelta,
      uniqueProductFamilies,
      productCount: target.productCount,
    };
  }

  /**
   * Nearest sibling = sibling with smallest |Δpower| in same fuel category,
   * fallback to any sibling minimum |Δpower|.
   */
  private nearestSibling(
    target: MotorInputRow,
    siblings: MotorInputRow[],
  ): MotorInputRow | null {
    const others = siblings.filter((s) => s.typeId !== target.typeId);
    if (others.length === 0) return null;

    const targetHp = target.powerHp ?? 0;
    const sameFuel = others.filter((s) => s.fuelType === target.fuelType);
    const pool = sameFuel.length > 0 ? sameFuel : others;

    return pool.reduce((best, cur) => {
      const bestDelta = Math.abs((best.powerHp ?? 0) - targetHp);
      const curDelta = Math.abs((cur.powerHp ?? 0) - targetHp);
      return curDelta < bestDelta ? cur : best;
    });
  }

  /**
   * Two year ranges [a1, a2] and [b1, b2] are disjoint if a2 < b1 OR b2 < a1.
   * Nulls treated as "open-ended" → not disjoint.
   */
  private yearRangesDisjoint(
    a1: number | null,
    a2: number | null,
    b1: number | null,
    b2: number | null,
  ): boolean {
    if (a1 === null || a2 === null || b1 === null || b2 === null) return false;
    return a2 < b1 || b2 < a1;
  }
}

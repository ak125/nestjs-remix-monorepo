/**
 * R2 Content Contract — H1/title policy
 */

import type {
  R2HeadingPolicy,
  R2Range,
  R2Vehicle,
} from './r2-content-contract.schema';

export function buildR2H1(vehicle: R2Vehicle, range: R2Range): string {
  return `${range.rangeLabel} pour ${vehicle.label}`;
}

export function buildR2Title(vehicle: R2Vehicle, range: R2Range): string {
  const years =
    vehicle.productionStartYear && vehicle.productionEndYear
      ? ` (${vehicle.productionStartYear}\u2013${vehicle.productionEndYear})`
      : '';

  return `${range.rangeLabel} ${vehicle.label}${years} | Compatibilit\u00e9 et choix`;
}

export function validateR2HeadingPolicy(input: {
  h1: string;
  title: string;
  vehicle: R2Vehicle;
  range: R2Range;
  policy: R2HeadingPolicy;
}) {
  const reasons: string[] = [];

  if (input.h1.length > input.policy.h1MaxLength) {
    reasons.push('H1_TOO_LONG');
  }

  if (input.title.length > input.policy.titleMaxLength) {
    reasons.push('TITLE_TOO_LONG');
  }

  if (input.policy.h1MustContainRangeAndVehicle) {
    const containsRange = input.h1
      .toLowerCase()
      .includes(input.range.rangeLabel.toLowerCase());
    const containsVehicle =
      input.h1
        .toLowerCase()
        .includes(input.vehicle.modelSlug.split('-')[0].toLowerCase()) ||
      input.h1
        .toLowerCase()
        .includes(input.vehicle.label.toLowerCase().split(' ')[0]);

    if (!containsRange || !containsVehicle) {
      reasons.push('H1_MISSING_RANGE_OR_VEHICLE_IDENTITY');
    }
  }

  if (
    input.policy.h1MustNotContainCommercialBoilerplate &&
    /(meilleur prix|promo|pas cher|discount|livraison gratuite)/i.test(input.h1)
  ) {
    reasons.push('H1_CONTAINS_COMMERCIAL_BOILERPLATE');
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

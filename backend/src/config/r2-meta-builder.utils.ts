/**
 * R2 Content Contract — Meta builder
 */

import type { R2ContentContract } from './r2-content-contract.schema';

export function buildR2Meta(contract: R2ContentContract) {
  return {
    title: contract.pagePlan.title,
    description:
      `Trouvez ${contract.range.rangeLabel.toLowerCase()} compatibles pour ${contract.vehicle.label}. ` +
      `Consultez les crit\u00e8res de compatibilit\u00e9, les variantes utiles et les sous-groupes disponibles.`,
    canonical: contract.canonical.url,
    robots:
      contract.status.decision === 'index'
        ? ('index,follow' as const)
        : ('noindex,follow' as const),
  };
}

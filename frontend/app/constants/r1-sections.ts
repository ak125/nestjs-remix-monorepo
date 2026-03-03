/**
 * R1 ROUTER — Section IDs et helper d'attributs DOM.
 * Verrouille les noms de section pour éviter les typos.
 */
export enum R1Section {
  HERO = "S_HERO",
  TRUST_STRIP = "S_TRUST_STRIP",
  COMPAT = "S_COMPAT",
  QUICK_NAV = "S_QUICK_NAV",
  KPI_COVERAGE = "S_KPI_COVERAGE",
  BUY_ARGS = "S_BUY_ARGS",
  MOTORISATIONS = "S_MOTORISATIONS",
  SAFE_TABLE = "S_SAFE_TABLE",
  COMPAT_ERRORS = "S_COMPAT_ERRORS",
  EQUIPEMENTIERS = "S_EQUIPEMENTIERS",
  CATALOGUE = "S_CATALOGUE",
  FAQ = "S_FAQ",
}

export function sectionAttr(section: R1Section) {
  return { "data-section": section, "data-page-role": "R1" } as const;
}

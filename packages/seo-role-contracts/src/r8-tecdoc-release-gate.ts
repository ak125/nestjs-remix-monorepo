/**
 * r8-tecdoc-release-gate — plage TecDoc R8 sous release gate.
 *
 * Les véhicules TecDoc importés `type_id ∈ [60000, 83456]` sont servis
 * `noindex, nofollow` jusqu'à validation SEO (`ReasonCode.TECDOC_RELEASE_GATE`).
 * Valeur caller-computed de `IndexabilityInput.tecdocReleaseGateOpen` : le
 * composer ne porte pas la règle, le caller R8 la calcule ici.
 *
 * Même plage que la page servie (`frontend/.../r8/r8-transform.ts`, robots).
 * Pur : aucune I/O.
 */
export const R8_TECDOC_RELEASE_GATE_RANGE = {
  min: 60000,
  max: 83456,
} as const;

/** `true` ⇔ le type_id R8 est sous release gate TecDoc (servi noindex). */
export function isR8TecdocReleaseGateOpen(typeId: number): boolean {
  return (
    typeId >= R8_TECDOC_RELEASE_GATE_RANGE.min &&
    typeId <= R8_TECDOC_RELEASE_GATE_RANGE.max
  );
}

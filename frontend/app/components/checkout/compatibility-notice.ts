/**
 * Texte de compatibilite affiche dans le tunnel (mandat BN, 2026-11-17 ;
 * precise par le mandat CK, 2026-11-18).
 *
 * Remplace « Compatibilite verifiee » et « Pieces compatibles avec votre
 * vehicule » : aucune verification automatique n'a lieu avant le paiement ;
 * l'equipe verifie la compatibilite avant l'envoi.
 *
 * Mandat CK : « compatible selon le catalogue » n'est affiche que si CHAQUE
 * article du panier a ete ajoute depuis la page catalogue du vehicule choisi
 * (type_id de la ligne = vehicule choisi, provenance « page »). Une piece
 * ajoutee depuis la recherche ou la fiche produit n'a pas ete filtree par le
 * catalogue du vehicule : la mention prudente s'applique alors.
 *
 * Formulations a valider par Marwane avec le departement 18 avant fusion.
 */
export const COMPATIBILITY_NOTICE =
  "Nous vérifions la compatibilité avec votre véhicule avant l'envoi";

export interface CompatibilityVehicle {
  type_id?: number | string | null;
  marque_name?: string | null;
  modele_name?: string | null;
  type_name?: string | null;
}

export interface CompatibilityCartItem {
  type_id?: number | string | null;
  vehicle_source?: string | null;
}

export function vehicleDisplayLabel(
  vehicle: CompatibilityVehicle | null | undefined,
): string | null {
  if (!vehicle) return null;
  return (
    [vehicle.marque_name, vehicle.modele_name, vehicle.type_name]
      .filter(Boolean)
      .join(" ") || null
  );
}

/**
 * Vrai seulement si chaque article a ete ajoute depuis la page catalogue du
 * vehicule choisi. Une ligne avec type_id mais sans provenance date d'avant le
 * mandat CK : seul l'ajout depuis une page vehicule posait alors un type_id.
 */
export function cartMatchesVehicleCatalogue(
  vehicle: CompatibilityVehicle | null | undefined,
  items: ReadonlyArray<CompatibilityCartItem | null | undefined>,
): boolean {
  const typeId = Number(vehicle?.type_id);
  if (!Number.isInteger(typeId) || typeId <= 0 || items.length === 0) {
    return false;
  }
  return items.every(
    (item) =>
      !!item &&
      Number(item.type_id) === typeId &&
      (item.vehicle_source ?? "page") === "page",
  );
}

/**
 * Mention de compatibilite du tunnel, sans point final.
 * `withVehicle: false` quand le vehicule est deja affiche a cote.
 */
export function compatibilityNotice(
  vehicle: CompatibilityVehicle | null | undefined,
  items: ReadonlyArray<CompatibilityCartItem | null | undefined>,
  { withVehicle = true }: { withVehicle?: boolean } = {},
): string {
  const label = vehicleDisplayLabel(vehicle);
  if (!label || !cartMatchesVehicleCatalogue(vehicle, items)) {
    return COMPATIBILITY_NOTICE;
  }
  return withVehicle
    ? `Compatible avec ${label} selon le catalogue ; nous vérifions avec votre immatriculation avant l'envoi`
    : "Compatible selon le catalogue ; nous vérifions avec votre immatriculation avant l'envoi";
}

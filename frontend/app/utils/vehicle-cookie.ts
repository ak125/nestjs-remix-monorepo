/**
 * 🚗 Gestion du Cookie de Véhicule Sélectionné
 *
 * Permet de persister le véhicule sélectionné entre les pages
 * pour afficher un breadcrumb contextualisé et filtrer les résultats.
 */

import { parse, serialize } from "cookie";
import { normalizeTypeAlias } from "./url-builder.utils";
import { logger } from "~/utils/logger";

// ========================================
// 📋 TYPES
// ========================================

export interface VehicleCookie {
  marque_id: number;
  marque_name: string;
  marque_alias: string;
  modele_id: number;
  modele_name: string;
  modele_alias: string;
  type_id: number;
  type_name: string;
  type_alias: string;
  selected_at: string; // ISO timestamp
}

export interface VehicleBreadcrumbData {
  label: string;
  href: string;
}

// ========================================
// 🍪 COOKIE HELPERS
// ========================================

const COOKIE_NAME = "selected_vehicle";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

/**
 * Récupérer le véhicule depuis le cookie
 */
export async function getVehicleFromCookie(
  cookieHeader: string | null,
): Promise<VehicleCookie | null> {
  if (!cookieHeader) {
    return null;
  }

  try {
    const cookies = parse(cookieHeader);
    const vehicleData = cookies[COOKIE_NAME];

    if (!vehicleData) {
      return null;
    }

    const vehicle = JSON.parse(decodeURIComponent(vehicleData));

    // Validation basique
    if (!vehicle.marque_id || !vehicle.modele_id || !vehicle.type_id) {
      logger.warn("⚠️ Cookie véhicule invalide (IDs manquants)");
      return null;
    }

    return vehicle;
  } catch (error) {
    logger.error("❌ Erreur parsing cookie véhicule:", error);
    return null;
  }
}

/**
 * Créer un cookie de véhicule sélectionné
 */
export function setVehicleCookie(
  vehicle: Omit<VehicleCookie, "selected_at">,
): string {
  const vehicleData: VehicleCookie = {
    ...vehicle,
    selected_at: new Date().toISOString(),
  };

  const serialized = serialize(
    COOKIE_NAME,
    encodeURIComponent(JSON.stringify(vehicleData)),
    {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      httpOnly: false, // Accessible en JS pour UI
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  );

  return serialized;
}

/**
 * Supprimer le cookie de véhicule
 */
export function clearVehicleCookie(): string {
  return serialize(COOKIE_NAME, "", {
    path: "/",
    maxAge: 0,
  });
}

// ========================================
// 🍞 BREADCRUMB HELPERS
// ========================================

/**
 * Générer les données breadcrumb pour un véhicule
 */
export function getVehicleBreadcrumbData(
  vehicle: VehicleCookie,
): VehicleBreadcrumbData {
  const safeTypeAlias = normalizeTypeAlias(
    vehicle.type_alias,
    vehicle.type_name,
  );
  return {
    label: `${vehicle.marque_name} ${vehicle.modele_name}`,
    href: `/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}/${vehicle.modele_alias}-${vehicle.modele_id}/${safeTypeAlias}-${vehicle.type_id}.html`,
  };
}

/**
 * Construire breadcrumb complet avec véhicule optionnel
 */
export function buildBreadcrumbWithVehicle(
  baseItems: Array<{ label: string; href?: string; current?: boolean }>,
  vehicle: VehicleCookie | null,
): Array<{ label: string; href?: string; current?: boolean }> {
  const items = [...baseItems];

  // Ajouter véhicule si disponible
  if (vehicle) {
    const vehicleData = getVehicleBreadcrumbData(vehicle);

    // Insérer avant le dernier élément (qui est souvent "current")
    const lastItem = items.pop();
    items.push({
      label: vehicleData.label,
      href: vehicleData.href,
    });

    if (lastItem) {
      items.push(lastItem);
    }
  }

  return items;
}

// ========================================
// 🔧 UTILITY FUNCTIONS
// ========================================

/**
 * Vérifier si un véhicule est sélectionné dans le cookie
 */
export async function hasSelectedVehicle(
  cookieHeader: string | null,
): Promise<boolean> {
  const vehicle = await getVehicleFromCookie(cookieHeader);
  return vehicle !== null;
}

/**
 * Récupérer uniquement les IDs du véhicule
 */
export async function getVehicleIds(
  cookieHeader: string | null,
): Promise<{ marqueId: number; modeleId: number; typeId: number } | null> {
  const vehicle = await getVehicleFromCookie(cookieHeader);

  if (!vehicle) {
    return null;
  }

  return {
    marqueId: vehicle.marque_id,
    modeleId: vehicle.modele_id,
    typeId: vehicle.type_id,
  };
}

/**
 * Formater le nom complet du véhicule
 */
export function formatVehicleName(vehicle: VehicleCookie): string {
  return `${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_name}`;
}

/**
 * Formater le nom court du véhicule (sans type)
 */
export function formatVehicleShortName(vehicle: VehicleCookie): string {
  return `${vehicle.marque_name} ${vehicle.modele_name}`;
}

// ========================================
// 📊 CLIENT-SIDE HELPERS (pour components)
// ========================================

/**
 * Helper côté client pour stocker le véhicule
 * Usage: onClick={() => storeVehicleClient(vehicleData)}
 */
export function storeVehicleClient(
  vehicle: Omit<VehicleCookie, "selected_at">,
): void {
  if (typeof document === "undefined") {
    logger.warn("⚠️ storeVehicleClient appelé côté serveur");
    return;
  }

  document.cookie = setVehicleCookie(vehicle);
}

/**
 * Helper côté client pour supprimer le véhicule
 */
export function clearVehicleClient(): void {
  if (typeof document === "undefined") {
    logger.warn("⚠️ clearVehicleClient appelé côté serveur");
    return;
  }

  document.cookie = clearVehicleCookie();
}

/**
 * Helper côté client pour lire le véhicule depuis cookies
 */
export function getVehicleClient(): VehicleCookie | null {
  if (typeof document === "undefined") {
    return null;
  }

  try {
    const cookies = parse(document.cookie);
    const vehicleData = cookies[COOKIE_NAME];

    if (!vehicleData) {
      return null;
    }

    return JSON.parse(decodeURIComponent(vehicleData));
  } catch {
    return null;
  }
}

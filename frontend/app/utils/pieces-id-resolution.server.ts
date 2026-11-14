/**
 * Résolution alias → ID des segments d'une URL R2
 * (`/pieces/{gamme}/{marque}/{modele}/{type}.html`), côté serveur uniquement.
 *
 * Une URL canonique porte ses quatre IDs : aucun appel réseau. Seules les URL
 * historiques sans ID passent par l'API interne. Trois issues distinctes :
 *   - ID trouvé (dans l'URL ou par l'API) ;
 *   - alias inconnu → ID 0, que le loader traduit en 410 / « absent du catalogue » ;
 *   - API hors d'état de répondre → `IdResolutionUnavailableError`, que le loader
 *     traduit en 503. Une panne n'est jamais présentée comme un alias inconnu.
 */

import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { parseUrlParam } from "~/utils/pieces-route.utils";

/**
 * Délai maximal d'un appel de résolution. Même plafond que les autres appels
 * internes du loader R2 (`fetchJsonOrNull`, alternatives) : au-delà, la requête
 * répond 503 au lieu de rester suspendue à un backend qui ne répond plus.
 */
const RESOLUTION_TIMEOUT_MS = 3000;

/** Taille de page demandée aux listes marques / modèles de l'API véhicules. */
const RESOLUTION_PAGE_SIZE = 200;

/**
 * Garde-fou de pagination : la plus grosse marque compte quelques centaines de
 * modèles. Une API qui renverrait indéfiniment des pages pleines est en défaut.
 */
const RESOLUTION_MAX_PAGES = 50;

/**
 * La résolution alias → ID n'a pas pu être menée : backend injoignable, délai
 * dépassé, réponse 5xx / 408 / 429 ou corps inexploitable. Ce n'est pas « alias
 * inconnu » : l'appelant doit répondre 503, jamais un 404/410 qui affirmerait
 * que la page n'existe pas.
 */
export class IdResolutionUnavailableError extends Error {
  constructor(
    readonly target: "vehicle" | "gamme",
    reason: string,
  ) {
    super(`Résolution ${target} indisponible : ${reason}`);
    this.name = "IdResolutionUnavailableError";
  }
}

const describeCause = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * Lit une réponse JSON de l'API de résolution. Retourne `null` quand l'API
 * refuse la demande (4xx définitif) : l'alias est alors traité comme introuvable.
 * Lève `IdResolutionUnavailableError` quand l'API n'a pas pu répondre.
 */
async function fetchResolutionJson(
  path: string,
  target: "vehicle" | "gamme",
): Promise<any | null> {
  let response: Response;
  try {
    response = await fetch(getInternalApiUrl(path), {
      signal: AbortSignal.timeout(RESOLUTION_TIMEOUT_MS),
    });
  } catch (cause) {
    throw new IdResolutionUnavailableError(
      target,
      `API injoignable (${describeCause(cause)})`,
    );
  }
  if (
    response.status >= 500 ||
    response.status === 408 ||
    response.status === 429
  ) {
    throw new IdResolutionUnavailableError(target, `HTTP ${response.status}`);
  }
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch (cause) {
    throw new IdResolutionUnavailableError(
      target,
      `réponse illisible (${describeCause(cause)})`,
    );
  }
}

/**
 * Lit une liste paginée de l'API véhicules en entier. La page par défaut de
 * l'API (50 lignes) ne suffit pas : une marque peut compter plusieurs centaines
 * de modèles, et un modèle absent de la première page n'est pas un modèle inconnu.
 */
async function fetchVehicleList(
  path: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let page = 0; page < RESOLUTION_MAX_PAGES; page++) {
    const body = await fetchResolutionJson(
      `${path}?limit=${RESOLUTION_PAGE_SIZE}&page=${page}`,
      "vehicle",
    );
    if (body === null) return rows; // demande refusée (4xx) : rien à lire
    if (!Array.isArray(body.data)) {
      throw new IdResolutionUnavailableError(
        "vehicle",
        `réponse inattendue de ${path} (liste absente)`,
      );
    }
    rows.push(...body.data);
    if (body.data.length < RESOLUTION_PAGE_SIZE) return rows; // dernière page
  }
  throw new IdResolutionUnavailableError(
    "vehicle",
    `pagination sans fin sur ${path}`,
  );
}

/**
 * Retrouve dans une liste la ligne désignée par un alias d'URL : alias exact
 * d'abord, sinon nom contenant l'alias (tolérance historique des URL sans ID).
 */
function findByAlias(
  rows: Record<string, unknown>[],
  alias: string,
  aliasKey: string,
  nameKey: string,
): Record<string, unknown> | undefined {
  if (!alias) return undefined;
  return (
    rows.find((row) => row[aliasKey] === alias) ??
    rows.find(
      (row) =>
        typeof row[nameKey] === "string" &&
        (row[nameKey] as string).toLowerCase().includes(alias),
    )
  );
}

const toPositiveId = (value: unknown): number => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : 0;
};

/**
 * Résout les IDs du véhicule depuis l'URL, et par l'API pour la marque ou le
 * modèle dont le segment ne porte pas d'ID. Un ID à 0 signifie « introuvable ».
 *
 * Le type n'est jamais résolu par alias : sans ID de type, l'URL ne désigne
 * aucune motorisation et aucun appel réseau ne peut y changer quoi que ce soit.
 */
export async function resolveVehicleIds(
  marqueParam: string,
  modeleParam: string,
  typeParam: string,
) {
  if (!marqueParam || !modeleParam || !typeParam) {
    logger.error(`❌ [RESOLVE-VEHICLE] Paramètres invalides:`, {
      marqueParam,
      modeleParam,
      typeParam,
    });
    throw new Error(`Paramètres véhicule invalides ou manquants`);
  }

  const marque = parseUrlParam(marqueParam);
  const modele = parseUrlParam(modeleParam);
  const type = parseUrlParam(typeParam);

  // IDs complets (cas canonique) ou type sans ID : rien à demander à l'API.
  // Le RM V2 RPC valide ensuite l'existence de la motorisation.
  if (type.id <= 0 || (marque.id > 0 && modele.id > 0)) {
    return { marqueId: marque.id, modeleId: modele.id, typeId: type.id };
  }

  logger.warn(
    `⚠️ [RESOLVE-VEHICLE] IDs manquants dans l'URL, résolution par l'API: marque=${marqueParam}, modele=${modeleParam}`,
  );

  // Chaque segment n'est résolu que si son ID manque. Une API qui n'a pas pu
  // répondre lève IdResolutionUnavailableError : seul un alias réellement
  // introuvable retourne 0 (et le 410 de l'appelant).
  const marqueId =
    marque.id > 0
      ? marque.id
      : toPositiveId(
          findByAlias(
            await fetchVehicleList("/api/vehicles/brands"),
            marque.alias,
            "marque_alias",
            "marque_name",
          )?.marque_id,
        );

  if (marqueId <= 0) {
    logger.warn(`⚠️ [RESOLVE-VEHICLE] Marque inconnue: ${marque.alias}`);
    return { marqueId: 0, modeleId: modele.id, typeId: type.id };
  }

  const modeleId =
    modele.id > 0
      ? modele.id
      : toPositiveId(
          findByAlias(
            await fetchVehicleList(`/api/vehicles/brands/${marqueId}/models`),
            modele.alias,
            "modele_alias",
            "modele_name",
          )?.modele_id,
        );

  if (modeleId <= 0) {
    logger.warn(
      `⚠️ [RESOLVE-VEHICLE] Modèle inconnu pour la marque ${marqueId}: ${modele.alias}`,
    );
  }
  return { marqueId, modeleId, typeId: type.id };
}

/**
 * Résout l'ID de gamme : ID de l'URL, sinon table statique des alias
 * historiques, sinon API. Retourne 0 pour un alias inconnu (le RM V2 RPC
 * répondra alors « absent du catalogue »).
 */
export async function resolveGammeId(gammeParam: string): Promise<number> {
  const gamme = parseUrlParam(gammeParam);

  // Mappings directs avec les IDs réels de la base de données
  // ⚠️ Ces mappings sont pour les routes SANS ID dans l'URL
  // Les routes avec ID (ex: courroie-d-accessoire-10) utilisent directement l'ID
  const knownGammeMap: Record<string, number> = {
    freinage: 402,
    "plaquettes-de-frein": 402,
    "plaquette-de-frein": 402,
    "disques-de-frein": 403,
    "disque-de-frein": 403,
    "kit-de-distribution": 128,
    "filtres-a-huile": 75,
    "filtres-a-air": 76,
    "filtres-a-carburant": 77,
    "filtres-habitacle": 78,
    amortisseurs: 854,
    amortisseur: 854,
  };

  // 🚀 LCP OPTIMIZATION: Si on a un ID dans l'URL, le retourner directement
  // Le RM V2 RPC fait déjà la validation de l'existence de la gamme en interne
  // Supprimer l'appel redondant à /api/catalog/gammes (économise ~50-100ms)
  if (gamme.id > 0) {
    logger.log(
      `✅ [GAMME-ID] ID trouvé dans l'URL: ${gamme.id} (validation déléguée au RM V2)`,
    );
    return gamme.id;
  }

  const gammeId = knownGammeMap[gamme.alias];

  if (gammeId) {
    logger.log(`✅ [GAMME-ID] Mapping trouvé pour ${gamme.alias}: ${gammeId}`);
    return gammeId;
  }

  // 🔍 API fallback: Chercher dans la base de données si alias non trouvé localement.
  // Une API qui n'a pas pu répondre lève IdResolutionUnavailableError : seul un
  // alias réellement introuvable retourne 0.
  const result = await fetchResolutionJson(
    `/api/catalog/gammes/by-alias/${encodeURIComponent(gamme.alias)}`,
    "gamme",
  );
  if (result?.success && result.data?.id) {
    logger.log(
      `✅ [GAMME-ID] API fallback trouvé pour ${gamme.alias}: ${result.data.id}`,
    );
    return result.data.id;
  }

  // 🛡️ Sécurité SEO: Ne pas retourner un ID incorrect si gamme inconnue
  // Le RM V2 RPC gérera la validation et retournera 404 si nécessaire
  logger.warn(
    `⚠️ [GAMME-ID] Gamme inconnue: ${gamme.alias} - retour 0 pour validation RM V2`,
  );
  return 0;
}

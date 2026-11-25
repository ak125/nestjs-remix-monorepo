/**
 * Appels de la fiche fournisseur vers le backend (loopback, cookie de session
 * transmis). Les gardes AuthenticatedGuard + IsAdminGuard du backend restent
 * l'autorité ; le contrôle de niveau ici évite seulement un aller-retour.
 */
import { type LoaderFunctionArgs } from "react-router";
import { requireUser } from "~/auth/unified.server";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";

export async function requireSupplierAdmin(
  context: LoaderFunctionArgs["context"],
) {
  const user = await requireUser({ context });
  if (!user.level || Number(user.level) < 7) {
    throw new Response("Accès non autorisé", { status: 403 });
  }
  return user;
}

export interface SupplierApiResponse {
  status: number;
  ok: boolean;
  payload: unknown;
}

export async function supplierApi(
  request: Request,
  path: string,
  init: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {},
): Promise<SupplierApiResponse> {
  const headers: Record<string, string> = {
    Cookie: request.headers.get("Cookie") || "",
    Accept: "application/json",
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(getInternalApiUrlFromRequest(path, request), {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const payload: unknown = await response.json().catch(() => null);
  return { status: response.status, ok: response.ok, payload };
}

/** Id de fournisseur de l'URL : chiffres seulement (spl_id). */
export function supplierIdParam(id: string | undefined): string {
  if (!id || !/^\d{1,9}$/.test(id)) {
    throw new Response("Identifiant fournisseur invalide", { status: 400 });
  }
  return id;
}

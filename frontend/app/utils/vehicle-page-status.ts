/**
 * R8 vehicle page (`/constructeurs/...`) HTTP-status verdict — single source of truth.
 *
 * Invariants (enforced by vehicle-page-status.test.ts):
 *  - A *deterministic* "vehicle not found / not displayable" is a **404**, never a 503.
 *    The backend `get_vehicle_page_data_cached` returns HTTP 200 + `{success:false}` for
 *    vehicles whose `type_display != '1'` (e.g. legacy/hidden) — that is a permanent state,
 *    not a transient outage, so labelling it 503 made Google retry forever and flag the
 *    site for "Erreur serveur (5xx)".
 *  - **503 is reserved for genuine transient failures** (backend 5xx, timeout, fetch error,
 *    or a `success:true` payload that is unexpectedly missing the vehicle) so crawlers retry.
 *  - **No non-200 verdict is ever `index,follow`** — error responses carry `noindex`.
 */
export type VehiclePageStatusCode =
  | "NOT_FOUND"
  | "GONE"
  | "BACKEND_RPC_ERROR"
  | "INVALID_PAYLOAD";

export interface VehiclePageError {
  /** HTTP status the loader should throw. */
  status: 404 | 410 | 503;
  /** X-Robots-Tag value — never `index,follow` on a non-200. */
  robots: string;
  /** Stable code for observability; only `isServerError` codes are logged as 503 alerts. */
  code: VehiclePageStatusCode;
  /** Genuine transient server error worth alerting on (vs. an expected not-found). */
  isServerError: boolean;
}

export interface VehiclePageRpcResult {
  success?: boolean;
  data?: { vehicle?: unknown } | null;
  /** Present on a failed RPC (e.g. "Vehicle not found"); not used for the verdict but part of the contract. */
  error?: unknown;
}

const NOT_FOUND: VehiclePageError = {
  status: 404,
  robots: "noindex, follow",
  code: "NOT_FOUND",
  isServerError: false,
};

const GONE: VehiclePageError = {
  status: 410,
  robots: "noindex, follow",
  code: "GONE",
  isServerError: false,
};

/**
 * Resolve the loader verdict once the backend `page-data-rpc` call has returned a response.
 * Returns `null` when the vehicle is displayable (loader should render the 200 page).
 *
 * Transient exceptions (timeout / network error) happen before a response exists and are
 * handled directly by the loader's catch block as a 503.
 */
export function resolveVehiclePageError(
  backendOk: boolean,
  backendStatus: number,
  result: VehiclePageRpcResult | null,
): VehiclePageError | null {
  if (!backendOk) {
    if (backendStatus === 404) return NOT_FOUND;
    if (backendStatus === 410) return GONE;
    // Real upstream server error → 503 so crawlers retry.
    return {
      status: 503,
      robots: "noindex",
      code: "BACKEND_RPC_ERROR",
      isServerError: true,
    };
  }

  // Backend answered 200.
  if (!result?.success) {
    // Deterministic "Vehicle not found" verdict (type_display != '1' or absent). 404, reversible.
    return NOT_FOUND;
  }
  if (!result.data?.vehicle) {
    // success:true but no vehicle payload → genuine backend anomaly → retry.
    return {
      status: 503,
      robots: "noindex",
      code: "INVALID_PAYLOAD",
      isServerError: true,
    };
  }
  return null;
}

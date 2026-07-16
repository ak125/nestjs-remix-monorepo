/**
 * RemixApplicationPort — the SINGLE source of truth for the actor-bound,
 * per-request application port that the embedded Remix SSR realm uses to reach
 * the NestJS domain services IN-PROCESS (no HTTP loopback, no ConnectRPC).
 *
 * REALM CONTRACT (why this file is a dependency-free LEAF):
 * - The frontend (ESM) imports this via `~/utils/remix-application-port`.
 * - The backend (CJS, `moduleResolution: Node` classic) sees these types through
 *   `frontend/index.d.cts`, which re-exports them via a PACKAGE-RELATIVE
 *   `import('./app/utils/remix-application-port')`. Classic Node resolution reads
 *   relative `.ts` sources, so the backend gets the REAL interface (not `any`).
 * - That only holds while this file has ZERO imports and ZERO runtime: a `.ts`
 *   pulled into the backend program via a type-space `import()` is NOT covered by
 *   `skipLibCheck`, so any transitive import here would become a hard
 *   "Cannot find module" in the backend build. Keep this file import-free.
 *
 * This is type-only (erased at emit) → it never creates a second runtime instance
 * of the identity-keyed context keys, so the dual-realm #1106 invariant is
 * untouched. Runtime crossing still happens exclusively through the
 * `getCreateAppLoadContext` façade bridge in `frontend/index.cjs`.
 */

/* ── Actor ─────────────────────────────────────────────────────────────────
 * Mirrors the authoritative backend `AuthUser` (auth.service.ts) subset the port
 * needs to authorize — NOT the stale `Express.User` (types/express.d.ts). A `null`
 * actor represents an anonymous request (public capabilities still work).
 */
export interface PortActor {
  id: string;
  email: string;
  level: number;
  isAdmin: boolean;
  isPro: boolean;
  isActive: boolean;
  authSource?: "admin" | "customer";
}

/* ── Shared pagination ─────────────────────────────────────────────────────── */
export interface PortPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/* ── Homepage (PUBLIC — no actor) ──────────────────────────────────────────
 * Shapes are the structural fields the frontend mappers actually read
 * (`~/utils/homepage-rpc.mapper`: mapFamiliesFromSplit / mapBelowFoldData).
 * Producer = HomepageRpcService (get_homepage_families DEFINER RPC + below-fold
 * direct reads). Kept narrow and honest to what is consumed.
 */
export interface HomepageGammeNode {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
  pg_img?: string | null;
}
export interface HomepageFamilyNode {
  mf_id: number | string;
  mf_name: string;
  mf_pic?: string | null;
  mf_description?: string | null;
  gammes?: HomepageGammeNode[];
  gammes_count?: number;
}
export interface HomepageFamiliesResult {
  catalog: { families: HomepageFamilyNode[] };
}

export interface HomepageBrandNode {
  marque_id: number;
  marque_name: string;
  marque_alias: string;
  marque_logo?: string | null;
}
export interface HomepageEquipementierNode {
  pm_name: string;
  pm_logo?: string | null;
}
export interface HomepageBelowFoldResult {
  brands: HomepageBrandNode[];
  equipementiers: HomepageEquipementierNode[];
  /** Blog rows are read positionally by the mapper (ba_title/ba_descrip/…). */
  blog_articles: ReadonlyArray<Record<string, unknown>>;
}

/* ── Admin orders (ADMIN — re-authorized server-side) ──────────────────────── */
export interface AdminOrdersQuery {
  page?: number;
  limit?: number;
  status?: number;
  search?: string;
}
export interface AdminOrdersResult {
  /** Raw order rows (dynamic DB projection); consumers read documented fields. */
  data: ReadonlyArray<Record<string, unknown>>;
  pagination: PortPagination;
}

/* ── Admin staff (ADMIN — re-authorized server-side) ───────────────────────── */
export interface AdminStaffMember {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  level: number;
  isActive: boolean;
  /** Derived from `isActive` for the table filter/UI. */
  status: "active" | "inactive";
  /** Derived from the single `cnfa_job` column. */
  department?: string;
  role?: string;
}
export interface AdminStaffQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: "active" | "inactive";
  department?: string;
  /** Admin tier filter (cnfa_level). */
  level?: number;
}
export interface AdminStaffResult {
  staff: AdminStaffMember[];
  pagination: PortPagination;
  total: number;
}
export interface AdminStaffStatistics {
  total: number;
  active: number;
  inactive: number;
  /** Count of distinct departments. */
  departments: number;
  /** Distinct department names (departments === departmentNames.length). */
  departmentNames: string[];
}

/* ── The port ──────────────────────────────────────────────────────────────
 * Frozen, per-request, actor-bound. Public homepage reads take no actor; every
 * `*Admin*` capability re-authorizes the bound actor server-side (401 anonymous /
 * 403 authenticated-non-admin) before delegating to the NestJS domain service.
 * No `[key: string]: unknown` escape hatch, no `any`, no optional-everything.
 */
export interface RemixApplicationPort {
  /** PUBLIC. */
  getHomepageFamilies(): Promise<HomepageFamiliesResult>;
  /** PUBLIC. */
  getHomepageBelowFold(): Promise<HomepageBelowFoldResult>;
  /** ADMIN (level ≥ 7 or isAdmin). */
  listAdminOrders(query: AdminOrdersQuery): Promise<AdminOrdersResult>;
  /** ADMIN. */
  listAdminStaff(query: AdminStaffQuery): Promise<AdminStaffResult>;
  /** ADMIN. */
  getAdminStaffStatistics(): Promise<AdminStaffStatistics>;
}

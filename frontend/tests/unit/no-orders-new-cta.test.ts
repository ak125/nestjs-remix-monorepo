/**
 * Guard — no UI link to `/orders/new` while order creation is disabled.
 *
 * `/orders/new` intentionally answers **503** (loader + action throw) until an
 * authenticated, idempotent, audited order-create use case exists: the real
 * contract (idempotency `order_idempotency` + `create_order_atomic` RPC +
 * resume-token) lives in `OrdersController`, not in a service method a port
 * could call as-is.
 *
 * Why this guard: `AccountNavigation` shipped a "Nouvelle commande" CTA pointing
 * at that route, and it is rendered by `AccountLayout` on every `/account/*`
 * route — so every logged-in customer was one click away from a bare 503 error
 * page. Found during the PROD release-bundle audit
 * (`audit/2026-07-16-prod-bundle-da90deabd-a931205c.md`).
 *
 * Scope discipline: this guard covers the **CTA only**. It deliberately does not
 * touch the 503 route itself, nor anything in the order domain — re-enabling
 * creation is a separate, owner-gated chantier.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../app");

/** Recursively collect every .ts/.tsx source under frontend/app. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Matches a LINK TARGET only — `to="/orders/new"`, `to={"/orders/new"}`,
 * `href='/orders/new'`, ``to={`/orders/new`}``.
 *
 * Deliberately does NOT match a bare `'/orders/new'` string: `app/lib/auth.ts`
 * legitimately lists the path in its route-protection tables, the route module
 * must keep existing (it answers 503 on purpose), and prose mentioning the path
 * must stay allowed.
 */
const LINK_TO_ORDERS_NEW = /(?:\bto|\bhref)\s*=\s*\{?\s*["'`]\/orders\/new\b/;

describe("no /orders/new CTA while order creation is disabled (503)", () => {
  it("no component links to /orders/new", () => {
    const offenders = sourceFiles(APP_DIR)
      .filter((file) => LINK_TO_ORDERS_NEW.test(readFileSync(file, "utf8")))
      .map((file) => relative(APP_DIR, file));

    expect(
      offenders,
      `A UI link to /orders/new reappeared in: ${offenders.join(", ")}. ` +
        `That route answers 503 by design — linking to it sends real users to an ` +
        `error page. Do not re-add it until an authenticated, idempotent, audited ` +
        `order-create use case ships (order domain = separate owner-gated chantier).`,
    ).toEqual([]);
  });

  it("AccountNavigation keeps its other quick action (guard is not vacuous)", () => {
    const src = readFileSync(
      join(APP_DIR, "components/account/AccountNavigation.tsx"),
      "utf8",
    );

    // The component still exists and still renders a quick-actions CTA...
    expect(src).toContain("/account/messages/new");
    // ...but none of them targets the disabled route.
    expect(LINK_TO_ORDERS_NEW.test(src)).toBe(false);
  });
});

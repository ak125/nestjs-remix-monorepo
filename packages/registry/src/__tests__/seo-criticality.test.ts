import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import {
  SeoCriticalitySchema,
  classifyRoute,
  type SeoCriticality,
} from "../canonical/seo-criticality";

const CANON_PATH = path.resolve(
  __dirname,
  "../../../../.spec/00-canon/repository-registry/seo-criticality.yaml",
);

function loadCanon(): SeoCriticality {
  const raw = fs.readFileSync(CANON_PATH, "utf-8");
  const parsed = yaml.load(raw);
  return SeoCriticalitySchema.parse(parsed);
}

describe("seo-criticality.yaml — canon file integrity", () => {
  test("parses cleanly with Zod (no surperRefine breach)", () => {
    assert.doesNotThrow(() => loadCanon());
  });

  test("has 3 tiers + excluded section", () => {
    const c = loadCanon();
    assert.ok(c.tiers.tier0 !== undefined);
    assert.ok(c.tiers.tier1 !== undefined);
    assert.ok(c.tiers.tier2 !== undefined);
    assert.ok(c.excluded.routes.length > 0);
  });

  test("sampling weights sum to 1.0 ± 0.01", () => {
    const c = loadCanon();
    const sum =
      c.tiers.tier0.sampling_weight +
      c.tiers.tier1.sampling_weight +
      c.tiers.tier2.sampling_weight;
    assert.ok(Math.abs(sum - 1.0) < 0.01);
  });

  test("SLO is strictly decreasing tier0 > tier1 > tier2", () => {
    const c = loadCanon();
    assert.ok(c.tiers.tier0.slo > c.tiers.tier1.slo);
    assert.ok(c.tiers.tier1.slo > c.tiers.tier2.slo);
  });

  test("breach_threshold_minutes is strictly increasing", () => {
    const c = loadCanon();
    assert.ok(
      c.tiers.tier0.alerting.breach_threshold_minutes <
        c.tiers.tier1.alerting.breach_threshold_minutes,
    );
    assert.ok(
      c.tiers.tier1.alerting.breach_threshold_minutes <
        c.tiers.tier2.alerting.breach_threshold_minutes,
    );
  });

  test("admin/* is in excluded, never in any tier (anti-pattern guard)", () => {
    const c = loadCanon();
    assert.ok(c.excluded.routes.includes("admin/*"));
    const allTierRoutes = [
      ...c.tiers.tier0.routes,
      ...c.tiers.tier1.routes,
      ...c.tiers.tier2.routes,
    ];
    assert.equal(allTierRoutes.some((r) => r.includes("admin")), false);
  });

  test("api/* is in excluded (auth-only contract, monitored separately)", () => {
    const c = loadCanon();
    assert.ok(c.excluded.routes.includes("api/*"));
  });

  test("references ADR-064 in metadata", () => {
    const c = loadCanon();
    assert.equal(c.metadata.adr_reference, "ADR-064");
  });
});

describe("classifyRoute()", () => {
  const config: SeoCriticality = loadCanon();

  test("classifies /pieces/foo-1.html as tier0", () => {
    assert.equal(classifyRoute(config, "/pieces/foo-1.html"), "tier0");
  });

  test("classifies /constructeurs/bmw-33/serie-3-..-..html as tier0", () => {
    assert.equal(
      classifyRoute(config, "/constructeurs/bmw-33/serie-3-33028/328-i-58077.html"),
      "tier0",
    );
  });

  test("classifies /blog/post-x as tier1", () => {
    assert.equal(classifyRoute(config, "/blog/post-x"), "tier1");
  });

  test("classifies /blog-pieces-auto/conseils/amortisseur as tier1", () => {
    assert.equal(
      classifyRoute(config, "/blog-pieces-auto/conseils/amortisseur"),
      "tier1",
    );
  });

  test("classifies /support/contact as tier2", () => {
    assert.equal(classifyRoute(config, "/support/contact"), "tier2");
  });

  test("classifies /admin/dashboard as excluded (never any tier)", () => {
    assert.equal(classifyRoute(config, "/admin/dashboard"), "excluded");
  });

  test("classifies /api/catalog/families as excluded", () => {
    assert.equal(classifyRoute(config, "/api/catalog/families"), "excluded");
  });

  test("classifies /__test/force-503 as excluded", () => {
    assert.equal(classifyRoute(config, "/__test/force-503"), "excluded");
  });

  test("classifies /sitemap.xml as excluded", () => {
    assert.equal(classifyRoute(config, "/sitemap.xml"), "excluded");
  });

  test("classifies /robots.txt as excluded", () => {
    assert.equal(classifyRoute(config, "/robots.txt"), "excluded");
  });

  test("returns null for uncovered routes (caller must default)", () => {
    assert.equal(classifyRoute(config, "/totally-unknown-path"), null);
  });
});

describe("SeoCriticalitySchema — anti-pattern guards", () => {
  test("rejects admin/* placed in a tier", () => {
    const bad: unknown = {
      schemaVersion: "1.0.0",
      slo_window_minutes: 60,
      tiers: {
        tier0: {
          slo: 0.997,
          sampling_weight: 0.6,
          alerting: { breach_threshold_minutes: 5, channel: "pagerduty", auto_issue: true },
          routes: ["pieces/*", "admin/dangerous-route"],
        },
        tier1: {
          slo: 0.99,
          sampling_weight: 0.3,
          alerting: { breach_threshold_minutes: 15, channel: "slack", auto_issue: false },
          routes: ["blog/*"],
        },
        tier2: {
          slo: 0.98,
          sampling_weight: 0.1,
          alerting: { breach_threshold_minutes: 60, channel: "log", auto_issue: false },
          routes: ["support/*"],
        },
      },
      excluded: { routes: ["api/*"] },
      metadata: {
        adr_reference: "ADR-064",
        introduced_in_pr: "TBD",
        last_review: "2026-05-14",
        next_review_due: "2026-08-14",
      },
    };
    const r = SeoCriticalitySchema.safeParse(bad);
    assert.equal(r.success, false);
    if (!r.success) {
      assert.ok(r.error.issues.some((i) => i.message.includes("admin")));
    }
  });

  test("rejects SLO not strictly decreasing", () => {
    const bad: unknown = {
      schemaVersion: "1.0.0",
      slo_window_minutes: 60,
      tiers: {
        tier0: {
          slo: 0.98,
          sampling_weight: 0.6,
          alerting: { breach_threshold_minutes: 5, channel: "pagerduty", auto_issue: true },
          routes: ["pieces/*"],
        },
        tier1: {
          slo: 0.99,
          sampling_weight: 0.3,
          alerting: { breach_threshold_minutes: 15, channel: "slack", auto_issue: false },
          routes: ["blog/*"],
        },
        tier2: {
          slo: 0.98,
          sampling_weight: 0.1,
          alerting: { breach_threshold_minutes: 60, channel: "log", auto_issue: false },
          routes: ["support/*"],
        },
      },
      excluded: { routes: ["admin/*"] },
      metadata: {
        adr_reference: "ADR-064",
        introduced_in_pr: "TBD",
        last_review: "2026-05-14",
        next_review_due: "2026-08-14",
      },
    };
    const r = SeoCriticalitySchema.safeParse(bad);
    assert.equal(r.success, false);
  });

  test("rejects sampling weights not summing to 1.0", () => {
    const bad: unknown = {
      schemaVersion: "1.0.0",
      slo_window_minutes: 60,
      tiers: {
        tier0: {
          slo: 0.997,
          sampling_weight: 0.5,
          alerting: { breach_threshold_minutes: 5, channel: "pagerduty", auto_issue: true },
          routes: ["pieces/*"],
        },
        tier1: {
          slo: 0.99,
          sampling_weight: 0.3,
          alerting: { breach_threshold_minutes: 15, channel: "slack", auto_issue: false },
          routes: ["blog/*"],
        },
        tier2: {
          slo: 0.98,
          sampling_weight: 0.1,
          alerting: { breach_threshold_minutes: 60, channel: "log", auto_issue: false },
          routes: ["support/*"],
        },
      },
      excluded: { routes: ["admin/*"] },
      metadata: {
        adr_reference: "ADR-064",
        introduced_in_pr: "TBD",
        last_review: "2026-05-14",
        next_review_due: "2026-08-14",
      },
    };
    const r = SeoCriticalitySchema.safeParse(bad);
    assert.equal(r.success, false);
  });
});

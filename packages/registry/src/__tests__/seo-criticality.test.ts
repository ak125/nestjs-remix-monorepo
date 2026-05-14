import { describe, expect, it } from "vitest";
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
  it("parses cleanly with Zod (no surperRefine breach)", () => {
    expect(() => loadCanon()).not.toThrow();
  });

  it("has 3 tiers + excluded section", () => {
    const c = loadCanon();
    expect(c.tiers.tier0).toBeDefined();
    expect(c.tiers.tier1).toBeDefined();
    expect(c.tiers.tier2).toBeDefined();
    expect(c.excluded.routes.length).toBeGreaterThan(0);
  });

  it("sampling weights sum to 1.0 ± 0.01", () => {
    const c = loadCanon();
    const sum =
      c.tiers.tier0.sampling_weight +
      c.tiers.tier1.sampling_weight +
      c.tiers.tier2.sampling_weight;
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
  });

  it("SLO is strictly decreasing tier0 > tier1 > tier2", () => {
    const c = loadCanon();
    expect(c.tiers.tier0.slo).toBeGreaterThan(c.tiers.tier1.slo);
    expect(c.tiers.tier1.slo).toBeGreaterThan(c.tiers.tier2.slo);
  });

  it("breach_threshold_minutes is strictly increasing", () => {
    const c = loadCanon();
    expect(c.tiers.tier0.alerting.breach_threshold_minutes).toBeLessThan(
      c.tiers.tier1.alerting.breach_threshold_minutes,
    );
    expect(c.tiers.tier1.alerting.breach_threshold_minutes).toBeLessThan(
      c.tiers.tier2.alerting.breach_threshold_minutes,
    );
  });

  it("admin/* is in excluded, never in any tier (anti-pattern guard)", () => {
    const c = loadCanon();
    expect(c.excluded.routes).toContain("admin/*");
    const allTierRoutes = [
      ...c.tiers.tier0.routes,
      ...c.tiers.tier1.routes,
      ...c.tiers.tier2.routes,
    ];
    expect(allTierRoutes.some((r) => r.includes("admin"))).toBe(false);
  });

  it("api/* is in excluded (auth-only contract, monitored separately)", () => {
    const c = loadCanon();
    expect(c.excluded.routes).toContain("api/*");
  });

  it("references ADR-062 in metadata", () => {
    const c = loadCanon();
    expect(c.metadata.adr_reference).toBe("ADR-062");
  });
});

describe("classifyRoute()", () => {
  const config: SeoCriticality = loadCanon();

  it("classifies /pieces/foo-1.html as tier0", () => {
    expect(classifyRoute(config, "/pieces/foo-1.html")).toBe("tier0");
  });

  it("classifies /constructeurs/bmw-33/serie-3-..-..html as tier0", () => {
    expect(
      classifyRoute(config, "/constructeurs/bmw-33/serie-3-33028/328-i-58077.html"),
    ).toBe("tier0");
  });

  it("classifies /blog/post-x as tier1", () => {
    expect(classifyRoute(config, "/blog/post-x")).toBe("tier1");
  });

  it("classifies /blog-pieces-auto/conseils/amortisseur as tier1", () => {
    expect(classifyRoute(config, "/blog-pieces-auto/conseils/amortisseur")).toBe("tier1");
  });

  it("classifies /support/contact as tier2", () => {
    expect(classifyRoute(config, "/support/contact")).toBe("tier2");
  });

  it("classifies /admin/dashboard as excluded (never any tier)", () => {
    expect(classifyRoute(config, "/admin/dashboard")).toBe("excluded");
  });

  it("classifies /api/catalog/families as excluded", () => {
    expect(classifyRoute(config, "/api/catalog/families")).toBe("excluded");
  });

  it("classifies /__test/force-503 as excluded", () => {
    expect(classifyRoute(config, "/__test/force-503")).toBe("excluded");
  });

  it("classifies /sitemap.xml as excluded", () => {
    expect(classifyRoute(config, "/sitemap.xml")).toBe("excluded");
  });

  it("classifies /robots.txt as excluded", () => {
    expect(classifyRoute(config, "/robots.txt")).toBe("excluded");
  });

  it("returns null for uncovered routes (caller must default)", () => {
    expect(classifyRoute(config, "/totally-unknown-path")).toBeNull();
  });
});

describe("SeoCriticalitySchema — anti-pattern guards", () => {
  it("rejects admin/* placed in a tier", () => {
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
        adr_reference: "ADR-062",
        introduced_in_pr: "TBD",
        last_review: "2026-05-14",
        next_review_due: "2026-08-14",
      },
    };
    const r = SeoCriticalitySchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes("admin"))).toBe(true);
    }
  });

  it("rejects SLO not strictly decreasing", () => {
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
        adr_reference: "ADR-062",
        introduced_in_pr: "TBD",
        last_review: "2026-05-14",
        next_review_due: "2026-08-14",
      },
    };
    const r = SeoCriticalitySchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("rejects sampling weights not summing to 1.0", () => {
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
        adr_reference: "ADR-062",
        introduced_in_pr: "TBD",
        last_review: "2026-05-14",
        next_review_due: "2026-08-14",
      },
    };
    const r = SeoCriticalitySchema.safeParse(bad);
    expect(r.success).toBe(false);
  });
});

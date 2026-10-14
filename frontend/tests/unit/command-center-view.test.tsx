import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import snapshot from "../../../audit/registry/command-center-snapshot.json";
import { CommandCenterResponseV2Schema } from "../../../packages/registry/src/command-center/snapshot";
import { DepartmentReports } from "../../app/components/command-center/DepartmentReports";
import { buildDepartmentReports } from "../../../backend/src/modules/admin/services/command-center-action-rules/department-report.rules";
import { GlobalHealthBar } from "../../app/components/command-center/GlobalHealthBar";
import { ModuleGrid } from "../../app/components/command-center/ModuleGrid";
vi.mock(
  "@repo/registry",
  async () => await import("../../../packages/registry/src/index"),
);
function response() {
  return CommandCenterResponseV2Schema.parse({
    ...snapshot,
    departments: snapshot.departments.map((d) => ({
      ...d,
      health_score_current: d.health_score_base,
      live_caps_applied: [],
    })),
    mode: "full",
    degraded: false,
    action_queue: [],
    department_reports: [],
    generated_at: "2026-10-10T00:00:00Z",
    git_sha: "a".repeat(40),
    stale_status: "UNKNOWN",
    validation_status: "UNKNOWN",
    global_status: { level: "WARNING", verdict: "PARTIAL_READY", reasons: [] },
  });
}
afterEach(cleanup);
it.each([
  {
    id: "payments_kept",
    value: 0,
    status: "CRITICAL" as const,
    reason: /aucun paiement gardé/i,
  },
  {
    id: "pages_generating_atc",
    value: 44,
    status: "UNKNOWN" as const,
    reason: /aucune cible/i,
  },
  {
    id: "diagnostic_to_product",
    value: 8,
    status: "UNKNOWN" as const,
    reason: /aucune cible/i,
  },
])(
  "separates the measured $id score from its priority action",
  ({ id, value, status, reason }) => {
    const data = response();
    data.department_reports = buildDepartmentReports({
      departments: [
        { id: "test", label: "Département", priority: "P0", kpi_primary: id },
      ],
      measures: [
        {
          kpi: {
            id,
            label: "Indicateur",
            value,
            status,
            source: "db",
            certified: true,
          },
          window_days: 30,
          previous_value: null,
          better: "higher",
        },
      ],
      actions: [
        {
          id: "test:repair",
          department: "test",
          title: "Fiabiliser la source",
          reason: "Source PARTIAL",
          next_step: "Vérifier les événements récents.",
          source: "data",
          action_type: "repair",
          impact: 5,
          urgency: 5,
          data_confidence: 90,
          effort: 2,
          risk: 2,
          score: 15,
          evidence: [],
          details: null,
          owner_go_required: false,
        },
      ],
      as_of: data.generated_at,
    });
    render(<DepartmentReports data={data} />);
    expect(
      within(screen.getByRole("region", { name: "Mesure" })).getByText(
        `Indicateur — ${value}`,
      ),
    ).toBeTruthy();
    const score = within(
      screen.getByRole("region", { name: "Cause du score" }),
    );
    expect(score.getByText(reason)).toBeTruthy();
    expect(score.queryByText("Source PARTIAL")).toBeNull();
    const action = within(
      screen.getByRole("region", { name: "Action prioritaire" }),
    );
    expect(action.getByText("Fiabiliser la source")).toBeTruthy();
    expect(action.getByText("Source PARTIAL")).toBeTruthy();
    expect(action.getByText("Vérifier les événements récents.")).toBeTruthy();
    expect(screen.getByText("0 attendent votre feu vert")).toBeTruthy();
  },
);

it("shows an empty diagnostic sample without a red score or an owner gate", () => {
  const data = response();
  data.department_reports = [
    {
      department: "diagnostic",
      label: "Diagnostic",
      priority: "P1",
      period: { as_of: data.generated_at, window_days: 30 },
      kpi: {
        id: "diagnostic_to_product",
        label: "Parcours vers un produit",
        measure: "MESURE",
        value: 0,
        unit: "/0",
        previous_value: null,
      },
      score: "NON_MESURE",
      evolution: "INCONNUE",
      decision: "IMPROVE",
      gap: "Aucune session exploitable sur la période.",
      probable_cause: null,
      risk: "FAIBLE",
      owner_go_required: false,
      next_evidence:
        "Vérifier la collecte et obtenir une période avec des sessions exploitables.",
      evidence: [],
      open_action_ids: [],
    },
  ];
  render(<DepartmentReports data={data} />);
  expect(screen.getByText("Parcours vers un produit — 0/0")).toBeTruthy();
  expect(
    screen.getByText("Aucune session exploitable sur la période."),
  ).toBeTruthy();
  expect(screen.getByText(/Vérifier la collecte/)).toBeTruthy();
  expect(screen.getByText(/pas de comparaison/)).toBeTruthy();
  expect(screen.getByText("0 attendent votre feu vert")).toBeTruthy();
  expect(screen.getByText("0 non mesurés")).toBeTruthy();
  expect(screen.getByText("Performance non évaluée")).toBeTruthy();
  expect(screen.queryByText("Critique")).toBeNull();
  expect(screen.queryByText("Réutiliser")).toBeNull();
});
it("keeps measured values visible without a green performance or reuse decision", () => {
  const data = response();
  data.department_reports = [
    {
      department: "diagnostic",
      label: "Diagnostic",
      priority: "P1",
      period: { as_of: data.generated_at, window_days: 30 },
      kpi: {
        id: "diagnostic_to_product",
        label: "Parcours vers un produit",
        measure: "MESURE",
        value: 1,
        unit: "/5000",
        previous_value: null,
      },
      score: "NON_MESURE",
      evolution: "INCONNUE",
      decision: "IMPROVE",
      gap: "Performance non évaluée",
      probable_cause: null,
      risk: "FAIBLE",
      owner_go_required: true,
      next_evidence: "Faire valider le critère de réussite par l’owner.",
      evidence: [],
      open_action_ids: [],
    },
  ];
  render(<DepartmentReports data={data} />);
  expect(screen.getByText("Parcours vers un produit — 1/5000")).toBeTruthy();
  expect(
    screen.getByText("Performance non évaluée", { selector: "span" }),
  ).toBeTruthy();
  expect(screen.getByText("1 performance non évaluée")).toBeTruthy();
  expect(screen.getByText("0 non mesurés")).toBeTruthy();
  expect(screen.getByText("Améliorer")).toBeTruthy();
  expect(screen.getByText("1 attendent votre feu vert")).toBeTruthy();
  expect(screen.queryByText("Fort")).toBeNull();
  expect(screen.queryByText("Réutiliser")).toBeNull();
  expect(screen.queryByText("Non mesuré")).toBeNull();
});

it("distinguishes absent and unreadable measurements from unassessed performance", () => {
  const data = response();
  data.department_reports = (["SANS_PRODUCTEUR", "ILLISIBLE"] as const).map(
    (measure) => ({
      department: measure,
      label: measure,
      priority: "P1",
      period: { as_of: data.generated_at, window_days: null },
      kpi: {
        id: measure,
        label: "KPI",
        measure,
        value: null,
        unit: null,
        previous_value: null,
      },
      score: "NON_MESURE",
      evolution: "INCONNUE",
      decision: "IMPROVE",
      gap: null,
      probable_cause: null,
      risk: "FAIBLE",
      owner_go_required: false,
      next_evidence: "Rétablir la mesure.",
      evidence: [],
      open_action_ids: [],
    }),
  );
  render(<DepartmentReports data={data} />);
  expect(screen.getByText("KPI — non mesuré")).toBeTruthy();
  expect(screen.getByText("KPI — source illisible")).toBeTruthy();
  expect(
    screen.getAllByText("Explication du score indisponible pour ce rapport."),
  ).toHaveLength(2);
  expect(
    screen.queryByRole("region", { name: "Action prioritaire" }),
  ).toBeNull();
  expect(screen.getByText("2 non mesurés")).toBeTruthy();
  expect(screen.queryByText("Performance non évaluée")).toBeNull();
});
it("separates unassessed human responsibilities from software certification", () => {
  render(<GlobalHealthBar data={response()} />);
  const family = screen.getByRole("group", { name: "AI-Governance" });
  expect(
    within(family).getByLabelText("Certification structurelle : CERTIFIED"),
  ).toBeTruthy();
  expect(
    within(family).getByText("3 responsabilités humaines non évaluées"),
  ).toBeTruthy();
  expect(within(family).getByText("6 dépt.")).toBeTruthy();
});
it.each(["UNKNOWN", "BROKEN"] as const)(
  "keeps %s software evidence visible in a mixed family",
  (certification) => {
    const data = response();
    data.departments.find((d) => d.id === "governance")!.certification =
      certification;
    render(<GlobalHealthBar data={data} />);
    expect(
      within(
        screen.getByRole("group", { name: "AI-Governance" }),
      ).getByLabelText(`Certification structurelle : ${certification}`),
    ).toBeTruthy();
  },
);
it("a family without software capabilities never displays CERTIFIED", () => {
  const data = response();
  data.departments = data.departments.filter(
    (d) => d.operating_mode === "human",
  );
  render(<GlobalHealthBar data={data} />);
  expect(
    screen.queryByLabelText("Certification structurelle : CERTIFIED"),
  ).toBeNull();
  expect(
    screen.getAllByText("Aucune capacité logicielle rattachée"),
  ).toHaveLength(2);
});
it("still includes a human department with a software capability", () => {
  const data = response();
  const legal = data.departments.find((d) => d.id === "legal")!;
  legal.capabilities = ["staff"];
  legal.certification = "BROKEN";
  render(<GlobalHealthBar data={data} />);
  const family = screen.getByRole("group", { name: "AI-Governance" });
  expect(
    within(family).getByLabelText("Certification structurelle : BROKEN"),
  ).toBeTruthy();
  expect(
    within(family).getByText("2 responsabilités humaines non évaluées"),
  ).toBeTruthy();
});
it("sorts all 24 cards by business number and distinguishes human responsibility", () => {
  render(<ModuleGrid data={response()} />);
  const cards = screen.getAllByRole("article");
  expect(cards).toHaveLength(24);
  expect(cards.map((c) => c.getAttribute("data-business-number"))).toEqual(
    Array.from({ length: 24 }, (_, i) => String(i + 1)),
  );
  const legal = cards[17];
  expect(within(legal).getByText("Responsable non nommé")).toBeTruthy();
  expect(within(legal).getByText(/activité humaine non évaluée/)).toBeTruthy();
  expect(within(legal).queryByRole("progressbar")).toBeNull();
  expect(within(cards[23]).getByText("People, Formation & Doc")).toBeTruthy();
  expect(within(cards[23]).getByText("staff")).toBeTruthy();
  expect(within(cards[23]).getByRole("progressbar")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});
it("profile links use the fixed repository, full SHA and exact anchor", () => {
  render(<ModuleGrid data={response()} />);
  const links = screen.getAllByRole("link");
  expect(links).toHaveLength(24);
  expect(links[17].getAttribute("href")).toBe(
    `https://github.com/ak125/nestjs-remix-monorepo/blob/${"a".repeat(40)}/audit/automecanik-departments-map.md#department-legal`,
  );
});
it.each([null, "short", "../main"])(
  "missing or unsafe SHA %s does not create a link",
  (sha) => {
    const cc = response();
    cc.git_sha = sha;
    render(<ModuleGrid data={cc} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(
      screen.getAllByText("Fiche indisponible pour cette révision"),
    ).toHaveLength(24);
  },
);
it.each([
  "https://evil.test",
  "../path",
  "audit/automecanik-departments-map.md#department-other",
])("hostile or mismatched profile %s is not linked", (ref) => {
  const cc = response();
  cc.departments[0].profile_ref = ref;
  render(<ModuleGrid data={cc} />);
  expect(screen.getAllByRole("link")).toHaveLength(23);
});

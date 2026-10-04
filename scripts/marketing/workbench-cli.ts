import { readFileSync } from "node:fs";
import {
  prepareScenario,
  explainSegment,
  summarizeSegment,
  planOpportunities,
  importPreview,
  prepareMediaPlan,
} from "../../backend/src/modules/marketing/services/marketing-preparation";
import {
  arbitrate,
  capabilities,
  deliveryReadiness,
  inspectExecution,
  privacyPreview,
} from "../../backend/src/modules/marketing/services/marketing-operations";
import {
  assignExperiment,
  capacityProjection,
  economicReport,
  experimentReport,
  scoreContacts,
  engagementReport,
} from "../../backend/src/modules/marketing/services/marketing-measurement";
import type { SegmentRule } from "../../backend/src/modules/marketing/dto/marketing-workbench.dto";

const reactivationSegment: SegmentRule = {
  op: "all",
  rules: [
    { op: "inactive", days: 180 },
    { op: "not", rule: { op: "audience", value: "professional" } },
  ],
};

export function runWorkbench(args: string[]) {
  const w = JSON.parse(
    readFileSync(__dirname + "/fixtures/workbench.synthetic.json", "utf8"),
  );
  const command = args[0];
  if (command === "--scenario") {
    if (args.length !== 2 || !/^J(0[1-9]|1[0-8])$/.test(args[1]))
      throw new Error("INVALID_ARGUMENT");
    return prepareScenario(w, args[1]);
  }
  if (args.length !== 1) throw new Error("INVALID_ARGUMENT");
  switch (command) {
    case "--help":
      return {
        version: "2.0.0",
        usage:
          "Run from the checked repository root; fixed synthetic fixtures only",
        commands: [
          "--scenario J01..J18",
          "--all-scenarios",
          "--segment",
          "--opportunities",
          "--import-preview",
          "--operations",
          "--report",
          "--capabilities",
          "--inactive-days N (V1)",
          "--cancel (V1)",
        ],
        network: false,
        live_mode: false,
        cron_activation: false,
      };
    case "--capabilities":
      return capabilities();
    case "--all-scenarios":
      return w.scenarios.map((s: { id: string }) => prepareScenario(w, s.id));
    case "--segment":
      return explainSegment(w, reactivationSegment);
    case "--opportunities":
      return {
        opportunities: planOpportunities(w, [
          {
            source_ref: "synthetic-wiki",
            objective: "qualified_request",
            audience: "private",
            stop_condition: "Source invalide ou page non vérifiée",
            hypothesis: "Tester un conseil sourcé et une demande qualifiée",
          },
          {
            source_ref: "synthetic-public",
            objective: "reduce_selection_errors",
            audience: "professional",
            stop_condition: "Signal public non confirmé",
            hypothesis: "Vérifier le besoin avant de préparer le brief",
          },
        ]),
        media_plan: prepareMediaPlan(w, {
          account: "synthetic-account",
          source_ref: "synthetic-wiki",
          landing_source_ref: "synthetic-business",
          format: "paid",
          objective: "qualified_request",
          audience: "declared_private",
          budget_minor: "10000",
          currency: "EUR",
          media_rights_verified: true,
          stop_condition: "Source invalide ou réception non démontrée",
          starts_at: "2026-10-03T10:00:00Z",
          ends_at: "2026-10-05T10:00:00Z",
        }),
      };
    case "--import-preview": {
      const r = importPreview(w.context, w.contacts, [
        w.contacts[0],
        w.contacts[0],
        { ...w.contacts[0], id: "synthetic-ambiguous" },
      ]);
      return {
        ...r,
        contacts: r.contacts.map((c) => ({
          id: c.id,
          project: c.project,
          opposed: c.opposed,
          erased: c.erased,
        })),
      };
    }
    case "--operations": {
      const proposal = (id: string, priority: number) => ({
        id,
        contact_id: "synthetic-contact-1",
        account: "synthetic-account",
        channel: "email",
        priority,
        template: "synthetic-template",
        version: "2",
        rights_verified: true,
      });
      return {
        arbitration: arbitrate(
          w,
          {
            account: "synthetic-account",
            timezone: "Europe/Paris",
            window: "calendar",
            hours: 24,
            contact_limit: 1,
            account_limit: 2,
            channel_limit: 2,
            start_hour: 8,
            end_hour: 20,
            max_cost_minor: "20",
            unit_cost_minor: "5",
          },
          [
            proposal("synthetic-campaign-a", 1),
            proposal("synthetic-campaign-b", 2),
          ],
          [],
        ),
        execution: inspectExecution(w.context, {
          project: "automecanik",
          environment: "DEV",
          account: "synthetic-account",
          operation: "prepare",
          family: "J11",
          template: "synthetic-template",
          version: "2",
          audience_rule: "synthetic-rule",
          max_contacts: 10,
          max_cost_minor: "20",
          timezone: "Europe/Paris",
          expires_at: "2026-10-03T00:00:00Z",
          suspended: false,
        }),
        delivery: deliveryReadiness({
          spf: "unknown",
          dkim: "unknown",
          dmarc: "unknown",
          alignment: "unknown",
          unsubscribe: "unknown",
          sender: "unknown",
          feedback: "unknown",
        }),
        privacy: privacyPreview(w, "synthetic-contact-1", "erase"),
        capabilities: capabilities(),
      };
    }
    case "--report": {
      const d = JSON.parse(
        readFileSync(__dirname + "/fixtures/economics.synthetic.json", "utf8"),
      );
      const assignments = assignExperiment(
        "synthetic-experiment",
        "2",
        Array.from({ length: 60 }, (_, i) => `synthetic-unit-${i}`),
      );
      return {
        audience: summarizeSegment(w, reactivationSegment),
        economics: economicReport(w.context, d),
        engagement: engagementReport(w),
        scores: scoreContacts(w, {
          version: "hypothesis-1",
          half_life_days: 30,
          fit_weight: 20,
          verified_click_weight: 5,
          purchase_weight: 10,
        }),
        experiment: experimentReport(
          assignments,
          assignments.map((x) => ({ ...x, converted: false })),
          100,
        ),
        capacity: capacityProjection({
          historical_units: 100,
          period_days: 30,
          factors: [0.8, 1, 1.2],
          capacity_units: 90,
          unit_contribution_minor: null,
          verified_dates: false,
        }),
      };
    }
    default:
      throw new Error("INVALID_ARGUMENT");
  }
}

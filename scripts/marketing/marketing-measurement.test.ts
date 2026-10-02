import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  economicReport,
  assignExperiment,
  experimentReport,
  scoreContacts,
  capacityProjection,
  engagementReport,
} from "../../backend/src/modules/marketing/services/marketing-measurement";
const fixture = () =>
  JSON.parse(
    readFileSync(__dirname + "/fixtures/workbench.synthetic.json", "utf8"),
  );

test("C08 verified purchase events update recency without fabricating ledger value or frequency", () => {
  const w = fixture(),
    c = w.contacts[0];
  w.events = w.events.filter((e: any) => e.kind !== "purchase");
  const config = {
    version: "hypothesis-1",
    half_life_days: 30,
    fit_weight: 20,
    verified_click_weight: 5,
    purchase_weight: 10,
  };
  const before = scoreContacts(w, config).find((x) => x.id === c.id)!;
  const event = {
    ...w.events[0],
    id: "synthetic-new-purchase",
    object_id: "synthetic-other-order",
    kind: "purchase",
    occurred_at: "2026-10-01T10:00:00Z",
    received_at: w.context.data_at,
  };
  w.events.push(event, { ...event });
  const after = scoreContacts(w, config).find((x) => x.id === c.id)!;
  assert.equal(after.recency_days, 1);
  assert.equal(after.recency_scope, "purchase_history_and_verified_events");
  assert.equal(after.purchase_metrics_scope, "supplied_purchase_history_only");
  assert.equal(after.frequency, before.frequency);
  assert.deepEqual(after.amounts, before.amounts);
  assert.deepEqual(after.contributions, before.contributions);
  assert.equal(after.score, before.score);
  c.history_complete = false;
  assert.equal(
    scoreContacts(w, config).find((x) => x.id === c.id)?.recency_days,
    null,
  );
});
const order = () => ({
  id: "synthetic-order",
  contact_id: "synthetic-contact-1",
  at: "2026-09-30T12:00:00Z",
  currency: "EUR",
  revenue_ex_tax_minor: "10000",
  tax_minor: "2000",
  cost_ex_tax_minor: "4000",
  campaign_id: "synthetic-campaign",
  verified: true,
});
const data = () => ({
  from: "2026-09-01T00:00:00Z",
  to: "2026-10-02T11:55:00Z",
  orders: [order()],
  refunds: [
    {
      id: "synthetic-refund",
      order_id: "synthetic-order",
      at: "2026-10-01T10:00:00Z",
      revenue_ex_tax_minor: "2000",
      tax_minor: "400",
      cost_recovered_minor: "500",
      currency: "EUR",
    },
  ],
  marketing_costs: [
    {
      id: "synthetic-cost",
      at: "2026-09-30T12:00:00Z",
      currency: "EUR",
      amount_ex_tax_minor: "1000",
    },
  ],
  costs_complete: true,
  eligible_contacts: 10,
  history_complete: true,
});

test("T15 costs are dated and restricted to the report period with exact boundaries", () => {
  const d = data();
  const dated = {
    ...d,
    marketing_costs: [
      { ...d.marketing_costs[0], id: "synthetic-start", at: d.from },
      {
        ...d.marketing_costs[0],
        id: "synthetic-before",
        at: "2026-08-31T23:59:59.999Z",
      },
      { ...d.marketing_costs[0], id: "synthetic-end", at: d.to },
      {
        ...d.marketing_costs[0],
        id: "synthetic-outside-usd",
        at: d.to,
        currency: "USD",
      },
    ],
  };
  const r = economicReport(fixture().context, dated);
  assert.equal(r.currencies.length, 1);
  assert.equal(r.currencies[0].marketing_cost_ex_tax_minor, "1000");
  assert.equal(r.currencies[0].contribution_ex_tax_minor, "3500");
  assert.deepEqual(r.source_ids.costs, ["synthetic-start"]);
});

test("T15 undated or future costs cannot be silently assigned to the report", () => {
  const d = data();
  const undated: any = structuredClone(d);
  delete undated.marketing_costs[0].at;
  assert.throws(
    () => economicReport(fixture().context, undated),
    /INVALID_WORKBENCH_INPUT/,
  );
  assert.throws(
    () =>
      economicReport(fixture().context, {
        ...d,
        marketing_costs: [
          { ...d.marketing_costs[0], at: "2026-10-02T11:59:00Z" },
        ],
      }),
    /FUTURE_WORKBENCH_DATA/,
  );
});

test("T15 refreshed refund reports identify the data snapshot separately from the sales period", () => {
  const d = data(),
    c = fixture().context;
  const first = economicReport(c, d);
  assert.equal(first.snapshot_at, c.data_at);
  assert.equal(first.marketing_cost_scope, "dated_costs_in_report_period");
  const later = {
    ...c,
    as_of: "2026-10-03T12:00:00Z",
    data_at: "2026-10-03T11:55:00Z",
  };
  d.refunds.push({
    ...d.refunds[0],
    id: "synthetic-later-refund",
    at: "2026-10-03T10:00:00Z",
  });
  const refreshed = economicReport(later, d);
  assert.equal(refreshed.snapshot_at, later.data_at);
  assert.deepEqual(refreshed.period, first.period);
  assert.equal(refreshed.currencies[0].net_revenue_ex_tax_minor, "6000");
});

test("T15 cost deduplication and currency separation preserve exact amounts even without sales", () => {
  const d = data(),
    cost = d.marketing_costs[0];
  d.marketing_costs.push(
    { ...cost },
    {
      ...cost,
      id: "synthetic-usd-cost",
      currency: "USD",
      amount_ex_tax_minor: "9007199254740993",
    },
  );
  const r = economicReport(fixture().context, d);
  assert.equal(
    r.currencies.find((x) => x.currency === "EUR")?.marketing_cost_ex_tax_minor,
    "1000",
  );
  assert.deepEqual(
    r.currencies.find((x) => x.currency === "USD"),
    {
      currency: "USD",
      net_revenue_ex_tax_minor: "0",
      net_tax_minor: "0",
      marketing_cost_ex_tax_minor: "9007199254740993",
      contribution_ex_tax_minor: "-9007199254740993",
      costs_complete: true,
    },
  );
  const unknown = economicReport(fixture().context, {
    ...d,
    costs_complete: false,
  });
  assert.ok(
    unknown.currencies.every((x) => x.contribution_ex_tax_minor === null),
  );
  d.marketing_costs.push({ ...cost, at: "2026-08-01T00:00:00Z" });
  assert.throws(
    () => economicReport(fixture().context, d),
    /CONFLICTING_ECONOMIC_EVENT/,
  );
});

test("T16 duplicate observations cannot hide missing participants", () => {
  const a = [
    { id: "synthetic-a", group: "A" },
    { id: "synthetic-b", group: "B" },
  ];
  const observed = { ...a[0], converted: true };
  const r = experimentReport(a, [observed, observed], 30);
  assert.ok(r.reasons.includes("missing_outcomes"));
  assert.equal(r.groups.find((g) => g.group === "A")?.observed, 1);
});

test("T15 refunds outside the selected cohort are validated and uncovered report periods rejected", () => {
  const d = data(),
    c = fixture().context;
  d.orders[0].at = "2026-08-01T00:00:00Z";
  d.refunds[0].revenue_ex_tax_minor = "10001";
  assert.throws(() => economicReport(c, d), /REFUND_EXCEEDS_ORDER/);
  c.data_at = "2026-10-02T11:00:00Z";
  assert.throws(() => economicReport(c, data()), /INVALID_REPORT_PERIOD/);
});

test("T15 fully refunded repeat orders remain gross but leave the positive net revenue cohort", () => {
  const d = data();
  d.orders.push({ ...order(), id: "synthetic-second" });
  d.refunds.push({
    ...d.refunds[0],
    id: "synthetic-full-refund",
    order_id: "synthetic-second",
    revenue_ex_tax_minor: "10000",
    tax_minor: "2000",
    cost_recovered_minor: "4000",
  });
  const r = economicReport(fixture().context, d);
  assert.equal(r.distinct_orders, 2);
  assert.equal(r.second_purchase_buyers, 1);
  assert.deepEqual(r.positive_net_revenue, {
    distinct_orders: 1,
    distinct_buyers: 1,
    conversion_rate: 0.1,
    second_purchase_buyers: 0,
    second_purchase_rate: 0,
  });
  d.history_complete = false;
  assert.equal(
    economicReport(fixture().context, d).positive_net_revenue
      .second_purchase_buyers,
    null,
  );
  d.refunds[0].revenue_ex_tax_minor = "10000";
  d.refunds[0].tax_minor = "2000";
  const empty = economicReport(fixture().context, d).positive_net_revenue;
  assert.equal(empty.distinct_buyers, 0);
  assert.equal(empty.conversion_rate, 0);
  assert.equal(empty.second_purchase_rate, null);
});
test("T15 business conversion dedup and partial refunds produce exact contribution and explicit denominator", () => {
  const d = data();
  d.orders.push(order());
  const r = economicReport(fixture().context, d);
  assert.equal(r.currencies[0].net_revenue_ex_tax_minor, "8000");
  assert.equal(r.currencies[0].contribution_ex_tax_minor, "3500");
  assert.equal(r.distinct_orders, 1);
  assert.equal(r.conversion_rate, 0.1);
  assert.equal(r.causal_effect, "not_estimated");
});
test("T15 unknown costs are not zero, over-refund and currency mixing rejected", () => {
  const d: any = data();
  d.orders[0].cost_ex_tax_minor = null;
  assert.equal(
    economicReport(fixture().context, d).currencies[0]
      .contribution_ex_tax_minor,
    null,
  );
  d.refunds[0].revenue_ex_tax_minor = "10001";
  assert.throws(
    () => economicReport(fixture().context, d),
    /REFUND_EXCEEDS_ORDER/,
  );
  d.refunds[0].revenue_ex_tax_minor = "2000";
  d.refunds[0].currency = "USD";
  assert.throws(() => economicReport(fixture().context, d), /REFUND_CURRENCY/);
});
test("T16 assignments are stable, holdout exists, insufficient and contaminated experiments never win", () => {
  const ids = Array.from({ length: 100 }, (_, i) => `synthetic-contact-${i}`);
  const a = assignExperiment("synthetic-experiment", "2", ids);
  assert.deepEqual(
    a,
    assignExperiment("synthetic-experiment", "2", ids.reverse()),
  );
  assert.ok(a.some((x) => x.group === "holdout"));
  assert.ok(a.some((x) => x.group === "A"));
  assert.ok(a.some((x) => x.group === "B"));
  const observations = a.map((x) => ({ ...x, converted: false }));
  const r = experimentReport(a, observations, 100);
  assert.equal(r.verdict, "inconclusive");
  assert.throws(
    () =>
      experimentReport(
        a,
        [
          ...observations,
          {
            ...observations[0],
            group: observations[0].group === "A" ? "B" : "A",
          },
        ],
        100,
      ),
    /EXPERIMENT_CONTAMINATION/,
  );
});
test("C08 scoring reports an unknown audience even when its declaration flag is true", () => {
  for (const [audience, declared, fit, missing] of [
    ["private", true, 20, false],
    ["professional", true, 20, false],
    ["unknown", true, 0, true],
    ["private", false, 0, true],
    ["professional", false, 0, true],
    ["unknown", false, 0, true],
  ] as const) {
    const w = fixture();
    w.contacts[0].audience = audience;
    w.contacts[0].audience_declared = declared;
    const r = scoreContacts(w, {
      version: "hypothesis-1",
      half_life_days: 30,
      fit_weight: 20,
      verified_click_weight: 0,
      purchase_weight: 0,
    })[0];
    assert.equal(
      r.contributions.find((x) => x.name === "declared_fit")?.value,
      fit,
    );
    assert.equal(
      r.missing.includes("declared_audience"),
      missing,
      `${audience}/${declared}`,
    );
    assert.equal(r.calibration, "hypothesis");
    assert.equal(r.predicted_ltv, null);
  }
});

test("C08 scoring shows contributions and missing history without predictive claims", () => {
  const r = scoreContacts(fixture(), {
    version: "hypothesis-1",
    half_life_days: 30,
    fit_weight: 20,
    verified_click_weight: 5,
    purchase_weight: 10,
  });
  assert.equal(
    r.find((x) => x.id === "synthetic-contact-unknown")?.score,
    null,
  );
  assert.ok(r[0].contributions.length);
  assert.equal(r[0].calibration, "hypothesis");
  assert.equal(r[0].predicted_ltv, null);
});
test("C25 capacity projection bounds hypotheses and preserves unknown profitability", () => {
  const r = capacityProjection({
    historical_units: 100,
    period_days: 30,
    factors: [0.8, 1, 1.2],
    capacity_units: 90,
    unit_contribution_minor: null,
    verified_dates: false,
  });
  assert.deepEqual(
    r.scenarios.map((x) => x.served_units),
    [80, 90, 90],
  );
  assert.equal(r.scheduled, false);
  assert.equal(r.revenue_forecast, null);
});
test("C22 C26 bots and unreliable opens remain separate; duplicate alerts group by fact", () => {
  const w = fixture(),
    e = w.events[0];
  w.events.push(
    { ...e, id: "synthetic-click", kind: "click" },
    { ...e, id: "synthetic-bot", kind: "click", bot: true },
    { ...e, id: "synthetic-open", kind: "open" },
  );
  const r = engagementReport(w);
  assert.equal(r.verified_nonbot_clicks, 1);
  assert.equal(r.bot_clicks, 1);
  assert.equal(r.opens_unreliable, 1);
  assert.equal(r.open_rate, null);
  assert.equal(r.alerts.length, 1);
  assert.equal(r.alerts[0].fact_count, 1);
  assert.equal(r.notifications_sent, 0);
});

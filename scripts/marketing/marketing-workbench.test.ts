import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createHash } from "node:crypto";
import path from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  prepareScenario,
  importPreview,
  explainSegment,
  summarizeSegment,
  renderCampaign,
  recommendProducts,
  planOpportunities,
  prepareMediaPlan,
  eligibility,
  uniqueEvents,
} from "../../backend/src/modules/marketing/services/marketing-preparation";
import { workspace } from "../../backend/src/modules/marketing/dto/marketing-workbench.dto";
import { runWorkbench } from "./workbench-cli";
const fixture = () =>
  JSON.parse(
    readFileSync(__dirname + "/fixtures/workbench.synthetic.json", "utf8"),
  );

test("J08 explains maintenance waiting until the exact due instant", () => {
  for (const [due, expected] of [
    ["2026-10-02T12:00:00.001Z", "defer"],
    ["2026-10-02T12:00:00Z", "prepare"],
    ["2026-10-02T11:59:59.999Z", "prepare"],
  ]) {
    const w = fixture(),
      s = w.scenarios.find((s: any) => s.id === "J08");
    s.facts.due_at = due;
    const r = prepareScenario(w, "J08");
    assert.equal(r.decision, expected, due);
    assert.deepEqual(
      r.reasons,
      expected === "defer" ? ["maintenance_not_due"] : [],
    );
    if (expected === "defer") {
      assert.equal(r.content, null);
      assert.equal(r.brief, null);
    } else assert.ok(r.brief);
  }
});

test("J08 reports each pending time constraint without releasing the other", () => {
  for (const maintenancePending of [false, true])
    for (const delayPending of [false, true]) {
      const w = fixture(),
        s = w.scenarios.find((s: any) => s.id === "J08");
      s.trigger_at = delayPending
        ? "2026-10-01T12:00:00.001Z"
        : "2026-10-01T12:00:00Z";
      s.delay_hours = 24;
      s.facts.due_at = maintenancePending
        ? "2026-10-02T12:00:00.001Z"
        : "2026-10-02T12:00:00Z";
      const r = prepareScenario(w, "J08");
      assert.equal(
        r.decision,
        maintenancePending || delayPending ? "defer" : "prepare",
      );
      assert.deepEqual(r.reasons, [
        ...(maintenancePending ? ["maintenance_not_due"] : []),
        ...(delayPending ? ["delay_not_elapsed"] : []),
      ]);
    }
});

test("J08 stops prevail over both pending time constraints", () => {
  for (const stop of ["cancelled", "removed", "completed", "unverified"]) {
    const w = fixture(),
      s = w.scenarios.find((s: any) => s.id === "J08");
    s.trigger_at = "2026-10-01T12:00:00.001Z";
    s.delay_hours = 24;
    s.facts.due_at = "2026-10-02T12:00:00.001Z";
    if (stop === "cancelled") s.facts.status = "cancelled";
    if (stop === "unverified") s.facts.receipt_verified = false;
    if (stop === "removed") w.contacts[0].vehicles = [];
    if (stop === "completed")
      w.events.push({
        ...w.events[0],
        id: "synthetic-maintenance-completed",
        contact_id: s.contact_id,
        object_id: s.object_id,
        kind: "maintenance_done",
        occurred_at: w.context.data_at,
        received_at: w.context.data_at,
      });
    const r = prepareScenario(w, "J08");
    assert.equal(r.decision, "exclude", stop);
    assert.ok(!r.reasons.includes("maintenance_not_due"));
    assert.ok(!r.reasons.includes("delay_not_elapsed"));
    assert.equal(r.brief, null);
  }
});

test("T06 template variables inherited from JavaScript are missing, including scenario rendering", () => {
  for (const key of ["constructor", "__proto__"]) {
    const w = fixture();
    w.sources[0].text = `Conseil fictif : {{${key}}}`;
    assert.throws(
      () => renderCampaign(w, ["synthetic-wiki"], "fr", {}),
      /TEMPLATE_VARIABLE_MISSING/,
      key,
    );
    assert.throws(() => prepareScenario(w, "J01"), /TEMPLATE_VARIABLE_MISSING/);
  }
});

test("T06 inherited custom template variables do not count as supplied values", () => {
  const w = fixture();
  w.sources[0].text = "Conseil pour {{vehicle}}";
  const variables = Object.create({ vehicle: "synthetic-vehicle" });
  assert.throws(
    () => renderCampaign(w, ["synthetic-wiki"], "fr", variables),
    /TEMPLATE_VARIABLE_MISSING/,
  );
});

test("T06 template variables containing only whitespace are missing", () => {
  const w = fixture();
  w.sources[0].text = "Conseil pour {{vehicle}}";
  for (const vehicle of ["", " ", "\t\n", "\u00a0"]) {
    assert.throws(
      () => renderCampaign(w, ["synthetic-wiki"], "fr", { vehicle }),
      /TEMPLATE_VARIABLE_MISSING/,
      JSON.stringify(vehicle),
    );
  }
});

test("T06 explicitly supplied template variables remain literal, escaped and unchanged", () => {
  const w = fixture();
  w.sources[0].text = "{{constructor}} / {{__proto__}} / {{vehicle}}";
  const variables = JSON.parse(
    '{"constructor":"<b>fiction</b>","__proto__":"literal & value","vehicle":"  synthetic-vehicle  "}',
  );
  const before = JSON.stringify(variables);
  const r = renderCampaign(w, ["synthetic-wiki"], "fr", variables);
  assert.ok(
    r.html.includes(
      "&lt;b&gt;fiction&lt;/b&gt; / literal &amp; value /   synthetic-vehicle  ",
    ),
  );
  assert.ok(!r.html.includes("<b>fiction</b>"));
  assert.ok(
    r.text.includes("<b>fiction</b> / literal & value /   synthetic-vehicle  "),
  );
  assert.equal(JSON.stringify(variables), before);
  assert.equal(Object.getPrototypeOf(variables), Object.prototype);
  assert.deepEqual(r.source_refs, ["synthetic-wiki"]);
});

for (const [id, ready] of [
  ["J01", "prepare"],
  ["J02", "ask"],
] as const) {
  test(`${id} configured delay gates solicitation until its exact elapsed boundary`, () => {
    for (const [trigger, delay, expected] of [
      ["2026-10-01T12:00:00.001Z", 24, "defer"],
      ["2026-10-01T12:00:00Z", 24, ready],
      ["2026-10-01T11:59:59.999Z", 24, ready],
      ["2026-10-02T11:55:00Z", 0, ready],
    ] as const) {
      const w = fixture(),
        s = w.scenarios.find((s: any) => s.id === id);
      assert.equal(prepareScenario(w, id).decision, ready);
      s.trigger_at = trigger;
      s.delay_hours = delay;
      if (id === "J01") {
        const signup = w.events.find((e: any) => e.kind === "confirmed_signup");
        signup.occurred_at = trigger;
        signup.received_at = w.context.data_at;
      }
      const r = prepareScenario(w, id);
      assert.equal(r.decision, expected, `${trigger}/${delay}`);
      assert.equal(
        r.reasons.includes("delay_not_elapsed"),
        expected === "defer",
      );
      if (expected === "defer") {
        assert.deepEqual(r.questions, []);
        assert.equal(r.content, null);
        assert.equal(r.brief, null);
      } else if (ready === "ask") assert.ok(r.questions.length > 0);
      else assert.ok(r.brief);
    }
  });
}

test("J02 stop conditions prevail before and at the delay boundary", () => {
  for (const stop of ["reply", "refusal", "opposed", "expired", "version"]) {
    const w = fixture(),
      s = w.scenarios.find((s: any) => s.id === "J02");
    s.trigger_at = "2026-10-01T12:00:00.001Z";
    s.delay_hours = 24;
    if (stop === "reply" || stop === "refusal")
      w.events.push({
        ...w.events[0],
        id: "synthetic-stop-during-delay",
        contact_id: s.contact_id,
        object_id: s.object_id,
        kind: stop,
        occurred_at: w.context.data_at,
        received_at: w.context.data_at,
      });
    if (stop === "opposed") w.contacts[0].opposed = true;
    if (stop === "expired") s.expires_at = w.context.as_of;
    if (stop === "version") s.facts.current_version = "2";
    for (const asOf of ["2026-10-02T12:00:00Z", "2026-10-02T12:00:00.001Z"]) {
      w.context.as_of = asOf;
      const r = prepareScenario(w, "J02");
      assert.equal(r.decision, "exclude", `${stop}/${asOf}`);
      assert.ok(!r.reasons.includes("delay_not_elapsed"));
      assert.deepEqual(r.questions, []);
      assert.equal(r.brief, null);
    }
  }
});

test("J02 solicitation delay does not postpone internal human review", () => {
  const w = fixture(),
    s = w.scenarios.find((s: any) => s.id === "J02");
  s.vehicle_id = "synthetic-vehicle-1";
  s.trigger_at = "2026-10-02T11:00:00Z";
  s.delay_hours = 24;
  const r = prepareScenario(w, "J02");
  assert.equal(r.decision, "human");
  assert.deepEqual(r.questions, []);
  assert.ok(!r.reasons.includes("delay_not_elapsed"));
  assert.equal(r.real_execution, "unavailable");
});

test("J02 verified reply stops qualification even when vehicle fields remain missing", () => {
  const w = fixture(),
    s = w.scenarios.find((s: any) => s.id === "J02");
  assert.equal(prepareScenario(w, "J02").decision, "ask");
  const reply = {
    ...w.events[0],
    id: "synthetic-qualification-reply",
    contact_id: s.contact_id,
    object_id: s.object_id,
    kind: "reply",
    occurred_at: s.trigger_at,
    received_at: w.context.data_at,
  };
  w.events.push(reply, { ...reply });
  const r = prepareScenario(w, "J02");
  assert.equal(r.decision, "exclude");
  assert.ok(r.reasons.includes("reply_received"));
  assert.deepEqual(r.questions, []);
  assert.equal(r.content, null);
  assert.equal(r.brief, null);
  w.events.reverse();
  assert.deepEqual(prepareScenario(w, "J02"), r);
});

test("J02 ignores replies outside the current verified project, contact, object and trigger", () => {
  for (const change of [
    { verified: false },
    { bot: true },
    { project: "other-project" },
    { contact_id: "synthetic-other-contact" },
    { object_id: "synthetic-other-request" },
    { occurred_at: "2025-01-01T00:00:00Z" },
  ]) {
    const w = fixture(),
      s = w.scenarios.find((s: any) => s.id === "J02"),
      before = prepareScenario(w, "J02");
    assert.equal(before.decision, "ask");
    w.events.push({
      ...w.events[0],
      id: "synthetic-qualification-unrelated-reply",
      contact_id: s.contact_id,
      object_id: s.object_id,
      kind: "reply",
      occurred_at: s.trigger_at,
      received_at: w.context.data_at,
      ...change,
    });
    assert.deepEqual(prepareScenario(w, "J02"), before, JSON.stringify(change));
  }
});

test("J02 blocked qualification exposes no pending questions", () => {
  for (const kind of ["refusal", "support", "cancelled"]) {
    const w = fixture(),
      s = w.scenarios.find((s: any) => s.id === "J02");
    assert.ok(prepareScenario(w, "J02").questions.length > 0);
    w.events.push({
      ...w.events[0],
      id: "synthetic-qualification-stop",
      contact_id: s.contact_id,
      object_id: s.object_id,
      kind,
      occurred_at: s.trigger_at,
      received_at: w.context.data_at,
    });
    const r = prepareScenario(w, "J02");
    assert.equal(r.decision, "exclude", kind);
    assert.deepEqual(r.questions, [], kind);
  }
});

test("C07 J11 purchase on another object stops reactivation despite a stale purchase list", () => {
  const w = fixture(),
    s = w.scenarios.find((s: any) => s.id === "J11");
  w.events = w.events.filter((e: any) => e.kind !== "purchase");
  assert.equal(prepareScenario(w, "J11").decision, "prepare");
  w.events.push({
    ...w.events[0],
    id: "synthetic-other-order-purchase",
    contact_id: s.contact_id,
    object_id: "synthetic-other-order",
    kind: "purchase",
    occurred_at: "2026-10-01T10:00:00Z",
    received_at: w.context.data_at,
  });
  const row = explainSegment(w, { op: "inactive", days: 180 }).find(
    (x) => x.id === s.contact_id && x.project === "automecanik",
  );
  assert.equal(row?.included, false);
  assert.ok(row?.reasons.includes("recency_days:1"));
  const r = prepareScenario(w, "J11");
  assert.equal(r.decision, "exclude");
  assert.ok(r.reasons.includes("not_inactive"));
});

test("C07 purchase recency respects contact, project, verification, bot and event time", () => {
  for (const change of [
    { verified: false },
    { bot: true },
    { project: "other-project" },
    { contact_id: "synthetic-other-contact" },
    { kind: "view" },
    { occurred_at: "2025-12-01T12:00:00Z" },
  ]) {
    const w = fixture(),
      s = w.scenarios.find((s: any) => s.id === "J11");
    w.events = w.events.filter((e: any) => e.kind !== "purchase");
    w.events.push({
      ...w.events[0],
      id: "synthetic-recency-candidate",
      contact_id: s.contact_id,
      object_id: "synthetic-other-order",
      kind: "purchase",
      occurred_at: w.context.data_at,
      received_at: w.context.data_at,
      ...change,
    });
    assert.equal(
      prepareScenario(w, "J11").decision,
      "prepare",
      JSON.stringify(change),
    );
  }
});

test("C07 inactivity threshold uses the latest verified instant and preserves missing history", () => {
  const w = fixture(),
    s = w.scenarios.find((s: any) => s.id === "J11");
  const c = w.contacts.find(
    (c: any) => c.id === s.contact_id && c.project === "automecanik",
  );
  w.events = w.events.filter((e: any) => e.kind !== "purchase");
  const event = {
    ...w.events[0],
    id: "synthetic-boundary-purchase",
    contact_id: c.id,
    object_id: "synthetic-another-order",
    kind: "purchase",
    occurred_at: "2026-10-01T12:00:00Z",
    received_at: w.context.data_at,
  };
  w.events.push(event, { ...event });
  const check = () =>
    explainSegment(w, { op: "inactive", days: 1 }).find(
      (x) => x.id === c.id && x.project === c.project,
    )!;
  assert.equal(check().match, true);
  w.events = w.events.filter((e: any) => e.id !== event.id);
  w.events.push({ ...event, occurred_at: "2026-10-01T12:00:00.001Z" });
  assert.equal(check().match, false);
  c.history_complete = false;
  assert.equal(check().match, null);
  c.history_complete = true;
  c.purchases = [];
  w.events = [];
  assert.equal(check().match, null);
});

test("T06 vehicle provenance must be current business evidence independently of product fitment", () => {
  for (const change of [
    null,
    { kind: "wiki" },
    { kind: "public" },
    { validated: false },
    { valid_until: "2026-10-02T12:00:00Z" },
    { observed_at: "2026-10-01T00:00:00Z" },
    { observed_at: "2026-10-02T11:59:00Z" },
  ]) {
    const w = fixture();
    w.contacts[0].vehicles[0].source_ref = "synthetic-vehicle-proof";
    if (change)
      w.sources.push({
        ...w.sources.find((s: any) => s.id === "synthetic-business"),
        id: "synthetic-vehicle-proof",
        ...change,
      });
    const r = recommendProducts(
      w,
      "synthetic-contact-1",
      "synthetic-vehicle-1",
    );
    assert.equal(r.selected.length, 0, JSON.stringify(change));
    assert.ok(
      r.decisions.every((x) => x.reasons.includes("vehicle_source_unverified")),
    );
    assert.equal(prepareScenario(w, "J07").decision, "exclude");
    if (change) {
      Object.assign(
        w.sources.find((s: any) => s.id === "synthetic-vehicle-proof"),
        {
          ...w.sources.find((s: any) => s.id === "synthetic-business"),
          id: "synthetic-vehicle-proof",
        },
      );
      assert.deepEqual(
        recommendProducts(w, "synthetic-contact-1", "synthetic-vehicle-1")
          .selected,
        ["synthetic-product-1"],
      );
    }
  }
});

test("J scenarios stop on verified cancellation scoped to their own object", () => {
  for (const change of [
    {},
    { verified: false },
    { bot: true },
    { project: "other-project" },
    { object_id: "synthetic-other" },
    { contact_id: "synthetic-other" },
  ]) {
    const w = fixture();
    w.events.push({
      ...w.events[0],
      id: "synthetic-cancellation",
      kind: "cancelled",
      ...change,
    });
    const r = prepareScenario(w, "J01");
    assert.equal(
      r.decision,
      Object.keys(change).length ? "prepare" : "exclude",
    );
    if (!Object.keys(change).length)
      assert.ok(r.reasons.includes("object_closed"));
  }
});

test("J trigger cannot postdate the data snapshot even before evaluation time", () => {
  const w = fixture();
  w.scenarios[0].trigger_at = "2026-10-02T11:59:00Z";
  assert.throws(() => prepareScenario(w, "J01"), /FUTURE_WORKBENCH_DATA/);
});

test("J equal-time purchase and quote reply stop even with fractional timestamp spelling", () => {
  for (const id of ["J05", "J07", "J10", "J11", "J12", "J13", "J16"]) {
    const w = fixture(),
      s = w.scenarios.find((s: any) => s.id === id);
    w.events.push({
      ...w.events[0],
      id: "synthetic-concurrent",
      contact_id: s.contact_id,
      object_id: s.object_id,
      kind: id === "J05" ? "reply" : "purchase",
      occurred_at: "2026-09-01T10:00:00.000Z",
      received_at: w.context.data_at,
    });
    const r = prepareScenario(w, id);
    assert.equal(r.decision, "exclude", id);
    assert.ok(
      r.reasons.includes(
        id === "J05"
          ? "reply_received"
          : id === "J11"
            ? "not_inactive"
            : "goal_reached",
      ),
      id,
    );
  }
});

test("J content never substitutes an unrelated WIKI when scenario references are absent", () => {
  const w = fixture();
  delete w.scenarios[0].content_source_refs;
  const r = prepareScenario(w, "J01");
  assert.equal(r.decision, "exclude");
  assert.ok(r.reasons.includes("content_source_missing"));
  assert.equal(r.content, null);
});

test("J backend brief does not attest an unobserved skill runtime version", () => {
  assert.equal(
    prepareScenario(fixture(), "J01").brief?.payload.skill_version,
    null,
  );
});

test("J initial purchases require an exact verified trigger binding without masking a second receipt", () => {
  for (const id of ["J07", "J12", "J16"]) {
    const w = fixture(),
      s = w.scenarios.find((s: any) => s.id === id);
    const initial = w.events.find((e: any) => e.id === s.trigger_event_id);
    assert.notEqual(prepareScenario(w, id).decision, "exclude", id);
    for (const change of [
      { verified: false },
      { bot: true },
      { project: "other-project" },
      { contact_id: "synthetic-other" },
      { object_id: "synthetic-other" },
      { occurred_at: "2026-09-01T10:00:01Z", received_at: w.context.data_at },
    ]) {
      const wrong = structuredClone(w);
      Object.assign(
        wrong.events.find((e: any) => e.id === initial.id),
        change,
      );
      assert.ok(
        prepareScenario(wrong, id).reasons.includes("trigger_event_unverified"),
        `${id}: ${JSON.stringify(change)}`,
      );
    }
    const missing = structuredClone(w);
    missing.events = missing.events.filter((e: any) => e.id !== initial.id);
    assert.ok(
      prepareScenario(missing, id).reasons.includes("trigger_event_unverified"),
    );
    w.events.push({ ...initial, id: "synthetic-another-purchase" });
    assert.ok(prepareScenario(w, id).reasons.includes("goal_reached"));
    w.events.pop();
    s.trigger_event_id = null;
    assert.ok(prepareScenario(w, id).reasons.includes("goal_reached"));
  }
  const w = fixture(),
    s = w.scenarios.find((s: any) => s.id === "J11");
  const e = {
    ...w.events[0],
    id: "synthetic-resumed-purchase",
    contact_id: s.contact_id,
    kind: "purchase",
    object_id: s.object_id,
  };
  w.events.push(e);
  s.trigger_event_id = e.id;
  assert.ok(prepareScenario(w, "J11").reasons.includes("not_inactive"));
});

test("J content follows explicit source selection regardless of inventory order", () => {
  const w = fixture(),
    selected = {
      ...w.sources[0],
      id: "synthetic-selected",
      text: "Conseil choisi explicitement.",
    };
  w.sources.unshift({
    ...w.sources[0],
    id: "synthetic-unrelated",
    text: "Texte sans rapport.",
  });
  w.sources.push(selected);
  w.scenarios[0].content_source_refs = [selected.id];
  const r = prepareScenario(w, "J01");
  assert.deepEqual(r.content?.source_refs, [selected.id]);
  assert.ok(r.content?.text.includes(selected.text));
  assert.ok(!r.content?.text.includes("Texte sans rapport"));
  w.sources.reverse();
  assert.deepEqual(prepareScenario(w, "J01").content, r.content);
});

test("J missing, expired, unvalidated or non-WIKI selected sources never fall back", () => {
  for (const change of [
    null,
    { kind: "public" },
    { validated: false },
    { valid_until: "2026-09-30T00:00:00Z" },
  ]) {
    const w = fixture();
    w.scenarios[0].content_source_refs = ["synthetic-selected"];
    if (change)
      w.sources.push({ ...w.sources[0], id: "synthetic-selected", ...change });
    const r = prepareScenario(w, "J01");
    assert.equal(r.decision, "exclude");
    assert.equal(r.content, null);
    assert.ok(r.reasons.includes("content_source_unverified"));
  }
  const w = fixture();
  w.scenarios[0].content_source_refs = ["synthetic-wiki", "synthetic-wiki"];
  assert.throws(() => prepareScenario(w, "J01"), /INVALID_WORKBENCH_INPUT/);
});

test("T05 preferences and events compare instants, including fractional seconds and equal-time refusal", () => {
  const w = fixture(),
    c = w.contacts[0],
    p = c.preferences[0];
  c.preferences = [
    { ...p, state: "granted", at: "2026-10-01T12:00:00Z" },
    { ...p, state: "refused", at: "2026-10-01T12:00:00.500Z" },
  ];
  assert.ok(eligibility(c, w).includes("consent_unverified"));
  c.preferences[1].at = "2026-10-01T12:00:00.000Z";
  assert.ok(eligibility(c, w).includes("consent_unverified"));
  const e = w.events[0];
  assert.deepEqual(
    uniqueEvents([
      { ...e, id: "synthetic-later", occurred_at: "2026-10-01T12:00:00.500Z" },
      { ...e, id: "synthetic-earlier", occurred_at: "2026-10-01T12:00:00Z" },
    ]).map((x) => x.id),
    ["synthetic-earlier", "synthetic-later"],
  );
});

test("T03 importing an explicit refusal preserves it on replay and cannot regrant", () => {
  const w = fixture(),
    row = structuredClone(w.contacts[0]);
  row.preferences = [
    { ...row.preferences[0], state: "refused", at: "2026-10-01T12:00:00Z" },
  ];
  const r = importPreview(w.context, [w.contacts[0]], [row]);
  assert.ok(eligibility(r.contacts[0], w).includes("consent_unverified"));
  assert.deepEqual(
    importPreview(w.context, r.contacts, [row]).contacts,
    r.contacts,
  );
  row.preferences[0] = {
    ...row.preferences[0],
    state: "granted",
    at: w.context.data_at,
  };
  assert.ok(
    eligibility(
      importPreview(w.context, r.contacts, [row]).contacts[0],
      w,
    ).includes("consent_unverified"),
  );
});

test("T03 import rejects future facts, ambiguous existing identities and combined overflow", () => {
  const w = fixture(),
    row = structuredClone(w.contacts[0]);
  row.preferences[0].at = "2027-01-01T00:00:00Z";
  assert.equal(
    importPreview(w.context, [], [row]).errors[0]?.code,
    "invalid_row",
  );
  assert.throws(
    () => importPreview(w.context, [w.contacts[0], w.contacts[0]], []),
    /DUPLICATE_OBJECT/,
  );
  assert.throws(
    () =>
      importPreview(
        w.context,
        [w.contacts[0], { ...w.contacts[0], id: "synthetic-another" }],
        [],
      ),
    /AMBIGUOUS_CONTACT_IDENTITY/,
  );
  const existing = Array.from({ length: 1000 }, (_, i) => ({
    ...w.contacts[0],
    id: `synthetic-import-${i}`,
    email: `synthetic-import-${i}@example.invalid`,
  }));
  const r = importPreview(w.context, existing, [w.contacts[0]]);
  assert.equal(r.contacts.length, 1000);
  assert.equal(r.errors[0]?.code, "contact_limit");
});

test("T03 import keeps the longest pause and stops rather than dropping excess preference evidence", () => {
  const w = fixture(),
    c = structuredClone(w.contacts[0]);
  c.paused_until = "2026-10-03T12:00:00.500Z";
  const row = { ...c, paused_until: "2026-10-03T12:00:00Z" };
  assert.equal(
    importPreview(w.context, [c], [row]).contacts[0].paused_until,
    c.paused_until,
  );
  c.preferences = Array.from({ length: 20 }, (_, i) => ({
    ...c.preferences[0],
    at: `2026-09-01T12:00:${String(i).padStart(2, "0")}Z`,
  }));
  row.preferences = [
    { ...c.preferences[0], state: "refused", at: "2026-10-01T12:00:00Z" },
  ];
  assert.throws(
    () => importPreview(w.context, [c], [row]),
    /MERGED_CONTACT_INVALID/,
  );
});

test("T03 stale imports cannot erase a recent purchase and reactivate the contact", () => {
  const w = fixture(),
    original = structuredClone(w.contacts[0]);
  w.events = [];
  assert.equal(
    explainSegment(w, { op: "inactive", days: 180 })[0].included,
    true,
  );
  const stale = structuredClone(original);
  original.purchases.push({
    ...original.purchases[0],
    id: "synthetic-recent-purchase",
    at: "2026-10-01T12:00:00Z",
  });
  const before = structuredClone(original);
  const r = importPreview(w.context, [original], [stale]);
  assert.equal(r.contacts[0].purchases.length, 2);
  assert.equal(
    explainSegment(
      { ...w, contacts: r.contacts },
      { op: "inactive", days: 180 },
    )[0].included,
    false,
  );
  assert.deepEqual(
    importPreview(w.context, r.contacts, [stale]).contacts,
    r.contacts,
  );
  assert.deepEqual(original, before);
  const unordered = {
    ...original,
    purchases: [...original.purchases].reverse(),
    vehicles: [...original.vehicles].reverse(),
  };
  const first = importPreview(w.context, [], [unordered]);
  assert.deepEqual(
    importPreview(w.context, first.contacts, [unordered]).contacts,
    first.contacts,
  );
});

test("T03 conflicting purchase facts and merged history overflow require reconciliation", () => {
  const w = fixture(),
    c = structuredClone(w.contacts[0]),
    row = structuredClone(c);
  row.purchases[0].net_minor = "999";
  assert.throws(
    () => importPreview(w.context, [c], [row]),
    /CONFLICTING_PURCHASE/,
  );
  row.purchases = [{ ...c.purchases[0], id: "synthetic-extra-purchase" }];
  c.purchases = Array.from({ length: 100 }, (_, i) => ({
    ...c.purchases[0],
    id: `synthetic-history-${i}`,
  }));
  assert.throws(
    () => importPreview(w.context, [c], [row]),
    /MERGED_CONTACT_INVALID/,
  );
});

test("T03 unproven completeness cannot be upgraded by importing a complete-looking row", () => {
  const w = fixture(),
    c = structuredClone(w.contacts[0]),
    row = structuredClone(c);
  c.history_complete = false;
  const r = importPreview(w.context, [c], [row]);
  assert.equal(r.contacts[0].history_complete, false);
  assert.equal(
    explainSegment(
      { ...w, contacts: r.contacts },
      { op: "inactive", days: 180 },
    )[0].match,
    null,
  );
});

test("T03 imported vehicle snapshots cannot erase or resurrect an existing declaration", () => {
  const w = fixture(),
    c = structuredClone(w.contacts[0]),
    stale = structuredClone(c);
  stale.vehicles = [];
  assert.deepEqual(
    importPreview(w.context, [c], [stale]).contacts[0].vehicles,
    c.vehicles,
  );
  const old = structuredClone(c);
  c.vehicles[0].declared = false;
  assert.throws(
    () => importPreview(w.context, [c], [old]),
    /CONFLICTING_VEHICLE/,
  );
  const newer = structuredClone(c);
  newer.vehicles[0].year = 2025;
  assert.throws(
    () => importPreview(w.context, [c], [newer]),
    /CONFLICTING_VEHICLE/,
  );
});

test("T01 ambiguous identities are refused at the workspace boundary too", () => {
  const w = fixture();
  w.contacts.push({
    ...w.contacts[0],
    id: "synthetic-ambiguous",
    email: w.contacts[0].email.replace("example.invalid", "EXAMPLE.INVALID"),
  });
  assert.throws(() => workspace(w), /AMBIGUOUS_CONTACT_IDENTITY/);
});

test("J17 requires an observed verified signal before proposing suspension review", () => {
  const w = fixture();
  w.events = w.events.filter(
    (e: any) => e.kind !== "complaint" && e.kind !== "hard_bounce",
  );
  assert.equal(prepareScenario(w, "J17").decision, "exclude");
});

test("J17 cannot attest a signal from an absent or unverified business source", () => {
  for (const variant of [
    "missing",
    "unvalidated",
    "wiki",
    "public",
    "expired",
    "stale",
    "future",
  ]) {
    const w = fixture();
    const s = w.scenarios.find((x: any) => x.id === "J17");
    const source = w.sources.find((x: any) => x.id === s.facts.source_ref);
    if (variant === "missing") s.facts.source_ref = "synthetic-missing-source";
    if (variant === "unvalidated") source.validated = false;
    if (variant === "wiki" || variant === "public") source.kind = variant;
    if (variant === "expired") source.valid_until = w.context.as_of;
    if (variant === "stale")
      source.observed_at = new Date(
        Date.parse(w.context.as_of) - w.context.max_age_hours * 3600000 - 1,
      ).toISOString();
    if (variant === "future")
      source.observed_at = new Date(
        Date.parse(w.context.data_at) + 1,
      ).toISOString();
    const r = prepareScenario(w, "J17");
    assert.equal(r.decision, "exclude", variant);
    assert.ok(r.reasons.includes("source_unverified"), variant);
    assert.ok(!r.reasons.includes("observed_signal_requires_review"), variant);
    assert.equal(r.content, null);
    assert.equal(r.brief, null);
  }
});

test("J17 accepts the exact source freshness boundary and exposes its reference", () => {
  const w = fixture();
  const s = w.scenarios.find((x: any) => x.id === "J17");
  const source = w.sources.find((x: any) => x.id === s.facts.source_ref);
  source.observed_at = new Date(
    Date.parse(w.context.as_of) - w.context.max_age_hours * 3600000,
  ).toISOString();
  source.valid_until = new Date(Date.parse(w.context.as_of) + 1).toISOString();
  const r = prepareScenario(w, "J17");
  assert.equal(r.decision, "human");
  assert.deepEqual(r.reasons, ["observed_signal_requires_review"]);
  assert.equal(
    "source_ref" in r ? r.source_ref : undefined,
    s.facts.source_ref,
  );
  assert.deepEqual("signal_ids" in r ? r.signal_ids : [], [
    "synthetic-event-17",
  ]);
  assert.equal(r.real_execution, "unavailable");
});

test("J17 internal review remains independent of contact marketing permission and delay", () => {
  const w = fixture();
  const s = w.scenarios.find((x: any) => x.id === "J17");
  s.delay_hours = 8760;
  const c = w.contacts.find(
    (x: any) => x.id === s.contact_id && x.project === w.context.project,
  );
  c.opposed = true;
  c.preferences = [];
  const r = prepareScenario(w, "J17");
  assert.equal(r.decision, "human");
  assert.deepEqual(r.reasons, ["observed_signal_requires_review"]);
  assert.deepEqual(r.questions, []);
  assert.equal(r.content, null);
  assert.equal(r.brief, null);
});

test("V2 acquisition, qualification, after-sales, recommendation, stock and reactivation produce useful decisions", () => {
  for (const id of ["J01", "J06", "J07", "J09", "J11"]) {
    const r = prepareScenario(fixture(), id);
    assert.equal(r.decision, "prepare", id);
    assert.ok(r.content?.text.length);
    assert.equal(r.real_execution, "unavailable");
  }
  const q = prepareScenario(fixture(), "J02");
  assert.equal(q.decision, "ask");
  assert.ok(q.questions.includes("engine"));
});
test("V2 different vehicle, side and audience never inherit another fitment or professional offer", () => {
  const w = fixture();
  const r = recommendProducts(w, "synthetic-contact-1", "synthetic-vehicle-1");
  assert.deepEqual(r.selected, ["synthetic-product-1"]);
  assert.equal(
    recommendProducts(w, "synthetic-contact-1", "synthetic-vehicle-2").selected
      .length,
    0,
  );
  w.products[0].stock = 0;
  assert.equal(
    recommendProducts(w, "synthetic-contact-1", "synthetic-vehicle-1").selected
      .length,
    0,
  );
});
test("V2 repeated import preserves opposition and never merges projects or plus-addresses", () => {
  const w = fixture();
  w.contacts[0].opposed = true;
  const row = structuredClone(w.contacts[0]);
  row.opposed = false;
  const r = importPreview(w.context, w.contacts, [row]);
  assert.equal(r.contacts[0].opposed, true);
  assert.equal(
    importPreview(w.context, r.contacts, [row]).contacts.length,
    r.contacts.length,
  );
  const foreign = { ...row, project: "other-project" };
  assert.equal(
    importPreview(w.context, [], [foreign]).errors[0].code,
    "project_mismatch",
  );
  const ambiguous = { ...row, id: "synthetic-different" };
  assert.equal(
    importPreview(w.context, w.contacts, [ambiguous]).errors[0].code,
    "ambiguous_identity",
  );
});
test("C07 unknown audience stays unknown under positive and negative profile filters", () => {
  const w = fixture();
  w.contacts[0].audience = "unknown";
  w.contacts[0].audience_declared = true;
  for (const value of ["private", "professional"]) {
    const rule = { op: "audience", value };
    for (const query of [rule, { op: "not", rule }]) {
      const r = explainSegment(w, query)[0];
      assert.equal(r.match, null);
      assert.equal(r.included, false);
      assert.ok(r.reasons.includes("audience_unknown"));
    }
  }
  const explicit = explainSegment(w, { op: "audience", value: "unknown" })[0];
  assert.equal(explicit.match, true);
  assert.equal(explicit.included, true);
  assert.ok(explicit.reasons.includes("audience_unknown"));
});

test("C07 unknown audience composes with known facts without becoming false", () => {
  const w = fixture();
  w.contacts[0].audience = "unknown";
  w.contacts[0].audience_declared = true;
  w.contacts[0].history_complete = true;
  w.events = [];
  const unknown = { op: "audience", value: "professional" };
  const present = { op: "count", kind: "view", days: 1, min: 0 };
  const absent = { op: "count", kind: "view", days: 1, min: 1 };
  const cases = [
    { rule: { op: "all", rules: [unknown, present] }, want: null },
    { rule: { op: "all", rules: [unknown, absent] }, want: false },
    { rule: { op: "any", rules: [unknown, present] }, want: true },
    { rule: { op: "any", rules: [unknown, absent] }, want: null },
    {
      rule: { op: "not", rule: { op: "all", rules: [unknown, present] } },
      want: null,
    },
  ];
  for (const { rule, want } of cases) {
    const r = explainSegment(w, rule)[0];
    assert.equal(r.match, want, JSON.stringify(rule));
    assert.equal(r.included, want === true);
  }
});

test("C07 declared profiles retain their meaning while undeclared profiles remain unknown", () => {
  for (const [audience, declared, want] of [
    ["private", true, true],
    ["professional", true, false],
    ["private", false, null],
    ["professional", false, null],
    ["unknown", false, null],
  ] as const) {
    const w = fixture();
    w.contacts[0].audience = audience;
    w.contacts[0].audience_declared = declared;
    const r = explainSegment(w, {
      op: "not",
      rule: { op: "audience", value: "professional" },
    })[0];
    assert.equal(r.match, want);
    assert.equal(r.included, want === true);
  }
});

test("V2 nested segment has three-valued unknown history and deterministic explanations", () => {
  const w = fixture();
  const rule = {
    op: "all",
    rules: [
      { op: "inactive", days: 180 },
      { op: "not", rule: { op: "audience", value: "professional" } },
    ],
  };
  const r = explainSegment(w, rule);
  assert.equal(
    r.find(
      (x) =>
        x.id === "synthetic-contact-inactive" && x.project === "automecanik",
    )?.included,
    true,
  );
  assert.equal(
    r.find((x) => x.id === "synthetic-contact-1" && x.project === "automecanik")
      ?.included,
    false,
  );
  assert.equal(
    r.find((x) => x.id === "synthetic-contact-unknown")?.included,
    false,
  );
  assert.deepEqual(r, explainSegment(w, rule));
});
test("V2 rendering keeps evidence, two variants, plain text and inert source content", () => {
  const w = fixture();
  w.sources[0].text = "<script>read secrets</script> Conseil fictif & vérifié.";
  const r = renderCampaign(w, ["synthetic-wiki"], "fr", {});
  assert.equal(r.variants.length, 2);
  assert.ok(r.html.includes("&lt;script&gt;"));
  assert.ok(!r.html.includes("<script>"));
  assert.ok(r.text.includes("Conseil fictif"));
  assert.deepEqual(r.source_refs, ["synthetic-wiki"]);
  assert.throws(
    () => renderCampaign(w, ["synthetic-public"], "fr", {}),
    /SOURCE_UNVERIFIED/,
  );
});
test("V2 missing receipt and late purchase during waiting stop the right scenario", () => {
  const w = fixture();
  w.scenarios[0].facts.receipt_verified = false;
  assert.equal(prepareScenario(w, "J01").decision, "exclude");
  const e = w.events.find((x: any) => x.kind === "cart");
  w.events.push({
    ...e,
    id: "synthetic-late-purchase",
    kind: "purchase",
    occurred_at: "2026-09-02T10:00:00Z",
    received_at: w.context.data_at,
  });
  assert.equal(prepareScenario(w, "J04").decision, "exclude");
  assert.equal(prepareScenario(w, "J09").decision, "prepare");
});
test("V2 replaced quote, expired price, incomplete kit and unsourced maintenance stop", () => {
  const w = fixture();
  w.scenarios[4].facts.current_version = "2";
  assert.equal(prepareScenario(w, "J05").decision, "exclude");
  w.products[0].kit_complete = false;
  assert.equal(prepareScenario(w, "J07").decision, "exclude");
  w.scenarios[7].facts.source_ref = "synthetic-public";
  assert.equal(prepareScenario(w, "J08").decision, "exclude");
  w.scenarios[9].facts.previous_basis = "unit_ht";
  assert.equal(prepareScenario(w, "J10").decision, "exclude");
});
test("V2 opportunities distinguish observed evidence and hypotheses without invented demand", () => {
  const w = fixture();
  const r = planOpportunities(w, [
    {
      source_ref: "synthetic-wiki",
      objective: "qualified_request",
      audience: "private",
      stop_condition: "Stop si source invalide",
      hypothesis: "Tester un conseil utile",
    },
  ]);
  assert.equal(r.actions.length, 1);
  assert.equal(r.actions[0].expected_volume, null);
  assert.equal(r.actions[0].source_ref, "synthetic-wiki");
});

test("J01-J18 have explicit useful decisions; completed goals and withdrawn vehicle stop", () => {
  const w = fixture();
  for (let n = 1; n <= 18; n++) {
    const id = `J${String(n).padStart(2, "0")}`,
      r = prepareScenario(w, id);
    assert.ok(
      ["prepare", "ask", "human"].includes(r.decision),
      `${id}: ${r.reasons}`,
    );
    assert.ok(r.action.length);
    assert.equal(r.real_execution, "unavailable");
  }
  for (const id of ["J01", "J07", "J10", "J12", "J13"]) {
    const copy = fixture(),
      s = copy.scenarios.find((s: any) => s.id === id);
    copy.events.push({
      ...copy.events[0],
      id: "synthetic-goal",
      contact_id: s.contact_id,
      object_id: s.object_id,
      kind: id === "J01" ? "accepted" : "purchase",
      occurred_at: "2026-09-02T10:00:00Z",
      received_at: copy.context.data_at,
    });
    assert.equal(prepareScenario(copy, id).decision, "exclude", id);
  }
  w.contacts[0].vehicles = [];
  assert.equal(prepareScenario(w, "J08").decision, "exclude");
});
test("T06 nested kits, mismatched year and revoked asset rights cannot be recommended", () => {
  const w = fixture();
  const original = w.products[0];
  w.products.push({
    ...structuredClone(original),
    id: "synthetic-nested",
    kit_components: ["synthetic-missing"],
  });
  original.kit_components = ["synthetic-nested"];
  assert.ok(
    !recommendProducts(
      w,
      "synthetic-contact-1",
      "synthetic-vehicle-1",
    ).selected.includes(original.id),
  );
  const wrong = fixture();
  wrong.contacts[0].vehicles[0].year = 2021;
  assert.equal(
    recommendProducts(wrong, "synthetic-contact-1", "synthetic-vehicle-1")
      .selected.length,
    0,
  );
});
test("T05 updated preference blocks pending marketing; service preference cannot grant marketing", () => {
  const w = fixture();
  const s = w.scenarios.find((s: any) => s.id === "J11");
  const c = w.contacts.find(
    (c: any) => c.id === s.contact_id && c.project === "automecanik",
  );
  assert.equal(prepareScenario(w, "J11").decision, "prepare");
  c.preferences.push({
    ...c.preferences[0],
    state: "refused",
    at: w.context.data_at,
  });
  assert.equal(prepareScenario(w, "J11").decision, "exclude");
  c.preferences = [{ ...c.preferences[0], purpose: "service" }];
  assert.equal(prepareScenario(w, "J11").decision, "exclude");
});
test("T11 URLs remain inert and constrained, missing variables and unknown source kinds fail", () => {
  const w = fixture();
  w.sources[0].url = "https://127.0.0.1/private";
  assert.throws(() => prepareScenario(w, "J06"), /INVALID_WORKBENCH_INPUT/);
  const m = fixture();
  m.sources[0].text = "Bonjour {{name}}";
  assert.throws(
    () => renderCampaign(m, ["synthetic-wiki"], "fr", {}),
    /TEMPLATE_VARIABLE_MISSING/,
  );
  for (const kind of ["raw", "rag"]) {
    const x = fixture();
    x.sources[0].kind = kind;
    assert.throws(() => prepareScenario(x, "J06"), /INVALID_WORKBENCH_INPUT/);
  }
});
test("C16 C21 a media plan preserves account, rights, budget and stop without publishing", () => {
  const plan = {
    account: "synthetic-account",
    source_ref: "synthetic-wiki",
    landing_source_ref: "synthetic-business",
    format: "social",
    objective: "qualified_request",
    audience: "declared_private",
    budget_minor: "0",
    currency: "EUR",
    media_rights_verified: true,
    stop_condition: "Source invalide",
    starts_at: "2026-10-03T10:00:00Z",
    ends_at: "2026-10-05T10:00:00Z",
  };
  const r = prepareMediaPlan(fixture(), plan);
  assert.equal(r.decision, "draft");
  assert.equal(r.spend_minor, "0");
  assert.ok(r.creative.text.length);
  assert.equal(
    prepareMediaPlan(fixture(), { ...plan, media_rights_verified: false })
      .decision,
    "exclude",
  );
  assert.equal(
    prepareMediaPlan(fixture(), {
      ...plan,
      format: "paid",
      budget_minor: "10000",
    }).provider_budget_enforced,
    false,
  );
});
test("T04 sequence and bounded performance at 1000 contacts / 10000 events", () => {
  const w = fixture(),
    base = w.contacts[0],
    event = w.events[0];
  w.contacts = Array.from({ length: 1000 }, (_, i) => ({
    ...structuredClone(base),
    id: `synthetic-contact-${i}`,
    email: `synthetic-${i}@example.invalid`,
  }));
  w.events = Array.from({ length: 10000 }, (_, i) => ({
    ...event,
    id: `synthetic-event-${i}`,
    contact_id: `synthetic-contact-${Math.floor(i / 10)}`,
    kind: i % 2 ? "click" : "view",
    occurred_at: i % 2 ? "2026-10-01T11:00:00Z" : "2026-10-01T10:00:00Z",
    received_at: w.context.data_at,
  }));
  const start = performance.now();
  const r = explainSegment(w, {
    op: "sequence",
    first: "view",
    then: "click",
    days: 7,
  });
  assert.equal(r.filter((x) => x.included).length, 1000);
  assert.ok(
    performance.now() - start < 10000,
    "10-second bounded preparation budget",
  );
});

const a1Segment = {
  op: "all",
  rules: [
    { op: "inactive", days: 180 },
    { op: "not", rule: { op: "audience", value: "professional" } },
  ],
};

test("A1 exclusions aggregate all match states and eligibility without inventing consent", () => {
  const w = workspace(fixture());
  const base = w.contacts.find((c) => c.id === "synthetic-contact-inactive")!;
  w.events = [];
  w.contacts = ["included", "blocked", "recent", "unknown"].map((name) => ({
    ...structuredClone(base),
    id: `synthetic-${name}`,
    email: `synthetic-${name}@example.invalid`,
  }));
  Object.assign(w.contacts[1], {
    identity_verified: false,
    opposed: true,
    erased: true,
    complaint: true,
    hard_bounce: true,
    paused_until: "2026-10-03T00:00:00Z",
    language: null,
  });
  w.contacts[1].preferences[0].state = "refused";
  w.contacts[2].purchases[0].at = "2026-09-01T12:00:00Z";
  w.contacts[3].history_complete = false;
  const rule = {
    ...a1Segment,
    rules: [...a1Segment.rules, a1Segment.rules[1]],
  };
  const before = structuredClone({ w, rule });
  const rows = explainSegment(w, rule);
  assert.deepEqual(
    rows.map((r) => [r.match, r.included]),
    [
      [true, true],
      [true, false],
      [false, false],
      [null, false],
    ],
  );
  assert.deepEqual(eligibility(w.contacts[2], w), []);
  assert.deepEqual(eligibility(w.contacts[3], w), []);
  const r = summarizeSegment(w, rule);
  assert.deepEqual(r, {
    mode: "snapshot",
    counting_unit: "project:id",
    total: 4,
    included: 1,
    excluded: 3,
    reason_counts_exclusive: false,
    exclusion_reasons: [
      { reason: "audience_declared", count: 3 },
      { reason: "consent_unverified", count: 1 },
      { reason: "erased", count: 1 },
      { reason: "history_unknown", count: 1 },
      { reason: "identity_unverified", count: 1 },
      { reason: "language_unknown", count: 1 },
      { reason: "not", count: 3 },
      { reason: "opposed", count: 1 },
      { reason: "paused", count: 1 },
      { reason: "recency_days:305", count: 1 },
      { reason: "recency_days:31", count: 1 },
      { reason: "suppressed", count: 1 },
    ],
  });
  assert.equal(r.total, r.included + r.excluded);
  assert.ok(r.exclusion_reasons.reduce((n, x) => n + x.count, 0) > r.excluded);
  assert.deepEqual(summarizeSegment(w, rule), r);
  assert.deepEqual({ w, rule }, before);
  w.contacts.reverse();
  rule.rules.reverse();
  assert.equal(JSON.stringify(summarizeSegment(w, rule)), JSON.stringify(r));
  const serialized = JSON.stringify(r);
  for (const c of w.contacts) {
    assert.ok(!serialized.includes(c.id));
    assert.ok(!serialized.includes(c.email));
  }
  // Returned aggregates share no mutable arrays or objects with the workspace.
  r.exclusion_reasons[0].reason = "changed-output";
  assert.deepEqual(
    summarizeSegment(before.w, before.rule),
    summarizeSegment(w, rule),
  );
});

test("A1 exclusions count project:id and keep DTO duplicate and ambiguity refusals", () => {
  const w = workspace(fixture());
  const base = w.contacts.find((c) => c.id === "synthetic-contact-inactive")!;
  w.contacts = [
    structuredClone(base),
    { ...structuredClone(base), project: "other-project" },
  ];
  w.events = [];
  const r = summarizeSegment(w, a1Segment);
  assert.equal(r.total, 2);
  assert.equal(r.included, 1);
  assert.equal(r.excluded, 1);
  assert.ok(
    r.exclusion_reasons.some(
      (x) => x.reason === "project_mismatch" && x.count === 1,
    ),
  );
  assert.throws(
    () => summarizeSegment({ ...w, contacts: [base, base] }, a1Segment),
    /DUPLICATE_OBJECT/,
  );
  const ambiguous = {
    ...structuredClone(base),
    id: "synthetic-ambiguous",
    email: base.email.replace("example.invalid", "EXAMPLE.INVALID"),
  };
  assert.throws(
    () => summarizeSegment({ ...w, contacts: [base, ambiguous] }, a1Segment),
    /AMBIGUOUS_CONTACT_IDENTITY/,
  );
});

test("A1 exclusions handle empty and wholly included audiences without reason leakage", () => {
  const w = workspace(fixture());
  w.contacts = [];
  assert.deepEqual(summarizeSegment(w, a1Segment), {
    mode: "snapshot",
    counting_unit: "project:id",
    total: 0,
    included: 0,
    excluded: 0,
    reason_counts_exclusive: false,
    exclusion_reasons: [],
  });
  w.contacts = workspace(fixture()).contacts.filter(
    (c) => c.id === "synthetic-contact-inactive",
  );
  const r = summarizeSegment(w, a1Segment);
  assert.equal(r.total, 1);
  assert.equal(r.included, 1);
  assert.equal(r.excluded, 0);
  assert.deepEqual(r.exclusion_reasons, []);
});

test("A1 exclusions reject unknown fields, invalid rules and non-synthetic contexts", () => {
  const w = fixture();
  for (const bad of [
    { ...w, unknown: "private-value" },
    { ...w, contacts: [{ ...w.contacts[0], unknown: "private-value" }] },
    { ...w, context: { ...w.context, synthetic: false } },
    { ...w, context: { ...w.context, environment: "PROD" } },
  ])
    assert.throws(
      () => summarizeSegment(bad, a1Segment),
      /INVALID_WORKBENCH_INPUT/,
    );
  for (const rule of [
    { op: "inactive", days: 0 },
    { ...a1Segment, unknown: "private-value" },
  ])
    assert.throws(() => summarizeSegment(w, rule), /INVALID_WORKBENCH_INPUT/);
});

test("V2 inactivity compares 180/365 on the same five identities without changing other indicators", () => {
  const baseline = runWorkbench(["--report"]);
  assert.deepEqual(
    runWorkbench(["--report", "--inactive-days", "180"]),
    baseline,
  );
  assert.ok("audience" in baseline && "economics" in baseline);
  for (const [days, included] of [
    [180, 1],
    [365, 0],
  ] as const) {
    const report = runWorkbench(["--report", "--inactive-days", String(days)]);
    assert.ok("audience" in report && "economics" in report);
    assert.equal(report.audience.total, 5);
    assert.equal(report.audience.included, included);
    assert.equal(report.audience.excluded, 5 - included);
    for (const key of [
      "economics",
      "engagement",
      "scores",
      "experiment",
      "capacity",
    ] as const)
      assert.deepEqual(report[key], baseline[key], key);
    const rows = runWorkbench(["--segment", "--inactive-days", String(days)]);
    assert.ok(Array.isArray(rows) && rows.every((row) => "included" in row));
    const selected = rows.filter((row) => "included" in row && row.included);
    assert.deepEqual(
      selected.map((row) => ("id" in row ? row.id : null)),
      days === 180 ? ["synthetic-contact-inactive"] : [],
    );
    assert.equal(rows.length, 5);
  }
});

test("V2 inactivity validates its bounds and rejects ambiguous or unrelated options", () => {
  for (const command of ["--segment", "--report"]) {
    for (const value of ["1", "3650"])
      assert.doesNotThrow(() =>
        runWorkbench([command, "--inactive-days", value]),
      );
    for (const value of [
      "0",
      "3651",
      "-1",
      "1.5",
      "1e2",
      "Infinity",
      "",
      " 180",
      "180x",
      "01",
      "9999999999999999999999999",
    ])
      assert.throws(
        () => runWorkbench([command, "--inactive-days", value]),
        /INVALID_ARGUMENT/,
      );
    for (const tail of [
      ["--inactive-days"],
      ["--inactive-days", "180", "--inactive-days", "365"],
      ["--inactive-days", "180", "--send"],
      ["--days", "180"],
    ])
      assert.throws(() => runWorkbench([command, ...tail]), /INVALID_ARGUMENT/);
  }
  for (const command of [
    "--help",
    "--operations",
    "--capabilities",
    "--all-scenarios",
  ])
    assert.throws(
      () => runWorkbench([command, "--inactive-days", "365"]),
      /INVALID_ARGUMENT/,
    );
});

test("A1 report adds aggregate audience and preserves the five existing indicators", () => {
  const report = runWorkbench(["--report"]);
  assert.ok("economics" in report && "audience" in report);
  assert.deepEqual(report.audience, summarizeSegment(fixture(), a1Segment));
  assert.equal(report.audience.total, 5);
  assert.equal(report.audience.included, 1);
  assert.equal(report.audience.excluded, 4);
  assert.deepEqual(
    runWorkbench(["--segment"]),
    explainSegment(fixture(), a1Segment),
  );
  assert.deepEqual(runWorkbench(["--report"]), report);
  // SHA-256 of each fixed-fixture indicator captured before the A1 integration.
  const before = {
    economics:
      "f9ae8b5bca613dd2ac6d96ede2e4175d3b4d5fe7c6a96dc4022fac9164e6dbf0",
    engagement:
      "2b09fd796a4ac6defae78e2afe8bb3a262d37c729d39c3368224f0d23dfd7120",
    scores: "c4a0e54bf2ecd9404cfe22f02d94e221a9b4279bf9f09820f9a6980a246cb44a",
    experiment:
      "973a9877ec0ffc3282559549dc5f1de4186701afbf43532cedf519dadc4cc2ce",
    capacity:
      "55fe89fcb7dcfa4db97011b7201b736a01e212a9ac157239d31fe7d22aadf4f1",
  };
  for (const key of Object.keys(before) as Array<keyof typeof before>) {
    assert.equal(
      createHash("sha256").update(JSON.stringify(report[key])).digest("hex"),
      before[key],
      key,
    );
  }
  assert.deepEqual(
    Object.keys(report).sort(),
    ["audience", ...Object.keys(before)].sort(),
  );
});

test("A1 report V2 envelope retains DEV markers with an isolated repository stub", () => {
  // Unit-test the unchanged entrypoint, without claiming that sandbox Git provenance passed.
  const filename = path.join(__dirname, "run-reactivation-pilot.ts");
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  let stdout = "",
    stderr = "",
    originChecks = 0;
  const isolatedProcess = {
    argv: [process.execPath, filename, "--report"],
    cwd: () => path.resolve(__dirname, "../.."),
    stdout: {
      write: (s: string) => {
        stdout += s;
      },
    },
    stderr: {
      write: (s: string) => {
        stderr += s;
      },
    },
    exitCode: 0,
  };
  runInNewContext(
    code,
    {
      exports: {},
      __dirname,
      process: isolatedProcess,
      require: (name: string) => {
        if (name === "node:fs") return { readFileSync };
        if (name === "node:path") return path;
        if (name === "./workbench-cli") return { runWorkbench };
        if (name === "./reactivation-pilot")
          return { runPilot: () => assert.fail("unexpected V1 execution") };
        if (name === "node:child_process")
          return {
            execFileSync: (command: string, args: string[]) => {
              assert.equal(command, "git");
              assert.equal(
                JSON.stringify(args),
                JSON.stringify(["remote", "get-url", "origin"]),
              );
              originChecks++;
              return "https://github.com/ak125/nestjs-remix-monorepo.git\n";
            },
          };
        throw new Error(`Unexpected module: ${name}`);
      },
    },
    { timeout: 10000 },
  );
  assert.equal(originChecks, 1);
  assert.equal(isolatedProcess.exitCode, 0);
  assert.equal(stderr, "");
  const { result, ...markers } = JSON.parse(stdout);
  assert.deepEqual(markers, {
    schema_version: "2.0.0",
    project: "automecanik",
    environment: "DEV",
    synthetic: true,
    real_execution: false,
  });
  assert.deepEqual(result, runWorkbench(["--report"]));
});

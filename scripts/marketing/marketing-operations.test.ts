import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  arbitrate,
  inspectExecution,
  deliveryReadiness,
  privacyPreview,
  capabilities,
} from "../../backend/src/modules/marketing/services/marketing-operations";
const fixture = () =>
  JSON.parse(
    readFileSync(__dirname + "/fixtures/workbench.synthetic.json", "utf8"),
  );
const policy = () => ({
  account: "synthetic-account",
  timezone: "Europe/Paris",
  window: "calendar" as const,
  hours: 24,
  contact_limit: 1,
  account_limit: 2,
  channel_limit: 2,
  start_hour: 8,
  end_hour: 20,
  max_cost_minor: "20",
  unit_cost_minor: "5",
});
const proposal = (id: string, priority = 1) => ({
  id,
  contact_id: "synthetic-contact-1",
  account: "synthetic-account",
  channel: "email" as const,
  priority,
  template: "synthetic-template",
  version: "2",
  rights_verified: true,
});

test("T07 calendar policy rejects durations that the daily calendar cannot enforce", () => {
  for (const hours of [1, 12, 23, 25, 48, 720])
    assert.throws(
      () =>
        arbitrate(
          fixture(),
          { ...policy(), hours },
          [proposal("synthetic-new")],
          [],
        ),
      /UNSUPPORTED_CALENDAR_WINDOW/,
      String(hours),
    );
});

test("T07 rolling duration uses elapsed hours and excludes the exact lower bound", () => {
  const w = fixture();
  for (const hours of [1, 24, 48, 720])
    for (const offset of [0, 1]) {
      const at = new Date(
        Date.parse(w.context.as_of) - hours * 3600000 + offset,
      ).toISOString();
      const r = arbitrate(
        w,
        { ...policy(), window: "rolling", hours },
        [proposal("synthetic-new")],
        [
          {
            ...proposal("synthetic-history"),
            at,
            state: "accepted",
          },
        ],
      );
      assert.equal(
        r.decisions[0].decision,
        offset ? "defer" : "prepare",
        `${hours}/${offset}`,
      );
    }
});

test("T07 calendar day spans the repeated daylight saving hour instead of rolling 24 hours", () => {
  const w = fixture();
  w.context.as_of = "2026-10-25T22:30:00Z";
  w.context.data_at = w.context.as_of;
  const p = { ...policy(), start_hour: 0, end_hour: 24 };
  const history = [
    {
      ...proposal("synthetic-history"),
      at: "2026-10-24T22:30:00Z",
      state: "accepted",
    },
  ];
  // Both instants fall on 25 October in Europe/Paris, exactly 24 elapsed hours apart.
  assert.equal(
    arbitrate(w, p, [proposal("synthetic-new")], history).decisions[0].decision,
    "defer",
  );
  assert.equal(
    arbitrate(
      w,
      { ...p, window: "rolling" },
      [proposal("synthetic-new")],
      history,
    ).decisions[0].decision,
    "prepare",
  );
});

test("T07 contact cap spans accounts while account and channel caps stay account scoped", () => {
  const w = fixture(),
    p = { ...policy(), account_limit: 1, channel_limit: 1 };
  const h = {
    ...proposal("synthetic-history"),
    account: "synthetic-other-account",
    at: w.context.data_at,
    state: "accepted",
  };
  assert.deepEqual(
    arbitrate(w, p, [proposal("synthetic-new")], [h]).decisions[0].reasons,
    ["contact_limit"],
  );
  assert.equal(
    arbitrate(
      w,
      p,
      [proposal("synthetic-new")],
      [{ ...h, contact_id: "synthetic-other-contact" }],
    ).decisions[0].decision,
    "prepare",
  );
});
test("T07 common arbitration reserves capacity across concurrent proposals, deterministically", () => {
  const w = fixture(),
    p = policy();
  const r = arbitrate(
    w,
    p,
    [proposal("synthetic-b", 2), proposal("synthetic-a")],
    [],
  );
  assert.deepEqual(
    r.decisions.map((x) => [x.id, x.decision]),
    [
      ["synthetic-a", "prepare"],
      ["synthetic-b", "defer"],
    ],
  );
  assert.equal(r.external_sends, 0);
  assert.equal(r.atomic_across_processes, false);
});
test("T07 calendar timezone boundary differs from rolling window; unknown timezone refused", () => {
  const w = fixture();
  w.context.as_of = "2026-10-02T06:00:00Z";
  w.context.data_at = w.context.as_of;
  const p = { ...policy(), start_hour: 0, end_hour: 24 };
  const history = [
    {
      ...proposal("synthetic-old"),
      at: "2026-10-01T21:59:59Z",
      state: "accepted" as const,
    },
  ];
  assert.equal(
    arbitrate(w, p, [proposal("synthetic-new")], history).decisions[0].decision,
    "prepare",
  );
  assert.equal(
    arbitrate(
      w,
      { ...p, window: "rolling" },
      [proposal("synthetic-new")],
      history,
    ).decisions[0].decision,
    "defer",
  );
  assert.throws(
    () => arbitrate(w, { ...p, timezone: "invalid" }, [], []),
    /TIMEZONE_INVALID/,
  );
});
test("T08 T09 replay accepted or uncertain requires reconciliation; duplicate conflicting receipts refuse", () => {
  const w = fixture(),
    item = proposal("synthetic-item");
  for (const state of ["accepted", "uncertain"] as const) {
    const h = { ...item, at: w.context.data_at, state };
    const r = arbitrate(w, policy(), [item], [h, h]);
    assert.equal(
      r.decisions[0].decision,
      state === "accepted" ? "exclude" : "human",
    );
  }
  const h = { ...item, at: w.context.data_at, state: "accepted" as const };
  assert.throws(
    () => arbitrate(w, policy(), [item], [h, { ...h, state: "cancelled" }]),
    /CONFLICTING_RECEIPT/,
  );
});
test("T08 replay rejects a receipt bound to a different target or content", () => {
  const w = fixture(),
    item = proposal("synthetic-item");
  const changes = [
    { contact_id: "synthetic-other-contact" },
    { account: "synthetic-other-account" },
    { channel: "sms" },
    { template: "synthetic-other-template" },
    { version: "3" },
  ];
  for (const state of ["accepted", "uncertain", "cancelled"])
    for (const change of changes) {
      const receipt = { ...item, ...change, at: "2026-09-01T12:00:00Z", state };
      assert.throws(
        () => arbitrate(w, policy(), [item], [receipt]),
        /PROPOSAL_RECEIPT_MISMATCH/,
        `${state}/${Object.keys(change)[0]}`,
      );
    }
});

test("T08 matching replay keeps historical outcomes despite priority changes", () => {
  const w = fixture(),
    item = proposal("synthetic-item", 9);
  const before = structuredClone(item);
  for (const [state, decision, reason] of [
    ["accepted", "exclude", "already_accepted"],
    ["uncertain", "human", "reconcile_before_retry"],
    ["cancelled", "exclude", "already_cancelled"],
  ]) {
    const receipt = {
      ...item,
      priority: 1,
      rights_verified: false,
      at: "2026-09-01T12:00:00Z",
      state,
    };
    const r = arbitrate(w, policy(), [item], [receipt, receipt]);
    assert.equal(r.decisions[0].decision, decision);
    assert.deepEqual(r.decisions[0].reasons, [reason]);
    assert.equal(r.reserved_cost_minor, "0");
  }
  assert.deepEqual(item, before);
});

test("T08 current exclusions prevail for matching receipts but cannot hide identity conflicts", () => {
  const w = fixture(),
    item = { ...proposal("synthetic-item"), rights_verified: false };
  const receipt = {
    ...item,
    rights_verified: true,
    at: w.context.data_at,
    state: "uncertain",
  };
  const r = arbitrate(w, policy(), [item], [receipt], true);
  assert.equal(r.decisions[0].decision, "exclude");
  assert.deepEqual(r.decisions[0].reasons, ["suspended", "rights_unverified"]);
  assert.throws(
    () => arbitrate(w, policy(), [item], [{ ...receipt, version: "3" }], true),
    /PROPOSAL_RECEIPT_MISMATCH/,
  );
});

test("T10 no self approval and unavailable authentic authority always blocks real execution", () => {
  const request = {
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
  };
  assert.equal(inspectExecution(fixture().context, request).executable, false);
  assert.throws(
    () => inspectExecution(fixture().context, { ...request, approved: true }),
    /INVALID_WORKBENCH_INPUT/,
  );
  assert.ok(
    inspectExecution(fixture().context, {
      ...request,
      expires_at: "2026-10-01T00:00:00Z",
    }).reasons.includes("request_expired"),
  );
  assert.ok(
    inspectExecution(fixture().context, {
      ...request,
      suspended: true,
    }).reasons.includes("suspended"),
  );
});
test("T13 T17 wrong account, absent channel permission and suspension stop pending work", () => {
  const w = fixture();
  const p = policy();
  assert.equal(
    arbitrate(
      w,
      p,
      [{ ...proposal("synthetic-a"), account: "synthetic-wrong" }],
      [],
    ).decisions[0].decision,
    "exclude",
  );
  w.contacts[0].opposed = true;
  assert.equal(
    arbitrate(w, p, [{ ...proposal("synthetic-b"), channel: "whatsapp" }], [])
      .decisions[0].decision,
    "exclude",
  );
  const r = arbitrate(fixture(), p, [proposal("synthetic-c")], [], true);
  assert.ok(r.decisions[0].reasons.includes("suspended"));
  assert.equal(r.accepted_messages_recalled, false);
});
test("T18 privacy preview minimizes addressed data, retains suppression and cannot persist/export", () => {
  const w = fixture();
  const r = privacyPreview(w, "synthetic-contact-1", "erase");
  assert.equal(r.persisted, false);
  assert.equal(r.tombstone?.opposed, true);
  assert.equal(r.tombstone?.erased, true);
  assert.ok(!JSON.stringify(r).includes("@"));
  assert.equal(r.authorization, "required_from_existing_service");
});
test("T20 delivery readiness is source-sensitive; costs unknown and absent channels stay unavailable", () => {
  assert.equal(
    deliveryReadiness({
      spf: "unknown",
      dkim: "verified",
      dmarc: "verified",
      alignment: "verified",
      unsubscribe: "unknown",
      sender: "verified",
      feedback: "unknown",
    }).ready,
    false,
  );
  assert.equal(
    arbitrate(
      fixture(),
      { ...policy(), unit_cost_minor: null },
      [proposal("synthetic-a")],
      [],
    ).decisions[0].decision,
    "human",
  );
  assert.ok(capabilities().every((x) => x.real_execution === "unavailable"));
});

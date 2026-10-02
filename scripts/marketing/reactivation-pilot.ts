/**
 * Pure, synthetic-only preparation. No Nest bootstrap, network, DB, queue or sender.
 * The existing brief DTO remains authoritative; this schema only describes its pilot payload.
 */
import { z } from "zod";
import {
  CreateMarketingBriefSchema,
  CoverageManifestSchema,
} from "../../backend/src/modules/marketing/dto/marketing-brief.dto";
import {
  MarketingBusinessUnit,
  MarketingChannel,
  MarketingConversionGoal,
} from "../../backend/src/config/marketing-matrix.types";

const id = z.string().regex(/^synthetic-[a-z0-9-]{1,64}$/);
const date = z.string().datetime();
const minor = z.string().regex(/^(0|[1-9][0-9]{0,17})$/);
const text = z
  .string()
  .min(1)
  .max(2000)
  .refine((s) => !/[@\u0000-\u0008]/.test(s));
const count = z.number().int().min(0).max(100000);
const ProjectSchema = z.enum(["automecanik", "other-project"]);
const ContactSchema = z
  .object({
    project: ProjectSchema,
    customer_id: id,
    identity_verified: z.boolean(),
    consent: z
      .object({
        brand: ProjectSchema,
        purpose: z.enum(["marketing", "service"]),
        channel: z.enum(["email", "sms"]),
        granted_at: date,
      })
      .strict()
      .nullable(),
    opposed: z.boolean(),
    sent_in_window: count,
    purchases: z
      .array(
        z
          .object({
            at: date,
            net_minor: minor,
            currency: z.enum(["EUR", "USD"]),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
const SourceSchema = z
  .object({
    id,
    kind: z.enum(["wiki", "business"]),
    validated: z.boolean(),
    observed_at: date,
    valid_until: date,
    text,
    url: z
      .string()
      .url()
      .max(500)
      .refine((s) => {
        const u = new URL(s);
        return (
          u.protocol === "https:" &&
          u.hostname === "example.invalid" &&
          !u.username &&
          !u.password &&
          !u.search &&
          !u.hash
        );
      }),
    compatibility_verified: z.boolean().optional(),
  })
  .strict();
const ContentSchema = z
  .object({
    version: z.string().regex(/^[0-9]{1,6}$/),
    language: z.literal("fr"),
    subject: text,
    intro: text,
    cta: text,
    claims: z
      .array(
        z
          .object({
            source_id: id,
            kind: z.enum(["advice", "price", "stock", "compatibility"]),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();
const RulesSchema = z
  .object({
    inactive_days: z.number().int().min(1).max(3650),
    recent_purchase_days: z.number().int().min(1).max(365),
    history_days: z.number().int().min(1).max(3650),
    max_data_age_hours: z.number().int().min(1).max(168),
    max_contacts: z.number().int().min(1).max(1000),
    max_per_contact: z.number().int().min(1).max(10),
    max_total: z.number().int().min(1).max(1000),
  })
  .strict()
  .refine(
    (r) =>
      r.recent_purchase_days <= r.inactive_days &&
      r.inactive_days <= r.history_days,
  );
const EventSchema = z
  .object({
    project: ProjectSchema,
    event_id: id,
    message_id: id,
    kind: z.enum([
      "accepted",
      "delivered",
      "clicked",
      "uncertain",
      "cancelled",
      "order_confirmed",
      "refund",
      "cost",
    ]),
    at: date,
    order_id: id.optional(),
    amount_minor: minor.optional(),
    currency: z.enum(["EUR", "USD"]).optional(),
  })
  .strict()
  .refine(
    (e) =>
      !["order_confirmed", "refund", "cost"].includes(e.kind) ||
      (!!e.amount_minor && !!e.currency && (e.kind === "cost" || !!e.order_id)),
  );
const NewsletterSchema = ContentSchema.omit({ claims: true }).extend({
  claims: z
    .array(
      z
        .object({
          source_id: id,
          kind: z.enum(["advice", "price", "stock", "compatibility"]),
          text,
          source_url: z.string().url(),
        })
        .strict(),
    )
    .max(20),
});
export const PilotPayloadSchema = z
  .object({
    project: z.literal("automecanik"),
    environment: z.literal("DEV"),
    run_id: id,
    schema_version: z.literal("1.0.0"),
    skill_version: z.literal("1.0.0"),
    data_at: date,
    audience_rules: RulesSchema,
    newsletter: NewsletterSchema,
    source_refs: z.array(id).max(30),
    synthetic: z.literal(true),
  })
  .strict();
export const PilotInputSchema = z
  .object({
    project: z.literal("automecanik"),
    environment: z.literal("DEV"),
    synthetic: z.literal(true),
    run_id: id,
    as_of: date,
    data_at: date,
    rules: RulesSchema,
    contacts: z.array(ContactSchema).max(1000),
    sources: z.array(SourceSchema).max(30),
    content: ContentSchema,
    events: z.array(EventSchema).max(3000),
    cancelled: z.boolean().default(false),
  })
  .strict();
type PilotInput = z.infer<typeof PilotInputSchema>;
const DAY = 86400000;
const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function unique<T>(rows: T[], key: (row: T) => string, code: string): T[] {
  const seen = new Map<string, T>();
  for (const row of rows) {
    const k = key(row),
      previous = seen.get(k);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row))
      throw new Error(code);
    if (!previous) seen.set(k, row);
  }
  return [...seen.values()];
}
function audienceOf(f: PilotInput) {
  const now = Date.parse(f.as_of);
  let selected = 0;
  return unique(
    f.contacts,
    (c) => c.project + ":" + c.customer_id,
    "CONFLICTING_IDENTITY",
  ).map((c) => {
    const reasons: string[] = [];
    if (c.project !== f.project)
      return {
        customer_id: c.customer_id,
        project: c.project,
        included: false,
        reasons: ["project_mismatch"],
        recency_days: null,
        frequency: 0,
        value_by_currency: {} as Record<string, string>,
      };
    const purchases = c.purchases.filter(
      (p) => now - Date.parse(p.at) <= f.rules.history_days * DAY,
    );
    const recency = purchases.length
      ? Math.floor(
          (now - Math.max(...purchases.map((p) => Date.parse(p.at)))) / DAY,
        )
      : null;
    const sums: Record<string, bigint> = {};
    for (const p of purchases)
      sums[p.currency] = (sums[p.currency] ?? 0n) + BigInt(p.net_minor);
    if (!c.identity_verified) reasons.push("identity_unverified");
    if (
      !c.consent ||
      c.consent.brand !== f.project ||
      c.consent.purpose !== "marketing" ||
      c.consent.channel !== "email" ||
      Date.parse(c.consent.granted_at) > now
    )
      reasons.push("consent_unverified");
    if (c.opposed) reasons.push("opposed");
    if (recency === null) reasons.push("history_missing");
    else if (recency < f.rules.recent_purchase_days)
      reasons.push("recent_purchase");
    else if (recency < f.rules.inactive_days) reasons.push("not_inactive");
    if (c.sent_in_window >= f.rules.max_per_contact)
      reasons.push("contact_cap");
    if (!reasons.length && selected >= f.rules.max_total)
      reasons.push("campaign_cap");
    if (!reasons.length) selected++;
    return {
      customer_id: c.customer_id,
      project: c.project,
      included: !reasons.length,
      reasons: reasons.length ? reasons : ["inactive_with_scoped_consent"],
      recency_days: recency,
      frequency: purchases.length,
      value_by_currency: Object.fromEntries(
        Object.entries(sums).map(([k, v]) => [k, v.toString()]),
      ),
    };
  });
}
function performanceOf(f: PilotInput) {
  const events = unique(
    f.events,
    (e) => e.project + ":" + e.event_id,
    "CONFLICTING_EVENT",
  ).filter((e) => e.project === f.project);
  const messages = new Map<string, Set<string>>();
  const orders = new Map<string, string>();
  const gross: Record<string, bigint> = {},
    refunds: Record<string, bigint> = {},
    costs: Record<string, bigint> = {};
  for (const e of events) {
    const states = messages.get(e.message_id) ?? new Set<string>();
    states.add(e.kind);
    messages.set(e.message_id, states);
    if (e.kind === "order_confirmed") {
      const k = e.order_id!,
        signature = e.currency + ":" + e.amount_minor;
      if (orders.has(k) && orders.get(k) !== signature)
        throw new Error("CONFLICTING_ORDER");
      if (!orders.has(k)) {
        orders.set(k, signature);
        gross[e.currency!] =
          (gross[e.currency!] ?? 0n) + BigInt(e.amount_minor!);
      }
    }
    if (e.kind === "refund")
      refunds[e.currency!] =
        (refunds[e.currency!] ?? 0n) + BigInt(e.amount_minor!);
    if (e.kind === "cost")
      costs[e.currency!] = (costs[e.currency!] ?? 0n) + BigInt(e.amount_minor!);
  }
  // Reconcile after the fold so refunds may arrive before their orders.
  const refundedByOrder = new Map<string, bigint>();
  for (const e of events.filter((e) => e.kind === "refund")) {
    const order = orders.get(e.order_id!);
    if (!order || order.split(":")[0] !== e.currency)
      throw new Error("UNRECONCILED_REFUND");
    const total =
      (refundedByOrder.get(e.order_id!) ?? 0n) + BigInt(e.amount_minor!);
    if (total > BigInt(order.split(":")[1]))
      throw new Error("UNRECONCILED_REFUND");
    refundedByOrder.set(e.order_id!, total);
  }
  const states = [...messages.values()];
  const net = Object.fromEntries(
    [...new Set([...Object.keys(gross), ...Object.keys(refunds)])]
      .sort()
      .map((c) => [c, ((gross[c] ?? 0n) - (refunds[c] ?? 0n)).toString()]),
  );
  return {
    synthetic: true as const,
    accepted: states.filter((s) => s.has("accepted")).length,
    delivered: states.filter((s) => s.has("delivered")).length,
    clicked: states.filter((s) => s.has("clicked")).length,
    uncertain: states.filter(
      (s) => s.has("uncertain") && !s.has("accepted") && !s.has("delivered"),
    ).length,
    confirmed_orders: orders.size,
    net_minor_by_currency: net,
    cost_minor_by_currency: Object.fromEntries(
      Object.entries(costs)
        .sort()
        .map(([k, v]) => [k, v.toString()]),
    ),
    retry_authorized: false as const,
    causal_effect: "not_measured" as const,
    limitations: [
      "Synthetic observations only; no provider receipt or real revenue.",
      "No attribution inferred from a click; no control group or causal estimate.",
    ],
  };
}
export function runPilot(input: unknown) {
  const parsed = PilotInputSchema.safeParse(input);
  if (!parsed.success) throw new Error("INVALID_INPUT");
  const f = parsed.data,
    now = Date.parse(f.as_of),
    dataAt = Date.parse(f.data_at);
  if (dataAt > now) throw new Error("FUTURE_DATA");
  if (now - dataAt > f.rules.max_data_age_hours * 3600000)
    throw new Error("STALE_DATA");
  if (f.contacts.length > f.rules.max_contacts)
    throw new Error("CONTACT_LIMIT");
  if (
    f.contacts.some((c) =>
      c.purchases.some((p) => Date.parse(p.at) > dataAt),
    ) ||
    f.events.some((e) => Date.parse(e.at) > dataAt)
  )
    throw new Error("FUTURE_DATA");
  const sources = unique(f.sources, (s) => s.id, "CONFLICTING_SOURCE");
  const blockers = [
    "external_approval_not_connected",
    "marketing_sender_not_connected",
  ];
  const claims = f.content.claims.flatMap((claim) => {
    const source = sources.find((s) => s.id === claim.source_id);
    let reason: string | undefined;
    if (!source || !source.validated) reason = "source_unverified";
    else if (
      Date.parse(source.observed_at) > dataAt ||
      Date.parse(source.valid_until) <= now ||
      now - Date.parse(source.observed_at) >
        f.rules.max_data_age_hours * 3600000
    )
      reason = "source_stale";
    else if (claim.kind === "advice" && source.kind !== "wiki")
      reason = "wiki_required";
    else if (claim.kind !== "advice" && source.kind !== "business")
      reason = "business_source_required";
    else if (claim.kind === "compatibility" && !source.compatibility_verified)
      reason = "compatibility_unknown";
    if (reason) {
      blockers.push(reason);
      return [];
    }
    return [{ ...claim, text: source!.text, source_url: source!.url }];
  });
  const audience = audienceOf(f);
  const coverage_manifest = CoverageManifestSchema.parse({
    scope_requested: "AutoMecanik synthetic reactivation preparation",
    scope_actually_scanned:
      "One bounded synthetic fixture; no live source queried",
    files_read_count: 1,
    excluded_paths: ["PROD", "RAW", "RAG"],
    unscanned_zones: ["Live consent, inventory, customer and provider APIs"],
    corrections_proposed: [],
    validation_executed: true,
    remaining_unknowns: [
      "External approval and sender capabilities",
      "Real measurement, source truth and runtime permissions",
    ],
    final_status: "VALIDATED_FOR_SCOPE_ONLY",
  });
  const newsletter = { ...f.content, claims };
  const brief = CreateMarketingBriefSchema.parse({
    agent_id: "CUSTOMER_RETENTION",
    business_unit: MarketingBusinessUnit.ECOMMERCE,
    channel: MarketingChannel.EMAIL,
    conversion_goal: MarketingConversionGoal.ORDER,
    cta: f.content.cta,
    target_segment:
      "Synthetic inactivity >= " +
      f.rules.inactive_days +
      " days; scoped consent",
    payload: {
      project: f.project,
      environment: f.environment,
      run_id: f.run_id,
      schema_version: "1.0.0",
      skill_version: "1.0.0",
      data_at: f.data_at,
      audience_rules: f.rules,
      newsletter,
      source_refs: sources.map((s) => s.id),
      synthetic: true,
    },
    coverage_manifest,
  });
  const approval_request = {
    project: f.project,
    environment: f.environment,
    run_id: f.run_id,
    content_version: f.content.version,
    content: newsletter,
    audience_rules: f.rules,
    source_refs: sources.map((s) => s.id),
    sender: "unconfigured",
    channel: "email",
    send_window: null,
    expires_at: null,
    limits: {
      max_total: f.rules.max_total,
      max_per_contact: f.rules.max_per_contact,
    },
    verification: "external_authority_required",
  };
  const result = {
    project: f.project,
    environment: f.environment,
    run_id: f.run_id,
    schema_version: "1.0.0",
    skill_version: "1.0.0",
    status: "draft" as const,
    data_at: f.data_at,
    as_of: f.as_of,
    source_refs: sources.map((s) => ({
      id: s.id,
      kind: s.kind,
      observed_at: s.observed_at,
      valid_until: s.valid_until,
      synthetic: true,
    })),
    brief,
    audience,
    approval_request,
    preview_html:
      '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Brouillon fictif</title><body><h1>' +
      escapeHtml(f.content.subject) +
      "</h1><p>" +
      escapeHtml(f.content.intro) +
      "</p>" +
      claims.map((c) => "<p>" + escapeHtml(c.text) + "</p>").join("") +
      "<p>" +
      escapeHtml(f.content.cta) +
      "</p><p>Simulation uniquement. Aucun destinataire réel. Revue humaine requise.</p></body></html>",
    validation: {
      can_execute: false as const,
      status: "REVIEW_REQUIRED" as const,
      blockers: [...new Set(blockers)],
      unknowns: coverage_manifest.remaining_unknowns,
      proposed_actions: [
        "Human content/source review",
        "Request scoped external approval and sender integration separately",
      ],
    },
    simulation: {
      transport: "none" as const,
      real_sends: 0 as const,
      candidates: f.cancelled ? 0 : audience.filter((c) => c.included).length,
      cancelled: f.cancelled,
    },
    performance: performanceOf(f),
    coverage_manifest,
  };
  validateResult(result);
  return result;
}
export type PilotResult = ReturnType<typeof runPilot>;
export function validateResult(input: unknown): void {
  const schema = z.object({
    project: z.literal("automecanik"),
    environment: z.literal("DEV"),
    run_id: id,
    schema_version: z.literal("1.0.0"),
    skill_version: z.literal("1.0.0"),
    status: z.literal("draft"),
    brief: CreateMarketingBriefSchema,
    coverage_manifest: CoverageManifestSchema,
    validation: z.object({
      can_execute: z.literal(false),
      status: z.literal("REVIEW_REQUIRED"),
      blockers: z.array(z.string()).min(1),
    }),
    simulation: z.object({
      transport: z.literal("none"),
      real_sends: z.literal(0),
      candidates: count,
      cancelled: z.boolean(),
    }),
    data_at: date,
    as_of: date,
    preview_html: z.string().min(1),
    source_refs: z.array(
      z
        .object({
          id,
          kind: z.enum(["wiki", "business"]),
          observed_at: date,
          valid_until: date,
          synthetic: z.literal(true),
        })
        .strict(),
    ),
    audience: z.array(
      z
        .object({
          customer_id: id,
          project: ProjectSchema,
          included: z.boolean(),
          reasons: z.array(z.string()).min(1),
          recency_days: count.nullable(),
          frequency: count,
          value_by_currency: z.record(z.string(), minor),
        })
        .strict(),
    ),
    approval_request: z
      .object({
        project: z.literal("automecanik"),
        environment: z.literal("DEV"),
        run_id: id,
        content_version: z.string(),
        content: NewsletterSchema,
        audience_rules: RulesSchema,
        source_refs: z.array(id),
        sender: z.literal("unconfigured"),
        channel: z.literal("email"),
        send_window: z.null(),
        expires_at: z.null(),
        limits: z.object({ max_total: count, max_per_contact: count }),
        verification: z.literal("external_authority_required"),
      })
      .strict(),
    performance: z
      .object({
        synthetic: z.literal(true),
        accepted: count,
        delivered: count,
        clicked: count,
        uncertain: count,
        confirmed_orders: count,
        net_minor_by_currency: z.record(
          z.string(),
          z.string().regex(/^-?[0-9]+$/),
        ),
        cost_minor_by_currency: z.record(z.string(), minor),
        retry_authorized: z.literal(false),
        causal_effect: z.literal("not_measured"),
        limitations: z.array(z.string()),
      })
      .strict(),
  });
  const result = schema.safeParse(input);
  if (
    !result.success ||
    !PilotPayloadSchema.safeParse(result.data.brief.payload).success
  )
    throw new Error("INVALID_OUTPUT");
}

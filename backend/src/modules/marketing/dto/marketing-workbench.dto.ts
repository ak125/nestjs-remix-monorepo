import { z } from 'zod';

// Offline preparation contracts. These are NOT trusted production adapters.
export const fixtureId = z.string().regex(/^synthetic-[a-z0-9-]{1,80}$/);
export const timestamp = z.string().datetime();
export const minorUnits = z.string().regex(/^(0|[1-9][0-9]{0,17})$/);
export const currency = z.enum(['EUR', 'USD']);
export const boundedText = z.string().min(1).max(2000);
export const safeFixtureUrl = z
  .string()
  .url()
  .max(500)
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'example.invalid' &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  });
export const ContextSchema = z
  .object({
    project: z.literal('automecanik'),
    environment: z.literal('DEV'),
    synthetic: z.literal(true),
    run_id: fixtureId,
    as_of: timestamp,
    data_at: timestamp,
    max_age_hours: z.number().int().min(1).max(168),
  })
  .strict();
export type WorkContext = z.infer<typeof ContextSchema>;
export const PreferenceSchema = z
  .object({
    channel: z.enum(['email', 'sms', 'whatsapp']),
    brand: z.literal('automecanik'),
    purpose: z.enum(['marketing', 'service']),
    state: z.enum(['granted', 'refused', 'unknown']),
    at: timestamp,
    evidence_ref: fixtureId.nullable(),
  })
  .strict();
export const VehicleSchema = z
  .object({
    id: fixtureId,
    engine: fixtureId.nullable(),
    year: z.number().int().min(1900).max(2100).nullable(),
    axle: z.enum(['front', 'rear']).nullable(),
    side: z.enum(['left', 'right', 'both']).nullable(),
    source_ref: fixtureId,
    declared: z.boolean(),
  })
  .strict();
export const WorkContactSchema = z
  .object({
    project: z.enum(['automecanik', 'other-project']),
    id: fixtureId,
    email: z.string().regex(/^synthetic-[a-z0-9.+-]+@example\.invalid$/i),
    identity_verified: z.boolean(),
    audience: z.enum(['private', 'professional', 'unknown']),
    audience_declared: z.boolean(),
    language: z.enum(['fr', 'en']).nullable(),
    opposed: z.boolean(),
    paused_until: timestamp.nullable(),
    complaint: z.boolean(),
    hard_bounce: z.boolean(),
    erased: z.boolean(),
    preferences: z.array(PreferenceSchema).max(20),
    vehicles: z.array(VehicleSchema).max(10),
    history_complete: z.boolean(),
    purchases: z
      .array(
        z
          .object({
            id: fixtureId,
            at: timestamp,
            category: fixtureId,
            net_minor: minorUnits,
            currency,
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export type WorkContact = z.infer<typeof WorkContactSchema>;
export const SourceSchema = z
  .object({
    id: fixtureId,
    kind: z.enum(['wiki', 'business', 'public']),
    validated: z.boolean(),
    observed_at: timestamp,
    valid_until: timestamp,
    text: boundedText,
    url: safeFixtureUrl,
  })
  .strict();
export type WorkSource = z.infer<typeof SourceSchema>;
export const ProductSchema = z
  .object({
    id: fixtureId,
    variant: fixtureId,
    label: boundedText,
    source_ref: fixtureId,
    valid_until: timestamp,
    stock: z.number().int().min(0).max(100000),
    price_minor: minorUnits.nullable(),
    currency,
    price_basis: z.enum(['unit_ttc', 'unit_ht']),
    audience: z.enum(['all', 'professional']),
    rights_verified: z.boolean(),
    fitments: z
      .array(
        z
          .object({
            vehicle_id: fixtureId,
            engine: fixtureId,
            year: z.number().int().min(1900).max(2100),
            axle: z.enum(['front', 'rear']),
            side: z.enum(['left', 'right', 'both']),
            evidence_ref: fixtureId,
            verified: z.boolean(),
            valid_until: timestamp,
          })
          .strict(),
      )
      .max(50),
    kit_components: z.array(fixtureId).max(10),
    kit_complete: z.boolean(),
  })
  .strict();
export type WorkProduct = z.infer<typeof ProductSchema>;
export const EventSchema = z
  .object({
    id: fixtureId,
    project: z.enum(['automecanik', 'other-project']),
    contact_id: fixtureId,
    object_id: fixtureId,
    kind: z.enum([
      'confirmed_signup',
      'view',
      'cart',
      'purchase',
      'delivered',
      'reply',
      'refusal',
      'support',
      'maintenance_done',
      'stock',
      'price_drop',
      'review_request',
      'accepted',
      'uncertain',
      'cancelled',
      'click',
      'open',
      'complaint',
      'hard_bounce',
    ]),
    occurred_at: timestamp,
    received_at: timestamp,
    verified: z.boolean(),
    bot: z.boolean(),
  })
  .strict();
export type WorkEvent = z.infer<typeof EventSchema>;
export type SegmentRule =
  | { op: 'all' | 'any'; rules: SegmentRule[] }
  | { op: 'not'; rule: SegmentRule }
  | { op: 'audience'; value: WorkContact['audience'] }
  | { op: 'inactive'; days: number }
  | { op: 'count'; kind: WorkEvent['kind']; days: number; min: number }
  | {
      op: 'sequence';
      first: WorkEvent['kind'];
      then: WorkEvent['kind'];
      days: number;
    };
// Depth is bounded before recursive parsing, including adversarial inputs.
const RuleSchema: z.ZodType<SegmentRule> = z.lazy(() =>
  z.discriminatedUnion('op', [
    z
      .object({
        op: z.enum(['all', 'any']),
        rules: z.array(RuleSchema).min(1).max(10),
      })
      .strict(),
    z.object({ op: z.literal('not'), rule: RuleSchema }).strict(),
    z
      .object({
        op: z.literal('audience'),
        value: z.enum(['private', 'professional', 'unknown']),
      })
      .strict(),
    z
      .object({
        op: z.literal('inactive'),
        days: z.number().int().min(1).max(3650),
      })
      .strict(),
    z
      .object({
        op: z.literal('count'),
        kind: EventSchema.shape.kind,
        days: z.number().int().min(1).max(3650),
        min: z.number().int().min(0).max(10000),
      })
      .strict(),
    z
      .object({
        op: z.literal('sequence'),
        first: EventSchema.shape.kind,
        then: EventSchema.shape.kind,
        days: z.number().int().min(1).max(3650),
      })
      .strict(),
  ]),
);
export function parseSegment(value: unknown): SegmentRule {
  const visit = (v: unknown, depth: number, seen: Set<unknown>): void => {
    if (depth > 6 || seen.has(v)) throw new Error('SEGMENT_LIMIT');
    if (v && typeof v === 'object') {
      seen.add(v);
      for (const child of Object.values(v)) visit(child, depth + 1, seen);
      seen.delete(v);
    }
  };
  visit(value, 0, new Set());
  return checked(RuleSchema, value);
}
export function checked<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error('INVALID_WORKBENCH_INPUT');
  return result.data;
}
export function context(value: unknown): WorkContext {
  const c = checked(ContextSchema, value);
  const age = Date.parse(c.as_of) - Date.parse(c.data_at);
  if (age < 0 || age > c.max_age_hours * 3600000)
    throw new Error('STALE_WORKBENCH_DATA');
  return c;
}
export function currentSource(s: WorkSource, c: WorkContext): boolean {
  return (
    s.validated &&
    Date.parse(s.observed_at) <= Date.parse(c.data_at) &&
    Date.parse(s.valid_until) > Date.parse(c.as_of) &&
    Date.parse(c.as_of) - Date.parse(s.observed_at) <= c.max_age_hours * 3600000
  );
}
export const ScenarioSchema = z
  .object({
    id: z.string().regex(/^J(0[1-9]|1[0-8])$/),
    contact_id: fixtureId,
    object_id: fixtureId,
    vehicle_id: fixtureId,
    product_id: fixtureId,
    trigger_at: timestamp,
    trigger_event_id: fixtureId.nullable().default(null),
    content_source_refs: z
      .array(fixtureId)
      .max(3)
      .refine((refs) => new Set(refs).size === refs.length)
      .default([]),
    expires_at: timestamp,
    delay_hours: z.number().int().min(0).max(8760),
    inactive_days: z.number().int().min(1).max(3650),
    facts: z
      .object({
        receipt_verified: z.boolean(),
        confirmed: z.boolean(),
        status: z.enum([
          'active',
          'paid',
          'delivered',
          'returned',
          'cancelled',
          'replaced',
          'expired',
        ]),
        version: z.string().min(1).max(20),
        current_version: z.string().min(1).max(20),
        source_ref: fixtureId,
        programme_verified: z.boolean(),
        self_referral: z.boolean(),
        net_value_minor: minorUnits,
        threshold_minor: minorUnits,
        due_at: timestamp.nullable(),
        previous_price_minor: minorUnits.nullable(),
        previous_variant: fixtureId,
        previous_basis: z.enum(['unit_ttc', 'unit_ht']),
        previous_currency: currency,
      })
      .strict(),
  })
  .strict();
export type Scenario = z.infer<typeof ScenarioSchema>;
export const WorkspaceSchema = z
  .object({
    context: ContextSchema,
    contacts: z.array(WorkContactSchema).max(1000),
    sources: z.array(SourceSchema).max(100),
    products: z.array(ProductSchema).max(100),
    events: z.array(EventSchema).max(10000),
    scenarios: z.array(ScenarioSchema).max(18),
  })
  .strict();
export type Workspace = z.infer<typeof WorkspaceSchema>;
export function contactEmailKey(email: string): string {
  const [local, domain] = email.split('@');
  return `${local}@${domain.toLowerCase()}`;
}

/** Shared contact invariants for import and every workspace consumer. */
function assertContactFacts(contacts: WorkContact[], c: WorkContext): void {
  if (
    new Set(contacts.map((x) => `${x.project}:${x.id}`)).size !==
    contacts.length
  )
    throw new Error('DUPLICATE_OBJECT');
  if (
    new Set(contacts.map((x) => `${x.project}:${contactEmailKey(x.email)}`))
      .size !== contacts.length
  )
    throw new Error('AMBIGUOUS_CONTACT_IDENTITY');
  if (
    contacts.some(
      (c) =>
        new Set(c.purchases.map((x) => x.id)).size !== c.purchases.length ||
        new Set(c.vehicles.map((x) => x.id)).size !== c.vehicles.length,
    )
  )
    throw new Error('DUPLICATE_OBJECT');
  if (
    contacts.some((contact) =>
      [...contact.purchases, ...contact.preferences].some(
        (p) => Date.parse(p.at) > Date.parse(c.data_at),
      ),
    )
  )
    throw new Error('FUTURE_WORKBENCH_DATA');
}

export function contactSnapshot(ctx: unknown, value: unknown): WorkContact[] {
  const c = context(ctx);
  const contacts = checked(WorkspaceSchema.shape.contacts, value);
  assertContactFacts(contacts, c);
  return contacts;
}

export function workspace(value: unknown): Workspace {
  const w = checked(WorkspaceSchema, value);
  context(w.context);
  assertContactFacts(w.contacts, w.context);
  for (const rows of [w.sources, w.products, w.scenarios]) {
    if (new Set(rows.map((x) => x.id)).size !== rows.length)
      throw new Error('DUPLICATE_OBJECT');
  }
  const seenEvents = new Map<string, string>();
  for (const event of w.events) {
    const key = `${event.project}:${event.id}`,
      body = JSON.stringify(event);
    if (seenEvents.has(key) && seenEvents.get(key) !== body)
      throw new Error('CONFLICTING_EVENT');
    seenEvents.set(key, body);
  }
  if (
    w.events.some(
      (e) =>
        Date.parse(e.occurred_at) > Date.parse(e.received_at) ||
        Date.parse(e.received_at) > Date.parse(w.context.data_at),
    )
  )
    throw new Error('FUTURE_WORKBENCH_DATA');
  return w;
}

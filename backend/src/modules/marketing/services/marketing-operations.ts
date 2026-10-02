import { z } from 'zod';
import {
  checked,
  context,
  fixtureId,
  minorUnits,
  timestamp,
  workspace,
} from '../dto/marketing-workbench.dto';
import { eligibility } from './marketing-preparation';

const Channel = z.enum(['email', 'sms', 'whatsapp', 'social']);
const ProposalSchema = z
  .object({
    id: fixtureId,
    contact_id: fixtureId,
    account: fixtureId,
    channel: Channel,
    priority: z.number().int().min(0).max(100),
    template: fixtureId,
    version: z.string().min(1).max(20),
    rights_verified: z.boolean(),
  })
  .strict();
const ReceiptSchema = ProposalSchema.extend({
  at: timestamp,
  state: z.enum(['accepted', 'uncertain', 'cancelled']),
});
const PolicySchema = z
  .object({
    account: fixtureId,
    timezone: z.string().min(1).max(80),
    window: z.enum(['calendar', 'rolling']),
    hours: z.number().int().min(1).max(720),
    contact_limit: z.number().int().min(0).max(100),
    account_limit: z.number().int().min(0).max(10000),
    channel_limit: z.number().int().min(0).max(10000),
    start_hour: z.number().int().min(0).max(23),
    end_hour: z.number().int().min(1).max(24),
    max_cost_minor: minorUnits,
    unit_cost_minor: minorUnits.nullable(),
  })
  .strict();
function clockParts(at: string, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(at));
    const part = (name: string) => parts.find((x) => x.type === name)!.value;
    return {
      day: `${part('year')}-${part('month')}-${part('day')}`,
      hour: Number(part('hour')),
    };
  } catch {
    throw new Error('TIMEZONE_INVALID');
  }
}

/** Bounded planning of ONE supplied snapshot. There is no shared durable lock or send path. */
export function arbitrate(
  input: unknown,
  policy: unknown,
  proposals: unknown,
  receipts: unknown,
  suspended = false,
) {
  const w = workspace(input),
    p = checked(PolicySchema, policy),
    rows = checked(z.array(ProposalSchema).max(1000), proposals),
    history = checked(z.array(ReceiptSchema).max(10000), receipts);
  if (p.start_hour >= p.end_hour) throw new Error('INVALID_WINDOW');
  if (p.window === 'calendar' && p.hours !== 24)
    throw new Error('UNSUPPORTED_CALENDAR_WINDOW');
  checked(z.boolean(), suspended);
  const now = Date.parse(w.context.as_of),
    local = clockParts(w.context.as_of, p.timezone);
  if (new Set(rows.map((x) => x.id)).size !== rows.length)
    throw new Error('DUPLICATE_PROPOSAL');
  const unique = new Map<string, z.infer<typeof ReceiptSchema>>();
  for (const h of history) {
    if (Date.parse(h.at) > Date.parse(w.context.data_at))
      throw new Error('FUTURE_WORKBENCH_DATA');
    if (
      unique.has(h.id) &&
      JSON.stringify(unique.get(h.id)) !== JSON.stringify(h)
    )
      throw new Error('CONFLICTING_RECEIPT');
    unique.set(h.id, h);
  }
  // An idempotency key cannot be rebound to another target or content.
  // Priority and current rights are reevaluated independently of that binding.
  for (const row of rows) {
    const prior = unique.get(row.id);
    if (
      prior &&
      (prior.contact_id !== row.contact_id ||
        prior.account !== row.account ||
        prior.channel !== row.channel ||
        prior.template !== row.template ||
        prior.version !== row.version)
    )
      throw new Error('PROPOSAL_RECEIPT_MISMATCH');
  }
  const active = [...unique.values()].filter(
    (h) =>
      h.state !== 'cancelled' &&
      (p.window === 'calendar'
        ? clockParts(h.at, p.timezone).day === local.day
        : now - Date.parse(h.at) < p.hours * 3600000),
  );
  let reservedCost = 0n;
  const decisions = rows
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
    .map((row) => {
      const reasons: string[] = [];
      let decision: 'prepare' | 'exclude' | 'defer' | 'human' = 'prepare';
      const c = w.contacts.find(
        (x) => x.id === row.contact_id && x.project === w.context.project,
      );
      if (suspended) reasons.push('suspended');
      if (row.account !== p.account) reasons.push('account_mismatch');
      if (!row.rights_verified) reasons.push('rights_unverified');
      if (!c) reasons.push('contact_unknown');
      else
        reasons.push(
          ...eligibility(
            c,
            w,
            row.channel === 'social' ? 'email' : row.channel,
          ),
        );
      if (reasons.length) decision = 'exclude';
      const prior = unique.get(row.id);
      if (decision === 'prepare' && prior) {
        decision = prior.state === 'uncertain' ? 'human' : 'exclude';
        reasons.push(
          prior.state === 'uncertain'
            ? 'reconcile_before_retry'
            : `already_${prior.state}`,
        );
      }
      if (decision === 'prepare' && row.channel !== 'email') {
        decision = 'human';
        reasons.push('channel_template_cost_adapter_unavailable');
      }
      if (decision === 'prepare' && p.unit_cost_minor === null) {
        decision = 'human';
        reasons.push('cost_unknown');
      }
      if (decision === 'prepare') {
        if (local.hour < p.start_hour || local.hour >= p.end_hour)
          reasons.push('outside_local_hours');
        if (
          active.filter((h) => h.contact_id === row.contact_id).length >=
          p.contact_limit
        )
          reasons.push('contact_limit');
        if (
          active.filter((h) => h.account === p.account).length >=
          p.account_limit
        )
          reasons.push('account_limit');
        if (
          active.filter(
            (h) => h.account === p.account && h.channel === row.channel,
          ).length >= p.channel_limit
        )
          reasons.push('channel_limit');
        if (
          reservedCost + BigInt(p.unit_cost_minor!) >
          BigInt(p.max_cost_minor)
        )
          reasons.push('plan_cost_limit');
        if (reasons.length) decision = 'defer';
        else {
          active.push({ ...row, at: w.context.as_of, state: 'accepted' });
          reservedCost += BigInt(p.unit_cost_minor!);
        }
      }
      return {
        id: row.id,
        decision,
        reasons,
        contact_id: row.contact_id,
        channel: row.channel,
      };
    });
  return {
    synthetic: true,
    decisions,
    reserved_cost_minor: reservedCost.toString(),
    external_sends: 0,
    atomic_across_processes: false,
    accepted_messages_recalled: false,
    scope: 'single_supplied_snapshot',
    cost_scope: 'new_proposals_only',
    contact_limit_scope: 'all_supplied_accounts_in_project',
    account_and_channel_limit_scope: 'policy_account',
    next_check:
      'Re-read authority, preferences, business data and shared provider limits immediately before any authorized send',
  };
}

const RequestSchema = z
  .object({
    project: z.literal('automecanik'),
    environment: z.literal('DEV'),
    account: fixtureId,
    operation: z.enum(['prepare', 'request_send', 'request_suspend']),
    family: z.string().regex(/^J(0[1-9]|1[0-8])$/),
    template: fixtureId,
    version: z.string().min(1).max(20),
    audience_rule: fixtureId,
    max_contacts: z.number().int().min(0).max(1000),
    max_cost_minor: minorUnits,
    timezone: z.string().max(80),
    expires_at: timestamp,
    suspended: z.boolean(),
  })
  .strict();
/** A REQUEST is not authority. No argument accepts an approval response or forged file. */
export function inspectExecution(ctx: unknown, request: unknown) {
  const c = context(ctx),
    r = checked(RequestSchema, request);
  clockParts(c.as_of, r.timezone);
  const reasons = [
    'approval_authority_unavailable',
    'sender_adapter_unavailable',
    'shared_reservation_unavailable',
  ];
  if (Date.parse(r.expires_at) <= Date.parse(c.as_of))
    reasons.push('request_expired');
  if (r.suspended) reasons.push('suspended');
  return {
    request: r,
    executable: false,
    authority: 'not_connected',
    reasons,
    required_binding: [
      'project',
      'environment',
      'account',
      'operation',
      'family',
      'template',
      'version',
      'audience_rule',
      'max_contacts',
      'max_cost_minor',
      'frequency_policy',
      'timezone',
      'expires_at',
      'revocation',
      'suspension',
    ],
    activation: 'not_requested',
  };
}
export function deliveryReadiness(input: unknown) {
  const state = z.enum(['verified', 'failed', 'unknown']);
  const s = checked(
    z
      .object({
        spf: state,
        dkim: state,
        dmarc: state,
        alignment: state,
        unsubscribe: state,
        sender: state,
        feedback: state,
      })
      .strict(),
    input,
  );
  return {
    ready: Object.values(s).every((x) => x === 'verified'),
    checks: s,
    missing_or_failed: Object.entries(s)
      .filter(([, v]) => v !== 'verified')
      .map(([k]) => k),
    scope: 'supplied_snapshot_only',
    live_audit: false,
    inbox_guarantee: false,
  };
}
export function privacyPreview(
  input: unknown,
  contactId: string,
  operation: 'export' | 'erase',
) {
  const w = workspace(input);
  checked(fixtureId, contactId);
  checked(z.enum(['export', 'erase']), operation);
  const c = w.contacts.find(
    (x) => x.project === w.context.project && x.id === contactId,
  );
  if (!c) throw new Error('CONTACT_UNKNOWN');
  return {
    operation,
    project: w.context.project,
    contact_id: c.id,
    persisted: false,
    authorization: 'required_from_existing_service',
    export_fields:
      operation === 'export'
        ? ['identity', 'declared_preferences', 'linked_object_references']
        : [],
    tombstone:
      operation === 'erase'
        ? { id: c.id, project: c.project, opposed: true, erased: true }
        : null,
    retention_policy: 'unavailable_requires_owner_decision',
    backups: 'not_modified',
    opposition_minimum: 'subject_to_applicable_retention_policy',
  };
}
export function capabilities() {
  return [
    'source_read',
    'consent_read',
    'email',
    'sms',
    'whatsapp_platform',
    'social',
    'ads',
    'lead_write',
    'durable_journey',
    'approval_authority',
    'atomic_reservation',
    'privacy_write',
  ].map((name) => ({
    name,
    implementation: ['source_read', 'consent_read'].includes(name)
      ? 'synthetic_contract'
      : 'unavailable',
    connection: 'none',
    real_execution: 'unavailable',
    activation: false,
  }));
}

import { z } from 'zod';
import {
  CreateMarketingBriefSchema,
  CoverageManifestSchema,
} from '../dto/marketing-brief.dto';
import {
  MarketingBusinessUnit,
  MarketingChannel,
  MarketingConversionGoal,
} from '../../../config/marketing-matrix.types';
import { getSocialTemplate } from '../templates/social-post-templates';
import {
  checked,
  context,
  currentSource,
  fixtureId,
  minorUnits,
  currency,
  timestamp,
  WorkContactSchema,
  contactSnapshot,
  contactEmailKey,
  workspace,
  parseSegment,
  type WorkContact,
  type WorkEvent,
  type Workspace,
  type SegmentRule,
} from '../dto/marketing-workbench.dto';

const DAY = 86400000;
/** Recency evidence only: receipts do not create ledger rows, amounts or frequency. */
export function purchaseRecencyDays(
  c: WorkContact,
  events: WorkEvent[],
  asOf: string,
): number | null {
  let latest: number | null = null;
  for (const purchase of c.purchases)
    latest = Math.max(latest ?? -Infinity, Date.parse(purchase.at));
  for (const event of events) {
    if (
      event.project === c.project &&
      event.contact_id === c.id &&
      event.kind === 'purchase' &&
      event.verified &&
      !event.bot
    )
      latest = Math.max(latest ?? -Infinity, Date.parse(event.occurred_at));
  }
  return latest === null ? null : Math.floor((Date.parse(asOf) - latest) / DAY);
}

export function uniqueEvents(events: WorkEvent[]): WorkEvent[] {
  const seen = new Map<string, WorkEvent>();
  for (const event of events) {
    const key = `${event.project}:${event.id}`;
    if (
      seen.has(key) &&
      JSON.stringify(seen.get(key)) !== JSON.stringify(event)
    )
      throw new Error('CONFLICTING_EVENT');
    seen.set(key, event);
  }
  return [...seen.values()].sort(
    (a, b) =>
      Date.parse(a.occurred_at) - Date.parse(b.occurred_at) ||
      a.id.localeCompare(b.id),
  );
}
export function eligibility(
  c: WorkContact,
  w: Workspace,
  channel: 'email' | 'sms' | 'whatsapp' = 'email',
): string[] {
  const reasons: string[] = [];
  const now = Date.parse(w.context.as_of);
  if (c.project !== w.context.project) return ['project_mismatch'];
  if (!c.identity_verified) reasons.push('identity_unverified');
  if (c.erased) reasons.push('erased');
  if (c.opposed) reasons.push('opposed');
  if (
    c.complaint ||
    c.hard_bounce ||
    w.events.some(
      (e) =>
        e.project === c.project &&
        e.contact_id === c.id &&
        e.verified &&
        ['complaint', 'hard_bounce'].includes(e.kind),
    )
  )
    reasons.push('suppressed');
  if (c.paused_until && Date.parse(c.paused_until) > now)
    reasons.push('paused');
  const preferences = c.preferences.filter(
    (p) =>
      p.channel === channel &&
      p.purpose === 'marketing' &&
      p.brand === w.context.project,
  );
  const latestAt = Math.max(...preferences.map((p) => Date.parse(p.at)));
  const latest = preferences.filter((p) => Date.parse(p.at) === latestAt);
  if (
    !latest.length ||
    latest.some((p) => p.state !== 'granted' || !p.evidence_ref)
  )
    reasons.push('consent_unverified');
  if (!c.language) reasons.push('language_unknown');
  return reasons;
}

/** A preview only: no persistent contact store and no public addressed export. */
export function importPreview(
  ctx: unknown,
  existing: unknown,
  incoming: unknown,
) {
  const c = context(ctx);
  const original = contactSnapshot(c, existing);
  const rows = checked(z.array(z.unknown()).max(1000), incoming);
  const contacts = structuredClone(
    original.filter((c) => c.project === 'automecanik'),
  );
  const errors: Array<{ row: number; code: string }> = [];
  rows.forEach((raw, row) => {
    const parsed = WorkContactSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row, code: 'invalid_row' });
      return;
    }
    const value = parsed.data;
    try {
      contactSnapshot(c, [value]);
    } catch {
      errors.push({ row, code: 'invalid_row' });
      return;
    }
    value.email = contactEmailKey(value.email);
    if (value.project !== 'automecanik') {
      errors.push({ row, code: 'project_mismatch' });
      return;
    }
    if (!value.identity_verified) {
      errors.push({ row, code: 'identity_unverified' });
      return;
    }
    const matches = contacts.filter(
      (c) =>
        c.project === value.project &&
        (c.id === value.id || contactEmailKey(c.email) === value.email),
    );
    if (
      matches.length > 1 ||
      matches.some(
        (c) => c.id !== value.id || contactEmailKey(c.email) !== value.email,
      )
    ) {
      errors.push({ row, code: 'ambiguous_identity' });
      return;
    }
    const previous = matches[0];
    if (previous) {
      // Import can add refusals, but cannot grant/regrant or erase prior evidence.
      value.preferences = [
        ...new Map(
          [
            ...previous.preferences,
            ...value.preferences.filter((p) => p.state === 'refused'),
          ].map((p) => [JSON.stringify(p), p]),
        ).values(),
      ];
      // An import is additive evidence, not an authoritative history replacement.
      const purchases = new Map(previous.purchases.map((p) => [p.id, p]));
      for (const purchase of value.purchases) {
        const known = purchases.get(purchase.id);
        if (
          known &&
          (Date.parse(known.at) !== Date.parse(purchase.at) ||
            known.category !== purchase.category ||
            known.net_minor !== purchase.net_minor ||
            known.currency !== purchase.currency)
        )
          throw new Error('CONFLICTING_PURCHASE');
        if (!known) purchases.set(purchase.id, purchase);
      }
      value.purchases = [...purchases.values()];
      value.history_complete =
        previous.history_complete && value.history_complete;
      const vehicles = new Map(previous.vehicles.map((v) => [v.id, v]));
      for (const vehicle of value.vehicles) {
        const known = vehicles.get(vehicle.id);
        if (known && JSON.stringify(known) !== JSON.stringify(vehicle))
          throw new Error('CONFLICTING_VEHICLE');
        if (!known) vehicles.set(vehicle.id, vehicle);
      }
      value.vehicles = [...vehicles.values()];
      if (!WorkContactSchema.safeParse(value).success)
        throw new Error('MERGED_CONTACT_INVALID');
      value.opposed ||= previous.opposed;
      value.erased ||= previous.erased;
      value.hard_bounce ||= previous.hard_bounce;
      value.complaint ||= previous.complaint;
      value.paused_until =
        [previous.paused_until, value.paused_until]
          .filter((x): x is string => !!x)
          .sort((a, b) => Date.parse(a) - Date.parse(b))
          .at(-1) ?? null;
      contacts[contacts.indexOf(previous)] = value;
    } else {
      if (contacts.length >= 1000) {
        errors.push({ row, code: 'contact_limit' });
        return;
      }
      value.preferences = value.preferences.map((p) => ({
        ...p,
        state: p.state === 'refused' ? 'refused' : 'unknown',
      }));
      contacts.push(value);
    }
    value.purchases.sort(
      (a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id),
    );
    value.vehicles.sort((a, b) => a.id.localeCompare(b.id));
  });
  return {
    synthetic: true,
    persisted: false,
    contacts,
    errors,
    rollback: 'discard_preview',
    permissions_imported: false,
  };
}

export function explainSegment(input: unknown, rawRule: unknown) {
  const w = workspace(input),
    rule = parseSegment(rawRule),
    now = Date.parse(w.context.as_of);
  const events = uniqueEvents(w.events);
  return w.contacts.map((c) => {
    const own = events.filter(
      (e) =>
        e.project === c.project &&
        e.contact_id === c.id &&
        e.verified &&
        !e.bot,
    );
    const evaluate = (
      r: SegmentRule,
    ): { match: boolean | null; reasons: string[] } => {
      if ('rules' in r) {
        const children = r.rules.map(evaluate),
          values = children.map((x) => x.match);
        const match =
          r.op === 'all'
            ? values.includes(false)
              ? false
              : values.includes(null)
                ? null
                : true
            : values.includes(true)
              ? true
              : values.includes(null)
                ? null
                : false;
        return { match, reasons: children.flatMap((x) => x.reasons) };
      }
      if (r.op === 'not') {
        const child = evaluate(r.rule);
        return {
          match: child.match === null ? null : !child.match,
          reasons: ['not', ...child.reasons],
        };
      }
      if (r.op === 'audience') {
        const known = c.audience_declared && c.audience !== 'unknown';
        return {
          match:
            c.audience_declared && (known || r.value === 'unknown')
              ? c.audience === r.value
              : null,
          reasons: [known ? 'audience_declared' : 'audience_unknown'],
        };
      }
      if (!c.history_complete)
        return { match: null, reasons: ['history_unknown'] };
      if (r.op === 'inactive') {
        const days = purchaseRecencyDays(c, own, w.context.as_of);
        if (days === null)
          return { match: null, reasons: ['no_purchase_history'] };
        return { match: days >= r.days, reasons: [`recency_days:${days}`] };
      }
      const window = own.filter(
        (e) => now - Date.parse(e.occurred_at) <= r.days * DAY,
      );
      if (r.op === 'count') {
        const n = window.filter((e) => e.kind === r.kind).length;
        return { match: n >= r.min, reasons: [`event_count:${r.kind}:${n}`] };
      }
      const match = window.some(
        (a) =>
          a.kind === r.first &&
          window.some(
            (b) =>
              b.kind === r.then &&
              Date.parse(b.occurred_at) > Date.parse(a.occurred_at),
          ),
      );
      return { match, reasons: [`sequence:${r.first}:${r.then}:${match}`] };
    };
    const evaluation = evaluate(rule),
      exclusions = eligibility(c, w);
    return {
      id: c.id,
      project: c.project,
      included: evaluation.match === true && !exclusions.length,
      match: evaluation.match,
      reasons: [...exclusions, ...evaluation.reasons],
      mode: 'snapshot',
      frequency: c.history_complete ? c.purchases.length : null,
    };
  });
}

/** Aggregate the validated preview; reasons describe exclusions, not consent violations. */
export function summarizeSegment(input: unknown, rawRule: unknown) {
  // explainSegment validates uniqueness by project:id before producing one row per identity.
  const rows = explainSegment(input, rawRule);
  const reasons = new Map<string, number>();
  let included = 0;
  for (const row of rows) {
    if (row.included) {
      included++;
      continue;
    }
    for (const reason of new Set(row.reasons))
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }
  return {
    mode: 'snapshot',
    counting_unit: 'project:id',
    total: rows.length,
    included,
    excluded: rows.length - included,
    reason_counts_exclusive: false,
    exclusion_reasons: [...reasons.keys()]
      .sort()
      .map((reason) => ({ reason, count: reasons.get(reason)! })),
  };
}

export function recommendProducts(
  input: unknown,
  contactId: string,
  vehicleId: string,
) {
  const w = workspace(input),
    now = Date.parse(w.context.as_of);
  const c = w.contacts.find(
    (x) =>
      x.project === w.context.project && x.id === checked(fixtureId, contactId),
  );
  if (!c) throw new Error('CONTACT_UNKNOWN');
  const vehicle = c.vehicles.find(
    (v) => v.id === checked(fixtureId, vehicleId),
  );
  const vehicleSource = w.sources.find((s) => s.id === vehicle?.source_ref);
  const vehicleSourceVerified =
    !!vehicleSource &&
    vehicleSource.kind === 'business' &&
    currentSource(vehicleSource, w.context);
  const decisions = w.products.map((p) => {
    const reasons: string[] = [];
    if (!vehicleSourceVerified) reasons.push('vehicle_source_unverified');
    const source = w.sources.find((s) => s.id === p.source_ref);
    if (
      !source ||
      source.kind !== 'business' ||
      !currentSource(source, w.context)
    )
      reasons.push('business_source_unverified');
    if (
      !vehicle?.declared ||
      !vehicle.engine ||
      !vehicle.year ||
      !vehicle.axle ||
      !vehicle.side
    )
      reasons.push('vehicle_incomplete');
    else if (
      !p.fitments.some(
        (f) =>
          f.vehicle_id === vehicle.id &&
          f.engine === vehicle.engine &&
          f.year === vehicle.year &&
          f.axle === vehicle.axle &&
          (f.side === vehicle.side || f.side === 'both') &&
          f.verified &&
          Date.parse(f.valid_until) > now &&
          w.sources.some(
            (s) =>
              s.id === f.evidence_ref &&
              s.kind === 'business' &&
              currentSource(s, w.context),
          ),
      )
    )
      reasons.push('compatibility_unverified');
    if (Date.parse(p.valid_until) <= now) reasons.push('offer_expired');
    if (p.stock < 1) reasons.push('out_of_stock');
    if (p.price_minor === null) reasons.push('price_missing');
    if (
      p.audience === 'professional' &&
      (!c.audience_declared || c.audience !== 'professional')
    )
      reasons.push('professional_only');
    if (!p.rights_verified) reasons.push('asset_rights_unknown');
    if (
      !p.kit_complete ||
      new Set(p.kit_components).size !== p.kit_components.length ||
      p.kit_components.includes(p.id)
    )
      reasons.push('kit_invalid');
    if (
      p.kit_components.some(
        (id) => w.products.find((x) => x.id === id)?.kit_components.length,
      )
    )
      reasons.push('nested_kit_unsupported');
    return { id: p.id, reasons, source_ref: p.source_ref };
  });
  // All kit parts must independently pass the exact same vehicle constraints.
  for (const d of decisions) {
    const p = w.products.find((p) => p.id === d.id)!;
    if (
      p.kit_components.some(
        (id) => !decisions.some((x) => x.id === id && x.reasons.length === 0),
      )
    )
      d.reasons.push('kit_component_invalid');
  }
  return {
    selected: decisions.filter((d) => !d.reasons.length).map((d) => d.id),
    decisions,
    ranking: 'verified_constraints_only',
    reservation: false,
  };
}

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
export function renderCampaign(
  input: unknown,
  refs: string[],
  language: 'fr' | 'en',
  variables: Record<string, string>,
  scenario = 'J11',
) {
  const w = workspace(input);
  checked(z.enum(['fr', 'en']), language);
  checked(z.array(fixtureId).min(1).max(20), refs);
  checked(
    z.record(z.string().regex(/^[a-z_]{1,30}$/), z.string().max(300)),
    variables,
  );
  const sources = refs.map((id) => w.sources.find((s) => s.id === id));
  if (
    sources.some((s) => !s || s.kind !== 'wiki' || !currentSource(s, w.context))
  )
    throw new Error('SOURCE_UNVERIFIED');
  const blocks = sources.map((s) =>
    s!.text.replace(/\{\{([a-z_]+)\}\}/g, (_, key: string) => {
      if (!Object.hasOwn(variables, key) || !variables[key].trim())
        throw new Error('TEMPLATE_VARIABLE_MISSING');
      return variables[key];
    }),
  );
  if (blocks.some((s) => /\{\{|\}\}/.test(s)))
    throw new Error('TEMPLATE_VARIABLE_MISSING');
  checked(z.string().regex(/^J(0[1-9]|1[0-8])$/), scenario);
  const copy: Record<string, [string, string, string, string]> = {
    J01: [
      'Bienvenue dans votre espace de conseils',
      'Choisir les thèmes qui vous intéressent',
      'Welcome to your advice space',
      'Choose your preferred topics',
    ],
    J03: [
      'Besoin de précisions pour votre choix ?',
      'Préciser votre besoin',
      'Need help choosing?',
      'Describe what you need',
    ],
    J04: [
      'Votre projet d’achat est-il toujours en cours ?',
      'Revoir les informations avant de poursuivre',
      'Is your purchase project still relevant?',
      'Review the information before proceeding',
    ],
    J05: [
      'Un point sur votre demande professionnelle',
      'Répondre au conseiller chargé du devis',
      'A follow-up on your business enquiry',
      'Reply to your quote adviser',
    ],
    J06: [
      'Après votre livraison : les informations utiles',
      'Partager votre retour d’expérience',
      'Useful information after delivery',
      'Share your experience',
    ],
    J07: [
      'Un complément à vérifier pour votre véhicule',
      'Examiner le complément documenté',
      'A documented complement for your vehicle',
      'Review the documented complement',
    ],
    J08: [
      'Votre échéance d’entretien déclarée',
      'Vérifier ou mettre à jour l’échéance',
      'Your declared maintenance date',
      'Check or update the date',
    ],
    J09: [
      'Une disponibilité à vérifier',
      'Consulter la disponibilité actuelle, sans réservation',
      'Availability to check',
      'Check current availability; no reservation',
    ],
    J10: [
      'Un changement de prix à vérifier',
      'Revoir la même référence et ses conditions',
      'A price change to check',
      'Review the same item and conditions',
    ],
    J14: [
      'Comment s’est passée votre expérience ?',
      'Partager librement un retour positif ou négatif',
      'How was your experience?',
      'Share positive or negative feedback freely',
    ],
    J15: [
      'Les points utiles pour préparer la saison',
      'Vérifier les conseils applicables à votre véhicule',
      'Useful points to prepare for the season',
      'Check advice relevant to your vehicle',
    ],
    J16: [
      'Préparer votre prochaine demande professionnelle',
      'Préciser vos besoins au conseiller',
      'Prepare your next business enquiry',
      'Discuss your needs with your adviser',
    ],
  };
  const selected = copy[scenario] ?? [
    'Un conseil utile pour votre projet',
    'Vérifier les informations du véhicule',
    'Useful advice for your project',
    'Check the vehicle information',
  ];
  const title = selected[language === 'fr' ? 0 : 2],
    cta = selected[language === 'fr' ? 1 : 3];
  const text = [title, ...blocks, cta, 'Simulation — aucune offre réelle'].join(
    '\n\n',
  );
  const html = `<!doctype html><html lang="${language}" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title></head><body style="margin:0;background:#fff;color:#17202a;font:18px/1.6 Arial,sans-serif"><main style="max-width:600px;margin:auto;padding:20px"><h1>${escape(title)}</h1>${blocks.map((b) => `<p>${escape(b)}</p>`).join('')}<p>${escape(cta)}</p><p>Simulation — aucune offre réelle</p></main></body></html>`;
  return {
    html,
    text,
    language,
    source_refs: refs,
    template_version: '2.0.0',
    variants: [
      { id: 'A', subject: title, preheader: cta },
      {
        id: 'B',
        subject:
          language === 'fr'
            ? 'Les informations à vérifier avant votre choix'
            : 'Information to check before choosing',
        preheader: cta,
      },
    ],
    social: {
      template: getSocialTemplate('conseil', 'facebook')?.key ?? null,
      text: blocks.join('\n'),
      publication: 'unavailable',
    },
    guide: { title, checklist: blocks },
    faq: [
      {
        question:
          language === 'fr'
            ? 'Que faut-il vérifier ?'
            : 'What should be checked?',
        answer: blocks.join('\n'),
      },
    ],
    carousel: blocks.map((text, i) => ({
      slide: i + 1,
      text,
      source_ref: refs[i],
    })),
    video_script: blocks.map((text, i) => ({
      scene: i + 1,
      voiceover: text,
      subtitle: text,
      source_ref: refs[i],
      media: 'not_selected_rights_required',
    })),
    review_required: true,
    email_client_tested: false,
    unsubscribe: 'not_connected',
    contrast: { foreground: '#17202a', background: '#ffffff' },
    tracking: 'none',
  };
}

/** Evaluate one current snapshot. No timers, participants, persistence or dispatch. */
export function prepareScenario(input: unknown, scenarioId: string) {
  const w = workspace(input),
    s = w.scenarios.find((x) => x.id === scenarioId);
  if (!s) throw new Error('SCENARIO_UNKNOWN');
  const c = w.contacts.find(
    (x) => x.project === w.context.project && x.id === s.contact_id,
  );
  if (!c) throw new Error('CONTACT_UNKNOWN');
  const now = Date.parse(w.context.as_of),
    trigger = Date.parse(s.trigger_at);
  if (trigger > Date.parse(w.context.data_at))
    throw new Error('FUTURE_WORKBENCH_DATA');
  const events = uniqueEvents(w.events).filter(
    (e) =>
      e.project === w.context.project &&
      e.contact_id === c.id &&
      e.object_id === s.object_id &&
      e.verified &&
      !e.bot &&
      Date.parse(e.occurred_at) >= trigger,
  );
  const has = (kind: WorkEvent['kind']) => events.some((e) => e.kind === kind);
  const triggerEvent = events.find((e) => e.id === s.trigger_event_id);
  const triggerEventValid =
    s.trigger_event_id === null ||
    (!!triggerEvent && Date.parse(triggerEvent.occurred_at) === trigger);
  // Only an explicitly bound initial purchase can be the basis of these journeys.
  // A distinct receipt at the same instant still stops the pending proposal.
  const purchaseReached = events.some(
    (e) =>
      e.kind === 'purchase' &&
      !(
        ['J07', 'J12', 'J16'].includes(s.id) &&
        triggerEventValid &&
        e.id === s.trigger_event_id
      ),
  );
  const reasons: string[] = eligibility(c, w);
  if (!triggerEventValid) reasons.push('trigger_event_unverified');
  const questions: string[] = [];
  const waitingReasons: string[] = [];
  let action = 'prepare_advice',
    decision: 'prepare' | 'ask' | 'exclude' | 'defer' | 'human' = 'prepare';
  const contactSource = w.sources.find((x) => x.id === s.facts.source_ref);
  if (scenarioId === 'J17') {
    const signal = uniqueEvents(w.events).filter(
      (e) =>
        e.project === w.context.project &&
        e.object_id === s.object_id &&
        e.verified &&
        !e.bot &&
        Date.parse(e.occurred_at) >= trigger &&
        ['complaint', 'hard_bounce'].includes(e.kind),
    );
    const sourceVerified =
      !!contactSource &&
      contactSource.kind === 'business' &&
      currentSource(contactSource, w.context);
    const valid =
      sourceVerified &&
      signal.length > 0 &&
      triggerEventValid &&
      s.facts.receipt_verified &&
      s.facts.confirmed &&
      s.facts.version === s.facts.current_version &&
      Date.parse(s.expires_at) > now;
    return {
      scenario_id: s.id,
      decision: valid ? ('human' as const) : ('exclude' as const),
      action: 'request_authorized_suspension',
      reasons: [
        valid
          ? 'observed_signal_requires_review'
          : 'no_current_verified_signal',
        ...(!sourceVerified ? ['source_unverified'] : []),
      ],
      source_ref: s.facts.source_ref,
      signal_ids: signal.map((e) => e.id),
      threshold_authority: 'not_connected',
      questions,
      content: null,
      brief: null,
      real_execution: 'unavailable',
      snapshot_at: w.context.data_at,
      transitions: [
        'snapshot_inspected',
        valid ? 'request_human_review' : 'exclude',
      ],
    };
  }
  if (Date.parse(s.expires_at) <= now) reasons.push('scenario_expired');
  if (!s.facts.receipt_verified || !s.facts.confirmed)
    reasons.push('trigger_unverified');
  if (
    ['returned', 'cancelled', 'replaced', 'expired'].includes(s.facts.status) ||
    has('cancelled')
  )
    reasons.push('object_closed');
  if (s.facts.version !== s.facts.current_version)
    reasons.push('version_changed');
  if (has('refusal') || has('support')) reasons.push('human_or_service_stop');
  if (has('accepted') || has('uncertain'))
    reasons.push('prior_action_requires_reconciliation');
  if (
    ['J05', 'J07', 'J10', 'J12', 'J13', 'J16'].includes(s.id) &&
    (s.facts.status === 'paid' || purchaseReached)
  )
    reasons.push('goal_reached');
  if (
    !contactSource ||
    !currentSource(contactSource, w.context) ||
    contactSource.kind === 'public'
  )
    reasons.push('source_unverified');
  switch (s.id) {
    case 'J01':
      if (!has('confirmed_signup')) reasons.push('confirmation_missing');
      action = 'welcome_and_preferences';
      break;
    case 'J02': {
      action = 'qualify_in_existing_leads';
      if (has('reply')) reasons.push('reply_received');
      const v = c.vehicles.find((x) => x.id === s.vehicle_id);
      for (const key of ['engine', 'year', 'axle', 'side'] as const)
        if (!v?.[key]) questions.push(key);
      decision = questions.length ? 'ask' : 'human';
      break;
    }
    case 'J03':
      if (!has('view')) reasons.push('view_unverified');
      if (has('purchase')) reasons.push('goal_reached');
      action = 'category_advice';
      break;
    case 'J04':
      if (!has('cart')) reasons.push('cart_event_missing');
      if (has('purchase')) reasons.push('goal_reached');
      action = 'cart_draft_only';
      break;
    case 'J05':
      if (c.audience !== 'professional' || !c.audience_declared)
        reasons.push('professional_unverified');
      if (has('reply')) reasons.push('reply_received');
      action = 'quote_followup_proposal';
      break;
    case 'J06':
      if (s.facts.status !== 'delivered' || !has('delivered'))
        reasons.push('delivery_unverified');
      action = 'after_delivery_advice';
      break;
    case 'J07':
      action = 'compatible_complement';
      break;
    case 'J08':
      if (contactSource?.kind !== 'wiki' || !s.facts.due_at)
        reasons.push('maintenance_basis_missing');
      if (!c.vehicles.some((v) => v.id === s.vehicle_id && v.declared))
        reasons.push('vehicle_removed');
      if (has('maintenance_done')) reasons.push('maintenance_done');
      if (s.facts.due_at && Date.parse(s.facts.due_at) > now)
        waitingReasons.push('maintenance_not_due');
      action = 'sourced_maintenance_reminder';
      break;
    case 'J09':
      if (!has('stock')) reasons.push('stock_event_missing');
      if (has('purchase')) reasons.push('goal_reached');
      action = 'stock_notice_without_reservation';
      break;
    case 'J10': {
      const p = w.products.find((x) => x.id === s.product_id);
      if (
        !p ||
        !s.facts.previous_price_minor ||
        p.price_minor === null ||
        s.facts.previous_variant !== p.variant ||
        s.facts.previous_basis !== p.price_basis ||
        s.facts.previous_currency !== p.currency ||
        BigInt(s.facts.previous_price_minor) <= BigInt(p.price_minor)
      )
        reasons.push('price_comparison_invalid');
      action = 'verified_price_change_draft';
      break;
    }
    case 'J11': {
      const segment = explainSegment(w, {
        op: 'inactive',
        days: s.inactive_days,
      }).find((x) => x.id === c.id && x.project === w.context.project)!;
      if (!segment.included || has('purchase')) reasons.push('not_inactive');
      action = 'reactivation_advice';
      break;
    }
    case 'J12':
      if (!s.facts.programme_verified) {
        decision = 'human';
        reasons.push('loyalty_programme_unavailable');
      }
      if (BigInt(s.facts.net_value_minor) < BigInt(s.facts.threshold_minor))
        reasons.push('threshold_not_met');
      action = 'recognition_without_credit';
      break;
    case 'J13':
      if (!s.facts.programme_verified) {
        decision = 'human';
        reasons.push('referral_programme_unavailable');
      }
      if (s.facts.self_referral) reasons.push('self_referral');
      action = 'voluntary_referral_proposal';
      break;
    case 'J14':
      if (!has('delivered')) reasons.push('experience_unverified');
      if (has('review_request')) reasons.push('already_requested');
      action = 'neutral_feedback_request';
      break;
    case 'J15':
      if (contactSource?.kind !== 'wiki') reasons.push('wiki_required');
      action = 'seasonal_advice_no_diagnosis';
      break;
    case 'J16':
      if (c.audience !== 'professional' || !c.audience_declared)
        reasons.push('professional_unverified');
      if (has('reply') || has('refusal')) reasons.push('reply_received');
      action = 'professional_followup';
      break;
    case 'J18':
      action = 'prepare_controlled_experiment';
      break;
  }
  const products = ['J04', 'J07', 'J09', 'J10'].includes(s.id)
    ? recommendProducts(w, c.id, s.vehicle_id)
    : null;
  if (products && !products.selected.includes(s.product_id))
    reasons.push('product_not_eligible');
  const blocking = reasons.filter(
    (r) =>
      ![
        'loyalty_programme_unavailable',
        'referral_programme_unavailable',
      ].includes(r),
  );
  if (blocking.length) decision = 'exclude';
  else if (decision === 'prepare' || decision === 'ask') {
    if (now < trigger + s.delay_hours * 3600000)
      waitingReasons.push('delay_not_elapsed');
    if (waitingReasons.length) {
      decision = 'defer';
      reasons.push(...waitingReasons);
    }
  }
  const wiki = s.content_source_refs;
  if (decision === 'prepare') {
    if (!wiki.length) {
      decision = 'exclude';
      reasons.push('content_source_missing');
    } else if (
      !wiki.every((ref) =>
        w.sources.some(
          (x) =>
            x.id === ref && x.kind === 'wiki' && currentSource(x, w.context),
        ),
      )
    ) {
      decision = 'exclude';
      reasons.push('content_source_unverified');
    }
  }
  const content =
    decision === 'prepare' && wiki.length
      ? renderCampaign(w, wiki, c.language ?? 'fr', {}, s.id)
      : null;
  const coverage_manifest = CoverageManifestSchema.parse({
    scope_requested: s.id,
    scope_actually_scanned: 'Synthetic snapshot, offline preparation only',
    files_read_count: 1,
    excluded_paths: ['PROD', 'STOP'],
    unscanned_zones: ['Real accounts and durable execution'],
    corrections_proposed: [],
    validation_executed: false,
    remaining_unknowns: [
      'Operational permission, source authenticity and real sender; see separately recorded test evidence',
    ],
    final_status: 'REVIEW_REQUIRED',
  });
  const brief = content
    ? CreateMarketingBriefSchema.parse({
        agent_id: 'CUSTOMER_RETENTION',
        business_unit: MarketingBusinessUnit.ECOMMERCE,
        channel: MarketingChannel.EMAIL,
        conversion_goal: [
          'J01',
          'J03',
          'J05',
          'J08',
          'J14',
          'J15',
          'J16',
        ].includes(s.id)
          ? MarketingConversionGoal.QUOTE
          : MarketingConversionGoal.ORDER,
        cta: content.variants[0].preheader,
        target_segment: `${c.audience}; ${s.id}; synthetic`,
        payload: {
          project: w.context.project,
          environment: w.context.environment,
          run_id: w.context.run_id,
          schema_version: '2.0.0',
          skill_version: null,
          trigger_event_id: s.trigger_event_id,
          scenario_id: s.id,
          action,
          content,
          source_refs: content.source_refs,
          status: 'draft',
        },
        coverage_manifest,
      })
    : null;
  return {
    scenario_id: s.id,
    decision,
    action,
    reasons,
    questions: decision === 'ask' ? questions : [],
    products,
    content,
    brief,
    real_execution: 'unavailable',
    snapshot_at: w.context.data_at,
    transitions: [
      'trigger_observed',
      ...events.map((e) => `event:${e.kind}`),
      decision,
    ],
    limitations: [
      'Snapshot evaluation, not a durable journey',
      'No real sender, source adapter or approval authority connected',
    ],
  };
}

export function planOpportunities(input: unknown, candidates: unknown) {
  const w = workspace(input);
  const rows = checked(
    z
      .array(
        z
          .object({
            source_ref: fixtureId,
            objective: z.enum([
              'qualified_request',
              'repeat_order',
              'reduce_selection_errors',
            ]),
            audience: z.enum(['private', 'professional']),
            stop_condition: z.string().min(1).max(300),
            hypothesis: z.string().min(1).max(300),
          })
          .strict(),
      )
      .max(30),
    candidates,
  );
  return {
    actions: rows
      .map((row) => {
        const source = w.sources.find((x) => x.id === row.source_ref);
        const verified =
          !!source &&
          currentSource(source, w.context) &&
          source.kind !== 'public';
        return {
          ...row,
          source_date: source?.observed_at ?? null,
          evidence_state: verified
            ? 'verified_fixture'
            : 'candidate_unverified',
          expected_volume: null,
          priority: verified ? 1 : 2,
          owner: 'CUSTOMER_RETENTION',
          next_action: verified ? 'prepare_brief' : 'verify_source',
        };
      })
      .sort(
        (a, b) =>
          a.priority - b.priority || a.source_ref.localeCompare(b.source_ref),
      ),
    scheduled: false,
  };
}

export function prepareMediaPlan(input: unknown, proposal: unknown) {
  const w = workspace(input),
    p = checked(
      z
        .object({
          account: fixtureId,
          source_ref: fixtureId,
          landing_source_ref: fixtureId,
          format: z.enum(['social', 'paid', 'seo_proposal']),
          objective: z.enum(['qualified_request', 'repeat_order']),
          audience: z.enum(['declared_private', 'declared_professional']),
          budget_minor: minorUnits,
          currency,
          media_rights_verified: z.boolean(),
          stop_condition: z.string().min(1).max(300),
          starts_at: timestamp,
          ends_at: timestamp,
        })
        .strict(),
      proposal,
    );
  const page = w.sources.find((s) => s.id === p.landing_source_ref),
    reasons: string[] = [];
  if (!page || page.kind !== 'business' || !currentSource(page, w.context))
    reasons.push('landing_unverified');
  if (!p.media_rights_verified) reasons.push('rights_unverified');
  if (
    Date.parse(p.starts_at) < Date.parse(w.context.as_of) ||
    Date.parse(p.ends_at) <= Date.parse(p.starts_at)
  )
    reasons.push('calendar_invalid');
  if (p.format !== 'paid' && p.budget_minor !== '0')
    reasons.push('unexpected_spend');
  const creative = renderCampaign(w, [p.source_ref], 'fr', {});
  return {
    proposal: p,
    decision: reasons.length ? 'exclude' : 'draft',
    reasons,
    creative,
    landing: page?.url ?? null,
    spend_minor: '0',
    provider_budget_enforced: false,
    audience_exported: false,
    tracking_enabled: false,
    publication: false,
    activation: false,
    unknowns: [
      'real account rights',
      'real landing and conversion receipt',
      'provider guardrails and billing',
      'brand review',
    ],
    source_state: 'synthetic_only',
  };
}

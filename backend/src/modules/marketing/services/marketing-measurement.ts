import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  checked,
  context,
  currency,
  fixtureId,
  minorUnits,
  timestamp,
  workspace,
} from '../dto/marketing-workbench.dto';
import { purchaseRecencyDays, uniqueEvents } from './marketing-preparation';
const OrderSchema = z
  .object({
    id: fixtureId,
    contact_id: fixtureId,
    at: timestamp,
    currency,
    revenue_ex_tax_minor: minorUnits,
    tax_minor: minorUnits,
    cost_ex_tax_minor: minorUnits.nullable(),
    campaign_id: fixtureId.nullable(),
    verified: z.boolean(),
  })
  .strict();
const RefundSchema = z
  .object({
    id: fixtureId,
    order_id: fixtureId,
    at: timestamp,
    revenue_ex_tax_minor: minorUnits,
    tax_minor: minorUnits,
    cost_recovered_minor: minorUnits.nullable(),
    currency,
  })
  .strict();
const CostSchema = z
  .object({
    id: fixtureId,
    at: timestamp,
    currency,
    amount_ex_tax_minor: minorUnits,
  })
  .strict();
const ReportSchema = z
  .object({
    from: timestamp,
    to: timestamp,
    orders: z.array(OrderSchema).max(10000),
    refunds: z.array(RefundSchema).max(10000),
    marketing_costs: z.array(CostSchema).max(10000),
    costs_complete: z.boolean(),
    eligible_contacts: z.number().int().min(0).max(1000000).nullable(),
    history_complete: z.boolean(),
  })
  .strict();
function deduplicate<T extends { id: string }>(rows: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (
      map.has(row.id) &&
      JSON.stringify(map.get(row.id)) !== JSON.stringify(row)
    )
      throw new Error('CONFLICTING_ECONOMIC_EVENT');
    map.set(row.id, row);
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}
/** Sales cohort report: later refunds require a refreshed report. No cash-flow or causal claim. */
export function economicReport(ctx: unknown, input: unknown) {
  const c = context(ctx),
    d = checked(ReportSchema, input),
    from = Date.parse(d.from),
    to = Date.parse(d.to);
  if (from >= to || to > Date.parse(c.data_at))
    throw new Error('INVALID_REPORT_PERIOD');
  const orders = deduplicate(d.orders),
    refunds = deduplicate(d.refunds),
    costs = deduplicate(d.marketing_costs);
  if (
    [...orders, ...refunds, ...costs].some(
      (x) => Date.parse(x.at) > Date.parse(c.data_at),
    )
  )
    throw new Error('FUTURE_WORKBENCH_DATA');
  const inPeriod = (row: { at: string }) =>
    Date.parse(row.at) >= from && Date.parse(row.at) < to;
  const included = orders.filter((o) => o.verified && inPeriod(o));
  const includedCosts = costs.filter(inPeriod);
  for (const refund of refunds) {
    const order = orders.find((o) => o.id === refund.order_id && o.verified);
    if (!order) throw new Error('REFUND_UNRECONCILED');
    if (order.currency !== refund.currency) throw new Error('REFUND_CURRENCY');
    if (Date.parse(refund.at) < Date.parse(order.at))
      throw new Error('REFUND_BEFORE_ORDER');
  }
  const refundTotals = new Map(
    orders.map((order) => {
      const own = refunds.filter((r) => r.order_id === order.id);
      const returned = own.reduce(
        (n, r) => n + BigInt(r.revenue_ex_tax_minor),
        0n,
      );
      const returnedTax = own.reduce((n, r) => n + BigInt(r.tax_minor), 0n);
      const recovered = own.reduce(
        (n, r) => n + BigInt(r.cost_recovered_minor ?? '0'),
        0n,
      );
      if (
        returned > BigInt(order.revenue_ex_tax_minor) ||
        returnedTax > BigInt(order.tax_minor) ||
        (order.cost_ex_tax_minor !== null &&
          recovered > BigInt(order.cost_ex_tax_minor))
      )
        throw new Error('REFUND_EXCEEDS_ORDER');
      return [
        order.id,
        {
          returned,
          returnedTax,
          recovered,
          costsKnown:
            order.cost_ex_tax_minor !== null &&
            own.every((r) => r.cost_recovered_minor !== null),
        },
      ];
    }),
  );
  const currencies = [
    ...new Set([
      ...included.map((o) => o.currency),
      ...includedCosts.map((x) => x.currency),
    ]),
  ]
    .sort()
    .map((unit) => {
      let revenue = 0n,
        tax = 0n,
        productCost = 0n,
        known = d.costs_complete;
      for (const order of included.filter((o) => o.currency === unit)) {
        const { returned, returnedTax, recovered, costsKnown } =
          refundTotals.get(order.id)!;
        revenue += BigInt(order.revenue_ex_tax_minor) - returned;
        tax += BigInt(order.tax_minor) - returnedTax;
        if (!costsKnown) known = false;
        else productCost += BigInt(order.cost_ex_tax_minor!) - recovered;
      }
      const spend = includedCosts
        .filter((x) => x.currency === unit)
        .reduce((n, x) => n + BigInt(x.amount_ex_tax_minor), 0n);
      return {
        currency: unit,
        net_revenue_ex_tax_minor: revenue.toString(),
        net_tax_minor: tax.toString(),
        marketing_cost_ex_tax_minor: spend.toString(),
        contribution_ex_tax_minor: known
          ? (revenue - productCost - spend).toString()
          : null,
        costs_complete: known,
      };
    });
  const buyers = new Set(included.map((x) => x.contact_id));
  if (d.eligible_contacts !== null && buyers.size > d.eligible_contacts)
    throw new Error('INVALID_DENOMINATOR');
  const repeat = [...buyers].filter(
    (id) => included.filter((o) => o.contact_id === id).length >= 2,
  ).length;
  const positive = included.filter(
    (o) => BigInt(o.revenue_ex_tax_minor) > refundTotals.get(o.id)!.returned,
  );
  const positiveBuyers = new Set(positive.map((o) => o.contact_id));
  const positiveRepeat = [...positiveBuyers].filter(
    (id) => positive.filter((o) => o.contact_id === id).length >= 2,
  ).length;
  return {
    synthetic: true,
    snapshot_at: c.data_at,
    period: { from: d.from, to: d.to, bounds: '[from,to)' },
    marketing_cost_scope: 'dated_costs_in_report_period',
    currencies,
    distinct_orders: included.length,
    distinct_buyers: buyers.size,
    eligible_contacts: d.eligible_contacts,
    conversion_rate: d.eligible_contacts
      ? buyers.size / d.eligible_contacts
      : null,
    second_purchase_buyers: d.history_complete ? repeat : null,
    second_purchase_rate:
      d.history_complete && buyers.size ? repeat / buyers.size : null,
    positive_net_revenue: {
      distinct_orders: positive.length,
      distinct_buyers: positiveBuyers.size,
      conversion_rate: d.eligible_contacts
        ? positiveBuyers.size / d.eligible_contacts
        : null,
      second_purchase_buyers: d.history_complete ? positiveRepeat : null,
      second_purchase_rate:
        d.history_complete && positiveBuyers.size
          ? positiveRepeat / positiveBuyers.size
          : null,
    },
    observed_value_scope: 'orders in period with refunds observed by data_at',
    attributed_orders: included.filter((x) => x.campaign_id !== null).length,
    unknown_attribution_orders: included.filter((x) => x.campaign_id === null)
      .length,
    causal_effect: 'not_estimated',
    predicted_ltv: null,
    cash_flow: null,
    source_ids: {
      orders: included.map((x) => x.id),
      refunds: refunds
        .filter((r) => included.some((o) => o.id === r.order_id))
        .map((x) => x.id),
      costs: includedCosts.map((x) => x.id),
    },
  };
}
const Group = z.enum(['holdout', 'A', 'B']);
const Assignment = z.object({ id: fixtureId, group: Group }).strict();
export function assignExperiment(
  experimentId: string,
  version: string,
  ids: string[],
) {
  checked(fixtureId, experimentId);
  checked(z.string().min(1).max(30), version);
  checked(z.array(fixtureId).max(10000), ids);
  if (new Set(ids).size !== ids.length)
    throw new Error('DUPLICATE_EXPERIMENT_UNIT');
  return [...ids].sort().map((id) => ({
    id,
    group: (['holdout', 'A', 'B'] as const)[
      createHash('sha256')
        .update(JSON.stringify(['automecanik', experimentId, version, id]))
        .digest()
        .readUInt32BE(0) % 3
    ],
  }));
}
export function experimentReport(
  assignments: unknown,
  observations: unknown,
  minPerGroup: number,
) {
  const a = checked(z.array(Assignment).max(10000), assignments),
    o = checked(
      z.array(Assignment.extend({ converted: z.boolean() })).max(10000),
      observations,
    );
  checked(z.number().int().min(30).max(1000000), minPerGroup);
  if (new Set(a.map((x) => x.id)).size !== a.length)
    throw new Error('EXPERIMENT_CONTAMINATION');
  const observed = new Map<
    string,
    z.infer<typeof Assignment> & { converted: boolean }
  >();
  for (const row of o) {
    if (
      !a.some((x) => x.id === row.id && x.group === row.group) ||
      (observed.has(row.id) &&
        JSON.stringify(observed.get(row.id)) !== JSON.stringify(row))
    )
      throw new Error('EXPERIMENT_CONTAMINATION');
    observed.set(row.id, row);
  }
  const groups = (['holdout', 'A', 'B'] as const).map((group) => {
    const members = a.filter((x) => x.group === group),
      data = [...observed.values()].filter((x) => x.group === group),
      success = data.filter((x) => x.converted).length,
      n = data.length;
    const p = n ? success / n : null,
      z2 = 1.96 ** 2,
      den = 1 + z2 / (n || 1),
      center = n ? (success / n + z2 / (2 * n)) / den : null;
    const half = n
      ? (1.96 *
          Math.sqrt(((success / n) * (1 - success / n) + z2 / (4 * n)) / n)) /
        den
      : null;
    return {
      group,
      assigned: members.length,
      observed: n,
      conversions: success,
      rate: p,
      wilson95:
        center !== null && half !== null
          ? [Math.max(0, center - half), Math.min(1, center + half)]
          : null,
    };
  });
  return {
    groups,
    verdict: 'inconclusive',
    reasons: [
      ...(groups.some((g) => g.observed < minPerGroup)
        ? ['insufficient_sample']
        : []),
      ...(observed.size < a.length ? ['missing_outcomes'] : []),
      'approved_protocol_and_observation_window_not_connected',
    ],
    winner: null,
    causal_claim: false,
    attribution_is_not_incrementality: true,
  };
}
export function scoreContacts(input: unknown, configuration: unknown) {
  const w = workspace(input),
    p = checked(
      z
        .object({
          version: z.string().min(1).max(30),
          half_life_days: z.number().min(1).max(3650),
          fit_weight: z.number().min(0).max(100),
          verified_click_weight: z.number().min(0).max(100),
          purchase_weight: z.number().min(0).max(100),
        })
        .strict(),
      configuration,
    );
  const events = uniqueEvents(w.events);
  return w.contacts
    .filter((c) => c.project === w.context.project)
    .map((c) => {
      const audienceKnown = c.audience_declared && c.audience !== 'unknown';
      const age = (at: string) =>
        (Date.parse(w.context.as_of) - Date.parse(at)) / 86400000;
      const clicks = events.filter(
        (e) =>
          e.contact_id === c.id &&
          e.project === w.context.project &&
          e.kind === 'click' &&
          e.verified &&
          !e.bot,
      );
      const contributions = [
        {
          name: 'declared_fit',
          value: audienceKnown ? p.fit_weight : 0,
        },
        {
          name: 'verified_click_decay',
          value: clicks.reduce(
            (n, e) =>
              n +
              p.verified_click_weight *
                2 ** (-age(e.occurred_at) / p.half_life_days),
            0,
          ),
        },
        {
          name: 'purchase_decay',
          value: c.purchases.reduce(
            (n, o) =>
              n + p.purchase_weight * 2 ** (-age(o.at) / p.half_life_days),
            0,
          ),
        },
      ];
      const amounts = [...new Set(c.purchases.map((x) => x.currency))].map(
        (unit) => ({
          currency: unit,
          observed_minor: c.purchases
            .filter((x) => x.currency === unit)
            .reduce((n, x) => n + BigInt(x.net_minor), 0n)
            .toString(),
        }),
      );
      return {
        id: c.id,
        version: p.version,
        score: c.history_complete
          ? Number(contributions.reduce((n, x) => n + x.value, 0).toFixed(4))
          : null,
        contributions,
        missing: [
          ...(!c.history_complete ? ['complete_history'] : []),
          ...(!audienceKnown ? ['declared_audience'] : []),
        ],
        recency_days: c.history_complete
          ? purchaseRecencyDays(c, events, w.context.as_of)
          : null,
        recency_scope: 'purchase_history_and_verified_events',
        purchase_metrics_scope: 'supplied_purchase_history_only',
        frequency: c.history_complete ? c.purchases.length : null,
        amounts: c.history_complete ? amounts : [],
        calibration: 'hypothesis',
        predicted_ltv: null,
        opens_used: false,
      };
    });
}
export function capacityProjection(input: unknown) {
  const p = checked(
    z
      .object({
        historical_units: z.number().int().min(0).max(1000000),
        period_days: z.number().int().min(1).max(366),
        factors: z.array(z.number().min(0).max(10)).min(1).max(5),
        capacity_units: z.number().int().min(0).max(1000000),
        unit_contribution_minor: minorUnits.nullable(),
        verified_dates: z.boolean(),
      })
      .strict(),
    input,
  );
  return {
    scenarios: p.factors.map((f) => {
      const demand = Math.floor(p.historical_units * f),
        served = Math.min(demand, p.capacity_units);
      return {
        factor_hypothesis: f,
        demand_units: demand,
        served_units: served,
        unserved_units: demand - served,
        contribution_minor:
          p.unit_contribution_minor === null
            ? null
            : (BigInt(served) * BigInt(p.unit_contribution_minor)).toString(),
      };
    }),
    period_days: p.period_days,
    confidence_interval: null,
    range_kind: 'user_hypotheses_not_statistical_prediction',
    scheduled: false,
    revenue_forecast: null,
    dates: p.verified_dates ? 'supplied_verified_fixture' : 'unverified',
  };
}

export function engagementReport(input: unknown) {
  const w = workspace(input),
    events = uniqueEvents(w.events).filter(
      (e) => e.project === w.context.project,
    );
  const accepted = events.filter((e) => e.verified && e.kind === 'accepted');
  const alerts = ['complaint', 'hard_bounce'].flatMap((kind) => {
    const facts = events.filter((e) => e.kind === kind && e.verified);
    return facts.length
      ? [
          {
            key: `${w.context.project}:${kind}`,
            fact_count: facts.length,
            event_ids: facts.map((e) => e.id),
            owner: 'CUSTOMER_RETENTION',
            next_action: 'review_and_request_authorized_suspension',
          },
        ]
      : [];
  });
  return {
    verified_nonbot_clicks: events.filter(
      (e) => e.kind === 'click' && e.verified && !e.bot,
    ).length,
    bot_clicks: events.filter((e) => e.kind === 'click' && e.bot).length,
    opens_unreliable: events.filter((e) => e.kind === 'open').length,
    open_rate: null,
    accepted_events: accepted.length,
    delivery_rate: null,
    alerts,
    notifications_sent: 0,
    coverage: 'supplied_events_only',
    no_alert_is_not_a_health_verdict: true,
    attribution: 'unknown_without_business_link',
  };
}

import { z } from 'zod';

// RPC arguments are PostgreSQL int4, not arbitrary JavaScript numbers.
const PgInteger = z.number().int().min(0).max(2147483647);
const QueryInteger = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(PgInteger);
const FuelQuery = z.string().trim().min(1).max(80).optional();

export const MaintenanceCalendarQuerySchema = z.object({
  type_id: QueryInteger.pipe(z.number().positive()).optional(),
  current_km: QueryInteger.optional(),
  fuel_type: FuelQuery,
});

export const MaintenanceAlertsQuerySchema = z.object({
  fuel_type: FuelQuery,
  milestones: z
    .string()
    .transform((value) => value.split(',').map((v) => v.trim()))
    .pipe(z.array(QueryInteger.pipe(z.number().positive())).min(1).max(100))
    .refine(
      (values) => new Set(values).size === values.length,
      'Paliers dupliqués',
    )
    .optional(),
});

const Priority = z.enum(['critique', 'important', 'normal']).nullable();
const PositiveInterval = PgInteger.positive().nullable();
const RuleIdentity = z.object({
  rule_alias: z.string().trim().min(1),
  rule_label: z.string().trim().min(1),
  maintenance_priority: Priority,
  km_interval: PositiveInterval,
});

const ScheduleItemSchema = RuleIdentity.extend({
  month_interval: PositiveInterval,
  applies_to_fuel: z.enum(['essence', 'diesel']).nullable(),
  km_remaining: PgInteger.nullable(),
  status: z.enum(['ok', 'due_soon', 'overdue', 'time_only']),
})
  .refine(
    (item) => item.km_interval !== null || item.month_interval !== null,
    'Intervalle absent',
  )
  .transform((item) => ({
    ...item,
    // The legacy RPC measures from odometer zero and ignores service history.
    // Neither a remaining distance nor a personalized status can be inferred.
    km_remaining: null,
    status: 'unknown' as const,
    status_reason: 'maintenance_history_missing' as const,
    applicability: 'unverified' as const,
  }));

export const MaintenanceScheduleSchema = z
  .array(ScheduleItemSchema)
  .refine(
    (items) =>
      new Set(items.map((item) => item.rule_alias)).size === items.length,
    'Intervalles dupliqués',
  );
export type MaintenanceScheduleItem = z.output<typeof ScheduleItemSchema>;

export const MaintenanceAlertsSchema = z.array(
  z.object({
    milestone_km: PgInteger.positive(),
    actions: z.array(RuleIdentity),
  }),
);
export type MaintenanceAlertAction = z.infer<typeof RuleIdentity>;
export type MaintenanceAlertMilestone = z.infer<
  typeof MaintenanceAlertsSchema
>[number];

// `entity_data.items` of wiki/support/controles-mensuels.md, validated like the
// RPC payloads above instead of being cast.
export const ControlesMensuelsSchema = z.array(
  z.object({
    element: z.string().trim().min(1),
    icon: z.string(),
    detail: z.string(),
  }),
);
export type ControleMensuel = z.infer<typeof ControlesMensuelsSchema>[number];

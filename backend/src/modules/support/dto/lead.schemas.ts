/**
 * DTOs Zod pour le mini-CRM V0 — surface HTTP admin /api/admin/leads.
 *
 * Les enums métier (LEAD_STATUSES, LEAD_TRANSITIONS) vivent dans
 * @repo/database-types/leads (SoT partagée FE/BE alignée avec la CHECK
 * contrainte SQL `chk_msg_crm_status`).
 */

import { z } from 'zod';
import { LEAD_STATUSES } from '@repo/database-types';

export const leadStatusSchema = z.enum(LEAD_STATUSES);

/**
 * PATCH /api/admin/leads/:id — édition partielle des champs CRM libres.
 *
 * - `.strict()` : rejette toute clé inattendue (ex. tentative de patcher
 *   `msg_close` ou `msg_open` depuis l'admin lead → refusé).
 * - `null` autorisé pour "effacer" un champ (ex. clear follow-up).
 * - Bornes max alignées sur l'usage UI raisonnable, pas sur des limites DB
 *   (les colonnes sont TEXT illimité côté Postgres) — défense applicative.
 */
export const updateLeadFieldsSchema = z
  .object({
    vehicle_info: z.string().trim().max(500).nullable().optional(),
    part_requested: z.string().trim().max(500).nullable().optional(),
    internal_note: z.string().trim().max(4000).nullable().optional(),
    next_follow_up_at: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional(),
  })
  .strict();

export type UpdateLeadFieldsDto = z.infer<typeof updateLeadFieldsSchema>;

/**
 * PATCH /api/admin/leads/:id/status — transition de statut.
 *
 * La validation `from → to` (LEAD_TRANSITIONS) est faite côté service,
 * pas ici, pour produire un BadRequestException avec un message explicite.
 */
export const updateLeadStatusSchema = z
  .object({
    status: leadStatusSchema,
  })
  .strict();

export type UpdateLeadStatusDto = z.infer<typeof updateLeadStatusSchema>;

/**
 * GET /api/admin/leads — filtres list.
 *
 * `follow_up=due` : next_follow_up_at <= now() (à relancer ou en retard)
 * `follow_up=overdue` : next_follow_up_at < now() - 24h (strictement en retard)
 * `follow_up=any` : aucun filtre sur next_follow_up_at
 */
export const listLeadsQuerySchema = z
  .object({
    status: leadStatusSchema.optional(),
    follow_up: z.enum(['due', 'overdue', 'any']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export type ListLeadsQueryDto = z.infer<typeof listLeadsQuerySchema>;

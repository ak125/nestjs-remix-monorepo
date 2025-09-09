/**
 * 💬 DTOs Messages Modernes - Validation Zod
 * ✅ Compatible avec table ___xtr_msg legacy
 * ✅ Validation stricte avec Zod
 * ✅ Types TypeScript inférés
 * ✅ Patterns de pagination et tri
 * ✅ Gestion des fils de discussion
 */

import { z } from 'zod';

// =====================================
// ENUMS ET CONSTANTES
// =====================================

export const MessageStatusEnum = z.enum(['read', 'unread'], {
  message: 'Le statut doit être "read" ou "unread"',
});

export const MessageSortByEnum = z.enum(
  ['created_at', 'subject', 'last_reply_at', 'reply_count'],
  {
    message:
      'Le tri doit être par created_at, subject, last_reply_at ou reply_count',
  },
);

export const SortOrderEnum = z.enum(['asc', 'desc'], {
  message: 'L\'ordre doit être "asc" ou "desc"',
});

// =====================================
// SCHEMAS DE BASE
// =====================================

/**
 * Schema pour créer un nouveau message
 */
export const CreateMessageSchema = z
  .object({
    subject: z
      .string()
      .min(1, 'Le sujet est obligatoire')
      .max(200, 'Le sujet ne peut pas dépasser 200 caractères')
      .trim(),

    message: z
      .string()
      .min(1, 'Le message est obligatoire')
      .max(5000, 'Le message ne peut pas dépasser 5000 caractères')
      .trim(),

    parentId: z
      .number()
      .int()
      .positive("L'ID parent doit être un entier positif")
      .optional(),

    // Métadonnées optionnelles
    isUrgent: z.boolean().default(false),
    category: z.string().max(50).optional(),
    attachments: z.array(z.string().url()).max(5).optional(),
  })
  .strict();

/**
 * Schema pour répondre à un message
 */
export const ReplyToMessageSchema = z
  .object({
    message: z
      .string()
      .min(1, 'Le message de réponse est obligatoire')
      .max(5000, 'La réponse ne peut pas dépasser 5000 caractères')
      .trim(),

    // Métadonnées de réponse
    isUrgent: z.boolean().default(false),
    attachments: z.array(z.string().url()).max(3).optional(),
  })
  .strict();

/**
 * Schema pour mettre à jour un message
 */
export const UpdateMessageSchema = z
  .object({
    subject: z
      .string()
      .min(1, 'Le sujet ne peut pas être vide')
      .max(200, 'Le sujet ne peut pas dépasser 200 caractères')
      .trim()
      .optional(),

    message: z
      .string()
      .min(1, 'Le message ne peut pas être vide')
      .max(5000, 'Le message ne peut pas dépasser 5000 caractères')
      .trim()
      .optional(),

    isUrgent: z.boolean().optional(),
    category: z.string().max(50).optional(),
  })
  .strict();

/**
 * Schema pour marquer comme lu/non lu
 */
export const MarkAsReadSchema = z
  .object({
    isRead: z.boolean(),
    markThread: z.boolean().default(false), // Marquer tout le fil
  })
  .strict();

// =====================================
// SCHEMAS DE REQUÊTE ET PAGINATION
// =====================================

/**
 * Schema pour les paramètres de pagination
 */
export const MessagePaginationSchema = z
  .object({
    page: z
      .number()
      .int()
      .min(1, 'La page doit être supérieure ou égale à 1')
      .default(1),

    limit: z
      .number()
      .int()
      .min(1, 'La limite doit être au moins 1')
      .max(100, 'La limite ne peut pas dépasser 100')
      .default(20),

    sortBy: MessageSortByEnum.default('created_at'),
    sortOrder: SortOrderEnum.default('desc'),
  })
  .strict();

/**
 * Schema pour les filtres de messages
 */
export const MessageFiltersSchema = z
  .object({
    status: MessageStatusEnum.optional(),
    hasReplies: z.boolean().optional(),
    isFromAdmin: z.boolean().optional(),
    category: z.string().max(50).optional(),

    // Filtres de date
    dateFrom: z.date().optional(),
    dateTo: z.date().optional(),

    // Recherche textuelle
    search: z
      .string()
      .min(2, 'La recherche doit contenir au moins 2 caractères')
      .max(100)
      .optional(),

    // Filtres urgence
    urgentOnly: z.boolean().default(false),
  })
  .strict();

/**
 * Schema pour les paramètres complets de requête
 */
export const GetMessagesQuerySchema =
  MessagePaginationSchema.merge(MessageFiltersSchema);

// =====================================
// SCHEMAS DE RÉPONSE
// =====================================

/**
 * Schema pour un message simple
 */
export const MessageSchema = z
  .object({
    id: z.number().int().positive(),
    customerId: z.string().min(1),
    subject: z.string(),
    message: z.string(),
    isRead: z.boolean(),
    isFromAdmin: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date().optional(),
    parentId: z.number().int().positive().optional(),

    // Métadonnées
    isUrgent: z.boolean().default(false),
    category: z.string().optional(),
    attachments: z.array(z.string().url()).optional(),

    // Statistiques du fil
    replyCount: z.number().int().min(0).default(0),
    lastReplyAt: z.date().optional(),
  })
  .strict();

/**
 * Schema pour un fil de discussion complet
 */
export const MessageThreadSchema = z
  .object({
    rootMessage: MessageSchema,
    replies: z.array(MessageSchema),
    totalReplies: z.number().int().min(0),
    hasMoreReplies: z.boolean().default(false),
  })
  .strict();

/**
 * Schema pour la réponse paginée
 */
export const MessageListResponseSchema = z
  .object({
    messages: z.array(MessageSchema),
    pagination: z.object({
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      total: z.number().int().min(0),
      totalPages: z.number().int().min(0),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
    }),
    filters: MessageFiltersSchema.optional(),
  })
  .strict();

/**
 * Schema pour les statistiques des messages
 */
export const MessageStatsSchema = z
  .object({
    totalMessages: z.number().int().min(0),
    unreadCount: z.number().int().min(0),
    threadCount: z.number().int().min(0),
    lastMessageAt: z.date().optional(),

    // Statistiques par catégorie
    byCategory: z.record(z.string(), z.number().int().min(0)).optional(),

    // Statistiques temporelles
    thisMonth: z.number().int().min(0).default(0),
    thisWeek: z.number().int().min(0).default(0),
    today: z.number().int().min(0).default(0),
  })
  .strict();

// =====================================
// SCHEMAS D'OPÉRATIONS BULK
// =====================================

/**
 * Schema pour les opérations en lot
 */
export const BulkMessageOperationSchema = z
  .object({
    messageIds: z
      .array(z.number().int().positive())
      .min(1, 'Au moins un ID de message requis')
      .max(50, 'Maximum 50 messages par opération'),

    operation: z.enum(['mark_read', 'mark_unread', 'delete', 'archive'], {
      message: 'Opération invalide',
    }),

    // Options spécifiques
    includeReplies: z.boolean().default(false),
  })
  .strict();

// =====================================
// TYPES TYPESCRIPT INFÉRÉS
// =====================================

export type CreateMessageDto = z.infer<typeof CreateMessageSchema>;
export type ReplyToMessageDto = z.infer<typeof ReplyToMessageSchema>;
export type UpdateMessageDto = z.infer<typeof UpdateMessageSchema>;
export type MarkAsReadDto = z.infer<typeof MarkAsReadSchema>;

export type MessagePaginationDto = z.infer<typeof MessagePaginationSchema>;
export type MessageFiltersDto = z.infer<typeof MessageFiltersSchema>;
export type GetMessagesQueryDto = z.infer<typeof GetMessagesQuerySchema>;

export type MessageDto = z.infer<typeof MessageSchema>;
export type MessageThreadDto = z.infer<typeof MessageThreadSchema>;
export type MessageListResponseDto = z.infer<typeof MessageListResponseSchema>;
export type MessageStatsDto = z.infer<typeof MessageStatsSchema>;

export type BulkMessageOperationDto = z.infer<
  typeof BulkMessageOperationSchema
>;

// =====================================
// FONCTIONS DE VALIDATION
// =====================================

export function validateCreateMessage(data: unknown): CreateMessageDto {
  return CreateMessageSchema.parse(data);
}

export function validateReplyToMessage(data: unknown): ReplyToMessageDto {
  return ReplyToMessageSchema.parse(data);
}

export function validateUpdateMessage(data: unknown): UpdateMessageDto {
  return UpdateMessageSchema.parse(data);
}

export function validateGetMessagesQuery(data: unknown): GetMessagesQueryDto {
  return GetMessagesQuerySchema.parse(data);
}

export function validateBulkOperation(data: unknown): BulkMessageOperationDto {
  return BulkMessageOperationSchema.parse(data);
}

// =====================================
// FONCTIONS DE TRANSFORMATION
// =====================================

/**
 * Transformer un message legacy vers le format moderne
 */
export function transformLegacyMessage(legacyMessage: any): MessageDto {
  return MessageSchema.parse({
    id: parseInt(legacyMessage.msg_id || legacyMessage.id),
    customerId: legacyMessage.msg_cst_id || legacyMessage.customer_id,
    subject: legacyMessage.msg_subject || legacyMessage.subject,
    message: legacyMessage.msg_content || legacyMessage.message,
    isRead: legacyMessage.msg_open !== '1' && !legacyMessage.is_read,
    isFromAdmin: !!(legacyMessage.msg_cnfa_id || legacyMessage.is_from_admin),
    createdAt: new Date(legacyMessage.msg_date || legacyMessage.created_at),
    parentId:
      legacyMessage.msg_parent_id || legacyMessage.parent_id || undefined,
    replyCount: parseInt(legacyMessage.reply_count || '0'),
    lastReplyAt: legacyMessage.last_reply_at
      ? new Date(legacyMessage.last_reply_at)
      : undefined,
    isUrgent: false, // Par défaut pour les anciens messages
    category: undefined,
    attachments: undefined,
  });
}

/**
 * Transformer les données modernes vers le format legacy pour insertion
 */
export function transformToLegacyMessage(
  messageDto: CreateMessageDto,
  customerId: string,
): Record<string, any> {
  return {
    msg_cst_id: customerId,
    msg_subject: messageDto.subject,
    msg_content: messageDto.message,
    msg_parent_id: messageDto.parentId || null,
    msg_open: '0', // Non lu par défaut
    msg_cnfa_id: null, // Pas de réponse admin par défaut
    msg_date: new Date().toISOString(),
  };
}

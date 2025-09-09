import { z } from 'zod';

/**
 * Schémas de validation Zod pour le module Messages
 * Architecture moderne avec validation côté backend
 */

// Types de messages
export const MessageTypeSchema = z.enum(['system', 'support', 'notification']);

// Niveaux de priorité
export const MessagePrioritySchema = z.enum([
  'low',
  'normal',
  'high',
  'urgent',
]);

// Statuts de messages
export const MessageStatusSchema = z.enum(['open', 'closed', 'all']);

// Schéma pour créer un message
export const CreateMessageSchema = z.object({
  customerId: z.string().min(1, 'ID client requis'),
  staffId: z.string().min(1, 'ID staff requis'),
  orderId: z.string().optional(),
  subject: z.string().min(1, 'Sujet requis').max(200, 'Sujet trop long'),
  content: z.string().min(1, 'Contenu requis').max(5000, 'Contenu trop long'),
  priority: MessagePrioritySchema.default('normal'),
  type: MessageTypeSchema.default('support'),
});

// Schéma pour mettre à jour un message
export const UpdateMessageSchema = z.object({
  subject: z
    .string()
    .min(1, 'Sujet requis')
    .max(200, 'Sujet trop long')
    .optional(),
  content: z
    .string()
    .min(1, 'Contenu requis')
    .max(5000, 'Contenu trop long')
    .optional(),
  priority: MessagePrioritySchema.optional(),
  type: MessageTypeSchema.optional(),
});

// Schéma pour les filtres de recherche
export const MessageFiltersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  staffId: z.string().optional(),
  customerId: z.string().optional(),
  search: z.string().optional(),
  status: MessageStatusSchema.default('all'),
  type: MessageTypeSchema.optional(),
  priority: MessagePrioritySchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// Schéma pour marquer comme lu
export const MarkAsReadSchema = z.object({
  readerId: z.string().min(1, 'ID du lecteur requis'),
});

// Schéma pour fermer un message
export const CloseMessageSchema = z.object({
  closerId: z.string().min(1, 'ID du responsable de fermeture requis'),
  reason: z.string().optional(),
});

// Schéma pour la réponse d'un message
export const MessageResponseSchema = z.object({
  id: z.string(),
  customerId: z.number(),
  staffId: z.string().optional(),
  orderId: z.string().optional(),
  type: MessageTypeSchema,
  title: z.string(),
  content: z.string(),
  priority: MessagePrioritySchema,
  msg_open: z.boolean(),
  msg_close: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Schéma pour les statistiques
export const MessageStatsSchema = z.object({
  total: z.number(),
  open: z.number(),
  closed: z.number(),
  unread: z.number(),
  urgent: z.number(),
  high_priority: z.number(),
  by_type: z.object({
    system: z.number(),
    support: z.number(),
    notification: z.number(),
  }),
});

// Schéma pour la réponse paginée
export const PaginatedMessagesSchema = z.object({
  messages: z.array(MessageResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

// Types TypeScript dérivés des schémas Zod
export type CreateMessageDto = z.infer<typeof CreateMessageSchema>;
export type UpdateMessageDto = z.infer<typeof UpdateMessageSchema>;
export type MessageFiltersDto = z.infer<typeof MessageFiltersSchema>;
export type MarkAsReadDto = z.infer<typeof MarkAsReadSchema>;
export type CloseMessageDto = z.infer<typeof CloseMessageSchema>;
export type MessageResponseDto = z.infer<typeof MessageResponseSchema>;
export type MessageStatsDto = z.infer<typeof MessageStatsSchema>;
export type PaginatedMessagesDto = z.infer<typeof PaginatedMessagesSchema>;

// Schémas pour WebSocket
export const TypingEventSchema = z.object({
  recipientId: z.string().min(1, 'ID destinataire requis'),
  isTyping: z.boolean(),
});

export const JoinConversationSchema = z.object({
  conversationId: z.string().min(1, 'ID conversation requis'),
});

export const WebSocketMarkAsReadSchema = z.object({
  messageId: z.string().min(1, 'ID message requis'),
});

export type TypingEventDto = z.infer<typeof TypingEventSchema>;
export type JoinConversationDto = z.infer<typeof JoinConversationSchema>;
export type WebSocketMarkAsReadDto = z.infer<typeof WebSocketMarkAsReadSchema>;

// Fonctions de validation utilitaires
export const validateCreateMessage = (data: unknown): CreateMessageDto => {
  return CreateMessageSchema.parse(data);
};

export const validateUpdateMessage = (data: unknown): UpdateMessageDto => {
  return UpdateMessageSchema.parse(data);
};

export const validateMessageFilters = (data: unknown): MessageFiltersDto => {
  return MessageFiltersSchema.parse(data);
};

export const validateMarkAsRead = (data: unknown): MarkAsReadDto => {
  return MarkAsReadSchema.parse(data);
};

export const validateCloseMessage = (data: unknown): CloseMessageDto => {
  return CloseMessageSchema.parse(data);
};

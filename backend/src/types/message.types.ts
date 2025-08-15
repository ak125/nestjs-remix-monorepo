/**
 * Types centralisés pour le domaine Messages
 * ✅ Architecture modulaire avec types cohérents
 * ✅ Enums typés pour meilleure lisibilité
 * ✅ DTOs validés pour API
 * ✅ Interfaces complètes avec toutes propriétés
 * ✅ Utilitaires pour logique métier
 */

// ================================
// ENUMS ET CONSTANTES
// ================================

/**
 * Types de messages avec documentation métier
 */
export enum MessageType {
  INFO = 'info', // Message informatif général
  WARNING = 'warning', // Avertissement utilisateur
  ERROR = 'error', // Message d'erreur système
  SUCCESS = 'success', // Confirmation d'action réussie
  NOTIFICATION = 'notification', // Notification système
  ALERT = 'alert', // Alerte importante
}

/**
 * Statuts de lecture des messages
 */
export enum MessageStatus {
  UNREAD = 'unread', // Non lu
  READ = 'read', // Lu
  ARCHIVED = 'archived', // Archivé
}

/**
 * Priorités des messages
 */
export enum MessagePriority {
  LOW = 'low', // Priorité basse
  NORMAL = 'normal', // Priorité normale
  HIGH = 'high', // Priorité élevée
  URGENT = 'urgent', // Urgent
}

// ================================
// INTERFACES PRINCIPALES
// ================================

/**
 * Interface principale Message - Représentation API
 */
export interface Message {
  id: number;
  userId: string;
  title: string;
  content: string;
  type: MessageType;
  status: MessageStatus;
  priority: MessagePriority;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Message avec détails utilisateur étendus
 */
export interface MessageWithDetails extends Message {
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
  threadId?: string;
  parentMessageId?: number;
  replies?: Message[];
  attachments?: MessageAttachment[];
}

/**
 * Pièce jointe de message
 */
export interface MessageAttachment {
  id: number;
  messageId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  uploadedAt: Date;
}

/**
 * Thread de conversation
 */
export interface MessageThread {
  id: string;
  subject: string;
  participants: string[];
  messages: Message[];
  createdAt: Date;
  lastMessageAt: Date;
  isActive: boolean;
}

// ================================
// DTOS - DATA TRANSFER OBJECTS
// ================================

/**
 * DTO pour créer un nouveau message
 */
export interface CreateMessageDto {
  userId: string;
  title: string;
  content: string;
  type?: MessageType;
  priority?: MessagePriority;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  threadId?: string;
  parentMessageId?: number;
}

/**
 * DTO pour mettre à jour un message
 */
export interface UpdateMessageDto {
  title?: string;
  content?: string;
  type?: MessageType;
  priority?: MessagePriority;
  status?: MessageStatus;
  isRead?: boolean;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * DTO pour rechercher des messages
 */
export interface SearchMessagesDto {
  userId?: string;
  type?: MessageType;
  status?: MessageStatus;
  priority?: MessagePriority;
  isRead?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  threadId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority';
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * DTO pour envoyer une notification système
 */
export interface SendNotificationDto {
  userIds: string[];
  title: string;
  content: string;
  type?: MessageType;
  priority?: MessagePriority;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

// ================================
// INTERFACES BASE DE DONNÉES
// ================================

/**
 * Représentation base de données (snake_case)
 */
export interface MessageDbRow {
  id: number;
  user_id: string;
  title: string;
  content: string;
  type: string;
  status: string;
  priority: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  updated_at?: string;
  expires_at?: string;
  metadata?: string; // JSON string
  thread_id?: string;
  parent_message_id?: number;
}

// ================================
// STATISTIQUES ET MÉTRIQUES
// ================================

/**
 * Statistiques des messages pour un utilisateur
 */
export interface MessageStats {
  totalMessages: number;
  unreadCount: number;
  readCount: number;
  archivedCount: number;
  byType: Record<MessageType, number>;
  byPriority: Record<MessagePriority, number>;
  lastMessageAt?: Date;
}

/**
 * Résumé des messages par période
 */
export interface MessageSummary {
  period: string;
  stats: MessageStats;
  recentMessages: Message[];
}

// ================================
// CLASSES UTILITAIRES
// ================================

/**
 * Utilitaires pour la gestion des types de messages
 */
export class MessageTypeUtils {
  /**
   * Vérifier si un type de message est critique
   */
  static isCritical(type: MessageType): boolean {
    return [MessageType.ERROR, MessageType.ALERT].includes(type);
  }

  /**
   * Obtenir la couleur associée au type
   */
  static getTypeColor(type: MessageType): string {
    const colors = {
      [MessageType.INFO]: '#3b82f6',
      [MessageType.SUCCESS]: '#10b981',
      [MessageType.WARNING]: '#f59e0b',
      [MessageType.ERROR]: '#ef4444',
      [MessageType.NOTIFICATION]: '#8b5cf6',
      [MessageType.ALERT]: '#dc2626',
    };
    return colors[type] || colors[MessageType.INFO];
  }

  /**
   * Obtenir l'icône associée au type
   */
  static getTypeIcon(type: MessageType): string {
    const icons = {
      [MessageType.INFO]: 'ℹ️',
      [MessageType.SUCCESS]: '✅',
      [MessageType.WARNING]: '⚠️',
      [MessageType.ERROR]: '❌',
      [MessageType.NOTIFICATION]: '🔔',
      [MessageType.ALERT]: '🚨',
    };
    return icons[type] || icons[MessageType.INFO];
  }

  /**
   * Obtenir le label lisible du type
   */
  static getTypeLabel(type: MessageType): string {
    const labels = {
      [MessageType.INFO]: 'Information',
      [MessageType.SUCCESS]: 'Succès',
      [MessageType.WARNING]: 'Avertissement',
      [MessageType.ERROR]: 'Erreur',
      [MessageType.NOTIFICATION]: 'Notification',
      [MessageType.ALERT]: 'Alerte',
    };
    return labels[type] || 'Inconnu';
  }
}

/**
 * Utilitaires pour la gestion des priorités
 */
export class MessagePriorityUtils {
  /**
   * Obtenir le niveau numérique de priorité (pour tri)
   */
  static getPriorityLevel(priority: MessagePriority): number {
    const levels = {
      [MessagePriority.LOW]: 1,
      [MessagePriority.NORMAL]: 2,
      [MessagePriority.HIGH]: 3,
      [MessagePriority.URGENT]: 4,
    };
    return levels[priority] || levels[MessagePriority.NORMAL];
  }

  /**
   * Vérifier si une priorité nécessite une attention immédiate
   */
  static requiresImmediateAttention(priority: MessagePriority): boolean {
    return [MessagePriority.HIGH, MessagePriority.URGENT].includes(priority);
  }

  /**
   * Obtenir la couleur associée à la priorité
   */
  static getPriorityColor(priority: MessagePriority): string {
    const colors = {
      [MessagePriority.LOW]: '#6b7280',
      [MessagePriority.NORMAL]: '#3b82f6',
      [MessagePriority.HIGH]: '#f59e0b',
      [MessagePriority.URGENT]: '#dc2626',
    };
    return colors[priority] || colors[MessagePriority.NORMAL];
  }
}

/**
 * Mappeur entre représentation DB et API
 */
export class MessageMapper {
  /**
   * Convertir une ligne DB en objet Message
   */
  static fromDb(row: MessageDbRow): Message {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      content: row.content,
      type: row.type as MessageType,
      status: row.status as MessageStatus,
      priority: row.priority as MessagePriority,
      isRead: row.is_read,
      readAt: row.read_at ? new Date(row.read_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  /**
   * Convertir un objet Message en format DB
   */
  static toDb(message: Partial<Message>): Partial<MessageDbRow> {
    return {
      user_id: message.userId,
      title: message.title,
      content: message.content,
      type: message.type,
      status: message.status,
      priority: message.priority,
      is_read: message.isRead,
      read_at: message.readAt?.toISOString(),
      expires_at: message.expiresAt?.toISOString(),
      metadata: message.metadata ? JSON.stringify(message.metadata) : undefined,
    };
  }

  /**
   * Convertir un tableau de lignes DB en Messages
   */
  static fromDbArray(rows: MessageDbRow[]): Message[] {
    return rows.map((row) => MessageMapper.fromDb(row));
  }
}

/**
 * Validateurs pour les messages
 */
export class MessageValidator {
  /**
   * Valider un titre de message
   */
  static isValidTitle(title: string): boolean {
    return !!(title && title.trim().length >= 1 && title.length <= 200);
  }

  /**
   * Valider le contenu d'un message
   */
  static isValidContent(content: string): boolean {
    return !!(content && content.trim().length >= 1 && content.length <= 10000);
  }

  /**
   * Valider un type de message
   */
  static isValidType(type: string): type is MessageType {
    return Object.values(MessageType).includes(type as MessageType);
  }

  /**
   * Valider une priorité de message
   */
  static isValidPriority(priority: string): priority is MessagePriority {
    return Object.values(MessagePriority).includes(priority as MessagePriority);
  }

  /**
   * Valider qu'un message n'a pas expiré
   */
  static isNotExpired(message: Message): boolean {
    if (!message.expiresAt) return true;
    return new Date() < message.expiresAt;
  }
}

// ================================
// CONSTANTES
// ================================

/**
 * Constantes pour les messages
 */
export const MESSAGE_CONSTANTS = {
  DEFAULT_TYPE: MessageType.INFO,
  DEFAULT_PRIORITY: MessagePriority.NORMAL,
  DEFAULT_STATUS: MessageStatus.UNREAD,
  MAX_TITLE_LENGTH: 200,
  MAX_CONTENT_LENGTH: 10000,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

/**
 * Configuration des types de messages
 */
export const MESSAGE_TYPE_CONFIG = {
  [MessageType.INFO]: {
    color: '#3b82f6',
    icon: 'ℹ️',
    label: 'Information',
    requiresAction: false,
  },
  [MessageType.SUCCESS]: {
    color: '#10b981',
    icon: '✅',
    label: 'Succès',
    requiresAction: false,
  },
  [MessageType.WARNING]: {
    color: '#f59e0b',
    icon: '⚠️',
    label: 'Avertissement',
    requiresAction: true,
  },
  [MessageType.ERROR]: {
    color: '#ef4444',
    icon: '❌',
    label: 'Erreur',
    requiresAction: true,
  },
  [MessageType.NOTIFICATION]: {
    color: '#8b5cf6',
    icon: '🔔',
    label: 'Notification',
    requiresAction: false,
  },
  [MessageType.ALERT]: {
    color: '#dc2626',
    icon: '🚨',
    label: 'Alerte',
    requiresAction: true,
  },
} as const;

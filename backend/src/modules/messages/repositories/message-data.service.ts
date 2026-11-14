import { TABLES } from '@repo/database-types';
import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { DatabaseException, ErrorCodes } from '@common/exceptions';
import { ilikeContains } from '@common/utils/postgrest-filter.util';

// Interface pour le message moderne
export interface ModernMessage {
  id: string;
  customerId: string;
  staffId: string;
  orderId?: string;
  subject: string;
  content: string;
  status: 'open' | 'closed';
  priority: 'low' | 'normal' | 'high';
  createdAt: Date;
  updatedAt: Date;
  isRead: boolean;
}

/** Filtres de statut acceptés par la liste. */
export const MESSAGE_STATUS_FILTERS = [
  'all',
  'open',
  'closed',
  'unread',
] as const;
export type MessageStatusFilter = (typeof MESSAGE_STATUS_FILTERS)[number];

// Interface pour les filtres
export interface MessageFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: MessageStatusFilter;
  customerId?: string;
  staffId?: string;
}

/** Ligne de `___xtr_msg` telle que la base la renvoie. */
interface LegacyMessageRow {
  msg_id: string;
  msg_cst_id: string;
  msg_cnfa_id: string;
  msg_ord_id: string | null;
  msg_subject: string | null;
  msg_content: string | null;
  msg_close: string | null;
  msg_open: string | null;
  msg_date: string;
}

/**
 * `msg_close` et `msg_open` sont des colonnes texte : la base renvoie '0' ou
 * '1', jamais un nombre.
 */
const FLAG_SET = '1';
const FLAG_UNSET = '0';

function isFlagSet(value: unknown): boolean {
  return String(value) === FLAG_SET;
}

/**
 * Mode de comptage : exact tant que le résultat reste sous le plafond de
 * lignes de l'API, estimation du planificateur au-delà. Un comptage exact de
 * la table entière la parcourt à chaque appel.
 */
const COUNT_MODE = 'estimated';

@Injectable()
export class MessageDataService extends SupabaseBaseService {
  protected readonly tableName = '___xtr_msg';

  /**
   * Obtenir les messages avec filtres
   */
  async getMessages(filters: MessageFilters = {}): Promise<{
    messages: ModernMessage[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      search,
      status = 'all',
      customerId,
      staffId,
    } = filters;

    try {
      let query = this.supabase
        .from(this.tableName)
        .select(
          'msg_id, msg_cst_id, msg_cnfa_id, msg_ord_id, msg_subject, msg_content, msg_close, msg_date, msg_open',
          { count: COUNT_MODE },
        );

      // Filtres
      if (status === 'closed') {
        query = query.eq('msg_close', FLAG_SET);
      } else if (status === 'open') {
        query = query.eq('msg_close', FLAG_UNSET);
      } else if (status === 'unread') {
        query = query.eq('msg_open', FLAG_UNSET);
      }

      if (customerId) {
        query = query.eq('msg_cst_id', customerId);
      }

      if (staffId) {
        query = query.eq('msg_cnfa_id', staffId);
      }

      if (search) {
        const pattern = ilikeContains(search);
        query = query.or(
          `msg_subject.ilike.${pattern},msg_content.ilike.${pattern}`,
        );
      }

      // Pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      // Tri par date décroissante
      query = query.order('msg_date', { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        this.logger.error('Error fetching messages:', error);
        throw new DatabaseException({
          code: ErrorCodes.MESSAGE.FETCH_FAILED,
          message: `Failed to fetch messages: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : new Error(String(error)),
        });
      }

      const messages = (data || []).map((row) => this.mapLegacyToModern(row));

      return {
        messages,
        total: count || 0,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error('Error in getMessages:', error);
      throw error;
    }
  }

  /**
   * Obtenir un message par ID
   */
  async findMessageById(messageId: string): Promise<ModernMessage | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('msg_id', messageId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        this.logger.error('Error finding message:', error);
        throw new DatabaseException({
          code: ErrorCodes.MESSAGE.NOT_FOUND,
          message: `Failed to find message: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : new Error(String(error)),
        });
      }

      return this.mapLegacyToModern(data);
    } catch (error) {
      this.logger.error('Error in findMessageById:', error);
      throw error;
    }
  }

  /**
   * Créer un nouveau message
   */
  async createMessage(messageData: {
    customerId: string;
    staffId: string;
    orderId?: string;
    subject: string;
    content: string;
    priority?: 'low' | 'normal' | 'high';
  }): Promise<ModernMessage> {
    try {
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      const legacyData = {
        msg_id: msgId,
        msg_cst_id: messageData.customerId,
        msg_cnfa_id: messageData.staffId,
        msg_ord_id: messageData.orderId || null,
        msg_date: now,
        msg_subject: messageData.subject,
        msg_content: messageData.content,
        msg_close: 0,
        msg_open: 0,
      };

      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert(legacyData)
        .select()
        .single();

      if (error) {
        this.logger.error('Error creating message:', error);
        throw new DatabaseException({
          code: ErrorCodes.MESSAGE.CREATE_FAILED,
          message: `Failed to create message: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : new Error(String(error)),
        });
      }

      this.logger.log(`Message created successfully: ${data.msg_id}`);
      return this.mapLegacyToModern(data);
    } catch (error) {
      this.logger.error('Error in createMessage:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour le statut d'un message
   */
  async updateMessageStatus(
    messageId: string,
    updates: { closed?: boolean; read?: boolean },
  ): Promise<ModernMessage> {
    try {
      const updateData: Record<string, number> = {};

      if (updates.closed !== undefined) {
        updateData.msg_close = updates.closed ? 1 : 0;
      }

      if (updates.read !== undefined) {
        updateData.msg_open = updates.read ? 1 : 0;
      }

      const { data, error } = await this.supabase
        .from(this.tableName)
        .update(updateData)
        .eq('msg_id', messageId)
        .select()
        .single();

      if (error) {
        this.logger.error('Error updating message:', error);
        throw new DatabaseException({
          code: ErrorCodes.MESSAGE.UPDATE_FAILED,
          message: `Failed to update message: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : new Error(String(error)),
        });
      }

      return this.mapLegacyToModern(data);
    } catch (error) {
      this.logger.error('Error in updateMessageStatus:', error);
      throw error;
    }
  }

  /**
   * Obtenir les statistiques
   *
   * Chaque chiffre est compté par la base. Les lire dans les lignes renvoyées
   * les plafonnait au nombre de lignes d'une réponse.
   */
  async getStatistics(
    customerId?: string,
  ): Promise<{ total: number; open: number; closed: number; unread: number }> {
    try {
      const [total, closed, unread] = await Promise.all([
        this.countMessages(customerId),
        this.countMessages(customerId, {
          column: 'msg_close',
          value: FLAG_SET,
        }),
        this.countMessages(customerId, {
          column: 'msg_open',
          value: FLAG_UNSET,
        }),
      ]);

      // Tout message non fermé est ouvert, comme dans `mapLegacyToModern`.
      return { total, open: Math.max(total - closed, 0), closed, unread };
    } catch (error) {
      this.logger.error('Error in getStatistics:', error);
      throw error;
    }
  }

  /**
   * Compter les messages d'un client (ou de tous), sans lire leurs lignes.
   */
  private async countMessages(
    customerId: string | undefined,
    flag?: { column: 'msg_close' | 'msg_open'; value: string },
  ): Promise<number> {
    let query = this.supabase
      .from(this.tableName)
      .select('msg_id', { count: COUNT_MODE, head: true });

    if (customerId) {
      query = query.eq('msg_cst_id', customerId);
    }

    if (flag) {
      query = query.eq(flag.column, flag.value);
    }

    const { count, error } = await query;

    if (error || count === null) {
      const reason = error?.message || 'count missing from the response';
      this.logger.error('Error counting messages:', error ?? reason);
      throw new DatabaseException({
        code: ErrorCodes.MESSAGE.FETCH_FAILED,
        message: `Failed to fetch statistics: ${reason}`,
        details: reason,
        cause: error instanceof Error ? error : new Error(reason),
      });
    }

    return count;
  }

  /**
   * Obtenir les clients récents
   */
  async getCustomers(
    limit: number = 100,
  ): Promise<Array<{ cst_id: string; cst_fname: string; cst_mail: string }>> {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.xtr_customer)
        .select('cst_id, cst_fname, cst_mail')
        .limit(limit)
        .order('cst_id', { ascending: false });

      if (error) {
        this.logger.error('Error fetching customers:', error);
        throw new DatabaseException({
          code: ErrorCodes.MESSAGE.FETCH_FAILED,
          message: `Failed to fetch customers: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : new Error(String(error)),
        });
      }

      return data || [];
    } catch (error) {
      this.logger.error('Error in getCustomers:', error);
      throw error;
    }
  }

  /**
   * Mapper les données legacy vers le format moderne
   */
  private mapLegacyToModern(row: LegacyMessageRow): ModernMessage {
    return {
      id: row.msg_id,
      customerId: row.msg_cst_id,
      staffId: row.msg_cnfa_id,
      orderId: row.msg_ord_id || undefined,
      subject: row.msg_subject || '',
      content: row.msg_content || '',
      status: isFlagSet(row.msg_close) ? 'closed' : 'open',
      priority: 'normal',
      createdAt: new Date(row.msg_date),
      updatedAt: new Date(row.msg_date),
      isRead: isFlagSet(row.msg_open),
    };
  }
}

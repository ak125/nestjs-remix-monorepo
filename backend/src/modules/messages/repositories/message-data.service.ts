import { TABLES } from '@repo/database-types';
import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

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

// Interface pour les filtres
export interface MessageFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'open' | 'closed' | 'all';
  customerId?: string;
  staffId?: string;
}

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
        .select('*', { count: 'exact' });

      // Filtres
      if (status !== 'all') {
        query = query.eq('msg_close', status === 'closed' ? 1 : 0);
      }

      if (customerId) {
        query = query.eq('msg_cst_id', customerId);
      }

      if (staffId) {
        query = query.eq('msg_cnfa_id', staffId);
      }

      if (search) {
        query = query.or(
          `msg_subject.ilike.%${search}%,msg_content.ilike.%${search}%`,
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
        throw new Error(`Failed to fetch messages: ${error.message}`);
      }

      const messages = (data || []).map((row: any) =>
        this.mapLegacyToModern(row),
      );

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
        throw new Error(`Failed to find message: ${error.message}`);
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
        throw new Error(`Failed to create message: ${error.message}`);
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
      const updateData: any = {};

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
        throw new Error(`Failed to update message: ${error.message}`);
      }

      return this.mapLegacyToModern(data);
    } catch (error) {
      this.logger.error('Error in updateMessageStatus:', error);
      throw error;
    }
  }

  /**
   * Obtenir les statistiques
   */
  async getStatistics(
    customerId?: string,
  ): Promise<{ total: number; open: number; closed: number; unread: number }> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('msg_close, msg_open');

      // Filtrer par customer si spécifié
      if (customerId) {
        query = query.eq('cst_id', customerId);
      }

      const { data, error } = await query;

      if (error) {
        this.logger.error('Error fetching statistics:', error);
        throw new Error(`Failed to fetch statistics: ${error.message}`);
      }

      const total = data?.length || 0;
      const open = data?.filter((row: any) => row.msg_close === 0).length || 0;
      const closed =
        data?.filter((row: any) => row.msg_close === 1).length || 0;
      const unread = data?.filter((row: any) => row.msg_open === 0).length || 0;

      return { total, open, closed, unread };
    } catch (error) {
      this.logger.error('Error in getStatistics:', error);
      throw error;
    }
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
        throw new Error(`Failed to fetch customers: ${error.message}`);
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
  private mapLegacyToModern(row: any): ModernMessage {
    return {
      id: row.msg_id,
      customerId: row.msg_cst_id,
      staffId: row.msg_cnfa_id,
      orderId: row.msg_ord_id || undefined,
      subject: row.msg_subject || '',
      content: row.msg_content || '',
      status: row.msg_close === 1 ? 'closed' : 'open',
      priority: 'normal',
      createdAt: new Date(row.msg_date),
      updatedAt: new Date(row.msg_date),
      isRead: row.msg_open === 1,
    };
  }
}

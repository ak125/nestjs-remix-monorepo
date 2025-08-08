/**
 * Service de gestion des messages - Table ___xtr_msg
 * Communication entre clients et staff administratif
 */

import { Injectable } from '@nestjs/common';
import { SupabaseServiceFacade } from '../../database/supabase-service-facade';

export interface Message {
  msg_id: string;
  msg_cst_id: string;
  msg_cnfa_id: string;
  msg_ord_id?: string;
  msg_orl_id?: string;
  msg_date: string;
  msg_subject: string;
  msg_content: string;
  msg_parent_id?: string;
  msg_open: '0' | '1';
  msg_close: '0' | '1';
}

export interface MessageWithDetails extends Message {
  customer?: {
    cst_name: string;
    cst_fname: string;
    cst_mail: string;
  };
  staff?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

@Injectable()
export class MessagesService {
  constructor(private readonly supabaseService: SupabaseServiceFacade) {}

  /**
   * Récupérer tous les messages avec pagination simple
   */
  async getAllMessages(
    page = 1,
    limit = 20,
    filters?: {
      staffId?: string;
      customerId?: string;
      orderId?: string;
      status?: 'open' | 'closed' | 'all';
    },
  ): Promise<{
    messages: MessageWithDetails[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      console.log(`📧 Récupération messages page ${page}, limit ${limit}`);
      const { messages, total: totalCount } =
        await this.supabaseService.listMessages({ page, limit, filters });
      console.log(`✅ ${messages?.length || 0} messages récupérés`);

      // Enrichir avec les données client/staff
      const messagesWithDetails = await Promise.all(
        (messages || []).map(async (msg: Message) => {
          let customer = null;
          let staff = null;

          // Récupérer les infos client
          if (msg.msg_cst_id) {
            try {
              const customerData = await this.supabaseService.getUserById(
                msg.msg_cst_id,
              );
              if (customerData) {
                customer = {
                  cst_name: customerData.cst_name || '',
                  cst_fname: customerData.cst_fname || '',
                  cst_mail: customerData.cst_mail || '',
                };
              }
            } catch (_err) {
              console.warn(`⚠️ Client ${msg.msg_cst_id} non trouvé`);
            }
          }

          // Récupérer les infos staff
          if (msg.msg_cnfa_id) {
            try {
              const staffData = await this.supabaseService.getUserById(
                msg.msg_cnfa_id,
              );
              if (staffData) {
                staff = {
                  firstName: staffData.cst_fname || 'Staff',
                  lastName: staffData.cst_name || 'Member',
                  email: staffData.cst_mail || '',
                };
              }
            } catch (_err) {
              console.warn(`⚠️ Staff ${msg.msg_cnfa_id} non trouvé`);
            }
          }

          return {
            ...msg,
            customer,
            staff,
          };
        }),
      );

      const total = totalCount || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        messages: messagesWithDetails,
        total,
        page,
        totalPages,
      };
    } catch (error: any) {
      console.error('❌ Erreur service messages:', error);
      throw new Error(`Erreur récupération messages: ${error.message}`);
    }
  }

  /**
   * Récupérer un message par ID
   */
  async getMessageById(messageId: string): Promise<MessageWithDetails | null> {
    try {
      const msg = await this.supabaseService.fetchMessageById(messageId);
      if (!msg) return null;

      // Enrichir avec les données client/staff
      let customer: MessageWithDetails['customer'] = undefined;
      let staff: MessageWithDetails['staff'] = undefined;

      if (msg.msg_cst_id) {
        try {
          const customerData = await this.supabaseService.getUserById(
            msg.msg_cst_id,
          );
          if (customerData) {
            customer = {
              cst_name: customerData.cst_name || '',
              cst_fname: customerData.cst_fname || '',
              cst_mail: customerData.cst_mail || '',
            };
          }
        } catch (error) {
          console.warn(`⚠️ Client ${msg.msg_cst_id} non trouvé`);
        }
      }

      if (msg.msg_cnfa_id) {
        try {
          const staffData = await this.supabaseService.getUserById(
            msg.msg_cnfa_id,
          );
          if (staffData) {
            staff = {
              firstName: staffData.cst_fname || 'Staff',
              lastName: staffData.cst_name || 'Member',
              email: staffData.cst_mail || '',
            };
          }
        } catch (error) {
          console.warn(`⚠️ Staff ${msg.msg_cnfa_id} non trouvé`);
        }
      }

      return {
        ...msg,
        customer,
        staff,
      };
    } catch (error: any) {
      console.error(`❌ Erreur récupération message ${messageId}:`, error);
      throw new Error(`Erreur récupération message: ${error.message}`);
    }
  }

  /**
   * Créer un nouveau message (version simplifiée)
   */
  async createMessage(messageData: {
    customerId: string;
    staffId: string;
    orderId?: string;
    orderLineId?: string;
    subject: string;
    content: string;
    parentId?: string;
  }): Promise<Message> {
    try {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      const newMessage: Message = {
        msg_id: messageId,
        msg_cst_id: messageData.customerId,
        msg_cnfa_id: messageData.staffId,
        msg_ord_id: messageData.orderId || '',
        msg_orl_id: messageData.orderLineId || '',
        msg_date: now,
        msg_subject: messageData.subject,
        msg_content: messageData.content,
        msg_parent_id: messageData.parentId || '',
        msg_open: '1',
        msg_close: '0',
      };
      await this.supabaseService.createMessageRecord(newMessage);

      console.log(`✅ Message ${messageId} créé avec succès`);
      return newMessage;
    } catch (error: any) {
      console.error('❌ Erreur création message:', error);
      throw new Error(`Erreur création message: ${error.message}`);
    }
  }

  /**
   * Fermer un message
   */
  async closeMessage(messageId: string): Promise<boolean> {
    try {
      await this.supabaseService.closeMessageRecord(messageId);

      console.log(`✅ Message ${messageId} fermé`);
      return true;
    } catch (error: any) {
      console.error(`❌ Erreur fermeture message ${messageId}:`, error);
      return false;
    }
  }

  /**
   * Récupérer les statistiques des messages (version simplifiée)
   */
  async getMessageStats(): Promise<{
    total: number;
    open: number;
    closed: number;
    byStaff: Record<string, number>;
    recent: number;
  }> {
    try {
      const { total, open, closed } =
        await this.supabaseService.getMessageStats();

      return {
        total,
        open,
        closed,
        byStaff: {}, // À implémenter si nécessaire
        recent: 0, // À implémenter si nécessaire
      };
    } catch (error: any) {
      console.error('❌ Erreur stats messages:', error);
      return { total: 0, open: 0, closed: 0, byStaff: {}, recent: 0 };
    }
  }
}

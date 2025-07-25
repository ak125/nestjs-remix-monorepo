/**
 * Service de gestion des messages - Table ___xtr_msg
 * Communication entre clients et staff administratif
 */

import { Injectable } from '@nestjs/common';
import { SupabaseRestService } from '../../database/supabase-rest.service';

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
  constructor(private readonly supabaseService: SupabaseRestService) {}

  /**
   * Récupérer tous les messages avec pagination simple
   */
  async getAllMessages(page = 1, limit = 20, filters?: {
    staffId?: string;
    customerId?: string;
    orderId?: string;
    status?: 'open' | 'closed' | 'all';
  }): Promise<{
    messages: MessageWithDetails[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      console.log(`📧 Récupération messages page ${page}, limit ${limit}`);
      
      // Construction de l'URL avec filtres REST API
      const baseUrl = `${this.supabaseService['baseUrl']}/___xtr_msg?select=*`;
      let url = baseUrl;
      
      // Ajout des filtres
      const queryParams: string[] = [];
      
      if (filters?.staffId) {
        queryParams.push(`msg_cnfa_id=eq.${filters.staffId}`);
      }
      
      if (filters?.customerId) {
        queryParams.push(`msg_cst_id=eq.${filters.customerId}`);
      }
      
      if (filters?.orderId) {
        queryParams.push(`msg_ord_id=eq.${filters.orderId}`);
      }
      
      if (filters?.status === 'open') {
        queryParams.push(`msg_open=eq.1`);
      } else if (filters?.status === 'closed') {
        queryParams.push(`msg_close=eq.1`);
      }
      
      if (queryParams.length > 0) {
        url += `&${queryParams.join('&')}`;
      }
      
      // Pagination
      const offset = (page - 1) * limit;
      url += `&order=msg_date.desc&limit=${limit}&offset=${offset}`;
      
      console.log(`� URL Messages: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.supabaseService['headers'],
      });
      
      if (!response.ok) {
        console.error('Erreur récupération messages:', response.status);
        throw new Error(`Erreur API: ${response.status}`);
      }
      
      const messages = await response.json();
      console.log(`✅ ${messages.length} messages récupérés`);
      
      // Enrichir avec les données client/staff
      const messagesWithDetails = await Promise.all(
        messages.map(async (msg: Message) => {
          let customer = null;
          let staff = null;
          
          // Récupérer les infos client
          if (msg.msg_cst_id) {
            try {
              const customerData = await this.supabaseService.getUserById(msg.msg_cst_id);
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
          
          // Récupérer les infos staff
          if (msg.msg_cnfa_id) {
            try {
              const staffData = await this.supabaseService.getUserById(msg.msg_cnfa_id);
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
        })
      );
      
      // Compter le total (approximation simple)
      const total = messages.length < limit ? messages.length : limit * page + 1;
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
      const url = `${this.supabaseService['baseUrl']}/___xtr_msg?msg_id=eq.${messageId}&select=*&limit=1`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.supabaseService['headers'],
      });
      
      if (!response.ok || response.status === 404) {
        return null;
      }
      
      const messages = await response.json();
      
      if (!messages || messages.length === 0) {
        return null;
      }
      
      const msg = messages[0];
      
      // Enrichir avec les données client/staff
      let customer = null;
      let staff = null;
      
      if (msg.msg_cst_id) {
        try {
          const customerData = await this.supabaseService.getUserById(msg.msg_cst_id);
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
          const staffData = await this.supabaseService.getUserById(msg.msg_cnfa_id);
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
      
      const url = `${this.supabaseService['baseUrl']}/___xtr_msg`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.supabaseService['headers'],
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(newMessage),
      });
      
      if (!response.ok) {
        throw new Error(`Erreur création: ${response.status}`);
      }
      
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
      const url = `${this.supabaseService['baseUrl']}/___xtr_msg?msg_id=eq.${messageId}`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          ...this.supabaseService['headers'],
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          msg_close: '1',
          msg_open: '0',
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Erreur fermeture: ${response.status}`);
      }
      
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
      // Total des messages
      const totalUrl = `${this.supabaseService['baseUrl']}/___xtr_msg?select=count`;
      const totalResponse = await fetch(totalUrl, {
        method: 'GET',
        headers: {
          ...this.supabaseService['headers'],
          'Prefer': 'count=exact',
        },
      });
      
      // Messages ouverts
      const openUrl = `${this.supabaseService['baseUrl']}/___xtr_msg?msg_open=eq.1&select=count`;
      const openResponse = await fetch(openUrl, {
        method: 'GET',
        headers: {
          ...this.supabaseService['headers'],
          'Prefer': 'count=exact',
        },
      });
      
      // Messages fermés
      const closedUrl = `${this.supabaseService['baseUrl']}/___xtr_msg?msg_close=eq.1&select=count`;
      const closedResponse = await fetch(closedUrl, {
        method: 'GET',
        headers: {
          ...this.supabaseService['headers'],
          'Prefer': 'count=exact',
        },
      });
      
      // Extraction des counts depuis les headers
      const total = parseInt(totalResponse.headers.get('Content-Range')?.split('/')[1] || '0');
      const open = parseInt(openResponse.headers.get('Content-Range')?.split('/')[1] || '0');
      const closed = parseInt(closedResponse.headers.get('Content-Range')?.split('/')[1] || '0');
      
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

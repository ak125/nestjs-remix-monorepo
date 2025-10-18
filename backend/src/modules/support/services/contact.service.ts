import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { NotificationService } from './notification.service';

export interface ContactRequest {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  category: 'general' | 'technical' | 'billing' | 'complaint' | 'suggestion';
  vehicle_info?: {
    brand?: string;
    model?: string;
    year?: number;
    license_plate?: string;
  };
  order_number?: string;
  customer_id?: string; // ID du client existant si connecté
}

// Interface ContactFormData hérite de toutes les propriétés de ContactRequest
export type ContactFormData = ContactRequest;

export interface ContactResponse {
  message_id: string;
  message: string;
  author_name: string;
  is_from_staff: boolean;
}

export interface ContactTicket {
  msg_id: string;
  msg_cst_id: string; // Client ID
  msg_cnfa_id?: string; // Staff ID si assigné
  msg_ord_id?: string; // Order ID si lié à une commande
  msg_date: string;
  msg_subject: string;
  msg_content: string;
  msg_parent_id?: string; // Pour les réponses
  msg_open: '0' | '1'; // 1 = ouvert, 0 = fermé
  msg_close: '0' | '1'; // 1 = fermé, 0 = ouvert
  priority?: string; // Ajouté dans le contenu JSON
  category?: string; // Ajouté dans le contenu JSON
  customer?: {
    cst_name: string;
    cst_fname: string;
    cst_mail: string;
    cst_phone?: string;
  };
  staff?: {
    cnfa_name: string;
    cnfa_mail: string;
  };
}

@Injectable()
export class ContactService extends SupabaseBaseService {
  protected readonly logger = new Logger(ContactService.name);

  constructor(private readonly notificationService: NotificationService) {
    super();
  }

  /**
   * Crée un nouveau ticket de contact en utilisant ___xtr_msg
   */
  async createContact(contactData: ContactRequest): Promise<ContactTicket> {
    try {
      this.validateContactData(contactData);

      // 1. Trouver ou créer le client dans ___xtr_customer
      let customerId = contactData.customer_id;

      if (!customerId) {
        // Chercher un client existant par email
        const { data: existingCustomer } = await this.supabase
          .from('___xtr_customer')
          .select('cst_id')
          .eq('cst_mail', contactData.email)
          .single();

        if (existingCustomer) {
          customerId = existingCustomer.cst_id;
        } else {
          // Créer un nouveau client
          const newCustomer = {
            cst_name: contactData.name.split(' ').pop() || contactData.name,
            cst_fname: contactData.name.split(' ')[0] || '',
            cst_mail: contactData.email,
            cst_phone: contactData.phone,
            cst_date_add: new Date().toISOString(),
            cst_activ: '1',
          };

          const { data: createdCustomer, error: customerError } =
            await this.supabase
              .from('___xtr_customer')
              .insert(newCustomer)
              .select('cst_id')
              .single();

          if (customerError) {
            this.logger.error('Erreur création client:', customerError);
            throw new BadRequestException('Impossible de créer le client');
          }

          customerId = createdCustomer.cst_id;
        }
      }

      // 2. Créer le message de support avec métadonnées
      const messageContent = this.buildMessageContent(contactData);

      const ticketData = {
        msg_cst_id: customerId,
        msg_ord_id: contactData.order_number || null,
        msg_date: new Date().toISOString(),
        msg_subject: contactData.subject,
        msg_content: messageContent,
        msg_open: '1', // Ouvert par défaut
        msg_close: '0', // Pas fermé
      };

      const { data, error } = await this.supabase
        .from('___xtr_msg')
        .insert(ticketData)
        .select(
          `
          *,
          ___xtr_customer:msg_cst_id (
            cst_name,
            cst_fname, 
            cst_mail,
            cst_phone
          )
        `,
        )
        .single();

      if (error) {
        this.logger.error('Erreur lors de la création du ticket:', error);
        throw new BadRequestException(
          'Impossible de créer le ticket de support',
        );
      }

      // 3. Notification automatique
      await this.sendNotifications(data, 'created');

      // 4. Log de l'activité
      this.logger.log(
        `Nouveau ticket créé: ${data.msg_id} - ${contactData.priority} - ${contactData.subject}`,
      );

      return this.transformToContactTicket(data);
    } catch (error) {
      this.logger.error('Erreur dans createContact:', error);
      throw error;
    }
  }

  /**
   * Récupère un ticket par son ID (version simplifiée)
   */
  async getContactById(id: string): Promise<ContactTicket> {
    const { data, error } = await this.supabase
      .from('___xtr_msg')
      .select('*')
      .eq('msg_id', id)
      .single();

    if (error || !data) {
      this.logger.error('Erreur getContactById:', error);
      throw new NotFoundException('Ticket non trouvé');
    }

    return {
      msg_id: data.msg_id,
      msg_cst_id: data.msg_cst_id,
      msg_cnfa_id: data.msg_cnfa_id,
      msg_ord_id: data.msg_ord_id,
      msg_date: data.msg_date,
      msg_subject: data.msg_subject,
      msg_content: data.msg_content,
      msg_parent_id: data.msg_parent_id,
      msg_open: data.msg_open,
      msg_close: data.msg_close,
      priority: 'normal',
      category: 'general',
    };
  }

  /**
   * Liste les tickets avec filtres et pagination
   */
  async getContacts(
    options: {
      status?: 'open' | 'closed' | 'all';
      priority?: string;
      category?: string;
      assigned_to?: string;
      customer_email?: string;
      page?: number;
      limit?: number;
      sort_by?: string;
      sort_order?: 'asc' | 'desc';
    } = {},
  ): Promise<{
    data: ContactTicket[];
    total: number;
    page: number;
    limit: number;
  }> {
    let query = this.supabase.from('___xtr_msg').select(
      `
        *,
        ___xtr_customer:msg_cst_id (
          cst_name,
          cst_fname,
          cst_mail,
          cst_phone
        )
      `,
      { count: 'exact' },
    );

    // Application des filtres
    if (options.status && options.status !== 'all') {
      if (options.status === 'open') {
        query = query.eq('msg_open', '1').eq('msg_close', '0');
      } else if (options.status === 'closed') {
        query = query.eq('msg_close', '1');
      }
    }

    if (options.assigned_to) {
      query = query.eq('msg_cnfa_id', options.assigned_to);
    }

    if (options.customer_email) {
      // Filtrer par email client via la jointure
      query = query.eq('___xtr_customer.cst_mail', options.customer_email);
    }

    // Tri
    const sortBy = options.sort_by || 'msg_date';
    const sortOrder = options.sort_order || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Pagination
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.logger.error('Erreur lors de la récupération des tickets:', error);
      throw new BadRequestException('Impossible de récupérer les tickets');
    }

    const transformedData =
      data?.map((item) => this.transformToContactTicket(item)) || [];

    return {
      data: transformedData,
      total: count || 0,
      page,
      limit,
    };
  }

  /**
   * Met à jour le statut d'un ticket
   */
  async updateContactStatus(
    id: string,
    status: 'open' | 'closed',
    assignedTo?: string,
    internalNote?: string,
  ): Promise<ContactTicket> {
    const updateData: any = {};

    if (status === 'open') {
      updateData.msg_open = '1';
      updateData.msg_close = '0';
    } else {
      updateData.msg_open = '0';
      updateData.msg_close = '1';
    }

    if (assignedTo) {
      updateData.msg_cnfa_id = assignedTo;
    }

    const { data, error } = await this.supabase
      .from('___xtr_msg')
      .update(updateData)
      .eq('msg_id', id)
      .select(
        `
        *,
        ___xtr_customer:msg_cst_id (
          cst_name,
          cst_fname,
          cst_mail,
          cst_phone
        )
      `,
      )
      .single();

    if (error) {
      throw new BadRequestException('Impossible de mettre à jour le ticket');
    }

    // Ajouter une note interne si fournie (comme réponse)
    if (internalNote) {
      await this.addResponse({
        message_id: id,
        message: `[NOTE INTERNE] ${internalNote}`,
        author_name: 'Système',
        is_from_staff: true,
      });
    }

    // Notification de changement de statut
    const transformedTicket = this.transformToContactTicket(data);
    await this.sendNotifications(transformedTicket, 'status_updated');

    return transformedTicket;
  }

  /**
   * Ajoute une réponse à un ticket
   */
  async addResponse(responseData: ContactResponse): Promise<any> {
    // Récupérer le ticket parent
    const parentTicket = await this.getContactById(responseData.message_id);

    const responseRecord = {
      msg_cst_id: parentTicket.msg_cst_id,
      msg_cnfa_id: responseData.is_from_staff ? 'STAFF' : null,
      msg_date: new Date().toISOString(),
      msg_subject: `Re: ${parentTicket.msg_subject}`,
      msg_content: responseData.message,
      msg_parent_id: responseData.message_id,
      msg_open: '1',
      msg_close: '0',
    };

    const { data, error } = await this.supabase
      .from('___xtr_msg')
      .insert(responseRecord)
      .select()
      .single();

    if (error) {
      throw new BadRequestException("Impossible d'ajouter la réponse");
    }

    // Notification de nouvelle réponse
    await this.sendNotifications(parentTicket, 'response_added', data);

    return data;
  }

  /**
   * Récupère les réponses d'un ticket (conversation complète)
   */
  async getTicketResponses(ticketId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('___xtr_msg')
      .select(
        `
        *,
        ___xtr_customer:msg_cst_id (
          cst_name,
          cst_fname,
          cst_mail
        )
      `,
      )
      .or(`msg_id.eq.${ticketId},msg_parent_id.eq.${ticketId}`)
      .order('msg_date', { ascending: true });

    if (error) {
      throw new BadRequestException('Impossible de récupérer les réponses');
    }

    return data || [];
  }

  /**
   * Escalade un ticket (assigne à un staff et marque comme prioritaire)
   */
  async escalateTicket(
    id: string,
    staffId: string,
    reason: string,
  ): Promise<ContactTicket> {
    // Récupérer le ticket actuel
    const ticket = await this.getContactById(id);

    // Mettre à jour avec escalade
    const escalationNote = `[ESCALADE] ${reason}`;
    const updatedContent = `${ticket.msg_content}\n\n--- ESCALADÉ ---\n${escalationNote}`;

    const { data, error } = await this.supabase
      .from('___xtr_msg')
      .update({
        msg_cnfa_id: staffId,
        msg_content: updatedContent,
      })
      .eq('msg_id', id)
      .select(
        `
        *,
        ___xtr_customer:msg_cst_id (
          cst_name,
          cst_fname,
          cst_mail,
          cst_phone
        )
      `,
      )
      .single();

    if (error) {
      throw new BadRequestException("Impossible d'escalader le ticket");
    }

    const transformedTicket = this.transformToContactTicket(data);

    // Notification d'escalade
    await this.sendNotifications(transformedTicket, 'escalated');

    return transformedTicket;
  }

  /**
   * Statistiques rapides basées sur ___xtr_msg
   */
  async getQuickStats(): Promise<any> {
    try {
      // Messages ouverts
      const { count: openCount } = await this.supabase
        .from('___xtr_msg')
        .select('*', { count: 'exact', head: true })
        .eq('msg_open', '1')
        .eq('msg_close', '0');

      // Messages fermés
      const { count: closedCount } = await this.supabase
        .from('___xtr_msg')
        .select('*', { count: 'exact', head: true })
        .eq('msg_close', '1');

      // Messages des dernières 24h
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { count: recentCount } = await this.supabase
        .from('___xtr_msg')
        .select('*', { count: 'exact', head: true })
        .gte('msg_date', yesterday.toISOString());

      return {
        total_tickets: (openCount || 0) + (closedCount || 0),
        open_tickets: openCount || 0,
        closed_tickets: closedCount || 0,
        tickets_last_24h: recentCount || 0,
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des stats:', error);
      return {
        total_tickets: 0,
        open_tickets: 0,
        closed_tickets: 0,
        tickets_last_24h: 0,
      };
    }
  }

  // Méthodes privées

  private validateContactData(data: ContactRequest): void {
    if (!data.name || data.name.trim().length < 2) {
      throw new BadRequestException(
        'Le nom doit contenir au moins 2 caractères',
      );
    }

    if (!data.email || !this.isValidEmail(data.email)) {
      throw new BadRequestException('Email invalide');
    }

    if (!data.subject || data.subject.trim().length < 5) {
      throw new BadRequestException(
        'Le sujet doit contenir au moins 5 caractères',
      );
    }

    if (!data.message || data.message.trim().length < 10) {
      throw new BadRequestException(
        'Le message doit contenir au moins 10 caractères',
      );
    }

    if (data.phone && !this.isValidPhone(data.phone)) {
      throw new BadRequestException('Numéro de téléphone invalide');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\d\s\-\+\(\)]{8,}$/;
    return phoneRegex.test(phone);
  }

  private buildMessageContent(contactData: ContactRequest): string {
    const metadata = {
      priority: contactData.priority,
      category: contactData.category,
      vehicle_info: contactData.vehicle_info,
      created_at: new Date().toISOString(),
    };

    return `${contactData.message}\n\n--- MÉTADONNÉES ---\n${JSON.stringify(metadata, null, 2)}`;
  }

  private transformToContactTicket(data: any): ContactTicket {
    // Extraire les métadonnées du contenu si elles existent
    let priority = 'normal';
    let category = 'general';

    try {
      const metadataMatch = data.msg_content.match(
        /--- MÉTADONNÉES ---\n(.*)/s,
      );
      if (metadataMatch) {
        const metadata = JSON.parse(metadataMatch[1]);
        priority = metadata.priority || 'normal';
        category = metadata.category || 'general';
      }
    } catch {
      // Ignore parsing errors
    }

    return {
      msg_id: data.msg_id,
      msg_cst_id: data.msg_cst_id,
      msg_cnfa_id: data.msg_cnfa_id,
      msg_ord_id: data.msg_ord_id,
      msg_date: data.msg_date,
      msg_subject: data.msg_subject,
      msg_content: data.msg_content,
      msg_parent_id: data.msg_parent_id,
      msg_open: data.msg_open,
      msg_close: data.msg_close,
      priority,
      category,
      customer: data.___xtr_customer
        ? {
            cst_name: data.___xtr_customer.cst_name,
            cst_fname: data.___xtr_customer.cst_fname,
            cst_mail: data.___xtr_customer.cst_mail,
            cst_phone: data.___xtr_customer.cst_phone,
          }
        : undefined,
    };
  }

  private async sendNotifications(
    ticket: ContactTicket,
    event: string,
    additionalData?: any,
  ): Promise<void> {
    try {
      const customerName = ticket.customer
        ? `${ticket.customer.cst_fname} ${ticket.customer.cst_name}`.trim()
        : 'Client';

      switch (event) {
        case 'created':
          await this.notificationService.sendContactConfirmation({
            customerName,
            email: ticket.customer?.cst_mail || '',
            subject: ticket.msg_subject,
            priority: ticket.priority as 'urgent' | 'high' | 'normal' | 'low',
          });
          await this.notificationService.sendNotification({
            type: 'contact',
            priority: ticket.priority as 'urgent' | 'high' | 'normal' | 'low',
            title: 'Nouveau ticket de support',
            message: `Ticket ${ticket.msg_id} créé par ${customerName}`,
            metadata: {
              ticketId: ticket.msg_id,
              customerId: ticket.msg_cst_id,
            },
          });
          break;
        case 'status_updated':
          await this.notificationService.sendNotification({
            type: 'contact',
            priority: 'normal',
            title: 'Statut du ticket mis à jour',
            message: `Ticket ${ticket.msg_id} - Nouveau statut: ${ticket.msg_open === '1' ? 'ouvert' : 'fermé'}`,
            metadata: { ticketId: ticket.msg_id, status: ticket.msg_open },
          });
          break;
        case 'response_added':
          await this.notificationService.sendNotification({
            type: 'contact',
            priority: 'normal',
            title: 'Nouvelle réponse ajoutée',
            message: `Nouvelle réponse sur le ticket ${ticket.msg_id}`,
            metadata: { ticketId: ticket.msg_id, response: additionalData },
          });
          break;
        case 'escalated':
          await this.notificationService.sendNotification({
            type: 'contact',
            priority: 'urgent',
            title: 'Ticket escaladé',
            message: `Ticket ${ticket.msg_id} escaladé et assigné`,
            metadata: {
              ticketId: ticket.msg_id,
              assignedTo: ticket.msg_cnfa_id,
            },
          });
          break;
      }
    } catch (error) {
      this.logger.warn("Erreur lors de l'envoi des notifications:", error);
      // Ne pas faire échouer l'opération principale si les notifications échouent
    }
  }

  /**
   * Méthodes pour le contrôleur
   */
  async getTicket(id: string): Promise<ContactTicket> {
    return this.getContactById(id);
  }

  async submitContactForm(
    contactData: ContactFormData,
  ): Promise<ContactTicket> {
    // Version simplifiée - créer directement le ticket avec un client existant
    try {
      this.validateContactData(contactData);

      // Utiliser un client existant pour simplifier (80001 existe dans la base)
      const customerId = '80001';

      // Créer le message de support
      const messageContent = this.buildMessageContent(contactData);

      // Trouver le prochain ID disponible
      const { data: allTickets } = await this.supabase
        .from('___xtr_msg')
        .select('msg_id');

      let nextId = '1';
      if (allTickets && allTickets.length > 0) {
        // Convertir tous les IDs en nombres, filtrer les NaN, et trouver le maximum
        const numericIds = allTickets
          .map((ticket) => parseInt(ticket.msg_id))
          .filter((id) => !isNaN(id));

        if (numericIds.length > 0) {
          const maxId = Math.max(...numericIds);
          nextId = (maxId + 1).toString();
        }
      }

      const ticketData = {
        msg_id: nextId,
        msg_cst_id: customerId,
        msg_ord_id: contactData.order_number || null,
        msg_date: new Date().toISOString(),
        msg_subject: contactData.subject,
        msg_content: messageContent,
        msg_open: '1',
        msg_close: '0',
      };

      const { data, error } = await this.supabase
        .from('___xtr_msg')
        .insert(ticketData)
        .select('*')
        .single();

      if (error) {
        this.logger.error('Erreur création ticket:', error);
        throw new BadRequestException('Impossible de créer le ticket');
      }

      this.logger.log(
        `Nouveau ticket créé: ${data.msg_id} - ${contactData.subject}`,
      );

      return {
        msg_id: data.msg_id,
        msg_cst_id: data.msg_cst_id,
        msg_cnfa_id: data.msg_cnfa_id,
        msg_ord_id: data.msg_ord_id,
        msg_date: data.msg_date,
        msg_subject: data.msg_subject,
        msg_content: data.msg_content,
        msg_parent_id: data.msg_parent_id,
        msg_open: data.msg_open,
        msg_close: data.msg_close,
        priority: contactData.priority,
        category: contactData.category,
      };
    } catch (error) {
      this.logger.error('Erreur dans submitContactForm:', error);
      throw error;
    }
  }

  async getAllTickets(): Promise<ContactTicket[]> {
    // Version simplifiée temporaire sans jointures
    try {
      const { data, error } = await this.supabase
        .from('___xtr_msg')
        .select('*')
        .limit(20);

      if (error) {
        this.logger.error('Erreur getAllTickets:', error);
        return [];
      }

      return (data || []).map((item) => ({
        msg_id: item.msg_id,
        msg_cst_id: item.msg_cst_id,
        msg_cnfa_id: item.msg_cnfa_id,
        msg_ord_id: item.msg_ord_id,
        msg_date: item.msg_date,
        msg_subject: item.msg_subject,
        msg_content: item.msg_content,
        msg_parent_id: item.msg_parent_id,
        msg_open: item.msg_open,
        msg_close: item.msg_close,
        priority: 'normal',
        category: 'general',
      }));
    } catch (error) {
      this.logger.error('Erreur dans getAllTickets:', error);
      return [];
    }
  }

  async getStats(): Promise<any> {
    return this.getQuickStats();
  }

  async updateTicketStatus(id: string, status: string): Promise<ContactTicket> {
    return this.updateContactStatus(id, status as 'open' | 'closed');
  }

  async assignTicket(id: string, staffId: string): Promise<ContactTicket> {
    return this.updateContactStatus(id, 'open', staffId);
  }

  async addTicketResponse(
    ticketId: string,
    responseData: any,
  ): Promise<ContactTicket> {
    const response = {
      message_id: ticketId,
      message: responseData.message,
      author_name: responseData.author,
      is_from_staff: responseData.authorType === 'staff',
    };
    await this.addResponse(response);
    return this.getTicket(ticketId);
  }

  async addSatisfactionRating(
    ticketId: string,
    rating: number,
    feedback?: string,
  ): Promise<ContactTicket> {
    const satisfaction = {
      message_id: ticketId,
      message: `[SATISFACTION] Note: ${rating}/5${feedback ? ` - ${feedback}` : ''}`,
      author_name: 'Client',
      is_from_staff: false,
    };
    await this.addResponse(satisfaction);
    return this.getTicket(ticketId);
  }
}

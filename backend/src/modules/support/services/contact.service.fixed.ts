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
  tags?: string[];
  attachments?: string[];
}

export interface ContactResponse {
  ticket_id: string;
  message: string;
  author: string;
  author_type: 'customer' | 'staff';
  attachments?: string[];
  is_internal?: boolean;
}

export interface ContactTicket {
  id: string;
  ticket_number: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  priority: string;
  category: string;
  status: string;
  assigned_to?: string;
  tags: string[];
  attachments: string[];
  vehicle_info?: any;
  order_number?: string;
  satisfaction?: any;
  estimated_response_time?: string;
  escalated: boolean;
  escalation_reason?: string;
  internal_notes: string[];
  created_at: string;
  updated_at: string;
}

@Injectable()
export class ContactService extends SupabaseBaseService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private readonly notificationService: NotificationService) {
    super();
  }

  /**
   * Crée un nouveau ticket de contact
   */
  async createContact(contactData: ContactRequest): Promise<ContactTicket> {
    try {
      this.validateContactData(contactData);

      // Génération d'un numéro de ticket unique
      const ticketNumber = await this.generateTicketNumber();

      // Estimation du temps de réponse basé sur la priorité
      const estimatedResponseTime = this.calculateEstimatedResponseTime(
        contactData.priority,
      );

      const ticketData = {
        ticket_number: ticketNumber,
        name: contactData.name,
        email: contactData.email,
        phone: contactData.phone,
        subject: contactData.subject,
        message: contactData.message,
        priority: contactData.priority,
        category: contactData.category,
        status: 'open',
        tags: contactData.tags || [],
        attachments: contactData.attachments || [],
        vehicle_info: contactData.vehicle_info,
        order_number: contactData.order_number,
        estimated_response_time: estimatedResponseTime,
        escalated: false,
        internal_notes: [],
      };

      const { data, error } = await this.supabase
        .from('support_contacts')
        .insert(ticketData)
        .select()
        .single();

      if (error) {
        this.logger.error('Erreur lors de la création du ticket:', error);
        throw new BadRequestException(
          'Impossible de créer le ticket de support',
        );
      }

      // Notification automatique
      await this.sendNotifications(data, 'created');

      // Log de l'activité
      this.logger.log(
        `Nouveau ticket créé: ${ticketNumber} - Priorité: ${contactData.priority}`,
      );

      return data;
    } catch (error) {
      this.logger.error('Erreur dans createContact:', error);
      throw error;
    }
  }

  /**
   * Récupère un ticket par son ID
   */
  async getContactById(id: string): Promise<ContactTicket> {
    const { data, error } = await this.supabase
      .from('support_contacts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Ticket non trouvé');
    }

    return data;
  }

  /**
   * Récupère un ticket par son numéro
   */
  async getContactByTicketNumber(ticketNumber: string): Promise<ContactTicket> {
    const { data, error } = await this.supabase
      .from('support_contacts')
      .select('*')
      .eq('ticket_number', ticketNumber)
      .single();

    if (error || !data) {
      throw new NotFoundException('Ticket non trouvé');
    }

    return data;
  }

  /**
   * Liste les tickets avec filtres et pagination
   */
  async getContacts(
    options: {
      status?: string;
      priority?: string;
      category?: string;
      assigned_to?: string;
      escalated?: boolean;
      email?: string;
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
    let query = this.supabase
      .from('support_contacts')
      .select('*', { count: 'exact' });

    // Application des filtres
    if (options.status) {
      query = query.eq('status', options.status);
    }
    if (options.priority) {
      query = query.eq('priority', options.priority);
    }
    if (options.category) {
      query = query.eq('category', options.category);
    }
    if (options.assigned_to) {
      query = query.eq('assigned_to', options.assigned_to);
    }
    if (options.escalated !== undefined) {
      query = query.eq('escalated', options.escalated);
    }
    if (options.email) {
      query = query.eq('email', options.email);
    }

    // Tri
    const sortBy = options.sort_by || 'created_at';
    const sortOrder = options.sort_order || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Pagination
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100); // Maximum 100 éléments par page
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.logger.error('Erreur lors de la récupération des tickets:', error);
      throw new BadRequestException('Impossible de récupérer les tickets');
    }

    return {
      data: data || [],
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
    status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed',
    assignedTo?: string,
    internalNote?: string,
  ): Promise<ContactTicket> {
    const updateData: any = { status };

    if (assignedTo) {
      updateData.assigned_to = assignedTo;
    }

    const { data, error } = await this.supabase
      .from('support_contacts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Impossible de mettre à jour le ticket');
    }

    // Ajouter une note interne si fournie
    if (internalNote) {
      await this.addInternalNote(id, internalNote);
    }

    // Notification de changement de statut
    await this.sendNotifications(data, 'status_updated');

    return data;
  }

  /**
   * Ajoute une réponse à un ticket
   */
  async addResponse(responseData: ContactResponse): Promise<any> {
    const responseRecord = {
      ticket_id: responseData.ticket_id,
      message: responseData.message,
      author: responseData.author,
      author_type: responseData.author_type,
      attachments: responseData.attachments || [],
      is_internal: responseData.is_internal || false,
    };

    const { data, error } = await this.supabase
      .from('support_contact_responses')
      .insert(responseRecord)
      .select()
      .single();

    if (error) {
      throw new BadRequestException("Impossible d'ajouter la réponse");
    }

    // Mettre à jour le statut du ticket si c'est une réponse du staff
    if (responseData.author_type === 'staff') {
      await this.updateContactStatus(
        responseData.ticket_id,
        'waiting_customer',
      );
    } else {
      // Si c'est une réponse du client, remettre en "open" ou "in_progress"
      const ticket = await this.getContactById(responseData.ticket_id);
      if (ticket.status === 'waiting_customer') {
        await this.updateContactStatus(responseData.ticket_id, 'in_progress');
      }
    }

    // Notification de nouvelle réponse
    const ticket = await this.getContactById(responseData.ticket_id);
    await this.sendNotifications(ticket, 'response_added', data);

    return data;
  }

  /**
   * Récupère les réponses d'un ticket
   */
  async getTicketResponses(ticketId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('support_contact_responses')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new BadRequestException('Impossible de récupérer les réponses');
    }

    return data || [];
  }

  /**
   * Escalade un ticket
   */
  async escalateTicket(id: string, reason: string): Promise<ContactTicket> {
    const { data, error } = await this.supabase
      .from('support_contacts')
      .update({
        escalated: true,
        escalation_reason: reason,
        priority: 'urgent', // Automatiquement en urgence
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException("Impossible d'escalader le ticket");
    }

    // Notification d'escalade
    await this.sendNotifications(data, 'escalated');

    return data;
  }

  /**
   * Ajoute une note interne
   */
  async addInternalNote(ticketId: string, note: string): Promise<void> {
    const ticket = await this.getContactById(ticketId);
    const updatedNotes = [
      ...ticket.internal_notes,
      `${new Date().toISOString()}: ${note}`,
    ];

    await this.supabase
      .from('support_contacts')
      .update({ internal_notes: updatedNotes })
      .eq('id', ticketId);
  }

  /**
   * Ajoute une évaluation de satisfaction
   */
  async addSatisfactionRating(
    ticketId: string,
    rating: number,
    comment?: string,
  ): Promise<ContactTicket> {
    const satisfaction = {
      rating,
      comment,
      rated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('support_contacts')
      .update({ satisfaction })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException("Impossible d'ajouter l'évaluation");
    }

    return data;
  }

  /**
   * Statistiques rapides
   */
  async getQuickStats(): Promise<any> {
    const { data, error } = await this.supabase
      .from('support_stats_overview')
      .select('*')
      .single();

    if (error) {
      this.logger.error('Erreur lors de la récupération des stats:', error);
      return null;
    }

    return data;
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

  private async generateTicketNumber(): Promise<string> {
    const prefix = 'CT';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  private calculateEstimatedResponseTime(
    priority: 'urgent' | 'high' | 'normal' | 'low',
  ): string {
    const hours: Record<string, number> = {
      urgent: 1,
      high: 4,
      normal: 24,
      low: 72,
    };

    const responseHours = hours[priority] || 24;
    const estimatedTime = new Date();
    estimatedTime.setHours(estimatedTime.getHours() + responseHours);

    return estimatedTime.toISOString();
  }

  private async sendNotifications(
    ticket: ContactTicket,
    event: string,
    additionalData?: any,
  ): Promise<void> {
    try {
      switch (event) {
        case 'created':
          await this.notificationService.sendContactConfirmation({
            customerName: ticket.name,
            email: ticket.email,
            subject: ticket.subject,
            priority: ticket.priority as 'urgent' | 'high' | 'normal' | 'low',
          });
          await this.notificationService.sendNotification({
            type: 'contact',
            priority: ticket.priority as 'urgent' | 'high' | 'normal' | 'low',
            title: 'Nouveau ticket de support',
            message: `Ticket ${ticket.ticket_number} créé par ${ticket.name}`,
            metadata: {
              ticketId: ticket.id,
              ticketNumber: ticket.ticket_number,
            },
          });
          break;
        case 'status_updated':
          await this.notificationService.sendNotification({
            type: 'contact',
            priority: 'normal',
            title: 'Statut du ticket mis à jour',
            message: `Ticket ${ticket.ticket_number} - Nouveau statut: ${ticket.status}`,
            metadata: { ticketId: ticket.id, status: ticket.status },
          });
          break;
        case 'response_added':
          await this.notificationService.sendNotification({
            type: 'contact',
            priority: 'normal',
            title: 'Nouvelle réponse ajoutée',
            message: `Nouvelle réponse sur le ticket ${ticket.ticket_number}`,
            metadata: { ticketId: ticket.id, response: additionalData },
          });
          break;
        case 'escalated':
          await this.notificationService.sendNotification({
            type: 'contact',
            priority: 'urgent',
            title: 'Ticket escaladé',
            message: `Ticket ${ticket.ticket_number} escaladé: ${ticket.escalation_reason}`,
            metadata: { ticketId: ticket.id, reason: ticket.escalation_reason },
          });
          break;
      }
    } catch (error) {
      this.logger.warn("Erreur lors de l'envoi des notifications:", error);
      // Ne pas faire échouer la création du ticket si les notifications échouent
    }
  }
}

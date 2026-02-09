import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface PreparationTicket {
  id: string;
  orderLineId: string;
  ticketReference: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  preparationDate: Date;
  orderNumber: string;
  status: string;
  ticketValue: number;
  isValid: boolean;
  createdAt: Date;
}

export interface CreditNote {
  id: string;
  orderLineId: string;
  ticketReference: string;
  ticketValue: number;
  remainingValue: number;
  usedValue: number;
  expiryDate: Date;
  notes: string;
  isValid: boolean;
  createdAt: Date;
}

export interface TicketValidationResult {
  id: string;
  ticketReference: string;
  ticketValue: number;
  orderLineId: string;
  orderId: string;
  isValid: boolean;
  type: 'PREPARATION' | 'CREDIT_NOTE' | 'STANDARD';
}

@Injectable()
export class TicketsService extends SupabaseBaseService {
  protected readonly logger = new Logger(TicketsService.name);

  constructor() {
    super();
  }

  /**
   * Créer un ticket de préparation avancé pour une ligne de commande
   */
  async createPreparationTicket(
    orderLineId: string,
  ): Promise<PreparationTicket> {
    try {
      this.logger.log(`Création ticket préparation pour ligne: ${orderLineId}`);

      // Requête Supabase pour obtenir les informations de la ligne de commande
      const { data: orderLines, error: orderLineError } = await this.supabase
        .from(TABLES.xtr_order_line)
        .select('*')
        .eq('orl_id', orderLineId)
        .limit(1);

      if (orderLineError) throw orderLineError;

      const orderLine = orderLines?.[0];
      if (!orderLine) {
        throw new BadRequestException('Ligne de commande introuvable');
      }

      this.logger.log('Ligne de commande trouvée:', {
        id: orderLine.orl_id,
        orderId: orderLine.orl_ord_id,
        productName: orderLine.orl_pg_name,
        quantity: orderLine.orl_art_quantity,
      });

      const ticketRef = `PREP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const preparationDate = new Date();

      // Utiliser les vraies colonnes de la table
      const quantity = parseInt(orderLine.orl_art_quantity) || 1;
      const unitPrice = parseFloat(orderLine.orl_art_price_sell_unit_ttc) || 0;
      const totalAmount = quantity * unitPrice;

      this.logger.log('Montants calculés:', {
        quantity,
        unitPrice,
        totalAmount,
      });

      // Générer un ID en suivant la séquence existante - Supabase fait un tri alphabétique
      const { data: allTickets } = await this.supabase
        .from(TABLES.xtr_order_line_equiv_ticket)
        .select('orlet_id');

      let maxId = 0;
      if (allTickets && allTickets.length > 0) {
        maxId = Math.max(...allTickets.map((t) => parseInt(t.orlet_id) || 0));
      }

      const nextId = (maxId + 1).toString();

      this.logger.log('Prochain ID ticket:', nextId);

      // Créer le ticket directement avec Supabase
      const { data: newTicket, error: ticketError } = await this.supabase
        .from(TABLES.xtr_order_line_equiv_ticket)
        .insert({
          orlet_id: nextId,
          orlet_ord_id: orderLine.orl_ord_id.toString(),
          orlet_orl_id: orderLineId,
          orlet_equiv_id: ticketRef, // On garde notre référence préparation
          orlet_amount_ttc: totalAmount.toString(),
        })
        .select()
        .single();

      if (ticketError) {
        this.logger.error('Erreur insertion ticket:', ticketError);
        throw ticketError;
      }

      this.logger.log('Ticket créé:', newTicket);

      return {
        id: newTicket.orlet_id || '',
        orderLineId,
        ticketReference: ticketRef,
        productName: orderLine.orl_pg_name || 'Produit',
        quantity,
        unitPrice,
        totalAmount,
        preparationDate,
        orderNumber: orderLine.orl_ord_id.toString(),
        status: 'PREPARED',
        ticketValue: totalAmount,
        isValid: true,
        createdAt: new Date(),
      };
    } catch (error) {
      const e = error instanceof Error ? error : { message: String(error) };
      this.logger.error('Erreur détaillée création ticket:', {
        message: e.message,
        code: (error as Record<string, unknown>)?.code,
        details: (error as Record<string, unknown>)?.details,
        hint: (error as Record<string, unknown>)?.hint,
        stack: e instanceof Error ? e.stack : undefined,
      });
      throw new BadRequestException(
        'Erreur lors de la création du ticket de préparation',
      );
    }
  }

  /**
   * Créer un avoir/crédit
   */
  async createCreditNote(
    orderLineId: string,
    amount: number,
    reason: string,
  ): Promise<CreditNote> {
    try {
      this.logger.log(
        `Création avoir pour ligne: ${orderLineId}, montant: ${amount}`,
      );

      const ticketRef = `AVOIR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      // Requête Supabase pour obtenir l'ordre
      const { data: orderLines, error } = await this.supabase
        .from(TABLES.xtr_order_line)
        .select('orl_ord_id')
        .eq('orl_id', orderLineId)
        .limit(1);

      if (error) throw error;

      const orderInfo = orderLines?.[0];
      if (!orderInfo) {
        throw new BadRequestException('Ligne de commande introuvable');
      }

      // Créer l'avoir directement avec Supabase
      const creditEquivId = `CREDIT_${ticketRef}`;
      const { data: newCredit, error: creditError } = await this.supabase
        .from(TABLES.xtr_order_line_equiv_ticket)
        .insert({
          orlet_ord_id: orderInfo.orl_ord_id.toString(),
          orlet_orl_id: orderLineId,
          orlet_equiv_id: creditEquivId,
          orlet_amount_ttc: amount.toString(),
        })
        .select()
        .single();

      if (creditError) throw creditError;

      return {
        id: newCredit.orlet_id || '',
        orderLineId,
        ticketReference: ticketRef,
        ticketValue: amount,
        remainingValue: amount,
        usedValue: 0,
        expiryDate,
        notes: reason,
        isValid: true,
        createdAt: new Date(),
      };
    } catch (error) {
      this.logger.error('Erreur création avoir:', error);
      throw new BadRequestException("Erreur lors de la création de l'avoir");
    }
  }

  /**
   * Valider un ticket par référence
   */
  async validateTicketByReference(
    ticketReference: string,
  ): Promise<TicketValidationResult> {
    try {
      this.logger.log(`Validation ticket: ${ticketReference}`);

      // Requête Supabase pour récupérer le ticket par sa référence
      const { data: tickets, error } = await this.supabase
        .from(TABLES.xtr_order_line_equiv_ticket)
        .select('*')
        .eq('orlet_equiv_id', ticketReference)
        .limit(1);

      if (error) {
        this.logger.error('Erreur requête ticket:', error);
        throw error;
      }

      const ticket = tickets?.[0];
      if (!ticket) {
        throw new BadRequestException('Ticket introuvable');
      }

      this.logger.log('Ticket trouvé:', ticket);

      const ticketValue = parseFloat(ticket.orlet_amount_ttc) || 0;
      const isValid = ticketValue > 0;

      if (!isValid) {
        throw new BadRequestException('Ticket invalide ou expiré');
      }

      // Détecter le type de ticket
      let type: 'PREPARATION' | 'CREDIT_NOTE' | 'STANDARD' = 'STANDARD';
      if (ticketReference.startsWith('PREP-')) {
        type = 'PREPARATION';
      } else if (
        ticketReference.startsWith('CREDIT_') ||
        ticketReference.startsWith('AVOIR-')
      ) {
        type = 'CREDIT_NOTE';
      }

      return {
        id: ticket.orlet_id,
        ticketReference: ticket.orlet_equiv_id,
        ticketValue,
        orderLineId: ticket.orlet_orl_id,
        orderId: ticket.orlet_ord_id,
        isValid: true,
        type,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Erreur validation ticket:', error);
      throw new BadRequestException('Erreur lors de la validation du ticket');
    }
  }

  /**
   * Utiliser un ticket (crédit/avoir)
   */
  async useTicket(
    ticketReference: string,
    amountToUse: number,
  ): Promise<{
    id: string;
    ticketReference: string;
    originalValue: number;
    usedAmount: number;
    remainingValue: number;
    orderLineId: string;
    orderId: string;
  }> {
    try {
      this.logger.log(
        `Utilisation ticket: ${ticketReference}, montant: ${amountToUse}`,
      );

      // Requête Supabase pour récupérer le ticket
      const { data: tickets, error: selectError } = await this.supabase
        .from(TABLES.xtr_order_line_equiv_ticket)
        .select(
          `
          orlet_id,
          orlet_equiv_id,
          orlet_amount_ttc,
          orlet_orl_id,
          ___xtr_order_line (
            order_id
          )
        `,
        )
        .eq('orlet_equiv_id', ticketReference)
        .limit(1);

      if (selectError) throw selectError;

      const ticket = tickets?.[0];
      if (!ticket) {
        throw new BadRequestException('Ticket introuvable');
      }

      const currentValue = parseFloat(ticket.orlet_amount_ttc) || 0;

      if (currentValue < amountToUse) {
        throw new BadRequestException('Montant insuffisant sur le ticket');
      }

      const newValue = currentValue - amountToUse;

      // Mise à jour Supabase
      const { error: updateError } = await this.supabase
        .from(TABLES.xtr_order_line_equiv_ticket)
        .update({
          orlet_amount_ttc: newValue.toString(),
        })
        .eq('orlet_id', ticket.orlet_id);

      if (updateError) throw updateError;

      return {
        id: ticket.orlet_id,
        ticketReference: ticket.orlet_equiv_id,
        originalValue: currentValue,
        usedAmount: amountToUse,
        remainingValue: newValue,
        orderLineId: ticket.orlet_orl_id,
        orderId:
          (
            ticket.___xtr_order_line as unknown as Record<string, unknown>
          )?.order_id?.toString() || '',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Erreur utilisation ticket:', error);
      throw new BadRequestException("Erreur lors de l'utilisation du ticket");
    }
  }

  /**
   * Lister les tickets d'une commande avec types
   */
  async getOrderAdvancedTickets(orderId: string): Promise<any[]> {
    try {
      // Requête Supabase pour récupérer les tickets d'une commande
      const { data: tickets, error } = await this.supabase
        .from(TABLES.xtr_order_line_equiv_ticket)
        .select(
          `
          orlet_id,
          orlet_equiv_id,
          orlet_amount_ttc,
          orlet_orl_id,
          orlet_ord_id,
          ___xtr_order_line (
            product_name,
            quantity,
            unit_price
          ),
          ___xtr_order (
            order_number
          )
        `,
        )
        .eq('orlet_ord_id', orderId)
        .order('orlet_id');

      if (error) throw error;

      return (tickets || []).map((ticket) => {
        let type: 'PREPARATION' | 'CREDIT_NOTE' | 'STANDARD' = 'STANDARD';
        if (ticket.orlet_equiv_id.startsWith('PREP-')) {
          type = 'PREPARATION';
        } else if (ticket.orlet_equiv_id.startsWith('CREDIT_')) {
          type = 'CREDIT_NOTE';
        }

        const orderLine = ticket.___xtr_order_line as unknown as Record<
          string,
          unknown
        > | null;
        const order = ticket.___xtr_order as unknown as Record<
          string,
          unknown
        > | null;

        return {
          id: ticket.orlet_id,
          ticketReference: ticket.orlet_equiv_id,
          ticketValue: parseFloat(ticket.orlet_amount_ttc) || 0,
          orderLineId: ticket.orlet_orl_id,
          orderId: ticket.orlet_ord_id,
          type,
          productName: orderLine?.product_name,
          quantity: orderLine?.quantity,
          orderNumber: order?.order_number,
        };
      });
    } catch (error) {
      this.logger.error('Erreur récupération tickets avancés:', error);
      throw new BadRequestException(
        'Erreur lors de la récupération des tickets',
      );
    }
  }
}

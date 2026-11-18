/**
 * Mandat CG — « Écrire au client » depuis la fiche commande.
 *
 * Aucun mail ne part sans un clic explicite après l'aperçu : la fiche lit les
 * modèles préremplis (`getComposer`), affiche l'aperçu rendu ici même
 * (`preview`), puis envoie (`send`).
 *
 * Trace de chaque envoi :
 * - une ligne `___xtr_msg` liée à la commande (`msg_ord_id`, objet, contenu),
 *   visible dans la messagerie de l'espace client ;
 * - une ligne `__admin_audit_log` (`customer_mail_sent`, commande, auteur),
 *   qui sert aussi d'historique : elle est indexée par (type, id) alors que
 *   `___xtr_msg` n'a aucun index sur `msg_ord_id`.
 *
 * Idempotence : l'identifiant de la ligne `___xtr_msg` dérive de la clé
 * `requestId` tirée par la fiche à l'aperçu. La ligne est réservée AVANT
 * l'envoi ; un second clic avec la même clé bute sur la clé primaire et
 * n'envoie rien. Si l'envoi échoue ou si aucun transport n'est configuré, la
 * réservation est retirée et l'erreur est rendue telle quelle.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import {
  MailService,
  customerMessageFragment,
  type MailDelivery,
} from '../../../services/mail.service';
import {
  PLACEHOLDER_MARK,
  buildAllCustomerMails,
  type CustomerMailContext,
  type CustomerMailTemplate,
  type PrefilledCustomerMail,
} from './customer-mail-templates';

export const CUSTOMER_MAIL_AUDIT_ACTION = 'customer_mail_sent';
const AUDIT_TABLE = '__admin_audit_log';

export interface CustomerMailInput {
  subject: string;
  body: string;
}

export interface CustomerMailSendInput extends CustomerMailInput {
  requestId: string;
  template: CustomerMailTemplate;
}

export interface CustomerMailHistoryEntry {
  msgId: string;
  sentAt: string | null;
  authorId: string | null;
  template: string | null;
  subject: string | null;
  delivery: string | null;
  content: string | null;
}

export type CustomerMailSendResult =
  | {
      status: 'sent';
      msgId: string;
      delivery: Exclude<MailDelivery, 'dry-run'>;
      auditRecorded: boolean;
    }
  | { status: 'already-sent'; msgId: string };

/** Identifiant `___xtr_msg` déterministe : même commande + même clé ⇒ même ligne. */
export function customerMailMessageId(
  orderId: string,
  requestId: string,
): string {
  return `cg_${createHash('sha256')
    .update(`${orderId}:${requestId}`)
    .digest('hex')
    .slice(0, 32)}`;
}

function missingPlaceholders(input: CustomerMailInput): boolean {
  return (
    input.subject.includes(PLACEHOLDER_MARK) ||
    input.body.includes(PLACEHOLDER_MARK)
  );
}

@Injectable()
export class OrderCustomerMailService extends SupabaseBaseService {
  protected readonly logger = new Logger(OrderCustomerMailService.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async getComposer(orderId: string): Promise<{
    orderId: string;
    recipient: string | null;
    templates: PrefilledCustomerMail[];
    history: CustomerMailHistoryEntry[] | null;
    historyError: string | null;
  }> {
    const { order, customer, lines } = await this.loadContext(orderId);
    const ctx: CustomerMailContext = {
      orderId: order.ord_id,
      orderDate: order.ord_date ?? null,
      totalTtc: order.ord_total_ttc ?? null,
      customerFirstName: customer?.cst_fname ?? null,
      customerLastName: customer?.cst_name ?? null,
      lines: lines.map((l) => ({
        name: l.orl_pg_name ?? null,
        brand: l.orl_pm_name ?? null,
        reference: l.orl_art_ref ?? null,
        quantity: l.orl_art_quantity ?? null,
      })),
    };
    let history: CustomerMailHistoryEntry[] | null = null;
    let historyError: string | null = null;
    try {
      history = await this.history(orderId);
    } catch (e) {
      historyError = e instanceof Error ? e.message : String(e);
    }
    return {
      orderId: order.ord_id,
      recipient: customer?.cst_mail || null,
      templates: buildAllCustomerMails(ctx),
      history,
      historyError,
    };
  }

  /** Aperçu : le HTML exact que `send` remettra au transport. Rien ne part. */
  preview(input: CustomerMailInput): {
    subject: string;
    html: string;
    complete: boolean;
  } {
    return {
      subject: input.subject,
      html: this.mailService.renderCustomerMessage(input.subject, input.body),
      complete: !missingPlaceholders(input),
    };
  }

  async send(
    orderId: string,
    input: CustomerMailSendInput,
    userId?: string,
  ): Promise<CustomerMailSendResult> {
    if (missingPlaceholders(input)) {
      throw new BadRequestException(
        `Le texte contient encore « ${PLACEHOLDER_MARK} … » : complétez-le avant l'envoi`,
      );
    }
    const { order, customer } = await this.loadContext(orderId);
    if (!customer?.cst_mail) {
      throw new BadRequestException(
        `Commande ${orderId} : client sans adresse mail, aucun envoi possible`,
      );
    }

    const msgId = customerMailMessageId(orderId, input.requestId);
    const { error: reserveError } = await this.supabase
      .from(TABLES.xtr_msg)
      .insert({
        msg_id: msgId,
        msg_cst_id: String(order.ord_cst_id),
        msg_ord_id: orderId,
        msg_cnfa_id: userId ?? null,
        msg_date: new Date().toISOString(),
        msg_subject: input.subject,
        msg_content: customerMessageFragment(input.body),
        msg_open: '0',
        msg_close: '0',
      });
    if (reserveError) {
      if (reserveError.code === '23505') {
        this.logger.warn(
          `Mail client ${msgId} (commande ${orderId}) déjà traité : aucun second envoi`,
        );
        return { status: 'already-sent', msgId };
      }
      throw new ServiceUnavailableException(
        `Trace du message non écrite (${reserveError.message}) : aucun mail envoyé`,
      );
    }

    let delivery: MailDelivery;
    try {
      delivery = await this.mailService.sendCustomerMessage(
        customer.cst_mail,
        input.subject,
        input.body,
      );
    } catch (e) {
      await this.release(msgId);
      throw new ServiceUnavailableException(
        `Mail non envoyé : ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    if (delivery === 'dry-run') {
      await this.release(msgId);
      throw new ServiceUnavailableException(
        "Transport de mail non configuré : rien n'est parti",
      );
    }

    const { error: auditError } = await this.supabase.from(AUDIT_TABLE).insert({
      aal_action: CUSTOMER_MAIL_AUDIT_ACTION,
      aal_entity_type: 'order',
      aal_entity_id: orderId,
      aal_user_id: userId ?? null,
      aal_old_value: null,
      aal_new_value: {
        msgId,
        template: input.template,
        subject: input.subject,
        delivery,
      },
      aal_metadata: { requestId: input.requestId },
    });
    if (auditError) {
      // Le mail est parti : on ne le cache pas, on signale la trace manquante.
      this.logger.error(
        `Mail client ${msgId} envoyé (${delivery}) mais journal admin non écrit : ${auditError.message}`,
      );
    }
    return { status: 'sent', msgId, delivery, auditRecorded: !auditError };
  }

  async history(orderId: string): Promise<CustomerMailHistoryEntry[]> {
    const { data, error } = await this.supabase
      .from(AUDIT_TABLE)
      .select('aal_created_at, aal_user_id, aal_new_value')
      .eq('aal_entity_type', 'order')
      .eq('aal_entity_id', orderId)
      .eq('aal_action', CUSTOMER_MAIL_AUDIT_ACTION)
      .order('aal_created_at', { ascending: false })
      .limit(50);
    if (error) {
      throw new Error(`Historique illisible : ${error.message}`);
    }
    const rows = (data ?? []) as Array<{
      aal_created_at: string | null;
      aal_user_id: string | null;
      aal_new_value: Record<string, unknown> | null;
    }>;
    const ids = rows
      .map((r) => r.aal_new_value?.msgId)
      .filter((v): v is string => typeof v === 'string');
    const contents = new Map<string, string | null>();
    if (ids.length) {
      // Lecture par clé primaire : pas de parcours de ___xtr_msg.
      const { data: msgs, error: msgError } = await this.supabase
        .from(TABLES.xtr_msg)
        .select('msg_id, msg_content')
        .in('msg_id', ids);
      if (msgError) {
        throw new Error(`Messages illisibles : ${msgError.message}`);
      }
      for (const m of (msgs ?? []) as Array<{
        msg_id: string;
        msg_content: string | null;
      }>) {
        contents.set(m.msg_id, m.msg_content);
      }
    }
    return rows.map((r) => {
      const v = r.aal_new_value ?? {};
      const msgId = typeof v.msgId === 'string' ? v.msgId : '';
      const text = (k: string) => (typeof v[k] === 'string' ? v[k] : null);
      return {
        msgId,
        sentAt: r.aal_created_at,
        authorId: r.aal_user_id,
        template: text('template'),
        subject: text('subject'),
        delivery: text('delivery'),
        content: contents.get(msgId) ?? null,
      };
    });
  }

  private async release(msgId: string): Promise<void> {
    const { error } = await this.supabase
      .from(TABLES.xtr_msg)
      .delete()
      .eq('msg_id', msgId);
    if (error) {
      this.logger.error(
        `Réservation ${msgId} non retirée après échec d'envoi : ${error.message}`,
      );
    }
  }

  private async loadContext(orderId: string) {
    const { data: order, error } = await this.supabase
      .from(TABLES.xtr_order)
      .select('ord_id, ord_cst_id, ord_date, ord_total_ttc')
      .eq('ord_id', orderId)
      .maybeSingle();
    if (error) {
      throw new ServiceUnavailableException(
        `Commande ${orderId} illisible : ${error.message}`,
      );
    }
    if (!order) {
      throw new NotFoundException(`Commande ${orderId} introuvable`);
    }
    const { data: customer, error: customerError } = await this.supabase
      .from(TABLES.xtr_customer)
      .select('cst_mail, cst_fname, cst_name')
      .eq('cst_id', order.ord_cst_id)
      .maybeSingle();
    if (customerError) {
      throw new ServiceUnavailableException(
        `Client de la commande ${orderId} illisible : ${customerError.message}`,
      );
    }
    const { data: lines, error: linesError } = await this.supabase
      .from(TABLES.xtr_order_line)
      .select('orl_pg_name, orl_pm_name, orl_art_ref, orl_art_quantity')
      .eq('orl_ord_id', orderId);
    if (linesError) {
      throw new ServiceUnavailableException(
        `Lignes de la commande ${orderId} illisibles : ${linesError.message}`,
      );
    }
    return {
      order: order as {
        ord_id: string;
        ord_cst_id: string | number;
        ord_date: string | null;
        ord_total_ttc: string | number | null;
      },
      customer: customer as {
        cst_mail: string | null;
        cst_fname: string | null;
        cst_name: string | null;
      } | null,
      lines: (lines ?? []) as Array<{
        orl_pg_name: string | null;
        orl_pm_name: string | null;
        orl_art_ref: string | null;
        orl_art_quantity: string | number | null;
      }>,
    };
  }
}

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  TABLES,
  LEAD_TRANSITIONS,
  isValidLeadTransition,
  type LeadStatus,
} from '@repo/database-types';
import { SupabaseBaseService } from '@database/services/supabase-base.service';

/**
 * Représentation d'un lead pour la surface admin (sous-ensemble de ___xtr_msg
 * + jointure customer minimale).
 */
export interface LeadRow {
  msg_id: string;
  msg_cst_id: string;
  msg_date: string;
  msg_subject: string;
  msg_content: string;
  msg_open: '0' | '1';
  msg_close: '0' | '1';
  msg_cnfa_id: string | null;
  msg_crm_status: LeadStatus | null;
  msg_crm_source_page: string | null;
  msg_crm_vehicle_info: string | null;
  msg_crm_part_requested: string | null;
  msg_crm_next_follow_up_at: string | null;
  msg_crm_internal_note: string | null;
  msg_crm_updated_at: string | null;
  customer?: {
    cst_name: string | null;
    cst_fname: string | null;
    cst_mail: string | null;
    cst_phone: string | null;
  } | null;
}

export interface ListLeadsFilter {
  status?: LeadStatus;
  follow_up?: 'due' | 'overdue' | 'any';
  /**
   * Optionnels pour s'aligner avec la sortie du Zod schema (.default() laisse
   * la prop optionnelle dans z.infer). Defaults appliqués au début de listLeads.
   */
  page?: number;
  page_size?: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;

export interface ListLeadsResult {
  rows: LeadRow[];
  total: number;
  page: number;
  page_size: number;
}

export interface UpdateLeadFieldsInput {
  vehicle_info?: string | null;
  part_requested?: string | null;
  internal_note?: string | null;
  next_follow_up_at?: string | null;
}

const LEAD_COLUMNS = [
  'msg_id',
  'msg_cst_id',
  'msg_date',
  'msg_subject',
  'msg_content',
  'msg_open',
  'msg_close',
  'msg_cnfa_id',
  'msg_crm_status',
  'msg_crm_source_page',
  'msg_crm_vehicle_info',
  'msg_crm_part_requested',
  'msg_crm_next_follow_up_at',
  'msg_crm_internal_note',
  'msg_crm_updated_at',
].join(', ');

const LEAD_SELECT_WITH_CUSTOMER = `
  ${LEAD_COLUMNS},
  customer:msg_cst_id (
    cst_name,
    cst_fname,
    cst_mail,
    cst_phone
  )
`;

@Injectable()
export class LeadsService extends SupabaseBaseService {
  protected readonly logger = new Logger(LeadsService.name);

  async listLeads(filter: ListLeadsFilter): Promise<ListLeadsResult> {
    const page = filter.page ?? DEFAULT_PAGE;
    const pageSize = filter.page_size ?? DEFAULT_PAGE_SIZE;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // `any` ici brise volontairement l'inférence profonde supabase-js qui fait
    // exploser TS2589 sur les chaînes conditionnelles. Le retour final est
    // re-typé en bord de fonction (LeadRow[]).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = this.supabase
      .from(TABLES.xtr_msg)
      .select(LEAD_SELECT_WITH_CUSTOMER, { count: 'exact' })
      // Toujours exclure les lignes legacy non-CRM
      .not('msg_crm_status', 'is', null);

    if (filter.status) {
      query = query.eq('msg_crm_status', filter.status);
    }

    if (filter.follow_up && filter.follow_up !== 'any') {
      const now = new Date();
      const threshold =
        filter.follow_up === 'overdue'
          ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
          : now;
      query = query
        .not('msg_crm_next_follow_up_at', 'is', null)
        .lte('msg_crm_next_follow_up_at', threshold.toISOString());
    }

    const { data, count, error } = await query
      .order('msg_date', { ascending: false })
      .range(from, to);

    if (error) {
      this.logger.error('listLeads failed', error);
      throw new BadRequestException(`leads list failed: ${error.message}`);
    }

    return {
      rows: (data ?? []) as unknown as LeadRow[],
      total: count ?? 0,
      page,
      page_size: pageSize,
    };
  }

  async getLead(id: string): Promise<LeadRow> {
    const { data, error } = await this.supabase
      .from(TABLES.xtr_msg)
      .select(LEAD_SELECT_WITH_CUSTOMER)
      .eq('msg_id', id)
      .not('msg_crm_status', 'is', null)
      .maybeSingle();

    if (error) {
      this.logger.error(`getLead(${id}) failed`, error);
      throw new BadRequestException(`leads get failed: ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException(`Lead ${id} not found or not CRM-tracked`);
    }

    return data as unknown as LeadRow;
  }

  async updateLeadFields(
    id: string,
    input: UpdateLeadFieldsInput,
  ): Promise<LeadRow> {
    const updates: Record<string, string | null> = {};

    if ('vehicle_info' in input)
      updates.msg_crm_vehicle_info = input.vehicle_info ?? null;
    if ('part_requested' in input)
      updates.msg_crm_part_requested = input.part_requested ?? null;
    if ('internal_note' in input)
      updates.msg_crm_internal_note = input.internal_note ?? null;
    if ('next_follow_up_at' in input)
      updates.msg_crm_next_follow_up_at = input.next_follow_up_at ?? null;

    if (Object.keys(updates).length === 0) {
      // Pas de no-op silencieux : un PATCH vide est une erreur d'usage.
      throw new BadRequestException('No fields to update');
    }

    // S'assure que la ligne est bien un lead CRM tracké (sinon NotFound).
    await this.getLead(id);

    // Race-safety : le filtre IS NOT NULL est aussi appliqué sur l'UPDATE pour
    // qu'une ligne dont msg_crm_status passe à NULL entre le getLead() et
    // l'UPDATE ne soit pas mutée silencieusement (ne devrait pas arriver en V0
    // — pas d'effacement public — mais ceinture+bretelles).
    const { data, error } = await this.supabase
      .from(TABLES.xtr_msg)
      .update(updates)
      .eq('msg_id', id)
      .not('msg_crm_status', 'is', null)
      .select(LEAD_SELECT_WITH_CUSTOMER)
      .single();

    if (error) {
      this.logger.error(`updateLeadFields(${id}) failed`, error);
      throw new BadRequestException(`leads update failed: ${error.message}`);
    }

    return data as unknown as LeadRow;
  }

  async updateLeadStatus(
    id: string,
    nextStatus: LeadStatus,
    actorUserId: string | null,
  ): Promise<LeadRow> {
    const current = await this.getLead(id);
    const fromStatus = current.msg_crm_status;

    if (!fromStatus) {
      // Garde-fou : ne devrait pas arriver car getLead filtre déjà NULL.
      throw new BadRequestException(
        'Lead has no current status — invariant violation',
      );
    }

    if (!isValidLeadTransition(fromStatus, nextStatus)) {
      throw new BadRequestException(
        `Invalid transition ${fromStatus} → ${nextStatus}. ` +
          `Allowed from "${fromStatus}": ${
            LEAD_TRANSITIONS[fromStatus].join(', ') || '(terminal)'
          }`,
      );
    }

    // Race-safety : filtre IS NOT NULL appliqué aussi sur l'UPDATE
    // (cf. commentaire identique dans updateLeadFields).
    const { data, error } = await this.supabase
      .from(TABLES.xtr_msg)
      .update({ msg_crm_status: nextStatus })
      .eq('msg_id', id)
      .not('msg_crm_status', 'is', null)
      .select(LEAD_SELECT_WITH_CUSTOMER)
      .single();

    if (error) {
      this.logger.error(`updateLeadStatus(${id}) failed`, error);
      throw new BadRequestException(
        `leads status update failed: ${error.message}`,
      );
    }

    this.logger.log(
      JSON.stringify({
        event: 'lead.status_transition',
        lead_id: id,
        from: fromStatus,
        to: nextStatus,
        by_user_id: actorUserId,
      }),
    );

    return data as unknown as LeadRow;
  }

  async clearFollowUp(id: string): Promise<LeadRow> {
    return this.updateLeadFields(id, { next_follow_up_at: null });
  }
}

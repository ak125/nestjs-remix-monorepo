import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import * as crypto from 'crypto';

export interface AbandonedCartRecord {
  id: string;
  cst_id: number;
  cst_mail: string;
  cst_fname: string | null;
  session_id: string;
  cart_snapshot: Record<string, unknown>[];
  cart_subtotal: number;
  cart_item_count: number;
  recovery_token: string;
  email_1h_sent_at: string | null;
  email_24h_sent_at: string | null;
  email_72h_sent_at: string | null;
  email_opened_at: string | null;
  email_clicked_at: string | null;
  recovered_at: string | null;
  unsubscribed_at: string | null;
  status: 'detected' | 'emailing' | 'recovered' | 'expired' | 'unsubscribed';
  created_at: string;
  updated_at: string;
  expires_at: string;
}

const TABLE = '__abandoned_cart_emails';

@Injectable()
export class AbandonedCartDataService extends SupabaseBaseService {
  protected readonly logger = new Logger(AbandonedCartDataService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  async insert(data: {
    cst_id: number;
    cst_mail: string;
    cst_fname: string | null;
    session_id: string;
    cart_snapshot: Record<string, unknown>[];
    cart_subtotal: number;
    cart_item_count: number;
  }): Promise<AbandonedCartRecord | null> {
    const recovery_token = crypto.randomBytes(32).toString('hex');

    const { data: row, error } = await this.supabase
      .from(TABLE)
      .insert({
        ...data,
        recovery_token,
        status: 'detected',
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Insert failed: ${error.message}`);
      return null;
    }
    return row as AbandonedCartRecord;
  }

  async findByToken(token: string): Promise<AbandonedCartRecord | null> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select('*')
      .eq('recovery_token', token)
      .single();

    if (error) return null;
    return data as AbandonedCartRecord;
  }

  async findById(id: string): Promise<AbandonedCartRecord | null> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data as AbandonedCartRecord;
  }

  async findRecentByCstId(
    cstId: number,
    withinHours = 24,
  ): Promise<AbandonedCartRecord | null> {
    const since = new Date(Date.now() - withinHours * 3600_000).toISOString();
    const { data, error } = await this.supabase
      .from(TABLE)
      .select('*')
      .eq('cst_id', cstId)
      .gte('created_at', since)
      .in('status', ['detected', 'emailing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return data as AbandonedCartRecord | null;
  }

  async updateEmailSent(id: string, step: '1h' | '24h' | '72h'): Promise<void> {
    const col = `email_${step}_sent_at` as const;
    const { error } = await this.supabase
      .from(TABLE)
      .update({
        [col]: new Date().toISOString(),
        status: 'emailing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) this.logger.error(`Update email sent failed: ${error.message}`);
  }

  async updateOpenedByToken(token: string): Promise<void> {
    const { error } = await this.supabase
      .from(TABLE)
      .update({
        email_opened_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('recovery_token', token)
      .is('email_opened_at', null);

    if (error) this.logger.error(`Update opened failed: ${error.message}`);
  }

  /**
   * Atomic recovery — only succeeds if status is still detected/emailing.
   * Returns the record if update succeeded, null if already recovered/expired.
   */
  async updateRecovered(token: string): Promise<AbandonedCartRecord | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from(TABLE)
      .update({
        email_clicked_at: now,
        recovered_at: now,
        status: 'recovered',
        updated_at: now,
      })
      .eq('recovery_token', token)
      .in('status', ['detected', 'emailing'])
      .select()
      .maybeSingle();

    if (error) {
      this.logger.error(`Update recovered failed: ${error.message}`);
      return null;
    }
    return data as AbandonedCartRecord | null;
  }

  async updateUnsubscribed(token: string): Promise<{ cst_id: number } | null> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .update({
        unsubscribed_at: new Date().toISOString(),
        status: 'unsubscribed',
        updated_at: new Date().toISOString(),
      })
      .eq('recovery_token', token)
      .select('cst_id')
      .single();

    if (error) {
      this.logger.error(`Update unsubscribed failed: ${error.message}`);
      return null;
    }
    return data as { cst_id: number };
  }

  async isUnsubscribedByCstId(cstId: number): Promise<boolean> {
    const { data } = await this.supabase
      .from(TABLE)
      .select('id')
      .eq('cst_id', cstId)
      .eq('status', 'unsubscribed')
      .limit(1)
      .maybeSingle();

    return !!data;
  }

  async getCustomerEmail(
    cstId: number,
  ): Promise<{ cst_mail: string; cst_fname: string | null } | null> {
    const { data, error } = await this.supabase
      .from('___xtr_customer')
      .select('cst_mail, cst_fname')
      .eq('cst_id', cstId)
      .single();

    if (error || !data) return null;
    return { cst_mail: data.cst_mail, cst_fname: data.cst_fname };
  }

  async getStats(): Promise<{
    total_detected: number;
    emails_sent_1h: number;
    emails_sent_24h: number;
    emails_sent_72h: number;
    opened: number;
    clicked: number;
    recovered: number;
    revenue_recovered: number;
  }> {
    const { data, error } = await this.supabase.rpc('execute_sql', {
      query: `
        SELECT
          count(*) as total_detected,
          count(email_1h_sent_at) as emails_sent_1h,
          count(email_24h_sent_at) as emails_sent_24h,
          count(email_72h_sent_at) as emails_sent_72h,
          count(email_opened_at) as opened,
          count(email_clicked_at) as clicked,
          count(recovered_at) as recovered,
          coalesce(sum(case when recovered_at is not null then cart_subtotal else 0 end), 0) as revenue_recovered
        FROM ${TABLE}
      `,
    });

    if (error || !data?.[0]) {
      this.logger.error(`Stats query failed: ${error?.message}`);
      return {
        total_detected: 0,
        emails_sent_1h: 0,
        emails_sent_24h: 0,
        emails_sent_72h: 0,
        opened: 0,
        clicked: 0,
        recovered: 0,
        revenue_recovered: 0,
      };
    }

    const row = data[0];
    return {
      total_detected: Number(row.total_detected),
      emails_sent_1h: Number(row.emails_sent_1h),
      emails_sent_24h: Number(row.emails_sent_24h),
      emails_sent_72h: Number(row.emails_sent_72h),
      opened: Number(row.opened),
      clicked: Number(row.clicked),
      recovered: Number(row.recovered),
      revenue_recovered: Number(row.revenue_recovered),
    };
  }
}

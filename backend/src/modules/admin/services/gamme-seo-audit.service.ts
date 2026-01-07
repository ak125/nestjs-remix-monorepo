/**
 * 📋 GAMME SEO AUDIT SERVICE
 *
 * Service pour tracker l'historique des actions sur les gammes SEO
 * - Qui a fait quoi, quand
 * - Valeurs avant/après
 * - Impact des modifications
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

// Types d'actions trackées
export type GammeSeoActionType =
  | 'THRESHOLD_UPDATE' // Modification des seuils
  | 'THRESHOLD_RESET' // Reset aux valeurs par défaut
  | 'BATCH_PROMOTE_INDEX' // Promotion en masse vers INDEX
  | 'BATCH_DEMOTE_NOINDEX' // Rétrogradation en masse vers NOINDEX
  | 'BATCH_MARK_G1' // Marquage en masse G1
  | 'BATCH_UNMARK_G1' // Retrait en masse G1
  | 'SINGLE_UPDATE'; // Mise à jour individuelle

// Interface d'une entrée d'audit
export interface GammeSeoAuditEntry {
  id?: number;
  admin_id: number;
  admin_email: string;
  action_type: GammeSeoActionType;
  entity_type: 'threshold' | 'gamme' | 'batch';
  entity_ids: number[] | null; // pg_ids affectés
  old_values: any | null;
  new_values: any | null;
  impact_summary: string;
  created_at?: string;
}

// Interface pour les filtres de l'historique
export interface AuditHistoryFilters {
  actionType?: GammeSeoActionType;
  entityType?: 'threshold' | 'gamme' | 'batch';
  adminId?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

// Table dédiée pour l'audit SEO (plus performante que ___xtr_msg avec LIKE)
const AUDIT_TABLE = 'gamme_seo_audit';

@Injectable()
export class GammeSeoAuditService extends SupabaseBaseService {
  protected readonly logger = new Logger(GammeSeoAuditService.name);

  /**
   * 📝 Enregistre une action dans l'historique
   */
  async logAction(params: {
    adminId: number;
    adminEmail: string;
    actionType: GammeSeoActionType;
    entityType: 'threshold' | 'gamme' | 'batch';
    entityIds?: number[];
    oldValues?: any;
    newValues?: any;
    impactSummary: string;
  }): Promise<{ success: boolean; auditId?: number }> {
    try {
      this.logger.log(
        `📝 Logging action: ${params.actionType} by ${params.adminEmail}`,
      );

      // Insert direct dans la table dédiée gamme_seo_audit
      const { data, error } = await this.supabase
        .from(AUDIT_TABLE)
        .insert({
          admin_id: params.adminId,
          admin_email: params.adminEmail,
          action_type: params.actionType,
          entity_type: params.entityType,
          entity_ids: params.entityIds || null,
          old_values: params.oldValues || null,
          new_values: params.newValues || null,
          impact_summary: params.impactSummary,
        })
        .select('id')
        .single();

      if (error) {
        this.logger.error('❌ Error logging audit:', error);
        return { success: false };
      }

      this.logger.log(`✅ Audit logged with ID: ${data?.id}`);
      return { success: true, auditId: data?.id };
    } catch (error) {
      this.logger.error('❌ Error in logAction:', error);
      return { success: false };
    }
  }

  /**
   * 📜 Récupère l'historique des actions
   */
  async getAuditHistory(filters: AuditHistoryFilters = {}): Promise<{
    data: GammeSeoAuditEntry[];
    total: number;
  }> {
    try {
      this.logger.log('📜 Fetching audit history...');

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      // Query directe sur table dédiée (sans LIKE, beaucoup plus rapide)
      let query = this.supabase
        .from(AUDIT_TABLE)
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply filters directement sur les colonnes
      if (filters.actionType) {
        query = query.eq('action_type', filters.actionType);
      }
      if (filters.entityType) {
        query = query.eq('entity_type', filters.entityType);
      }
      if (filters.adminId) {
        query = query.eq('admin_id', filters.adminId);
      }
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      // Pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        this.logger.error('❌ Error fetching audit history:', error);
        throw error;
      }

      // Map directement les colonnes (plus de parsing JSON)
      const entries: GammeSeoAuditEntry[] = (data || []).map((row: any) => ({
        id: row.id,
        admin_id: row.admin_id,
        admin_email: row.admin_email || 'unknown',
        action_type: row.action_type,
        entity_type: row.entity_type || 'gamme',
        entity_ids: row.entity_ids || null,
        old_values: row.old_values || null,
        new_values: row.new_values || null,
        impact_summary: row.impact_summary || '',
        created_at: row.created_at,
      }));

      this.logger.log(`✅ Found ${entries.length} audit entries`);
      return {
        data: entries,
        total: count || 0,
      };
    } catch (error) {
      this.logger.error('❌ Error in getAuditHistory:', error);
      return { data: [], total: 0 };
    }
  }

  /**
   * 📊 Statistiques d'audit (pour dashboard)
   */
  async getAuditStats(): Promise<{
    totalActions: number;
    actionsLast24h: number;
    actionsLast7d: number;
    topAdmins: Array<{ email: string; count: number }>;
    actionsByType: Record<string, number>;
  }> {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Query directe sur table dédiée
      const { data, error } = await this.supabase
        .from(AUDIT_TABLE)
        .select('id, admin_id, admin_email, action_type, created_at')
        .gte('created_at', lastWeek.toISOString());

      if (error) throw error;

      const entries = data || [];

      // Calculate stats
      const actionsLast24h = entries.filter(
        (e: any) => new Date(e.created_at) >= yesterday,
      ).length;
      const actionsByType: Record<string, number> = {};
      const adminCounts: Record<string, number> = {};

      entries.forEach((row: any) => {
        // Count by action type (colonne directe, pas de parsing)
        const actionType = row.action_type || 'UNKNOWN';
        actionsByType[actionType] = (actionsByType[actionType] || 0) + 1;

        // Count by admin (colonne directe)
        const email = row.admin_email || 'unknown';
        adminCounts[email] = (adminCounts[email] || 0) + 1;
      });

      // Top admins
      const topAdmins = Object.entries(adminCounts)
        .map(([email, count]) => ({ email, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Get total count
      const { count: totalCount } = await this.supabase
        .from(AUDIT_TABLE)
        .select('id', { count: 'exact', head: true });

      return {
        totalActions: totalCount || 0,
        actionsLast24h,
        actionsLast7d: entries.length,
        topAdmins,
        actionsByType,
      };
    } catch (error) {
      this.logger.error('❌ Error getting audit stats:', error);
      return {
        totalActions: 0,
        actionsLast24h: 0,
        actionsLast7d: 0,
        topAdmins: [],
        actionsByType: {},
      };
    }
  }

  /**
   * 🔄 Helpers pour les messages d'impact
   */
  static formatImpactSummary(
    actionType: GammeSeoActionType,
    count?: number,
    details?: string,
  ): string {
    const summaries: Record<GammeSeoActionType, string> = {
      THRESHOLD_UPDATE: `Seuils Smart Action modifiés${details ? ': ' + details : ''}`,
      THRESHOLD_RESET: 'Seuils réinitialisés aux valeurs par défaut',
      BATCH_PROMOTE_INDEX: `${count || 0} gamme(s) promue(s) en INDEX`,
      BATCH_DEMOTE_NOINDEX: `${count || 0} gamme(s) rétrogradée(s) en NOINDEX`,
      BATCH_MARK_G1: `${count || 0} gamme(s) marquée(s) G1`,
      BATCH_UNMARK_G1: `${count || 0} gamme(s) retirée(s) de G1`,
      SINGLE_UPDATE: `1 gamme mise à jour${details ? ': ' + details : ''}`,
    };
    return summaries[actionType] || 'Action effectuée';
  }
}

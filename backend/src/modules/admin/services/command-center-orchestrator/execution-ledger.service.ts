import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { type ExecutionLedgerEntry } from './executable-action.contract';

/** Résultat SURFACÉ d'un append ledger — jamais de silence (no-silent-fallback). */
export interface LedgerWriteResult {
  recorded: boolean;
  /** raison du non-enregistrement (`read_only`, message d'erreur DB…) si recorded=false. */
  reason?: string;
}

/**
 * Ledger d'orchestration shadow (ADR-087). Trace chaque run shadow dans la table
 * existante `__admin_audit_log` (= « ledger admin_audit » du canon — on ÉTEND, on ne
 * crée pas de table parallèle). Append-only : on n'écrit JAMAIS un artefact, seulement
 * une ligne d'audit.
 *
 * En mode READ_ONLY (container PREPROD, ADR-028 Option D), l'append est court-circuité
 * par le garde canonique `guardReadOnly` hérité de `SupabaseBaseService` → renvoie
 * `{recorded:false, reason:'read_only'}` (le garde émet déjà un warn structuré LogQL).
 * Toute autre erreur DB est loggée + surfacée — jamais avalée silencieusement.
 */
@Injectable()
export class CommandCenterExecutionLedgerService extends SupabaseBaseService {
  protected readonly logger = new Logger(
    CommandCenterExecutionLedgerService.name,
  );

  /** Valeurs figées pour namespacer nos lignes dans la table d'audit partagée. */
  private static readonly LEDGER_ACTION = 'cc_orchestration_shadow_plan';
  private static readonly LEDGER_ENTITY_TYPE = 'cc_executable_action';

  async record(entry: ExecutionLedgerEntry): Promise<LedgerWriteResult> {
    // READ_ONLY (PREPROD) : court-circuit canonique, surfacé (pas de write tenté).
    if (this.guardReadOnly('cc-orchestration-ledger', entry.action_id)) {
      return { recorded: false, reason: 'read_only' };
    }

    try {
      const { error } = await this.supabase.from('__admin_audit_log').insert({
        aal_action: CommandCenterExecutionLedgerService.LEDGER_ACTION,
        aal_entity_type: CommandCenterExecutionLedgerService.LEDGER_ENTITY_TYPE,
        aal_entity_id: entry.action_id,
        aal_user_id: entry.actor,
        aal_new_value: {
          mode: entry.mode,
          plan_hash: entry.plan_hash,
          would_change: entry.would_change,
          // Phase 2 : distingue une exécution réelle approuvée d'un run shadow.
          ...(entry.executed ? { executed: true } : {}),
        },
        aal_metadata: null,
      });
      if (error) {
        this.logger.error(
          `ledger append KO (${entry.action_id}): ${error.message}`,
        );
        return { recorded: false, reason: error.message };
      }
      return { recorded: true };
    } catch (e) {
      const reason = (e as Error).message;
      this.logger.error(`ledger append a levé (${entry.action_id}): ${reason}`);
      return { recorded: false, reason };
    }
  }
}

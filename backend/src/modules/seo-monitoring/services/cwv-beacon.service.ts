/**
 * CWV Beacon Service — Bloc 3 / CWV Runtime Observability.
 *
 * Persiste un beacon CWV émis depuis le frontend (`navigator.sendBeacon`).
 *
 * Discipline :
 *   - Bots (`ua_class != 'human'`) : écrits dans __seo_event_log (debug only),
 *     JAMAIS dans __seo_cwv_raw — anti-pollution p75 humains (canon plan §5).
 *   - Humans : INSERT direct dans __seo_cwv_raw (partitioned daily, TTL 48h).
 *   - Erreurs INSERT : log + retour `ok: false`, JAMAIS d'exception (un beacon
 *     raté ne doit pas casser une requête user).
 *   - Pattern mirror de FunnelEventsService (extends SupabaseBaseService).
 *
 * Rejets (beacon qui n'atteint ni __seo_cwv_raw ni l'événement bot) :
 *   - comptés par raison fermée (`CWV_BEACON_REJECTION_REASONS`) et écrits dans
 *     __seo_event_log sous `seo.runtime.cwv_beacon_rejected`, sur le patron de
 *     `seo.runtime.bot_cwv_beacon` ;
 *   - agrégés, pas écrits un par un : l'endpoint est public, un flot de
 *     requêtes invalides ne doit pas devenir un flot de lignes. Une ligne par
 *     raison par intervalle, avec le compte exact de l'intervalle ;
 *   - seuls la raison et les signatures `code@chemin` des issues Zod sont
 *     gardées. Les chemins viennent des clés déclarées du schéma `.strict()` :
 *     un nom de clé inconnue n'y figure jamais (Zod le rapporte au parent) ;
 *   - si l'écriture échoue (dont : valeur d'enum pas encore migrée), le compte
 *     part dans un warning structuré, sans relance ni rétention ;
 *   - en READ_ONLY (container PREPROD), l'écriture est court-circuitée par
 *     `guardReadOnly` : warning `readonly.skipped` portant les comptes ;
 *   - perte bornée : sur un arrêt non gracieux, au plus un intervalle de
 *     comptes. L'arrêt gracieux vide l'agrégat (`enableShutdownHooks`, main.ts).
 */
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import type { CwvBeaconServerInsert } from '@repo/cwv-taxonomy';
import { isBot } from '@repo/cwv-taxonomy';

/** Valeur d'enum `seo_event_type` — migration 20260911_seo_cwv_beacon_rejected_event_enum.sql. */
export const CWV_BEACON_REJECTED_EVENT_TYPE =
  'seo.runtime.cwv_beacon_rejected' as const;

/**
 * Raisons de rejet (`payload.reason`). Les beacons de bots ne sont pas rejetés
 * ici : ils ont déjà leur événement compté, `seo.runtime.bot_cwv_beacon`.
 */
export const CWV_BEACON_REJECTION_REASONS = [
  'empty_body',
  'schema_invalid',
  'foreign_host',
] as const;
export type CwvBeaconRejectionReason =
  (typeof CWV_BEACON_REJECTION_REASONS)[number];

/** Forme minimale d'une issue Zod : seuls le code et le chemin sont lus. */
export interface CwvBeaconRejectionIssue {
  readonly code: string;
  readonly path: ReadonlyArray<PropertyKey>;
}

interface RejectionTally {
  count: number;
  issues: Map<string, number>;
}

@Injectable()
export class CwvBeaconService
  extends SupabaseBaseService
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * Intervalle d'écriture des rejets agrégés. Borne l'écriture à une ligne par
   * raison par minute quel que soit le volume rejeté (au plus 3 × 1 440 lignes
   * par jour), et la perte sur arrêt brutal à une minute de comptes.
   */
  static readonly REJECTION_FLUSH_INTERVAL_MS = 60_000;

  private readonly nodeEnv: string | null;
  private rejectionTallies = new Map<
    CwvBeaconRejectionReason,
    RejectionTally
  >();
  private rejectionWindowStart = new Date();
  private rejectionFlushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(configService: ConfigService) {
    super(configService);
    // Distingue, dans la base partagée, les comptes du process DEV de ceux de PROD.
    this.nodeEnv = configService.get<string>('NODE_ENV') ?? null;
  }

  onModuleInit(): void {
    this.rejectionFlushTimer = setInterval(() => {
      void this.flushRejections();
    }, CwvBeaconService.REJECTION_FLUSH_INTERVAL_MS);
    this.rejectionFlushTimer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.rejectionFlushTimer) {
      clearInterval(this.rejectionFlushTimer);
      this.rejectionFlushTimer = null;
    }
    await this.flushRejections();
  }

  /**
   * Persiste un beacon CWV. Fire-and-forget côté appelant.
   *
   * Routing déterministe par ua_class :
   *   - human       → __seo_cwv_raw (aggregation pure, p75 humains)
   *   - bot_search/ai/other → __seo_event_log (debug only, séparation canon)
   */
  async record(input: CwvBeaconServerInsert): Promise<{ ok: boolean }> {
    if (isBot(input.ua_class)) {
      return this.recordBot(input);
    }
    return this.recordHuman(input);
  }

  /** Compte un beacon rejeté. Synchrone : aucune I/O sur le chemin de la requête. */
  countRejection(
    reason: CwvBeaconRejectionReason,
    issues: ReadonlyArray<CwvBeaconRejectionIssue> = [],
  ): void {
    const tally = this.rejectionTallies.get(reason) ?? {
      count: 0,
      issues: new Map<string, number>(),
    };
    tally.count += 1;
    for (const issue of issues) {
      const path =
        issue.path.length > 0 ? issue.path.map(String).join('.') : '(root)';
      const signature = `${issue.code}@${path}`;
      tally.issues.set(signature, (tally.issues.get(signature) ?? 0) + 1);
    }
    this.rejectionTallies.set(reason, tally);
    this.logger.debug(`[cwv_beacon_rejection] event=counted reason=${reason}`);
  }

  /** Écrit l'agrégat de l'intervalle écoulé (une ligne par raison), puis le vide. */
  async flushRejections(): Promise<void> {
    const windowStart = this.rejectionWindowStart;
    const windowEnd = new Date();
    this.rejectionWindowStart = windowEnd;
    if (this.rejectionTallies.size === 0) return;

    const tallies = this.rejectionTallies;
    this.rejectionTallies = new Map();
    // READ_ONLY (container PREPROD, clé anon) : `__seo_event_log` n'accepte pas
    // l'INSERT. Skip gouverné (ADR-028), journalisé `readonly.skipped` avec les
    // comptes ; `persist_failed` reste réservé aux vrais échecs d'écriture.
    const counts = [...tallies]
      .map(([reason, tally]) => `${reason}=${tally.count}`)
      .join(' ');
    if (this.guardReadOnly('flushRejections', counts)) return;

    const rows = [...tallies].map(([reason, tally]) => ({
      event_type: CWV_BEACON_REJECTED_EVENT_TYPE,
      entity_url: null,
      severity: 'info',
      payload: {
        reason,
        count: tally.count,
        issues: Object.fromEntries(tally.issues),
        window_start: windowStart.toISOString(),
        window_end: windowEnd.toISOString(),
        node_env: this.nodeEnv,
      },
    }));

    let failure: string | null = null;
    try {
      const { error } = await this.supabase
        .from('__seo_event_log')
        .insert(rows);
      if (error) failure = `${error.code ?? 'no_code'}: ${error.message}`;
    } catch (err) {
      failure = err instanceof Error ? err.message : String(err);
    }
    if (failure === null) return;

    for (const row of rows) {
      this.logger.warn(
        `[cwv_beacon_rejection] event=persist_failed reason=${row.payload.reason} count=${row.payload.count} window_start=${row.payload.window_start} window_end=${row.payload.window_end} error=${failure}`,
      );
    }
  }

  private async recordHuman(
    input: CwvBeaconServerInsert,
  ): Promise<{ ok: boolean }> {
    const { error } = await this.supabase.from('__seo_cwv_raw').insert({
      session_id: input.session_id,
      surface: input.surface,
      route_group: input.route_group,
      priority_tier: input.priority_tier,
      funnel_step: input.funnel_step,
      previous_funnel_step: input.previous_funnel_step,
      url: input.url,
      metric: input.metric,
      value: input.value,
      device: input.device,
      ua_class: input.ua_class,
      attribution: input.attribution ?? null,
      nav_type: input.nav_type,
    });
    if (error) {
      this.logger.error(
        `cwv beacon insert failed (${input.metric}/${input.route_group}): ${error.message}`,
      );
      return { ok: false };
    }
    return { ok: true };
  }

  private async recordBot(
    input: CwvBeaconServerInsert,
  ): Promise<{ ok: boolean }> {
    // Bots : event_log avec payload pour debug, jamais agrégé.
    const { error } = await this.supabase.from('__seo_event_log').insert({
      event_type: 'seo.runtime.bot_cwv_beacon',
      entity_url: input.url,
      severity: 'info',
      payload: {
        ua_class: input.ua_class,
        metric: input.metric,
        value: input.value,
        surface: input.surface,
        route_group: input.route_group,
        priority_tier: input.priority_tier,
        device: input.device,
      },
    });
    if (error) {
      this.logger.error(
        `cwv beacon (bot) event_log insert failed (${input.metric}): ${error.message}`,
      );
      return { ok: false };
    }
    return { ok: true };
  }
}

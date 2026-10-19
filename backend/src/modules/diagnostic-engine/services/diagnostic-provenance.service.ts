import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import {
  DiagnosticEngineDataService,
  type DiagLinkProvenance,
  type DiagMergedCauseLink,
  type DiagSymptomCauseLink,
} from '../diagnostic-engine.data-service';
import {
  provenanceStateOf,
  type HypothesisProvenance,
  type ProvenanceState,
  type ProvenanceSummary,
} from '../types/evidence-pack.schema';

/**
 * WIKI provenance of the diagnostic ranking.
 *
 * Reads, for every symptom → cause link behind the hypotheses, the live rows
 * projected from validated WIKI fiches (`__diag_link_provenance`) and decides
 * which ranking the orchestrator keeps:
 *
 *   - EXPOSE OFF: the reference ranking, nothing read (PRIMARY is ignored,
 *     with one warning per process — a ranking weighed by an information the
 *     pack does not show would be unexplainable).
 *   - EXPOSE ON: the reference ranking, plus each hypothesis's provenance and
 *     the rank change PRIMARY would make, measured and never applied.
 *   - EXPOSE + PRIMARY: each contribution weighs 100 when its link has a live
 *     `diagnostic_safe` row, else 0; the mean over the selected symptoms (the
 *     denominator of relative_score), rounded once, replaces the link's
 *     relative_score and the scoring engine runs unchanged.
 *
 * An unreadable provenance is `unavailable`: the reference ranking is kept
 * and no hypothesis carries a state — never `unsourced`, which would claim
 * the WIKI documents nothing. The flags are read on every call: the admin
 * dashboard can override them at runtime.
 */
export const DIAGNOSTIC_PROVENANCE_EVALUATED =
  'diagnostic_provenance_evaluated';

/** Event payload — bounded values only (it feeds Prometheus labels). */
export interface DiagnosticProvenanceEvaluated {
  mode: 'expose' | 'primary';
  status: ProvenanceSummary['status'];
  /** State of the hypothesis ranked first; absent when unavailable or empty. */
  top_state?: ProvenanceState;
  /** Whether PRIMARY orders the hypotheses differently; absent when unavailable. */
  rank_changed?: boolean;
}

export interface RankedWithProvenance<H> {
  hypotheses: H[];
  /** null = provenance not exposed (flag OFF). */
  provenance: {
    byHypothesis: ReadonlyMap<string, HypothesisProvenance>;
    summary: ProvenanceSummary;
  } | null;
}

@Injectable()
export class DiagnosticProvenanceService implements OnModuleInit {
  private readonly logger = new Logger(DiagnosticProvenanceService.name);
  private primaryIgnoredWarned = false;

  constructor(
    private readonly dataService: DiagnosticEngineDataService,
    private readonly flags: FeatureFlagsService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit(): void {
    this.warnIfPrimaryIgnored(
      this.flags.diagnosticProvenanceExposeEnabled,
      this.flags.diagnosticProvenancePrimaryEnabled,
    );
  }

  async rank<H extends { hypothesis_id: string }>(
    links: DiagMergedCauseLink[],
    score: (links: DiagSymptomCauseLink[]) => H[],
  ): Promise<RankedWithProvenance<H>> {
    const expose = this.flags.diagnosticProvenanceExposeEnabled;
    const primaryRequested = this.flags.diagnosticProvenancePrimaryEnabled;
    this.warnIfPrimaryIgnored(expose, primaryRequested);

    const reference = score(links);
    if (!expose) return { hypotheses: reference, provenance: null };
    const mode = primaryRequested ? 'primary' : 'expose';

    let rows: DiagLinkProvenance[];
    try {
      rows = await this.dataService.getLiveLinkProvenance(
        links.flatMap((link) => link.contributions.map((c) => c.link_id)),
      );
    } catch (error) {
      this.logger.error(
        'WIKI provenance unavailable — reference ranking kept, no state shown',
        error,
      );
      this.emit({ mode, status: 'unavailable' });
      return {
        hypotheses: reference,
        provenance: {
          byHypothesis: new Map(),
          summary: { status: 'unavailable' },
        },
      };
    }

    const refsByLink = new Map<number, DiagLinkProvenance[]>();
    for (const row of rows) {
      refsByLink.set(row.link_id, [
        ...(refsByLink.get(row.link_id) ?? []),
        row,
      ]);
    }
    const refsOf = (linkId: number) => refsByLink.get(linkId) ?? [];

    const byHypothesis = new Map<string, HypothesisProvenance>();
    for (const link of links) {
      if (!link.cause) continue;
      const provenanceLinks = link.contributions.map((c) => {
        const refs = refsOf(c.link_id);
        return {
          link_id: c.link_id,
          symptom_slug: c.symptom_slug,
          documented: refs.length > 0,
          wiki_refs: refs.map(
            ({ wiki_path, gamme_slug, relation_to_part, diagnostic_safe }) => ({
              wiki_path,
              gamme_slug,
              relation_to_part,
              diagnostic_safe,
            }),
          ),
        };
      });
      byHypothesis.set(link.cause.slug, {
        state: provenanceStateOf(provenanceLinks),
        links: provenanceLinks,
      });
    }

    const weighted = score(
      links.map((link) => ({
        ...link,
        relative_score: Math.round(
          link.contributions.reduce(
            (sum, c) =>
              sum +
              (refsOf(c.link_id).some((r) => r.diagnostic_safe) ? 100 : 0),
            0,
          ) / link.symptom_count,
        ),
      })),
    );
    const hypotheses = mode === 'primary' ? weighted : reference;

    const counts = { sourced: 0, partial: 0, unsourced: 0 };
    for (const h of hypotheses) {
      const state = byHypothesis.get(h.hypothesis_id)?.state;
      if (state) counts[state] += 1;
    }
    const top = hypotheses.at(0);
    this.emit({
      mode,
      status: 'available',
      top_state: top ? byHypothesis.get(top.hypothesis_id)?.state : undefined,
      rank_changed: weighted.some(
        (h, i) => h.hypothesis_id !== reference[i]?.hypothesis_id,
      ),
    });
    return {
      hypotheses,
      provenance: { byHypothesis, summary: { status: 'available', counts } },
    };
  }

  private warnIfPrimaryIgnored(
    expose: boolean,
    primaryRequested: boolean,
  ): void {
    if (!primaryRequested || expose || this.primaryIgnoredWarned) return;
    this.primaryIgnoredWarned = true;
    this.logger.warn(
      'DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED ignored: it requires DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED (the ranking would depend on a provenance the pack does not show)',
    );
  }

  private emit(payload: DiagnosticProvenanceEvaluated): void {
    this.events.emit(DIAGNOSTIC_PROVENANCE_EVALUATED, payload);
  }
}

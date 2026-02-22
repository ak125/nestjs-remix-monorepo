import { Injectable, Logger } from '@nestjs/common';
import { MarketingHubDataService } from './marketing-hub-data.service';
import { MarketingDataService } from './marketing-data.service';
import { UTMBuilderService } from './utm-builder.service';
import type {
  WeeklyPlan,
  DaySlot,
  PriorityGamme,
  CalendarRules,
  ContentPillar,
  PostBrief,
} from '../interfaces/marketing-hub.interfaces';

const DEFAULT_CALENDAR: CalendarRules = {
  posting_days: [1, 3, 5, 7], // Lun, Mer, Ven, Dim
  pillar_schedule: {
    1: 'catalogue',
    3: 'conseil',
    5: 'confiance',
    7: 'promo',
  },
  excluded_dates: [],
  optimal_hours: {
    1: '12:00',
    3: '18:00',
    5: '17:00',
    7: '10:00',
  },
  max_posts_per_day: 1,
};

@Injectable()
export class WeeklyPlanGeneratorService {
  private readonly logger = new Logger(WeeklyPlanGeneratorService.name);

  constructor(
    private readonly hubData: MarketingHubDataService,
    private readonly marketingData: MarketingDataService,
    private readonly utmBuilder: UTMBuilderService,
  ) {}

  /**
   * Generate a weekly plan for the given ISO week.
   * Anti-duplication: excludes gammes posted in last 28 days.
   */
  async generatePlan(opts: {
    week_iso: string;
    priority_gammes?: PriorityGamme[];
    calendar_rules?: CalendarRules;
  }): Promise<WeeklyPlan | null> {
    const calendar = opts.calendar_rules ?? DEFAULT_CALENDAR;

    // 1. Get priority gammes (from opts or auto-detect)
    let gammes = opts.priority_gammes ?? [];
    if (gammes.length === 0) {
      gammes = await this.autoDetectPriorityGammes();
    }

    // 2. Anti-duplication: exclude recently posted gammes
    const recentIds = await this.hubData.getRecentGammeIds(28);
    const availableGammes = gammes.filter((g) => !recentIds.includes(g.pg_id));

    // Fallback: if not enough gammes, allow reuse with flag
    const finalGammes =
      availableGammes.length >= calendar.posting_days.length
        ? availableGammes
        : [
            ...availableGammes,
            ...gammes.slice(
              0,
              calendar.posting_days.length - availableGammes.length,
            ),
          ];

    // 3. Build day slots
    const slots: DaySlot[] = calendar.posting_days.map((day, index) => {
      const pillar = calendar.pillar_schedule[day] as ContentPillar;
      const gamme = finalGammes[index % finalGammes.length];
      const _isReused = recentIds.includes(gamme?.pg_id);

      const brief: PostBrief = {
        topic: gamme
          ? `${pillar} — ${gamme.pg_name}`
          : `${pillar} — contenu generique`,
        angle: this.getDefaultAngle(pillar),
        gamme_id: gamme?.pg_id ?? null,
        gamme_alias: gamme?.pg_alias ?? null,
        content_source: this.getContentSource(pillar),
        source_url: gamme
          ? `https://www.automecanik.com/pieces/${gamme.pg_alias}`
          : 'https://www.automecanik.com',
        target_channels: ['instagram', 'facebook', 'youtube'],
        objective: pillar === 'promo' ? 'conversion' : 'traffic',
        cta_type: pillar === 'conseil' ? 'sauvegarde' : 'lien_bio',
        key_selling_points: [],
        visual_direction: this.getVisualDirection(pillar),
      };

      const dateIso = this.getDateForWeekDay(opts.week_iso, day);

      return {
        day_of_week: day,
        date_iso: dateIso,
        pillar,
        optimal_hour: calendar.optimal_hours[day] || '12:00',
        brief,
      };
    });

    // 4. Persist plan
    const plan = await this.hubData.upsertWeeklyPlan({
      week_iso: opts.week_iso,
      priority_gammes: finalGammes as PriorityGamme[],
      calendar_rules: calendar as CalendarRules,
      plan_json: slots as DaySlot[],
      status: 'draft',
      posts_generated: 0,
      posts_approved: 0,
      posts_published: 0,
    });

    if (plan) {
      this.logger.log(
        `Plan ${opts.week_iso} generated: ${slots.length} slots, ${availableGammes.length} unique gammes`,
      );
    }

    return plan;
  }

  private async autoDetectPriorityGammes(): Promise<PriorityGamme[]> {
    // 1. Try SEO gammes with existing content (best candidates)
    try {
      const seoGammes = await this.hubData.getTopSeoGammes(12);
      if (seoGammes.length > 0) {
        // Filter out recently posted gammes
        const recentIds = await this.hubData.getRecentGammeIds(28);
        const fresh = seoGammes.filter((g) => !recentIds.includes(g.pg_id));
        if (fresh.length >= 4) {
          this.logger.log(
            `autoDetect: ${fresh.length} SEO gammes (${fresh.map((g) => g.pg_alias).join(', ')})`,
          );
          return fresh.slice(0, 8);
        }
      }
    } catch {
      this.logger.warn('autoDetect: SEO gammes query failed');
    }

    // 2. Fallback: coverage gaps
    try {
      const coverage = await this.marketingData.getContentCoverage();
      if (coverage && coverage.gaps) {
        return coverage.gaps
          .slice(0, 8)
          .map(
            (gap: { pg_id: number; pg_alias?: string; pg_name?: string }) => ({
              pg_id: gap.pg_id,
              pg_alias: gap.pg_alias || '',
              pg_name: gap.pg_name || '',
              reason: 'low_coverage' as const,
            }),
          );
      }
    } catch {
      this.logger.warn('autoDetect: coverage unavailable');
    }
    return [];
  }

  private getContentSource(pillar: ContentPillar): PostBrief['content_source'] {
    switch (pillar) {
      case 'catalogue':
        return 'gamme_catalogue';
      case 'conseil':
        return 'blog_advice';
      case 'confiance':
        return 'trust_review';
      case 'promo':
        return 'promo';
    }
  }

  private getDefaultAngle(pillar: ContentPillar): string {
    switch (pillar) {
      case 'catalogue':
        return 'Piece de la semaine : presentation produit + compatibilite';
      case 'conseil':
        return 'Quand et pourquoi changer cette piece ?';
      case 'confiance':
        return 'Chiffres cles + reviews clients verifiees';
      case 'promo':
        return 'Offre en cours + livraison gratuite des 150EUR';
    }
  }

  private getVisualDirection(pillar: ContentPillar): string {
    switch (pillar) {
      case 'catalogue':
        return 'Photo produit sur fond bleu #0F4C81, badge prix en rouge #FF3B30';
      case 'conseil':
        return 'Carrousel educatif slides, icones techniques, palette bleu/blanc';
      case 'confiance':
        return 'Chiffres en grand (Montserrat Bold), fond sombre, accent vert #1FDC93';
      case 'promo':
        return 'Fond rouge vif, texte blanc, CTA vert, urgence visuelle';
    }
  }

  private getDateForWeekDay(weekIso: string, dayOfWeek: number): string {
    // Parse "2026-W09" → Monday of that week, then add dayOfWeek - 1
    const match = weekIso.match(/^(\d{4})-W(\d{2})$/);
    if (!match) return '';
    const year = parseInt(match[1]);
    const week = parseInt(match[2]);
    // Jan 4 is always in week 1
    const jan4 = new Date(year, 0, 4);
    const dayDiff = jan4.getDay() || 7; // Monday=1
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - dayDiff + 1 + (week - 1) * 7);
    const target = new Date(monday);
    target.setDate(monday.getDate() + dayOfWeek - 1);
    return target.toISOString().split('T')[0];
  }
}

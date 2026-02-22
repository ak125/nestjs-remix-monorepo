import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type {
  UTMParams,
  UTMLink,
  SocialChannel,
  ContentPillar,
} from '../interfaces/marketing-hub.interfaces';

@Injectable()
export class UTMBuilderService {
  private readonly BASE_URL = 'https://www.automecanik.com';

  /**
   * Build a deterministic UTM link.
   * utm_content = hash(channel_format_variant) for A/B tracking.
   */
  buildUTMLink(opts: {
    path: string;
    week_iso: string;
    pillar: ContentPillar;
    gamme_alias: string;
    channel: SocialChannel;
    format?: string;
    variant?: string;
  }): UTMLink {
    const weekShort = opts.week_iso.replace('-', '').toLowerCase(); // 2026w09
    const gammeSlug = opts.gamme_alias
      .replace(/[^a-z0-9-]/gi, '')
      .substring(0, 30);

    const campaign = `mktg_${weekShort}_${opts.pillar}_${gammeSlug}`;

    const contentParts = [
      opts.channel,
      opts.format || 'post',
      opts.variant || 'v1',
    ].join('_');
    const contentHash = createHash('md5')
      .update(contentParts)
      .digest('hex')
      .substring(0, 8);
    const utmContent = `${opts.channel}_${opts.format || 'post'}_${contentHash}`;

    const params: UTMParams = {
      utm_campaign: campaign,
      utm_source: opts.channel,
      utm_medium: 'social',
      utm_content: utmContent,
    };

    const baseUrl = `${this.BASE_URL}${opts.path}`;
    const searchParams = new URLSearchParams({
      utm_campaign: params.utm_campaign,
      utm_source: params.utm_source,
      utm_medium: params.utm_medium,
      utm_content: params.utm_content!,
    });

    return {
      base_url: baseUrl,
      params,
      full_url: `${baseUrl}?${searchParams.toString()}`,
    };
  }

  /**
   * Build UTM params only (without full URL).
   */
  buildParams(opts: {
    week_iso: string;
    pillar: ContentPillar;
    gamme_alias: string;
    channel: SocialChannel;
  }): UTMParams {
    const weekShort = opts.week_iso.replace('-', '').toLowerCase();
    const gammeSlug = opts.gamme_alias
      .replace(/[^a-z0-9-]/gi, '')
      .substring(0, 30);

    return {
      utm_campaign: `mktg_${weekShort}_${opts.pillar}_${gammeSlug}`,
      utm_source: opts.channel,
      utm_medium: 'social',
    };
  }
}

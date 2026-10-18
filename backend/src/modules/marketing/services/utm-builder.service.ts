import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { SITE_ORIGIN } from '../../../config/app.config';
import { DomainValidationException } from '@common/exceptions';
import type {
  UTMParams,
  UTMLink,
  SocialChannel,
  ContentPillar,
} from '../interfaces/marketing-hub.interfaces';

@Injectable()
export class UTMBuilderService {
  private readonly BASE_URL = SITE_ORIGIN;

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

    const baseUrl = this.destination(opts.path).toString();

    return {
      base_url: baseUrl,
      params,
      full_url: this.appendParams(baseUrl, params),
    };
  }

  /** Share URL handling with manual exports; attribution replaces old UTM values. */
  appendParams(path: string, params: UTMParams): string {
    const url = this.destination(path);
    for (const key of [
      'utm_campaign',
      'utm_source',
      'utm_medium',
      'utm_content',
    ] as const) {
      const value = params[key];
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    return url.toString();
  }

  private destination(path: string): URL {
    let url: URL;
    try {
      url = new URL(path, this.BASE_URL);
    } catch {
      throw new DomainValidationException({
        message: 'Invalid marketing destination',
        field: 'source_url',
      });
    }
    if (
      url.origin !== new URL(this.BASE_URL).origin ||
      url.username ||
      url.password
    ) {
      throw new DomainValidationException({
        message: 'Marketing destination must belong to the storefront',
        field: 'source_url',
      });
    }
    return url;
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

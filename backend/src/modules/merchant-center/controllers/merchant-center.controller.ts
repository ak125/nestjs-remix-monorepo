/**
 * MerchantCenterController — Google Shopping XML feed endpoint.
 *
 * GET /api/feed/merchant-center.xml
 *   Streams RSS 2.0 with `g:*` Google Shopping namespace.
 *   Pages 1000 items per RPC call ; cache-friendly `s-maxage=14400` (4h).
 *
 * Per Google Shopping spec : 1 <item> per piece, mandatory fields g:id, g:title,
 * g:description, g:link, g:image_link, g:availability, g:price, g:brand,
 * g:gtin OR g:mpn, g:condition. Optional g:product_type (drives category in GMC).
 *
 * V1 scope :
 *   - No __merchant_center_feed_log table (V1.5+)
 *   - No GH workflow (GMC pulls the URL directly per its schedule)
 *   - No item_group_id (V1.5+ for variants)
 *
 * Refs :
 *   - migration 20260519_merchant_center_feed_v1.sql
 *   - plan superpower-1-d-abord-proud-cookie.md step 5B
 */
import { Controller, Get, Header, Logger, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  MerchantCenterFeedRow,
  MerchantCenterFeedService,
} from '../services/merchant-center-feed.service';

@Controller('feed')
export class MerchantCenterController {
  private readonly logger = new Logger(MerchantCenterController.name);

  constructor(private readonly feedService: MerchantCenterFeedService) {}

  @Get('merchant-center.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600, s-maxage=14400')
  async stream(@Res() res: Response): Promise<void> {
    const startedAt = Date.now();

    res.write('<?xml version="1.0" encoding="UTF-8"?>\n');
    res.write('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n');
    res.write('  <channel>\n');
    res.write('    <title>AutoMecanik — Pièces auto</title>\n');
    res.write('    <link>https://www.automecanik.com</link>\n');
    res.write(
      '    <description>Catalogue Google Shopping AutoMecanik (pièces détachées automobile, équipementiers OE)</description>\n',
    );

    let offset = 0;
    let total = 0;

    while (true) {
      const batch = await this.feedService.fetchPage(offset);
      if (batch.length === 0) break;

      for (const row of batch) {
        res.write(renderItemXml(row));
      }

      total += batch.length;
      offset += batch.length;

      if (batch.length < MerchantCenterFeedService.PAGE_SIZE) break;
    }

    res.write('  </channel>\n');
    res.write('</rss>\n');
    res.end();

    this.logger.log(
      `Streamed ${total} items in ${Date.now() - startedAt}ms (offset=${offset})`,
    );
  }
}

function xmlEscape(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderItemXml(row: MerchantCenterFeedRow): string {
  const identityTag = row.gtin
    ? `<g:gtin>${xmlEscape(row.gtin)}</g:gtin>`
    : `<g:mpn>${xmlEscape(row.mpn)}</g:mpn>`;

  return `    <item>
      <g:id>${xmlEscape(row.id)}</g:id>
      <g:title>${xmlEscape(row.title)}</g:title>
      <g:description>${xmlEscape(row.description)}</g:description>
      <g:link>${xmlEscape(row.link)}</g:link>
      <g:image_link>${xmlEscape(row.image_link)}</g:image_link>
      <g:availability>${xmlEscape(row.availability)}</g:availability>
      <g:price>${xmlEscape(row.price)}</g:price>
      <g:brand>${xmlEscape(row.brand)}</g:brand>
      ${identityTag}
      <g:product_type>${xmlEscape(row.product_type)}</g:product_type>
      <g:condition>${xmlEscape(row.condition)}</g:condition>
    </item>
`;
}

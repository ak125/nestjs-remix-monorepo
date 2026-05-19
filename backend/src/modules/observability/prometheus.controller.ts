import { Controller, Get, Header, Inject } from '@nestjs/common';
import type { Registry } from 'prom-client';
import { PROMETHEUS_REGISTRY } from './observability.tokens';

/**
 * Prometheus scrape endpoint (PR-C).
 *
 * Distinct from the various legacy JSON `/metrics` endpoints in the
 * monorepo (search/seo/system/admin) — Prometheus needs the text exposition
 * format and a stable, unauthenticated URL. Path scoped under
 * `/api/observability/` to make the contract explicit.
 *
 * Anonymous by design (canon : metrics endpoints must be cheap to scrape ;
 * authn would force the scraper to carry credentials and is not required —
 * the surface only exposes counters, never PII).
 */
@Controller('api/observability')
export class PrometheusController {
  constructor(
    @Inject(PROMETHEUS_REGISTRY)
    private readonly registry: Registry,
  ) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(): Promise<string> {
    return this.registry.metrics();
  }
}

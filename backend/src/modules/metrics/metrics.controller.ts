/**
 * MetricsController — endpoint /metrics au format Prometheus text exposition.
 *
 * Exposition publique (pas de guard) — c'est le pattern standard Prometheus.
 * Si l'instance est exposée publiquement, ajouter ProxyAuth ou IP allowlist.
 *
 * Usage :
 *   curl http://localhost:3000/metrics | grep seo_
 */

import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  scrape(): string {
    return this.metrics.renderPrometheus();
  }
}

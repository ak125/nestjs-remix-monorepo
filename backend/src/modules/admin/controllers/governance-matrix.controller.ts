import { Controller, Get, Logger, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { OperatingMatrixService } from '@config/operating-matrix.service';

/**
 * GovernanceMatrixController — admin-only HTTP exposure of the SEO Operating Matrix.
 *
 * Live runtime view of registry × catalog × .claude/agents inventory. Useful
 * for prod debugging when the committed audit-reports/seo-agent-matrix.json
 * may differ from runtime (env-dependent agent scan results).
 *
 * Single endpoint, two formats:
 *   GET /api/admin/governance/seo-operating-matrix             → JSON canonical
 *   GET /api/admin/governance/seo-operating-matrix?format=md   → Markdown
 *
 * Bypasses the AdminResponseInterceptor (uses @Res() directly): the JSON is
 * already canonicalized by the service, and wrapping it would break the
 * deterministic byte-for-byte equivalence with the committed artifact.
 */
@Controller('api/admin/governance')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class GovernanceMatrixController {
  private readonly logger = new Logger(GovernanceMatrixController.name);

  constructor(private readonly matrix: OperatingMatrixService) {}

  @Get('seo-operating-matrix')
  getMatrix(
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ): void {
    if (format === 'md' || format === 'markdown') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(this.matrix.formatMarkdown());
      return;
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(this.matrix.formatJsonString());
  }
}

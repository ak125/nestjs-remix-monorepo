/**
 * Internal Command Center digest for the Hermes supervisor (machine consumer,
 * no admin session). Protected by X-Internal-Key (InternalApiKeyGuard, constant-time
 * compare) — same guard as the other /api/internal/* routes.
 *
 * Read-only: a bounded projection of the cockpit response (same cache, same rules,
 * see toCommandCenterDigest). Same exposure as GET /api/admin/command-center:
 * COMMAND_CENTER_MODE `disabled` → 404 — the flag is never bypassed here.
 *
 * GET /api/internal/command-center/digest
 */
import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import type { CommandCenterDigest } from '@repo/registry';
import { InternalApiKeyGuard } from '../../../auth/internal-api-key.guard';
import {
  CommandCenterReaderService,
  toCommandCenterDigest,
} from '../services/command-center-reader.service';

@Controller('api/internal/command-center')
@UseGuards(InternalApiKeyGuard)
export class InternalCommandCenterController {
  constructor(private readonly reader: CommandCenterReaderService) {}

  @Get('digest')
  async digest(): Promise<CommandCenterDigest> {
    if (this.reader.getMode() === 'disabled') {
      throw new NotFoundException(
        'Command Center is disabled in this environment',
      );
    }
    return toCommandCenterDigest(await this.reader.getCommandCenter());
  }
}

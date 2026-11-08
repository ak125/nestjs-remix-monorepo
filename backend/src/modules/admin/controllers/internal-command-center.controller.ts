/**
 * Internal Command Center digest for the Hermes supervisor (machine consumer,
 * no admin session). Accepts the digest-only X-Command-Center-Key
 * (CommandCenterDigestKeyGuard), which the supervisor collector uses, or
 * X-Internal-Key (InternalApiKeyGuard), the key of the other /api/internal/* routes.
 * Both compare in constant time.
 *
 * Read-only: a bounded projection of the cockpit response (same cache, same rules,
 * see toCommandCenterDigest). Same exposure as GET /api/admin/command-center:
 * COMMAND_CENTER_MODE `disabled` → 404 — the flag is never bypassed here.
 *
 * GET /api/internal/command-center/digest
 */
import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import type { CommandCenterDigest } from '@repo/registry';
import { AnyOf } from '../../../auth/any-of.guard';
import { CommandCenterDigestKeyGuard } from '../../../auth/command-center-digest-key.guard';
import { InternalApiKeyGuard } from '../../../auth/internal-api-key.guard';
import {
  CommandCenterReaderService,
  toCommandCenterDigest,
} from '../services/command-center-reader.service';

@Controller('api/internal/command-center')
@UseGuards(AnyOf(CommandCenterDigestKeyGuard, InternalApiKeyGuard))
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

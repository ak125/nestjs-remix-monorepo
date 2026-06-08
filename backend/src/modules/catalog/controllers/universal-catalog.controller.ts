import { Controller, Get } from '@nestjs/common';
import { UniversalCatalogService } from '../services/universal-catalog.service';

/**
 * Read-only API for the "Produits universels" section (T2b).
 * GET /api/catalog/universal/section → universal gammes + product previews (no vehicle).
 * Flag-gated by SHOW_UNIVERSAL_SECTION (default OFF → { enabled:false, gammes:[] }).
 */
@Controller('api/catalog/universal')
export class UniversalCatalogController {
  constructor(private readonly universal: UniversalCatalogService) {}

  @Get('section')
  getSection() {
    return this.universal.getSection();
  }
}

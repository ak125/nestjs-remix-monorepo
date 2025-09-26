import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';

// Controllers
import { CatalogController } from './catalog.controller';
import { PiecesRealController } from '../../pieces/pieces-real.controller';
import { PiecesRealDataController } from './controllers/pieces-real-data.controller';

// Services
import { CatalogService } from './catalog.service';
import { CatalogFamilyService } from './services/catalog-family.service';
import { CatalogGammeService } from './services/catalog-gamme.service';
import { PiecesRealService } from '../../pieces/pieces-real.service';
import { PiecesRealDataSimpleService } from './services/pieces-real-data-simple.service';

/**
 * Module Catalogue Simplifié - Focus sur les vraies pièces avec logique PHP exacte
 */
@Module({
  imports: [DatabaseModule],
  controllers: [
    CatalogController,
    PiecesRealController,
    PiecesRealDataController,
  ],
  providers: [
    CatalogService,
    CatalogFamilyService,
    CatalogGammeService,
    PiecesRealService,
    PiecesRealDataSimpleService,
  ],
  exports: [CatalogService, PiecesRealService],
})
export class CatalogModuleSimple {}
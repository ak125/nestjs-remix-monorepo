/**
 * 📖 MODULE SEO CONTENT
 *
 * Regroupe tous les services de génération de contenu SEO RAG:
 * - ReferenceService: Pages Référence R4 (définitions mécaniques intemporelles)
 * - DiagnosticService: Pages Diagnostic R5 (Observable Pro, symptômes)
 * - SeoGeneratorService: Synthèse RAG vers R4/R5 avec LLM optionnel
 *
 * Contrôleurs:
 * - ReferenceController, DiagnosticController, SeoGeneratorController
 */

import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Module AI Content (optionnel, pour enrichissement LLM)
import { AiContentModule } from '../ai-content/ai-content.module';

// Import SeoValidationModule pour QualityValidatorService
import { SeoValidationModule } from '../seo-validation/seo-validation.module';

// Services content (import depuis seo/ pour compatibilité)
import { ReferenceService } from '../seo/services/reference.service';
import { DiagnosticService } from '../seo/services/diagnostic.service';
import { SeoGeneratorService } from '../seo/services/seo-generator.service';

// Contrôleurs
import { ReferenceController } from '../seo/controllers/reference.controller';
import { DiagnosticController } from '../seo/controllers/diagnostic.controller';
import { SeoGeneratorController } from '../seo/controllers/seo-generator.controller';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => AiContentModule), // Optionnel pour enrichissement LLM
    forwardRef(() => SeoValidationModule), // Pour QualityValidatorService
  ],

  controllers: [
    ReferenceController,
    DiagnosticController,
    SeoGeneratorController,
  ],

  providers: [ReferenceService, DiagnosticService, SeoGeneratorService],

  exports: [ReferenceService, DiagnosticService, SeoGeneratorService],
})
export class SeoContentModule {}

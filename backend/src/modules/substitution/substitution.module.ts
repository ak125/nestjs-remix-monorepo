import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IntentExtractorService } from './services/intent-extractor.service';
import { SubstitutionService } from './services/substitution.service';
import { SubstitutionLoggerService } from './services/substitution-logger.service';
import { SubstitutionController } from './controllers/substitution.controller';

/**
 * SubstitutionModule - Moteur de Substitution Sémantique
 *
 * Transforme les URLs en pages SEO-optimisées via un système de verrous contextuels.
 *
 * Paradigme HTTP:
 * - API retourne toujours HTTP 200
 * - Le statut métier (200/404/410) est dans response.httpStatus
 * - Le frontend utilise httpStatus pour définir le code HTTP réel
 *
 * Matrice HTTP:
 * | Cas                          | Code |
 * |------------------------------|------|
 * | Intention valide             | 200  | Page SEO enrichie (avec ou sans lock)
 * | Intention fausse             | 410  | Gone: contenu retiré
 * | Intention inconnue           | 404  | Not Found: URL incompréhensible
 */
@Module({
  imports: [ConfigModule],
  controllers: [SubstitutionController],
  providers: [
    IntentExtractorService,
    SubstitutionService,
    SubstitutionLoggerService,
  ],
  exports: [SubstitutionService, IntentExtractorService],
})
export class SubstitutionModule {}

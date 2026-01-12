import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IntentExtractorService } from './services/intent-extractor.service';
import { SubstitutionService } from './services/substitution.service';
import { SubstitutionLoggerService } from './services/substitution-logger.service';
import { SubstitutionController } from './controllers/substitution.controller';

/**
 * SubstitutionModule - Moteur de Substitution Sémantique
 *
 * Transforme les 404 en pages de récupération SEO-optimisées via un système de verrous contextuels (412).
 *
 * Paradigme HTTP:
 * - API retourne toujours HTTP 200
 * - Le vrai code (200/404/410/412) est dans response.httpStatus
 * - Le frontend utilise httpStatus pour définir le code HTTP réel
 *
 * Matrice HTTP:
 * | Cas                          | Code |
 * |------------------------------|------|
 * | Intention valide mais floue  | 412  | Lock: besoin de contexte
 * | Intention valide et précise  | 200  | Catalogue normal
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

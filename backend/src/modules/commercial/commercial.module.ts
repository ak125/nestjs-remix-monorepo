import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CommercialArchivesService } from './archives/archives.service';
import { CommercialArchivesController } from './archives/archives.controller';

/**
 * Module Commercial
 * ✅ Intégré à l'architecture moderne du projet
 * ✅ Utilise SupabaseBaseService pour la cohérence
 * ✅ Cache Redis intégré
 * ✅ Service CRON pour archivage automatique (géré au niveau app)
 * ✅ Remplace les anciennes fonctions PHP d'archivage
 */
@Module({
  imports: [
    DatabaseModule, // Pour accès Supabase/PostgREST
    // ScheduleModule est géré au niveau app.module.ts
  ],
  controllers: [
    CommercialArchivesController, // Controller archives
  ],
  providers: [
    CommercialArchivesService, // Service archives avec CRON
  ],
  exports: [
    CommercialArchivesService, // Service exporté pour usage dans autres modules
  ],
})
export class CommercialModule {}

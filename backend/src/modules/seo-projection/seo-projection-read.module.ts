/**
 * SeoProjectionReadModule — module de LECTURE léger (moindre-privilège) pour la projection SEO.
 *
 * Fournit le seul `SeoProjectionReaderService` (RPC `get_active_seo_projection`). N'importe **PAS**
 * `DatabaseModule` ni le write-side (`SeoProjectionModule` = writer + gate `service_role` + queues) :
 * un consommateur de lecture (admin brief aujourd'hui ; consumers R* plus tard) ne doit jamais tirer
 * la capacité d'écriture. `SupabaseBaseService` se construit avec `ConfigService` seul ; `RpcGateService`
 * est `@Global`. **DARK** : aucune activation de lecture publique, aucun flag de canary ici.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SeoProjectionReaderService } from './seo-projection-reader.service';

@Module({
  imports: [ConfigModule],
  providers: [SeoProjectionReaderService],
  exports: [SeoProjectionReaderService],
})
export class SeoProjectionReadModule {}

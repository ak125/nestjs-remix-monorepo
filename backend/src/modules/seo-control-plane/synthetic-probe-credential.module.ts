import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SyntheticProbeCredentialService } from './synthetic-probe-credential.service';

/**
 * @Global — le credential synthétique est injecté par DEUX modules distincts :
 * BotGuardModule (verify, côté origine) et SeoControlPlaneModule (sign, côté
 * crawler). Le rendre global évite une dépendance circulaire
 * bot-guard ↔ seo-control-plane et ne duplique aucun provider.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [SyntheticProbeCredentialService],
  exports: [SyntheticProbeCredentialService],
})
export class SyntheticProbeCredentialModule {}

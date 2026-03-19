import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';

/**
 * MailModule — Module global pour MailService.
 *
 * Declare @Global() pour que MailService soit disponible dans TOUS les modules
 * sans import explicite (evite les bugs DI recurrents dans AdminModule, SupportModule, etc.)
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}

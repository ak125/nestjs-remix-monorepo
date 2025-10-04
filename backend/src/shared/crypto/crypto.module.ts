import { Module, Global } from '@nestjs/common';
import { PasswordCryptoService } from './password-crypto.service';

/**
 * Module Global de Cryptographie
 * ✅ Service unique partagé dans toute l'application
 * ✅ Pas besoin d'importer dans chaque module
 */
@Global()
@Module({
  providers: [PasswordCryptoService],
  exports: [PasswordCryptoService],
})
export class CryptoModule {}

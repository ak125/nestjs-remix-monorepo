import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ConfigurationService } from '../services/configuration.service';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';

/**
 * 🔧 ConfigurationController - Controller de configuration système
 *
 * Controller aligné sur l'approche des modules existants :
 * ✅ Décorateurs NestJS standards (@Controller, @Get, @Put)
 * ✅ Injection du service métier
 * ✅ Structure REST cohérente
 * ✅ Préparé pour l'authentification admin
 */
@Controller('api/admin/configuration')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class ConfigurationController {
  constructor(private readonly configurationService: ConfigurationService) {}

  /**
   * GET /admin/configuration
   * Récupère toutes les configurations système
   */
  @Get()
  async getAllConfigurations() {
    return await this.configurationService.getAllConfigurations();
  }

  /**
   * GET /admin/configuration/:key
   * Récupère une configuration par clé
   */
  @Get(':key')
  async getConfigurationByKey(@Param('key') key: string) {
    return await this.configurationService.getConfigurationByKey(key);
  }

  /**
   * PUT /admin/configuration/:key
   * Met à jour une configuration
   */
  @Put(':key')
  async updateConfiguration(
    @Param('key') key: string,
    @Body('value') value: any,
  ) {
    return await this.configurationService.updateConfiguration(key, value);
  }
}

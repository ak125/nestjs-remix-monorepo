import { Injectable } from '@nestjs/common';
import { EnhancedConfigService } from '../modules/config/services/enhanced-config.service';
import { ConfigType } from '../modules/config/schemas/config.schemas';

@Injectable()
export class ExampleUsageService {
  constructor(
    private readonly configService: EnhancedConfigService,
  ) {}

  async exempleUtilisationConfig() {
    // 📖 Récupérer une configuration simple
    const appName = await this.configService.get('app.name', 'MonApp');
    console.log('Nom de l\'application:', appName);

    // 🔒 Récupérer une configuration sécurisée (chiffrée)
    const apiKey = await this.configService.getSecure('api.secret_key');
    console.log('Clé API (déchiffrée):', apiKey);

    // 📊 Créer une nouvelle configuration
    await this.configService.create({
      key: 'feature.new_dashboard',
      value: true,
      type: ConfigType.BOOLEAN,
      description: 'Activer le nouveau dashboard',
      category: 'features',
      isPublic: false,
    });

    // 🔄 Mettre à jour une configuration
    await this.configService.update('feature.new_dashboard', {
      value: false,
      description: 'Dashboard désactivé temporairement',
    });

    // 📋 Récupérer toutes les configurations d'une catégorie
    const featureConfigs = await this.configService.getByCategory('features');
    console.log('Configurations features:', featureConfigs);

    // 🧹 Supprimer une configuration
    await this.configService.delete('feature.old_feature');

    // 💾 Configuration avec cache personnalisé
    const cachedValue = await this.configService.get(
      'expensive.computation',
      'default',
      7200 // Cache pendant 2 heures
    );
  }
}
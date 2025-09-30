import { Controller, Get, Logger, Param } from '@nestjs/common';
import { CartDataService } from '../../database/services/cart-data.service';

@Controller('api/test')
export class TestSupabaseController {
  private readonly logger = new Logger(TestSupabaseController.name);

  constructor(private readonly cartDataService: CartDataService) {}

  /**
   * 🧪 Test direct de la connexion Supabase
   */
  @Get('supabase')
  async testSupabaseConnection() {
    try {
      this.logger.log('🧪 Test de connexion Supabase...');
      
      // Test basique : récupérer quelques pièces sans filtre
      const result = await (this.cartDataService as any).client
        .from('pieces')
        .select('piece_id, piece_name, piece_display')
        .limit(3);

      this.logger.log('✅ Résultat brut Supabase:', result);

      return {
        success: true,
        message: 'Test Supabase',
        data: result.data,
        error: result.error,
        count: result.data?.length || 0,
      };
    } catch (error) {
      this.logger.error('❌ Erreur test Supabase:', error);
      return {
        success: false,
        message: 'Erreur test Supabase',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 🧪 Test récupération produit spécifique
   */
  @Get('product/:id')
  async testProductById(@Param('id') productId: string) {
    try {
      const id = parseInt(productId, 10);
      this.logger.log(`🧪 Test récupération produit ${id}...`);
      
      const result = await this.cartDataService.getProductById(id);
      
      return {
        success: true,
        message: `Test produit ${id}`,
        product: result,
      };
    } catch (error) {
      this.logger.error(`❌ Erreur test produit ${productId}:`, error);
      return {
        success: false,
        message: `Erreur test produit ${productId}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
import { Controller, Get, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

@Controller('api/admin/simple-stock')
export class SimpleStockController extends SupabaseBaseService {
  protected readonly logger = new Logger(SimpleStockController.name);

  @Get('health')
  async health() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'simple-stock',
    };
  }

  @Get('test-relation')
  async testRelation() {
    try {
      // Test 1: Récupérer quelques pièces
      const { data: pieces, error: piecesError } = await this.client
        .from('pieces')
        .select('piece_id, piece_ref, piece_name')
        .limit(3);

      if (piecesError) throw piecesError;

      // Test 2: Pour chaque pièce, récupérer le prix
      const results = [];
      for (const piece of pieces || []) {
        const { data: prices, error: pricesError } = await this.client
          .from('pieces_price')
          .select('pri_dispo, pri_vente_ttc, pri_qte_vente')
          .eq('pri_piece_id', piece.piece_id.toString())
          .limit(1);

        if (!pricesError && prices && prices.length > 0) {
          results.push({
            piece: piece,
            price: prices[0],
          });
        } else {
          results.push({
            piece: piece,
            price: null,
            priceError: pricesError?.message || 'No prices found',
          });
        }
      }

      return {
        success: true,
        message: 'Test relation pieces/pieces_price',
        data: results,
        count: results.length,
      };
    } catch (error) {
      this.logger.error('Erreur test relation', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  @Get('available-stock')
  async getAvailableStock() {
    try {
      // Récupérer directement les prix des pièces disponibles
      const { data: availablePrices, error } = await this.client
        .from('pieces_price')
        .select('pri_piece_id, pri_dispo, pri_vente_ttc, pri_ref, pri_des')
        .eq('pri_dispo', '1')
        .limit(10);

      if (error) throw error;

      return {
        success: true,
        message: 'Stock disponible récupéré',
        data: availablePrices || [],
        count: availablePrices?.length || 0,
      };
    } catch (error) {
      this.logger.error('Erreur stock disponible', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
}

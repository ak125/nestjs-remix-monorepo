import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { 
  type ApiResponse,
  type UnifiedPiece,
  createSuccessResponse,
  createErrorResponse,
} from '@monorepo/shared-types';

@Injectable()
export class PiecesTestService extends SupabaseBaseService {
  
  async testPiecePrice(pieceId: number): Promise<ApiResponse<{
    piece_id: number;
    prices_table1: number;
    prices_table2: number; 
    prices_table3: number;
    sample: any;
  }>> {
    try {
      console.log(`🔍 Test de la pièce ${pieceId}`);
      
      // Test table pieces_price
      const pricesResult1 = await this.client
        .from('pieces_price')
        .select('*')
        .eq('pri_piece_id', pieceId.toString());
        
      console.log(
        '📊 pieces_price résultats:',
        pricesResult1.data?.length || 0,
      );
      if (pricesResult1.data?.length && pricesResult1.data.length > 0) {
        console.log('📋 Premier prix:', pricesResult1.data[0]);
      }
      
      // Test table pieces_prices aussi
      const pricesResult2 = await this.client
        .from('pieces_prices')
        .select('*')
        .eq('pri_piece_id', pieceId);
        
      console.log(
        '📊 pieces_prices résultats:',
        pricesResult2.data?.length || 0,
      );
      if (pricesResult2.data?.length && pricesResult2.data.length > 0) {
        console.log('📋 Premier prix (table prices):', pricesResult2.data[0]);
      }
      
      // Test avec conversion string/number
      const pricesResult3 = await this.client
        .from('pieces_price')
        .select('*')
        .eq('pri_piece_id', pieceId);
        
      console.log(
        '📊 pieces_price (number) résultats:',
        pricesResult3.data?.length || 0,
      );
      
      return createSuccessResponse({
        piece_id: pieceId,
        prices_table1: pricesResult1.data?.length || 0,
        prices_table2: pricesResult2.data?.length || 0,
        prices_table3: pricesResult3.data?.length || 0,
        sample: pricesResult1.data?.[0] || pricesResult2.data?.[0] || null
      }, 'Test des prix terminé avec succès');
      
    } catch (error: any) {
      console.error('❌ Erreur test prix:', error);
      return createErrorResponse(
        'TEST_PRICE_ERROR',
        'Erreur lors du test de prix',
        error.message
      );
    }
  }
}
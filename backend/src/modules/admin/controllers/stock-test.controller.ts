import { Controller, Get, Logger } from '@nestjs/common';
import { StockManagementService } from '../services/stock-management.service';

@Controller('api/admin/stock-test')
export class StockTestController {
  private readonly logger = new Logger(StockTestController.name);

  constructor(private readonly stockService: StockManagementService) {}

  @Get('health')
  async health() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'stock-test',
    };
  }

  @Get('simple-stock')
  async getSimpleStock() {
    try {
      this.logger.debug('Test simple récupération stock');
      
      // Test très basique - récupérer juste les données stock
      const { data, error } = await this.stockService.client
        .from('stock')
        .select('*')
        .limit(5);

      if (error) {
        throw new Error(`Erreur base: ${error.message}`);
      }

      return {
        success: true,
        data: data || [],
        count: data?.length || 0,
      };
    } catch (error) {
      this.logger.error('Erreur test stock', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  @Get('real-tables')
  async getRealTables() {
    try {
      this.logger.debug('Test tables qui existent vraiment');
      
      // Test avec une table qui existe : ___xtr_customer
      const { data, error } = await this.stockService.client
        .from('___xtr_customer')
        .select('cst_id, cst_mail, cst_fname, cst_name')
        .limit(3);

      if (error) {
        throw new Error(`Erreur customers: ${error.message}`);
      }

      return {
        success: true,
        data: data || [],
        count: data?.length || 0,
        message: 'Table ___xtr_customer accessible'
      };
    } catch (error) {
      this.logger.error('Erreur test tables réelles', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

    @Get('test-pieces')
  async testPieces() {
    try {
      this.logger.debug('Test table pieces réelle');
      
      const { data, error } = await this.stockService.client
        .from('pieces')
        .select('piece_id, piece_ref, piece_name, piece_des')
        .limit(3);

      if (error) {
        throw new Error(`Erreur pieces: ${error.message}`);
      }

      return {
        success: true,
        data: data || [],
        count: data?.length || 0,
        message: 'Table pieces accessible',
      };
    } catch (error) {
      this.logger.error('Erreur test pieces', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  @Get('test-pieces-price')
  async testPiecesPrice() {
    try {
      this.logger.debug('Test table pieces_price');
      
      const { data, error } = await this.stockService.client
        .from('pieces_price')
        .select('*')
        .limit(2);

      if (error) {
        throw new Error(`Erreur pieces_price: ${error.message}`);
      }

      return {
        success: true,
        data: data || [],
        count: data?.length || 0,
        columns: data && data.length > 0 ? Object.keys(data[0]) : [],
        message: 'Table pieces_price accessible',
      };
    } catch (error) {
      this.logger.error('Erreur test pieces_price', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
}

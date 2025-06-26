import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards,
  Logger
} from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateStockDto, UpdateStockDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('stock')
@UseGuards(JwtAuthGuard)
export class StockController {
  private readonly logger = new Logger(StockController.name);

  constructor(private readonly stockService: StockService) {}

  @Get('stats')
  async getStats() {
    this.logger.log('GET /stock/stats - Récupération des statistiques');
    return this.stockService.getStockStats();
  }

  @Post()
  async create(@Body() createStockDto: CreateStockDto) {
    this.logger.log('POST /stock - Création d\'un stock', { pieceId: createStockDto.pieceId });
    return this.stockService.create(createStockDto);
  }

  @Get()
  async findAll() {
    this.logger.log('GET /stock - Liste des stocks');
    return this.stockService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const stockId = parseInt(id, 10);
    this.logger.log(`GET /stock/${stockId} - Détail du stock`);
    return this.stockService.findOne(stockId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateStockDto: UpdateStockDto) {
    const stockId = parseInt(id, 10);
    this.logger.log(`PATCH /stock/${stockId} - Mise à jour du stock`);
    return this.stockService.update(stockId, updateStockDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const stockId = parseInt(id, 10);
    this.logger.log(`DELETE /stock/${stockId} - Suppression du stock`);
    return this.stockService.remove(stockId);
  }

  @Patch(':id/quantity')
  async updateQuantity(
    @Param('id') id: string, 
    @Body() body: { quantity: number }
  ) {
    const stockId = parseInt(id, 10);
    this.logger.log(`PATCH /stock/${stockId}/quantity - Mise à jour quantité`, { 
      quantity: body.quantity 
    });
    return this.stockService.updateQuantity(stockId, body.quantity);
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockDto, UpdateStockDto } from './dto';

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(private prisma: PrismaService) {}

  async getStockStats(): Promise<any> {
    this.logger.log('Récupération des statistiques de stock');

    try {
      const [referencesOnSale, referencesInStock, referencesStockOk, referencesStockOut] = await Promise.all([
        this.prisma.piece.count({ where: { displayed: true } }),
        this.prisma.stock.count(),
        this.prisma.stock.count({ where: { quantity: { gt: 0 } } }),
        this.prisma.stock.count({ where: { quantity: 0 } })
      ]);

      const stats = {
        referencesOnSale,
        referencesInStock,
        referencesStockOk,
        referencesStockOut
      };

      this.logger.log('Statistiques récupérées', { stats });
      return stats;
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des statistiques', error);
      throw error;
    }
  }

  async findAll() {
    this.logger.log('Récupération de la liste des stocks');

    const stocks = await this.prisma.stock.findMany({
      include: {
        piece: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    this.logger.log(`${stocks.length} stocks récupérés`);
    return stocks;
  }

  async findOne(id: number) {
    const stock = await this.prisma.stock.findUnique({
      where: { id },
      include: { piece: true }
    });

    if (!stock) {
      throw new NotFoundException(`Stock avec l'ID ${id} non trouvé`);
    }

    return stock;
  }

  async create(createStockDto: CreateStockDto) {
    this.logger.log('Création d\'un nouveau stock', { 
      pieceId: createStockDto.pieceId 
    });

    const stock = await this.prisma.stock.create({
      data: {
        pieceId: createStockDto.pieceId,
        quantity: createStockDto.quantity,
        unitPrice: createStockDto.unitPrice || 0,
        supplierRef: createStockDto.supplierRef || '',
        location: createStockDto.location || ''
      },
      include: { piece: true }
    });

    this.logger.log(`Stock créé avec succès`, { stockId: stock.id });
    return stock;
  }

  async update(id: number, updateStockDto: UpdateStockDto) {
    // Vérifier que le stock existe
    await this.findOne(id);

    const stock = await this.prisma.stock.update({
      where: { id },
      data: updateStockDto,
      include: { piece: true }
    });

    this.logger.log(`Stock ${id} mis à jour`);
    return stock;
  }

  async remove(id: number) {
    // Vérifier que le stock existe
    await this.findOne(id);

    await this.prisma.stock.delete({
      where: { id }
    });

    this.logger.log(`Stock ${id} supprimé`);
    return { message: `Stock ${id} supprimé avec succès` };
  }

  async updateQuantity(id: number, quantity: number) {
    const stock = await this.update(id, { quantity });
    this.logger.log(`Quantité mise à jour pour le stock ${id}: ${quantity}`);
    return stock;
  }
}

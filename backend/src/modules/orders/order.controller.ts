import { Controller, Get, Query } from '@nestjs/common';
import { OrderService } from '../../database/services/order.service';
import { RedisCacheService } from '../../database/services/redis-cache.service';

@Controller('api/orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  @Get()
  async getOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '10', 10);

    // Clé de cache unique pour cette requête
    const cacheKey = `orders:${pageNum}:${limitNum}:${status || 'all'}:${search || ''}`;

    // Essayer de récupérer depuis Redis
    const cached = await this.redisCacheService.get(cacheKey);
    if (cached) {
      console.log('✅ Données servies depuis Redis');
      return cached;
    }

    // Si pas en cache, récupérer depuis la DB
    console.log('📊 Récupération depuis la base de données...');
    const result = await this.orderService.getOrdersWithDetails(
      pageNum,
      limitNum,
      status,
      search,
    );

    // Mettre en cache pour 5 minutes
    await this.redisCacheService.set(cacheKey, result, 300);

    return result;
  }

  // ...existing code...
}

import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards,
  Request,
  Logger
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto, CartValidationDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  private readonly logger = new Logger(CartController.name);

  constructor(private readonly cartService: CartService) {}

  @Post('add')
  async addToCart(@Request() req, @Body() addToCartDto: AddToCartDto) {
    const userId = req.user.id;
    this.logger.log('POST /cart/add - Ajout au panier', { 
      userId, 
      pieceId: addToCartDto.pieceId,
      quantity: addToCartDto.quantity 
    });
    return this.cartService.addToCart(userId, addToCartDto);
  }

  @Get()
  async getCart(@Request() req) {
    const userId = req.user.id;
    this.logger.log('GET /cart - Récupération du panier', { userId });
    return this.cartService.getCart(userId);
  }

  @Patch('item/:id')
  async updateCartItem(
    @Request() req,
    @Param('id') id: string, 
    @Body() updateDto: UpdateCartItemDto
  ) {
    const userId = req.user.id;
    const itemId = parseInt(id, 10);
    this.logger.log(`PATCH /cart/item/${itemId} - Mise à jour article`, { userId, itemId });
    return this.cartService.updateCartItem(userId, itemId, updateDto);
  }

  @Delete('item/:id')
  async removeFromCart(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    const itemId = parseInt(id, 10);
    this.logger.log(`DELETE /cart/item/${itemId} - Suppression article`, { userId, itemId });
    return this.cartService.removeFromCart(userId, itemId);
  }

  @Delete('clear')
  async clearCart(@Request() req) {
    const userId = req.user.id;
    this.logger.log('DELETE /cart/clear - Vidage du panier', { userId });
    return this.cartService.clearCart(userId);
  }

  @Post('validate')
  async validateCart(@Request() req, @Body() validationDto: CartValidationDto) {
    const userId = req.user.id;
    this.logger.log('POST /cart/validate - Validation du panier', { 
      userId,
      customerEmail: validationDto.customerEmail 
    });
    return this.cartService.validateCart(userId, validationDto);
  }

  @Get('count')
  async getCartCount(@Request() req) {
    const userId = req.user.id;
    const cart = await this.cartService.getCart(userId);
    this.logger.log('GET /cart/count - Nombre d\'articles', { 
      userId, 
      count: cart.totalItems 
    });
    return { count: cart.totalItems };
  }
}

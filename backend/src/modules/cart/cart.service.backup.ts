import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddToCartDto, UpdateCartItemDto, CartSummaryDto, CartValidationDto } from './dto';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(private prisma: PrismaService) {}

  async addToCart(userId: number, addToCartDto: AddToCartDto): Promise<any> {
    this.logger.log('Ajout au panier', { 
      userId,
      pieceId: addToCartDto.pieceId,
      quantity: addToCartDto.quantity
    });

    try {
      // Vérifier si l'article existe déjà dans le panier
      const existingItem = await this.prisma.cartItem.findFirst({
        where: {
          userId,
          pieceId: addToCartDto.pieceId
        }
      });

      let cartItem;

      if (existingItem) {
        // Mettre à jour la quantité
        cartItem = await this.prisma.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: existingItem.quantity + addToCartDto.quantity,
            updatedAt: new Date()
          },
          include: {
            piece: {
              include: { brand: true }
            }
          }
        });
      } else {
        // Créer un nouvel article
        cartItem = await this.prisma.cartItem.create({
          data: {
            userId,
            pieceId: addToCartDto.pieceId,
            quantity: addToCartDto.quantity,
            unitPrice: addToCartDto.price,
            reference: addToCartDto.reference,
            supplierRef: addToCartDto.supplierRef || '',
            equipmentId: addToCartDto.equipmentId
          },
          include: {
            piece: {
              include: { brand: true }
            }
          }
        });
      }

      // MCP Audit
      await MCPAuth.audit({
        action: 'CART_ITEM_ADDED',
        contextId: mcpContext.id,
        userId,
        data: {
          cartItemId: cartItem.id,
          pieceId: addToCartDto.pieceId,
          quantity: addToCartDto.quantity,
          price: addToCartDto.price
        }
      });

      return cartItem;
    } catch (error) {
      this.logger.error('Erreur lors de l\'ajout au panier', error);
      throw error;
    }
  }

  async getCart(userId: number): Promise<CartSummaryDto> {
    const mcpContext = this.contextManager.getContext({
      action: 'get_cart',
      version: '1.0',
      userId: userId.toString()
    });

    this.logger.log('Récupération du panier', { contextId: mcpContext.id, userId });

    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        piece: {
          include: { brand: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calcul des totaux
    let subtotal = 0;
    const items = cartItems.map(item => {
      const totalPrice = item.quantity * item.unitPrice;
      subtotal += totalPrice;

      return {
        pieceId: item.pieceId,
        pieceName: item.piece.name,
        reference: item.reference,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice,
        brandName: item.piece.brand?.name || '',
        brandLogo: item.piece.brand?.logo || '',
        availability: 'In Stock' // À adapter selon votre logique
      };
    });

    const shipping = this.calculateShipping(subtotal);
    const total = subtotal + shipping;

    const cartSummary: CartSummaryDto = {
      items,
      totalItems: cartItems.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      shipping,
      total,
      currency: 'EUR'
    };

    await MCPAuth.audit({
      action: 'CART_RETRIEVED',
      contextId: mcpContext.id,
      userId,
      data: {
        itemCount: cartSummary.totalItems,
        total: cartSummary.total
      }
    });

    return cartSummary;
  }

  async updateCartItem(userId: number, itemId: number, updateDto: UpdateCartItemDto): Promise<any> {
    const mcpContext = this.contextManager.getContext({
      action: 'update_cart_item',
      version: '1.0',
      userId: userId.toString()
    });

    // Vérifier que l'article appartient à l'utilisateur
    const existingItem = await this.prisma.cartItem.findFirst({
      where: { id: itemId, userId }
    });

    if (!existingItem) {
      throw new NotFoundException(`Article de panier ${itemId} non trouvé`);
    }

    const updatedItem = await this.prisma.cartItem.update({
      where: { id: itemId },
      data: updateDto,
      include: {
        piece: {
          include: { brand: true }
        }
      }
    });

    await MCPAuth.audit({
      action: 'CART_ITEM_UPDATED',
      contextId: mcpContext.id,
      userId,
      data: {
        itemId,
        changes: updateDto
      }
    });

    return updatedItem;
  }

  async removeFromCart(userId: number, itemId: number): Promise<{ message: string }> {
    const mcpContext = this.contextManager.getContext({
      action: 'remove_from_cart',
      version: '1.0',
      userId: userId.toString()
    });

    // Vérifier que l'article appartient à l'utilisateur
    const existingItem = await this.prisma.cartItem.findFirst({
      where: { id: itemId, userId }
    });

    if (!existingItem) {
      throw new NotFoundException(`Article de panier ${itemId} non trouvé`);
    }

    await this.prisma.cartItem.delete({
      where: { id: itemId }
    });

    await MCPAuth.audit({
      action: 'CART_ITEM_REMOVED',
      contextId: mcpContext.id,
      userId,
      data: { itemId, pieceId: existingItem.pieceId }
    });

    this.logger.log(`Article ${itemId} supprimé du panier`, { contextId: mcpContext.id, userId });

    return { message: `Article supprimé du panier` };
  }

  async clearCart(userId: number): Promise<{ message: string }> {
    const mcpContext = this.contextManager.getContext({
      action: 'clear_cart',
      version: '1.0',
      userId: userId.toString()
    });

    const deletedCount = await this.prisma.cartItem.deleteMany({
      where: { userId }
    });

    await MCPAuth.audit({
      action: 'CART_CLEARED',
      contextId: mcpContext.id,
      userId,
      data: { deletedItems: deletedCount.count }
    });

    this.logger.log(`Panier vidé - ${deletedCount.count} articles supprimés`, { 
      contextId: mcpContext.id, 
      userId 
    });

    return { message: `Panier vidé - ${deletedCount.count} articles supprimés` };
  }

  async validateCart(userId: number, validationDto: CartValidationDto): Promise<any> {
    const mcpContext = this.contextManager.getContext({
      action: 'validate_cart',
      version: '1.0',
      userId: userId.toString()
    });

    // Récupérer le panier actuel
    const cart = await this.getCart(userId);

    if (cart.totalItems === 0) {
      throw new Error('Le panier est vide');
    }

    // Créer une commande (à adapter selon votre logique)
    const order = await this.prisma.order.create({
      data: {
        userId,
        customerEmail: validationDto.customerEmail,
        customerName: validationDto.customerName,
        deliveryAddress: validationDto.deliveryAddress || '',
        notes: validationDto.notes || '',
        subtotal: cart.subtotal,
        shipping: cart.shipping,
        total: cart.total,
        status: 'PENDING',
        items: {
          create: cart.items.map(item => ({
            pieceId: item.pieceId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            reference: item.reference
          }))
        }
      },
      include: { items: true }
    });

    // Vider le panier après validation
    await this.clearCart(userId);

    await MCPAuth.audit({
      action: 'CART_VALIDATED',
      contextId: mcpContext.id,
      userId,
      data: {
        orderId: order.id,
        total: order.total,
        itemCount: cart.totalItems
      }
    });

    this.logger.log(`Panier validé - Commande ${order.id} créée`, { 
      contextId: mcpContext.id, 
      userId 
    });

    return order;
  }

  private calculateShipping(subtotal: number): number {
    // Logique de calcul des frais de port
    if (subtotal >= 100) return 0; // Livraison gratuite
    if (subtotal >= 50) return 5;
    return 10;
  }
}

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

      this.logger.log('Article ajouté au panier avec succès', { cartItemId: cartItem.id });
      return cartItem;
    } catch (error) {
      this.logger.error('Erreur lors de l\'ajout au panier', error);
      throw error;
    }
  }

  async getCart(userId: number): Promise<CartSummaryDto> {
    this.logger.log('Récupération du panier', { userId });

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
        availability: 'In Stock'
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

    this.logger.log('Panier récupéré', { itemCount: cartSummary.totalItems, total: cartSummary.total });
    return cartSummary;
  }

  async updateCartItem(userId: number, itemId: number, updateDto: UpdateCartItemDto): Promise<any> {
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

    this.logger.log('Article de panier mis à jour', { itemId, changes: updateDto });
    return updatedItem;
  }

  async removeFromCart(userId: number, itemId: number): Promise<{ message: string }> {
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

    this.logger.log(`Article ${itemId} supprimé du panier`, { userId });
    return { message: `Article supprimé du panier` };
  }

  async clearCart(userId: number): Promise<{ message: string }> {
    const deletedCount = await this.prisma.cartItem.deleteMany({
      where: { userId }
    });

    this.logger.log(`Panier vidé - ${deletedCount.count} articles supprimés`, { userId });
    return { message: `Panier vidé - ${deletedCount.count} articles supprimés` };
  }

  async validateCart(userId: number, validationDto: CartValidationDto): Promise<any> {
    // Récupérer le panier actuel
    const cart = await this.getCart(userId);

    if (cart.totalItems === 0) {
      throw new Error('Le panier est vide');
    }

    // Créer une commande
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

    this.logger.log(`Panier validé - Commande ${order.id} créée`, { userId });
    return order;
  }

  private calculateShipping(subtotal: number): number {
    // Logique de calcul des frais de port
    if (subtotal >= 100) return 0; // Livraison gratuite
    if (subtotal >= 50) return 5;
    return 10;
  }
}

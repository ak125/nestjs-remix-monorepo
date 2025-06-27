/**
 * MCP GENERATED SERVICE - RESELLER PROTECTED
 * Généré automatiquement par MCP Context-7
 * Module: reseller-ecommerce
 * Sécurité: Logique métier revendeurs
 * Source: massdoc/mycart.php
 */
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ResellerMycartShowDto } from './dto/reseller-mycart-show.dto';

@Injectable()
export class ResellerMycartShowService {
  constructor(private prisma: PrismaService) {}

  async showResellerCart(query: any) {
    try {
      // Vérification supplémentaire côté service
      if (!query.resellerId) {
        throw new ForbiddenException('ID revendeur requis');
      }

      const cartItems = await this.prisma.resellerCart.findMany({
        where: { 
          resellerId: query.resellerId,
          status: 'active'
        },
        include: { 
          product: true,
          resellerDiscount: true // Remises spéciales revendeurs
        }
      });

      return {
        status: 'success',
        data: cartItems,
        module: 'reseller-ecommerce',
        security: 'reseller-protected',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error in ResellerMycartShowService.showResellerCart: ${error.message}`);
    }
  }

  async addToResellerCart(dto: ResellerMycartShowDto) {
    try {
      // Validation sécurité revendeur
      const reseller = await this.prisma.reseller.findUnique({
        where: { id: dto.resellerId },
        include: { discountTiers: true }
      });

      if (!reseller || !reseller.isActive) {
        throw new ForbiddenException('Revendeur non autorisé');
      }

      const cartItem = await this.prisma.resellerCart.create({
        data: {
          resellerId: dto.resellerId,
          productId: dto.productId,
          quantity: dto.quantity || 1,
          resellerPrice: dto.resellerPrice, // Prix revendeur
          discountPercent: reseller.discountTiers[0]?.percentage || 0
        }
      });

      return {
        status: 'success',
        data: cartItem,
        module: 'reseller-ecommerce',
        security: 'reseller-protected',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error in ResellerMycartShowService.addToResellerCart: ${error.message}`);
    }
  }

  async getResellerDiscounts(query: any) {
    try {
      const discounts = await this.prisma.resellerDiscount.findMany({
        where: { resellerId: query.resellerId, isActive: true },
        include: { product: true }
      });

      return {
        status: 'success',
        data: discounts,
        module: 'reseller-ecommerce',
        security: 'reseller-protected',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error in ResellerMycartShowService.getResellerDiscounts: ${error.message}`);
    }
  }

  async validateResellerCart(dto: ResellerMycartShowDto) {
    try {
      // Validation finale avant commande revendeur
      const cartValidation = await this.prisma.resellerCart.findMany({
        where: { 
          resellerId: dto.resellerId,
          status: 'active'
        },
        include: { 
          product: { include: { stock: true } },
          resellerDiscount: true
        }
      });

      const validationResults = cartValidation.map(item => ({
        productId: item.productId,
        available: item.product.stock.quantity >= item.quantity,
        resellerPriceValid: item.resellerPrice > 0,
        discountApplied: item.discountPercent > 0
      }));

      return {
        status: 'success',
        data: {
          isValid: validationResults.every(r => r.available && r.resellerPriceValid),
          items: validationResults,
          totalItems: cartValidation.length
        },
        module: 'reseller-ecommerce',
        security: 'reseller-protected',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error in ResellerMycartShowService.validateResellerCart: ${error.message}`);
    }
  }
}

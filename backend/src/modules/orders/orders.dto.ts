/**
 * DTOs pour le module Orders
 * Utilise les types Zod inférés directement sans classes
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  OrderStatus,
  PaymentStatus,
  DeliveryMethod,
  // Types inférés automatiquement de Zod
  DeliveryAddress,
  OrderItem,
  CreateOrder,
  UpdateOrder,
  SearchOrders,
  UserOrders,
  OrderCalculationItem,
  CalculateOrder,
} from './schemas/orders.schemas';

// Types d'entrée pour les requêtes (utilise les types Zod)
export type DeliveryAddressDto = DeliveryAddress;
export type OrderItemDto = OrderItem;
export type CreateOrderDto = CreateOrder;
export type UpdateOrderDto = UpdateOrder;
export type SearchOrdersDto = SearchOrders;
export type UserOrdersDto = UserOrders;
export type OrderCalculationItemDto = OrderCalculationItem;
export type CalculateOrderDto = CalculateOrder;

// Types de réponse pour Swagger (avec décorateurs)
export class OrderResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'ORD-2024-001' })
  orderNumber!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  userId!: string;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PENDING })
  status!: OrderStatus;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PENDING })
  paymentStatus!: PaymentStatus;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  items!: OrderItemDto[];

  @ApiProperty({ example: 119.98 })
  subtotalPrice!: number;

  @ApiProperty({ example: 5.99 })
  deliveryPrice!: number;

  @ApiProperty({ example: 0 })
  discountAmount!: number;

  @ApiProperty({ example: 125.97 })
  totalPrice!: number;

  @ApiProperty({ type: 'object', additionalProperties: true })
  deliveryAddress!: DeliveryAddressDto;

  @ApiProperty({ enum: DeliveryMethod, example: DeliveryMethod.STANDARD })
  deliveryMethod!: DeliveryMethod;

  @ApiPropertyOptional({ example: 'FR123456789' })
  trackingNumber?: string;

  @ApiPropertyOptional({ example: '2024-12-25T10:00:00Z' })
  deliveryDate?: string;

  @ApiPropertyOptional({ example: 'Livrer avant 18h' })
  notes?: string;

  @ApiPropertyOptional({ example: 'WELCOME10' })
  promocode?: string;

  @ApiProperty({ example: '2024-12-20T10:00:00Z' })
  createdAt!: string;

  @ApiProperty({ example: '2024-12-20T10:00:00Z' })
  updatedAt!: string;
}

export class OrderCalculationResponseDto {
  @ApiProperty({ example: 119.98 })
  subtotalPrice!: number;

  @ApiProperty({ example: 5.99 })
  deliveryPrice!: number;

  @ApiProperty({ example: 0 })
  discountAmount!: number;

  @ApiProperty({ example: 125.97 })
  totalPrice!: number;

  @ApiPropertyOptional({ example: 'WELCOME10' })
  promocodeApplied?: string;

  @ApiProperty({ example: true })
  promocodeValid!: boolean;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  items!: OrderItemDto[];
}

export class PaginatedOrdersResponseDto {
  @ApiProperty({ type: [OrderResponseDto] })
  orders!: OrderResponseDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 45 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;

  @ApiProperty({ example: true })
  hasNext!: boolean;

  @ApiProperty({ example: false })
  hasPrevious!: boolean;
}

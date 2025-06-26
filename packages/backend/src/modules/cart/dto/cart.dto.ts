import { IsNumber, IsOptional, IsString, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AddToCartDto {
  @IsNumber()
  pieceId: number;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  price: number;

  @IsString()
  reference: string;

  @IsOptional()
  @IsString()
  supplierRef?: string;

  @IsOptional()
  @IsNumber()
  equipmentId?: number;
}

export class UpdateCartItemDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  price?: number;
}

export class CartItemDto {
  @IsNumber()
  pieceId: number;

  @IsString()
  pieceName: string;

  @IsString()
  reference: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unitPrice: number;

  @IsNumber()
  totalPrice: number;

  @IsOptional()
  @IsString()
  brandName?: string;

  @IsOptional()
  @IsString()
  brandLogo?: string;

  @IsOptional()
  @IsString()
  availability?: string;
}

export class CartSummaryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @IsNumber()
  totalItems: number;

  @IsNumber()
  subtotal: number;

  @IsNumber()
  shipping: number;

  @IsNumber()
  total: number;

  @IsString()
  currency: string;
}

export class CartValidationDto {
  @IsString()
  customerEmail: string;

  @IsString()
  customerName: string;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

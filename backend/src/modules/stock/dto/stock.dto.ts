import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStockDto {
  @ApiProperty({ description: 'ID de la pièce' })
  @IsNumber()
  pieceId: number;

  @ApiProperty({ description: 'Quantité en stock' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ description: 'Prix unitaire' })
  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Référence fournisseur' })
  @IsOptional()
  @IsString()
  supplierRef?: string;

  @ApiPropertyOptional({ description: 'Emplacement en stock' })
  @IsOptional()
  @IsString()
  location?: string;
}

export class UpdateStockDto {
  @ApiPropertyOptional({ description: 'Quantité en stock' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Prix unitaire' })
  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Référence fournisseur' })
  @IsOptional()
  @IsString()
  supplierRef?: string;

  @ApiPropertyOptional({ description: 'Emplacement en stock' })
  @IsOptional()
  @IsString()
  location?: string;
}

export class StockStatsDto {
  @ApiProperty({ description: 'Références en vente' })
  referencesOnSale: number;

  @ApiProperty({ description: 'Références en stock' })
  referencesInStock: number;

  @ApiProperty({ description: 'Références stock OK (qté > 0)' })
  referencesStockOk: number;

  @ApiProperty({ description: 'Références stock OUT (qté = 0)' })
  referencesStockOut: number;
}

export class StockResponseDto {
  @ApiProperty({ description: 'ID du stock' })
  id: number;

  @ApiProperty({ description: 'ID de la pièce' })
  pieceId: number;

  @ApiProperty({ description: 'Quantité en stock' })
  quantity: number;

  @ApiProperty({ description: 'Prix unitaire' })
  unitPrice: number;

  @ApiProperty({ description: 'Référence fournisseur' })
  supplierRef: string;

  @ApiProperty({ description: 'Emplacement en stock' })
  location: string;

  @ApiProperty({ description: 'Date de création' })
  createdAt: Date;

  @ApiProperty({ description: 'Date de mise à jour' })
  updatedAt: Date;
}

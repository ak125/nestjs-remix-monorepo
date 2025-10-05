import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO pour les callbacks Cyberplus/BNP
 */
export class CyberplusCallbackDto {
  @ApiProperty({
    description: 'ID de la transaction Cyberplus',
    example: 'CYB_1696502400_ABC123',
  })
  @IsString()
  transaction_id!: string;

  @ApiProperty({
    description: 'ID de la commande',
    example: 'ORD_2023_001234',
  })
  @IsString()
  order_id!: string;

  @ApiProperty({
    description: 'Statut du paiement',
    example: 'success',
  })
  @IsString()
  status!: string;

  @ApiProperty({
    description: 'Code statut numérique',
    example: '00',
    required: false,
  })
  @IsOptional()
  @IsString()
  statuscode?: string;

  @ApiProperty({
    description: 'Montant du paiement (en euros)',
    example: 99.99,
  })
  @IsNumber()
  amount!: number;

  @ApiProperty({
    description: 'Devise (ISO 4217)',
    example: 'EUR',
    required: false,
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: 'Méthode de paiement utilisée',
    example: 'CB',
    required: false,
  })
  @IsOptional()
  @IsString()
  payment_method?: string;

  @ApiProperty({
    description: 'Signature HMAC pour validation',
    example: 'a3b2c1d4e5f6...',
  })
  @IsString()
  signature!: string;

  @ApiProperty({
    description: 'Adresse IP du client',
    required: false,
  })
  @IsOptional()
  @IsString()
  ip?: string;

  @ApiProperty({
    description: 'Adresse IP du serveur Cyberplus',
    required: false,
  })
  @IsOptional()
  @IsString()
  ips?: string;

  @ApiProperty({
    description: 'Date du paiement (ISO 8601)',
    required: false,
  })
  @IsOptional()
  @IsString()
  date_payment?: string;

  @ApiProperty({
    description: 'Données additionnelles',
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

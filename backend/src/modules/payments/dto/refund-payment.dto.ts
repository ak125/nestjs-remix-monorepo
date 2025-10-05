import { IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO pour les remboursements de paiement
 */
export class RefundPaymentDto {
  @ApiProperty({
    description: 'Montant du remboursement (si partiel)',
    example: 49.99,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiProperty({
    description: 'Raison du remboursement',
    example: 'Client insatisfait - Article défectueux',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

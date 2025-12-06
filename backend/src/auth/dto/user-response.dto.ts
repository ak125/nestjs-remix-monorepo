import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: 123,
  })
  id: number;

  @ApiProperty({
    description: 'User email',
    example: 'client@fafa-auto.fr',
  })
  email: string;

  @ApiProperty({
    description: 'Full name',
    example: 'Jean Dupont',
    required: false,
  })
  name?: string;

  @ApiProperty({
    description: 'User role',
    example: 'customer',
    enum: ['admin', 'customer', 'manager'],
  })
  role: string;

  @ApiProperty({
    description: 'Phone number',
    example: '+33612345678',
    required: false,
  })
  phone?: string;

  @ApiProperty({
    description: 'Account creation date',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: string;
}

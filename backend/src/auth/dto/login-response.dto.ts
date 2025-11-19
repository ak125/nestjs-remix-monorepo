import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
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
    description: 'Session created successfully',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Redirect URL after login',
    example: '/dashboard',
    required: false,
  })
  redirectUrl?: string;
}

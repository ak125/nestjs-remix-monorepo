import { ApiProperty } from '@nestjs/swagger';

export class LogoutResponseDto {
  @ApiProperty({
    description: 'Logout successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Status message',
    example: 'Logged out successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Session destroyed',
    example: true,
  })
  sessionDestroyed: boolean;
}

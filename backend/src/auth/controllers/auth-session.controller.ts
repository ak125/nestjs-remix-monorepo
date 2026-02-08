import { Controller, Get, Req, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { UserResponseDto } from '../dto/user-response.dto';

@ApiTags('auth')
@Controller()
export class AuthSessionController {
  private readonly logger = new Logger(AuthSessionController.name);

  /**
   * GET /auth/me
   * Récupérer l'utilisateur connecté
   */
  @Get('auth/me')
  @ApiOperation({
    summary: 'Get current authenticated user',
    description:
      'Returns the currently logged in user information from session.',
  })
  @ApiCookieAuth('connect.sid')
  @ApiResponse({
    status: 200,
    description: 'User information retrieved',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'User not authenticated',
    schema: {
      example: {
        success: false,
        error: 'Utilisateur non connecté',
        timestamp: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  async getCurrentUser(@Req() request: Express.Request) {
    if (request.user) {
      return {
        success: true,
        user: request.user,
        timestamp: new Date().toISOString(),
      };
    } else {
      return {
        success: false,
        error: 'Utilisateur non connecté',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /auth/validate-session
   * Valider la session utilisateur sans guard (pour éviter logique circulaire)
   */
  @Get('auth/validate-session')
  async validateSession(@Req() request: Express.Request) {
    try {
      if (
        request.isAuthenticated &&
        request.isAuthenticated() &&
        request.user
      ) {
        const user = request.user as any;

        return {
          valid: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            name: user.name,
            level: user.level,
            isAdmin: user.isAdmin,
            isPro: user.isPro,
            isActive: user.isActive,
          },
        };
      }

      return {
        valid: false,
        user: null,
      };
    } catch (error: unknown) {
      this.logger.error(`Session validation error: ${error}`);
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
        user: null,
      };
    }
  }
}

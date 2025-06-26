/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: welcome.php
 */

import { Controller, Get, Post, Session, Redirect, Render } from '@nestjs/common';
import { WelcomeService } from './welcome.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('welcome')
export class WelcomeController {
  constructor(private readonly welcomeService: WelcomeService) {}

  @Get()
  @AuthGuard()
  async welcome(@Session() session: any) {
    const authResult = await this.welcomeService.validateSession(
      session.log,
      session.mykey
    );

    if (!authResult.accessRequest) {
      return this.redirectToAccess(authResult.destinationLinkMsg);
    }

    return this.renderWelcome(authResult);
  }

  private redirectToAccess(message: string) {
    // Logique de redirection selon le message d'accès
    return { redirect: `/access?message=${message}` };
  }

  private renderWelcome(authResult: any) {
    return {
      title: 'Tableau de bord',
      message: 'Bienvenu sur votre tableau de bord',
      userInfo: authResult
    };
  }
}

import { Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { LocalAuthGuard } from './local-auth.guard';

@Controller() // Pas de préfixe = routes directes
export class AuthRootController {
  @UseGuards(LocalAuthGuard)
  @Post('authenticate')
  authenticate(@Req() request: Express.Request, @Res() response: Response) {
    console.log('--- POST /authenticate ---');
    console.log('User connecté:', request.user);

    if (!request.user) {
      console.log('Aucun utilisateur, redirection vers /');
      return response.redirect('/');
    }

    // Authentification réussie
    return response.json({
      success: true,
      user: request.user,
    });
  }
}

import { Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { LocalAuthGuard } from './local-auth.guard';

@Controller() // Pas de préfixe = route directe
export class AuthenticateController {
  @UseGuards(LocalAuthGuard)
  @Post('authenticate')
  login(@Req() request: Express.Request, @Res() response: Response) {
    console.log('--- POST /authenticate - Redirection conditionnelle ---');
    console.log('User connecté:', request.user);

    if (!request.user) {
      console.log('Aucun utilisateur, redirection vers /');
      return response.redirect('/');
    }

    console.log('Utilisateur authentifié, redirection vers /dashboard');
    return response.redirect('/dashboard');
  }
}

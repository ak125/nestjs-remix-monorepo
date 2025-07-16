import {
  Controller,
  Get,
  Next,
  Post,
  Req,
  Res,
  UseGuards,
  Body,
} from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { Request as ExpressRequest } from 'express';
import { LocalAuthGuard } from './local-auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('/authenticate')
  authenticateRedirect(@Res() response: Response) {
    console.log('Redirection /authenticate vers /login');
    response.redirect('/login');
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async loginPost(
    @Req() request: ExpressRequest,
    @Res() response: Response,
  ) {
    console.log('--- POST /auth/login SUCCES ---');
    console.log('User authenticated:', request.user);
    response.redirect('/');
  }

  @Post('logout')
  async logout(
    @Req() request: ExpressRequest,
    @Res() response: Response,
    @Next() next: NextFunction,
  ) {
    request.logOut(function (err) {
      if (err) {
        return next(err);
      }
      request.session.destroy(() => {
        response.clearCookie('connect.sid');
        response.redirect('/');
      });
    });
  }

  @Post('register')
  async register(@Body() body: any, @Res() res: Response) {
    try {
      const { email, firstname, lastname, password } = body;
      console.log('Register request:', { email, firstname, lastname });

      // Vérifier si l'utilisateur existe
      const existingUser = await this.authService.checkIfUserExists({
        email,
        withPassword: false,
        password: '',
      });

      if (existingUser && !existingUser.error) {
        return res.redirect('/register?error=user_exists');
      }

      // Créer l'utilisateur
      const newUser = await this.authService.createUser({
        email,
        firstName: firstname,
        lastName: lastname,
        password,
      });

      if (newUser) {
        console.log('User created successfully:', newUser);
        // Rediriger vers login avec l'email en query string et message succès
        return res.redirect(`/login?register=success&email=${encodeURIComponent(email)}`);
      }

      return res.redirect('/register?error=creation_failed');
    } catch (error) {
      console.error('Register error:', error);
      return res.redirect('/register?error=server_error');
    }
  }
}

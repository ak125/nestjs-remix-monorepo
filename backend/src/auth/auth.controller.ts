import {
  Controller,
  // Get,
  Next,
  Post,
  Redirect,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { LocalAuthGuard } from './local-auth.guard';

@Controller()
export class AuthController {
  @UseGuards(LocalAuthGuard)
  @Post('/authenticate')
  @Redirect('/')
  login() {}

  @Post('auth/logout')
  async logout(
    @Req() request: Express.Request,
    @Res() response: Response,
    @Next() next: NextFunction,
  ) {
    console.log('--- POST /auth/logout DÉBUT ---');
    console.log('User avant logout:', request.user);

    // this will ensure that re-using the old session id
    // does not have a logged in user
    request.logOut(function (err) {
      if (err) {
        console.error('Erreur logout:', err);
        return next(err);
      }
      console.log('LogOut réussi, user après:', request.user);

      // Ensure the session is destroyed and the user is redirected.
      request.session.destroy(() => {
        response.clearCookie('connect.sid'); // The name of the cookie where express/connect stores its session_id
        console.log('Session détruite et cookie effacé');
        console.log('--- POST /auth/logout REDIRECTION vers / ---');
        response.redirect('/'); // Redirect to website after logout
      });
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';

@Injectable()
export class CookieSerializer extends PassportSerializer {
  deserializeUser(payload: any, done: (err: any, user?: any) => void) {
    // console.log('deserializeUser', { payload });
    done(null, payload);
  }

  serializeUser(user: any, done: (err: any, user?: any) => void) {
    // console.log('serializeUser', { user });

    // Si user est undefined, false ou null, ne pas créer de session
    if (!user || user === false || user === null) {
      console.log('⚠️  User is undefined/false/null, no session created');
      return done(null, null);
    }

    done(null, user);
  }
}

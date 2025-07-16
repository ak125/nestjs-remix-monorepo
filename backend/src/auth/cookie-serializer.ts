import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';

@Injectable()
export class CookieSerializer extends PassportSerializer {
  deserializeUser(payload: any, done: (err: any, user?: any) => void) {
    console.log('deserializeUser', { payload });
    done(null, payload);
  }

  serializeUser(user: any, done: (err: any, user?: any) => void) {
    console.log('serializeUser', { user });
    done(null, user);
  }
}

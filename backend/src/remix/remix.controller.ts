import { getServerBuild } from '@fafa/frontend';
import { All, Controller, Next, Req, Res } from '@nestjs/common';
import { createRequestHandler } from '@remix-run/express';
import { NextFunction, Request, Response } from 'express';
import { RemixService } from './remix.service';

@Controller()
export class RemixController {
  constructor(private remixService: RemixService) {}

  @All('*')
  async handler(
    @Req() request: Request,
    @Res() response: Response,
    @Next() next: NextFunction,
  ) {
    console.log('--- RemixController handler ---');
    console.log('Request URL:', request.url);
    console.log('Request user:', request.user);
    console.log('Request session:', request.session);
    
    return createRequestHandler({
      build: await getServerBuild(),
      getLoadContext: () => ({
        user: request.user,
        remixService: this.remixService,
      }),
    })(request, response, next);
  }
}

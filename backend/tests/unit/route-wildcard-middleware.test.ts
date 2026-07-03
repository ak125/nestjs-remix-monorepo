/**
 * Route wildcard REGISTRATION + middleware scoping (PR-9f, Nest 11 / Express 5
 * / path-to-regexp 8).
 *
 * Mirrors the EXACT `forRoutes(...)` / `@All(...)` wildcard shapes used in the
 * app so that `app.init()` exercises path-to-regexp 8 parsing of every pattern:
 *   - `@All('{*path}')`                                  (RemixController catch-all)
 *   - `forRoutes('{*path}')`                             (AppModule, string form)
 *   - `forRoutes({ path: '{*path}', method: ALL })`      (bot-guard, mcp-validation)
 *   - `forRoutes({ path: 'api/diagnostic/*path', ... })` (vehicle-context, scoped)
 *
 * If any pattern were invalid under path-to-regexp 8 (e.g. legacy `'*'` /
 * `:p(.*)`), `app.init()` would throw — so this is a registration smoke test in
 * addition to a scoping assertion. Uses probe middlewares with zero external
 * deps (no Supabase/Redis), so it runs in-process and in CI.
 */
import {
  Controller,
  All,
  Injectable,
  Module,
  NestMiddleware,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
  INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

const globalStringHits: string[] = [];
const globalObjectHits: string[] = [];
const scopedHits: string[] = [];

@Injectable()
class GlobalStringProbe implements NestMiddleware {
  use(req: any, _res: any, next: () => void) {
    globalStringHits.push(req.originalUrl ?? req.url);
    next();
  }
}
@Injectable()
class GlobalObjectProbe implements NestMiddleware {
  use(req: any, _res: any, next: () => void) {
    globalObjectHits.push(req.originalUrl ?? req.url);
    next();
  }
}
@Injectable()
class ScopedProbe implements NestMiddleware {
  use(req: any, _res: any, next: () => void) {
    scopedHits.push(req.originalUrl ?? req.url);
    next();
  }
}

@Controller()
class CatchAllProbeController {
  @All('{*path}') // mirrors RemixController
  handle() {
    return { ok: true };
  }
}

@Module({ controllers: [CatchAllProbeController] })
class ProbeModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // string form (AppModule)
    consumer.apply(GlobalStringProbe).forRoutes('{*path}');
    // object form (bot-guard / mcp-validation)
    consumer
      .apply(GlobalObjectProbe)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
    // scoped named wildcards (vehicle-context)
    consumer.apply(ScopedProbe).forRoutes(
      { path: 'api/diagnostic/*path', method: RequestMethod.ALL },
      { path: 'api/v1/orientation/*path', method: RequestMethod.ALL },
    );
  }
}

describe('PR-9f wildcard registration + middleware scoping (path-to-regexp 8)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();
    app = mod.createNestApplication();
    // Throws here if any wildcard pattern is invalid under path-to-regexp 8.
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    globalStringHits.length = 0;
    globalObjectHits.length = 0;
    scopedHits.length = 0;
  });

  it('catch-all @All({*path}) matches root and arbitrary deep paths', async () => {
    expect((await request(app.getHttpServer()).get('/')).status).toBe(200);
    expect(
      (await request(app.getHttpServer()).get('/pieces/freinage/x/y')).status,
    ).toBe(200);
  });

  it('global wildcard middleware (string + object form) fire on root and any path', async () => {
    await request(app.getHttpServer()).get('/');
    await request(app.getHttpServer()).get('/anything/deep/here');
    for (const hits of [globalStringHits, globalObjectHits]) {
      expect(hits).toContain('/');
      expect(hits.some((u) => u.startsWith('/anything'))).toBe(true);
    }
  });

  it('scoped api/diagnostic/*path fires on its prefix but NOT on a sibling prefix', async () => {
    await request(app.getHttpServer()).get('/api/diagnostic/abc/def');
    expect(scopedHits.some((u) => u.startsWith('/api/diagnostic/'))).toBe(true);

    scopedHits.length = 0;
    await request(app.getHttpServer()).get('/api/diagnostics-sibling/abc');
    await request(app.getHttpServer()).get('/api/v1/other/abc');
    await request(app.getHttpServer()).get('/pieces/freinage');
    expect(scopedHits).toHaveLength(0);
  });

  it('scoped api/v1/orientation/*path fires on its prefix', async () => {
    await request(app.getHttpServer()).get('/api/v1/orientation/foo/bar');
    expect(scopedHits.some((u) => u.startsWith('/api/v1/orientation/'))).toBe(
      true,
    );
  });
});

import { Test } from '@nestjs/testing';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AnyOf } from './any-of.guard';

// ───────────────────────────────────────────────────────────────────
// Test stub guards
// ───────────────────────────────────────────────────────────────────

@Injectable()
class AlwaysAccept implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

@Injectable()
class AlwaysRejectWithUnauthorized implements CanActivate {
  canActivate(): boolean {
    throw new UnauthorizedException('A rejected');
  }
}

@Injectable()
class AlwaysRejectWithForbidden implements CanActivate {
  canActivate(): boolean {
    throw new ForbiddenException('B rejected');
  }
}

@Injectable()
class ReturnsFalse implements CanActivate {
  canActivate(): boolean {
    return false;
  }
}

@Injectable()
class AsyncAccept implements CanActivate {
  async canActivate(): Promise<boolean> {
    return true;
  }
}

function emptyCtx(): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({}) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

async function buildComposite(
  ...guards: Array<new () => CanActivate>
): Promise<CanActivate> {
  const Composite = AnyOf(...guards);
  const moduleRef = await Test.createTestingModule({
    providers: [Composite, ...guards],
  }).compile();
  return moduleRef.get(Composite);
}

// ───────────────────────────────────────────────────────────────────

describe('AnyOf composite guard', () => {
  it('returns true when first guard accepts (short-circuit)', async () => {
    const guard = await buildComposite(
      AlwaysAccept,
      AlwaysRejectWithUnauthorized,
    );
    await expect(guard.canActivate(emptyCtx())).resolves.toBe(true);
  });

  it('returns true when second guard accepts after first throws', async () => {
    const guard = await buildComposite(
      AlwaysRejectWithUnauthorized,
      AlwaysAccept,
    );
    await expect(guard.canActivate(emptyCtx())).resolves.toBe(true);
  });

  it('returns true with async guard at any position', async () => {
    const guard = await buildComposite(
      AlwaysRejectWithUnauthorized,
      AsyncAccept,
    );
    await expect(guard.canActivate(emptyCtx())).resolves.toBe(true);
  });

  it('throws the first error when all guards reject', async () => {
    const guard = await buildComposite(
      AlwaysRejectWithUnauthorized,
      AlwaysRejectWithForbidden,
    );
    await expect(guard.canActivate(emptyCtx())).rejects.toMatchObject({
      message: 'A rejected',
    });
  });

  it('throws UnauthorizedException when guards list is empty', async () => {
    const guard = await buildComposite();
    await expect(guard.canActivate(emptyCtx())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('treats guard returning false as a soft reject (continues to next)', async () => {
    const guard = await buildComposite(ReturnsFalse, AlwaysAccept);
    await expect(guard.canActivate(emptyCtx())).resolves.toBe(true);
  });

  it('throws first error even when last guard returned false silently', async () => {
    const guard = await buildComposite(
      AlwaysRejectWithUnauthorized,
      ReturnsFalse,
    );
    await expect(guard.canActivate(emptyCtx())).rejects.toMatchObject({
      message: 'A rejected',
    });
  });
});

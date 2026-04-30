import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { PermissionsService } from '../permissions.service';

function makeContext(user: any): ExecutionContext {
  const handler = () => undefined;
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => handler,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PermissionsGuard, PermissionsService, Reflector],
    }).compile();
    guard = moduleRef.get(PermissionsGuard);
    reflector = moduleRef.get(Reflector);
  });

  it('returns true when no @RequirePermission metadata', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    expect(guard.canActivate(makeContext({ level: 0 }))).toBe(true);
  });

  it('returns true when commercial (level 3) has canCancel', () => {
    jest.spyOn(reflector, 'get').mockReturnValue('canCancel');
    expect(guard.canActivate(makeContext({ level: 3 }))).toBe(true);
  });

  it('returns false when base user (level 1) lacks canCancel', () => {
    jest.spyOn(reflector, 'get').mockReturnValue('canCancel');
    expect(guard.canActivate(makeContext({ level: 1 }))).toBe(false);
  });

  it('returns false when user is undefined', () => {
    jest.spyOn(reflector, 'get').mockReturnValue('canCancel');
    expect(guard.canActivate(makeContext(undefined))).toBe(false);
  });

  it('returns true when admin (level 7) has canRefund', () => {
    jest.spyOn(reflector, 'get').mockReturnValue('canRefund');
    expect(guard.canActivate(makeContext({ level: 7 }))).toBe(true);
  });

  it('returns false when commercial (level 3) lacks canRefund', () => {
    jest.spyOn(reflector, 'get').mockReturnValue('canRefund');
    expect(guard.canActivate(makeContext({ level: 3 }))).toBe(false);
  });

  it('coerces string level to number', () => {
    jest.spyOn(reflector, 'get').mockReturnValue('canCancel');
    expect(guard.canActivate(makeContext({ level: '3' }))).toBe(true);
  });
});

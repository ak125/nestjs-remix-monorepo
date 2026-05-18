import { ArgumentMetadata, BadRequestException, Logger } from '@nestjs/common';
import { z } from 'zod';
import { BaseNumericParamPipe } from '../base-numeric-param.pipe';

/** Trivial concretization for isolated wrapper testing. */
class AcceptAllPipe extends BaseNumericParamPipe {
  protected readonly logger = new Logger(AcceptAllPipe.name);
  constructor() {
    // Schéma trivial : accepte tout, transforme en number constant.
    super(z.unknown().transform(() => 42));
  }
}

class RejectAllPipe extends BaseNumericParamPipe {
  protected readonly logger = new Logger(RejectAllPipe.name);
  constructor() {
    // Schéma qui jette toujours.
    super(z.unknown().refine(() => false, { message: 'always rejects' }));
  }
}

class ThrowRawErrorPipe extends BaseNumericParamPipe {
  protected readonly logger = new Logger(ThrowRawErrorPipe.name);
  constructor() {
    super(z.unknown().transform(() => 42));
  }
  override transform(_value: string, _metadata: ArgumentMetadata): number {
    // Simule une erreur runtime non-BadRequestException.
    throw new Error('raw runtime error');
  }
}

const paramMeta: ArgumentMetadata = {
  type: 'param',
  data: 'brandId',
  metatype: String,
};

describe('BaseNumericParamPipe (wrapper behavior)', () => {
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    debugSpy.mockRestore();
  });

  it('propagates ACCEPT result without logging', () => {
    const pipe = new AcceptAllPipe();
    const result = pipe.transform('whatever', paramMeta);
    expect(result).toBe(42);
    expect(typeof result).toBe('number');
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it('emits exactly one debug log when BadRequestException is thrown', () => {
    const pipe = new RejectAllPipe();
    expect(() => pipe.transform('mini-f56', paramMeta)).toThrow(
      BadRequestException,
    );
    expect(debugSpy).toHaveBeenCalledTimes(1);
    const message = debugSpy.mock.calls[0][0] as string;
    expect(message).toContain('param.brandId');
    expect(message).toContain('"mini-f56"');
  });

  it('safe-encodes rejected values containing quotes / control chars', () => {
    const pipe = new RejectAllPipe();
    expect(() => pipe.transform('"injected"\n\t', paramMeta)).toThrow(
      BadRequestException,
    );
    const message = debugSpy.mock.calls[0][0] as string;
    // JSON.stringify produces "\"injected\"\\n\\t" — no raw newline/quote leak.
    expect(message).toContain('"\\"injected\\"\\n\\t"');
    expect(message).not.toMatch(/\n[\t]/); // no literal newline in log line
  });

  it("uses 'unknown' when metadata.data is missing", () => {
    const pipe = new RejectAllPipe();
    expect(() =>
      pipe.transform('x', { type: 'param', data: undefined, metatype: String }),
    ).toThrow(BadRequestException);
    const message = debugSpy.mock.calls[0][0] as string;
    expect(message).toContain('param.unknown');
  });

  it('does NOT log non-BadRequestException errors (strict observability)', () => {
    const pipe = new ThrowRawErrorPipe();
    expect(() => pipe.transform('x', paramMeta)).toThrow('raw runtime error');
    expect(debugSpy).not.toHaveBeenCalled();
  });
});

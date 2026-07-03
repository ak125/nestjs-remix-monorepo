import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { splatToPath } from '../utils/splat-path.util';

/**
 * Extracts a path-to-regexp v8 wildcard parameter (`{*path}`) from the request
 * and returns it as a single, already-decoded path string with NO leading
 * slash (`''` for a root match).
 *
 * Replaces the legacy `@Param('path') + decodeURIComponent(...)` idiom: under
 * path-to-regexp v6 the wildcard was a single (already once-decoded) string;
 * under v8 it is a pre-decoded `string[]`. {@link splatToPath} normalises both
 * shapes and never double-decodes (CWE-174).
 *
 * The wildcard param name defaults to `path`; pass an explicit name for a
 * differently-named wildcard (e.g. `@SplatPath('url')` for `{*url}`).
 */
export const SplatPath = createParamDecorator(
  (paramName: string | undefined, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return splatToPath(request?.params?.[paramName ?? 'path']);
  },
);

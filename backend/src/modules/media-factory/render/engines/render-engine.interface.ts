/**
 * IRenderEngine — Pluggable render engine interface (P3-Lite).
 *
 * Any engine (stub, Remotion, FFmpeg) must implement this contract.
 */

import type { RenderRequest, RenderResult } from '../types/render.types';

export interface IRenderEngine {
  readonly name: string;
  readonly version: string;
  render(request: RenderRequest): Promise<RenderResult>;
}

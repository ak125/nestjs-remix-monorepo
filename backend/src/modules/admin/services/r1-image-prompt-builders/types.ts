/**
 * Types partagés entre les 5 builders R1 image prompt.
 */

// RagData centralisé — source unique dans rag-data.types.ts
import { type RagData } from '../rag-data.types';
export { type RagData } from '../rag-data.types';

export interface BuilderResult {
  prompt: string;
  neg: string;
  alt: string;
  caption: string | null;
  ragFieldsUsed: string[];
  richnessScore: number;
}

export type SlotBuilder = (
  pgName: string,
  rag: RagData | null,
) => BuilderResult;

// Negative prompts par intention visuelle (depuis P0.4)
export const NEG_PHOTO =
  'cartoon, illustration, clipart, sketch, diagram, infographic, low quality, watermark, blurry, text overlay, human hands, visible logo, brand name, 3D render';
export const NEG_SCHEMA =
  'photograph, photo, photorealistic, product catalog, studio lighting, depth of field, bokeh, cartoon, low quality, watermark, blurry, human hands, visible logo, brand name';

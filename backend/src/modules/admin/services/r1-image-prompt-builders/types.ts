/**
 * Types partagés entre les 5 builders R1 image prompt.
 */

export interface RagData {
  category?: string;
  domain?: {
    role?: string;
    confusion_with?: Array<{ term: string; difference: string }>;
    related_parts?: string[];
  };
  selection?: {
    criteria?: string[];
    cost_range?: { min: number; max: number; currency?: string };
    brands?: { premium?: string[]; standard?: string[] };
  };
  diagnostic?: {
    symptoms?: Array<{ id: string; label: string; severity: string }>;
  };
  maintenance?: {
    wear_signs?: string[];
    interval?: string;
  };
  installation?: {
    difficulty?: string;
    tools?: string[];
    steps?: string[];
    time?: string;
    prerequisite?: string;
  };
}

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

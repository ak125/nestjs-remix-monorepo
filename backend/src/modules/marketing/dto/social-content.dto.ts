import { z } from 'zod';
import type { ChannelVariants } from '../interfaces/marketing-hub.interfaces';

/** Runtime boundary for provider JSON; business approval remains a separate gate. */
export const socialContentSchemas = {
  instagram: z.object({
    caption: z.string().trim().min(1).max(2200),
    hashtags: z.array(z.string().trim().min(1)).max(30),
    format: z.enum(['carrousel', 'post', 'reel', 'story']),
    dimensions: z.enum(['1080x1080', '1080x1350', '1080x1920']),
    visual_brief: z.string().optional(),
    alt_text: z.string().optional(),
  }),
  facebook: z.object({
    caption: z.string().trim().min(1).max(500),
    hashtags: z.array(z.string().trim().min(1)).max(30),
    format: z.enum(['post', 'story', 'reel']),
    link_preview: z.boolean(),
  }),
  youtube: z.object({
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(5000),
    tags: z.array(z.string().trim().min(1)).max(30),
    format: z.enum(['short', 'video_long']),
    hook_script: z.string().optional(),
    thumbnail_brief: z.string().optional(),
  }),
} satisfies {
  [Channel in keyof ChannelVariants]-?: z.ZodType<
    NonNullable<ChannelVariants[Channel]>
  >;
};

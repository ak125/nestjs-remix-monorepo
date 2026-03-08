import { z } from "zod";

const GammeSchema = z
  .object({
    pg_id: z.number(),
    pg_alias: z.string(),
    pg_name: z.string(),
    pg_img: z.string().nullable().optional(),
  })
  .passthrough();

const FamilySchema = z
  .object({
    mf_id: z.number(),
    mf_name: z.string(),
    mf_pic: z.string().nullable().optional(),
    mf_description: z.string().nullable().optional(),
    gammes: z.array(GammeSchema).optional().default([]),
  })
  .passthrough();

const BrandSchema = z
  .object({
    marque_id: z.number(),
    marque_name: z.string(),
    marque_alias: z.string(),
    marque_logo: z.string().nullable().optional(),
  })
  .passthrough();

const EquipementierSchema = z
  .object({
    pm_name: z.string(),
    pm_logo: z.string().nullable().optional(),
  })
  .passthrough();

const BlogArticleSchema = z
  .object({
    ba_id: z.number(),
    ba_title: z.string(),
    ba_alias: z.string(),
    ba_descrip: z.string().nullable().optional(),
    ba_preview: z.string().nullable().optional(),
    ba_category: z.string().nullable().optional(),
    pg_name: z.string().nullable().optional(),
    pg_alias: z.string().nullable().optional(),
  })
  .passthrough();

export const HomepageRpcSchema = z
  .object({
    success: z.boolean().optional(),
    equipementiers: z.array(EquipementierSchema).optional().default([]),
    blog_articles: z.array(BlogArticleSchema).optional().default([]),
    catalog: z
      .object({
        families: z.array(FamilySchema).optional().default([]),
      })
      .passthrough()
      .optional(),
    brands: z.array(BrandSchema).optional().default([]),
  })
  .passthrough();

export type HomepageRpcData = z.infer<typeof HomepageRpcSchema>;
export type HomepageFamily = z.infer<typeof FamilySchema>;
export type HomepageBrand = z.infer<typeof BrandSchema>;
export type HomepageEquipementier = z.infer<typeof EquipementierSchema>;
export type HomepageBlogArticle = z.infer<typeof BlogArticleSchema>;

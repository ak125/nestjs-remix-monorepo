/**
 * Social Post Templates — composable TemplateKey = ${Pillar}:${Channel}:${Length}
 *
 * 6 templates MVP : catalogue + conseil x 3 canaux (IG/FB/YT)
 * Pattern identique a content-templates.ts : system + user(ctx) + sanitizeBriefField
 */

import type {
  TemplateKey,
  TemplateContext,
  ContentPillar,
  SocialChannel,
} from '../interfaces/marketing-hub.interfaces';

// Re-use sanitization from ai-content (anti-injection)
function sanitizeBriefField(value: string): string {
  return value
    .replace(/\n{2,}/g, '\n')
    .replace(
      /^(IMPORTANT|SYSTEM|USER|ASSISTANT|IGNORE|OUBLIE|FORGET)\s*:/gim,
      '[filtered]:',
    )
    .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, '[filtered]')
    .trim();
}

function sanitizeBriefArray(arr: string[] | undefined): string[] {
  return (arr ?? []).map(sanitizeBriefField);
}

export interface SocialPromptTemplate {
  key: TemplateKey;
  system: string;
  user: (ctx: TemplateContext) => string;
  maxLength: number;
}

// ── Shared fragments ──

const BRAND_SYSTEM = `Marque : Automecanik (e-commerce pieces auto, France).
Site : automecanik.com | +500 000 references.
Charte : rouge #FF3B30 (CTA), bleu #0F4C81 (fonds), vert #1FDC93 (promos).
Typo : Montserrat Bold (titres) + Inter Regular (corps).`;

const CLAIMS_RULES = `CLAIMS POLICY (STRICTE) :
- Prix : UNIQUEMENT si price_source fourni (valeur + table + date < 24h)
- Livraison : formulation exacte "Livraison gratuite des 150\u20ac" (aucune variation)
- Compatibilite : "Trouvez votre piece compatible sur automecanik.com"
- JAMAIS : "le moins cher", "garanti a vie", "meilleur prix", noms concurrents`;

// ── CATALOGUE templates ──

const CATALOGUE_IG: SocialPromptTemplate = {
  key: 'catalogue:instagram:standard',
  maxLength: 2200,
  system: `Tu es un copywriter e-commerce automobile expert Instagram.
${BRAND_SYSTEM}

REGLES INSTAGRAM :
- Max 2200 caracteres, 2-3 emojis en debut de ligne, CTA obligatoire
- 20-25 hashtags EN COMMENTAIRE SEPARE (genere-les a part, PAS dans le texte)
- Toujours #automecanik en premier hashtag
- Tutoiement obligatoire, ton professionnel mais accessible
- Pas d'anglicismes inutiles
${CLAIMS_RULES}

SORTIE OBLIGATOIRE (JSON strict) :
{"caption": "...", "hashtags": ["#automecanik", ...], "format": "carrousel|post|reel|story", "dimensions": "1080x1080|1080x1350|1080x1920", "visual_brief": "...", "alt_text": "..."}`,

  user: (ctx) => {
    const points = sanitizeBriefArray(ctx.key_selling_points);
    let prompt = `Cree un post Instagram CATALOGUE pour :\n\n`;
    prompt += `Gamme : ${sanitizeBriefField(ctx.gamme_name)}\n`;
    prompt += `Alias : ${sanitizeBriefField(ctx.gamme_alias)}\n`;
    prompt += `URL : ${ctx.utm_link}\n`;
    prompt += `Format souhaite : ${ctx.format}\n`;
    if (ctx.dimensions) prompt += `Dimensions : ${ctx.dimensions}\n`;
    if (ctx.price_range)
      prompt += `Gamme de prix : ${sanitizeBriefField(ctx.price_range)}\n`;
    if (ctx.vehicles?.length)
      prompt += `Vehicules compatibles : ${sanitizeBriefArray(ctx.vehicles).join(', ')}\n`;
    if (points.length)
      prompt += `\nArguments de vente :\n${points.map((p) => `- ${p}`).join('\n')}\n`;
    prompt += `\nSemaine : ${ctx.week_iso}`;
    return prompt;
  },
};

const CATALOGUE_FB: SocialPromptTemplate = {
  key: 'catalogue:facebook:standard',
  maxLength: 500,
  system: `Tu es un copywriter e-commerce automobile expert Facebook.
${BRAND_SYSTEM}

REGLES FACEBOOK :
- Max 500 caracteres, ton un peu plus formel, vouvoiement accepte
- Lien DIRECT avec preview (pas "lien en bio"), 3-5 hashtags integres dans le texte
- #automecanik obligatoire
- CTA avec lien direct vers la page produit
${CLAIMS_RULES}

SORTIE OBLIGATOIRE (JSON strict) :
{"caption": "...", "hashtags": ["#automecanik", ...], "format": "post|story|reel", "link_preview": true}`,

  user: (ctx) => {
    const points = sanitizeBriefArray(ctx.key_selling_points);
    let prompt = `Cree un post Facebook CATALOGUE pour :\n\n`;
    prompt += `Gamme : ${sanitizeBriefField(ctx.gamme_name)}\n`;
    prompt += `URL avec UTM : ${ctx.utm_link}\n`;
    if (ctx.price_range)
      prompt += `Gamme de prix : ${sanitizeBriefField(ctx.price_range)}\n`;
    if (points.length)
      prompt += `\nArguments :\n${points.map((p) => `- ${p}`).join('\n')}\n`;
    return prompt;
  },
};

const CATALOGUE_YT: SocialPromptTemplate = {
  key: 'catalogue:youtube:standard',
  maxLength: 5000,
  system: `Tu es un createur de contenu video automobile expert YouTube.
${BRAND_SYSTEM}

REGLES YOUTUBE :
- Titre max 100 caracteres, accrocheur, avec le nom de la piece
- Description 200-500 caracteres
- 5-15 tags, dont "automecanik" et "pieces auto"
- Hook (5s) : question ou chiffre choc
- CTA : "Lien en description" + lien UTM
${CLAIMS_RULES}

SORTIE OBLIGATOIRE (JSON strict) :
{"title": "...", "description": "...", "tags": ["automecanik", "pieces auto", ...], "format": "short|video_long", "hook_script": "...", "thumbnail_brief": "..."}`,

  user: (ctx) => {
    const points = sanitizeBriefArray(ctx.key_selling_points);
    let prompt = `Cree un contenu YouTube CATALOGUE pour :\n\n`;
    prompt += `Gamme : ${sanitizeBriefField(ctx.gamme_name)}\n`;
    prompt += `URL avec UTM : ${ctx.utm_link}\n`;
    prompt += `Format : ${ctx.format}\n`;
    if (points.length)
      prompt += `\nArguments :\n${points.map((p) => `- ${p}`).join('\n')}\n`;
    return prompt;
  },
};

// ── CONSEIL templates ──

const CONSEIL_IG: SocialPromptTemplate = {
  key: 'conseil:instagram:standard',
  maxLength: 2200,
  system: `Tu es un expert entretien automobile qui cree du contenu educatif Instagram.
${BRAND_SYSTEM}

REGLES INSTAGRAM CONSEIL :
- Max 2200 caracteres, 2-3 emojis en debut de ligne, CTA "Sauvegarde ce post"
- Format ideal : carrousel educatif (slides)
- 20-25 hashtags EN COMMENTAIRE SEPARE, #automecanik en premier
- Tutoiement, ton pedagogique
- PRIVILEGE : questions "pourquoi" et "comment savoir si"
- Si recyclage SEO : extraire les points cles du blog/guide existant
${CLAIMS_RULES}

SORTIE OBLIGATOIRE (JSON strict) :
{"caption": "...", "hashtags": ["#automecanik", ...], "format": "carrousel", "dimensions": "1080x1080", "visual_brief": "...", "alt_text": "..."}`,

  user: (ctx) => {
    const points = sanitizeBriefArray(ctx.key_selling_points);
    let prompt = `Cree un post Instagram CONSEIL pour :\n\n`;
    prompt += `Gamme : ${sanitizeBriefField(ctx.gamme_name)}\n`;
    prompt += `URL : ${ctx.utm_link}\n`;
    if (points.length)
      prompt += `\nPoints cles a couvrir :\n${points.map((p) => `- ${p}`).join('\n')}\n`;
    if (ctx.blog_excerpt)
      prompt += `\nExtrait blog/guide a recycler :\n${sanitizeBriefField(ctx.blog_excerpt)}\n`;
    if (ctx.guide_excerpt)
      prompt += `\nExtrait guide :\n${sanitizeBriefField(ctx.guide_excerpt)}\n`;
    return prompt;
  },
};

const CONSEIL_FB: SocialPromptTemplate = {
  key: 'conseil:facebook:standard',
  maxLength: 500,
  system: `Tu es un expert entretien automobile qui cree du contenu educatif Facebook.
${BRAND_SYSTEM}

REGLES FACEBOOK CONSEIL :
- Max 500 caracteres, ton pedagogique, vouvoiement accepte
- Lien direct vers le guide/article, 3-5 hashtags integres
- CTA : "Lisez notre guide complet" ou "En savoir plus"
- Si recyclage SEO : extraire les points cles du contenu existant
${CLAIMS_RULES}

SORTIE OBLIGATOIRE (JSON strict) :
{"caption": "...", "hashtags": ["#automecanik", ...], "format": "post", "link_preview": true}`,

  user: (ctx) => {
    const points = sanitizeBriefArray(ctx.key_selling_points);
    let prompt = `Cree un post Facebook CONSEIL pour :\n\n`;
    prompt += `Gamme : ${sanitizeBriefField(ctx.gamme_name)}\n`;
    prompt += `URL guide : ${ctx.utm_link}\n`;
    if (points.length)
      prompt += `\nPoints cles :\n${points.map((p) => `- ${p}`).join('\n')}\n`;
    if (ctx.blog_excerpt)
      prompt += `\nExtrait a recycler :\n${sanitizeBriefField(ctx.blog_excerpt)}\n`;
    return prompt;
  },
};

const CONSEIL_YT: SocialPromptTemplate = {
  key: 'conseil:youtube:standard',
  maxLength: 5000,
  system: `Tu es un createur de contenu video automobile educatif expert YouTube.
${BRAND_SYSTEM}

REGLES YOUTUBE CONSEIL :
- Titre max 100 car. : question accrocheuse ("Quand changer ses plaquettes de frein ?")
- Description 200-500 car. avec lien UTM
- 5-15 tags
- Hook (0-5s) : "Tu savais que...?" ou chiffre surprenant
- Structure Short (15-60s) : Hook → Probleme → Solution → CTA
- Structure longue (5-15min) : Hook → Chapitres → Outro + CTA
${CLAIMS_RULES}

SORTIE OBLIGATOIRE (JSON strict) :
{"title": "...", "description": "...", "tags": ["automecanik", ...], "format": "short|video_long", "hook_script": "...", "thumbnail_brief": "..."}`,

  user: (ctx) => {
    const points = sanitizeBriefArray(ctx.key_selling_points);
    let prompt = `Cree un contenu YouTube CONSEIL pour :\n\n`;
    prompt += `Gamme : ${sanitizeBriefField(ctx.gamme_name)}\n`;
    prompt += `URL : ${ctx.utm_link}\n`;
    prompt += `Format : ${ctx.format}\n`;
    if (points.length)
      prompt += `\nPoints cles :\n${points.map((p) => `- ${p}`).join('\n')}\n`;
    if (ctx.blog_excerpt)
      prompt += `\nExtrait blog a recycler :\n${sanitizeBriefField(ctx.blog_excerpt)}\n`;
    if (ctx.guide_excerpt)
      prompt += `\nExtrait guide :\n${sanitizeBriefField(ctx.guide_excerpt)}\n`;
    return prompt;
  },
};

// ── Registry ──

export const SOCIAL_POST_TEMPLATES: Record<string, SocialPromptTemplate> = {
  'catalogue:instagram:standard': CATALOGUE_IG,
  'catalogue:facebook:standard': CATALOGUE_FB,
  'catalogue:youtube:standard': CATALOGUE_YT,
  'conseil:instagram:standard': CONSEIL_IG,
  'conseil:facebook:standard': CONSEIL_FB,
  'conseil:youtube:standard': CONSEIL_YT,
};

/**
 * Get a social template by composable key.
 * Falls back to standard length if exact key not found.
 */
export function getSocialTemplate(
  pillar: ContentPillar,
  channel: SocialChannel,
  length: string = 'standard',
): SocialPromptTemplate | null {
  const key = `${pillar}:${channel}:${length}`;
  return SOCIAL_POST_TEMPLATES[key] ?? null;
}

/**
 * List all available template keys.
 */
export function listTemplateKeys(): string[] {
  return Object.keys(SOCIAL_POST_TEMPLATES);
}

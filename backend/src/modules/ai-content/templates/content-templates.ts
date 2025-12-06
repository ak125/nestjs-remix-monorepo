import { ContentType, Tone } from '../dto/generate-content.dto';

export interface PromptTemplate {
  system: string;
  user: (context: Record<string, any>) => string;
}

export const CONTENT_TEMPLATES: Record<ContentType, PromptTemplate> = {
  generic: {
    system: `Tu es un assistant de rédaction polyvalent et expert.
Tu crées du contenu de qualité professionnelle adapté à chaque demande.
Tu respectes les consignes et le ton demandé tout en restant créatif et engageant.`,
    user: (ctx) => {
      const { prompt, tone, length } = ctx;

      let userPrompt =
        prompt || 'Crée du contenu pertinent selon le contexte fourni.';

      if (length) {
        userPrompt += `\n\nLongueur souhaitée : ${length}`;
      }

      if (tone) {
        userPrompt += `\nTon à adopter : ${tone}`;
      }

      return userPrompt;
    },
  },

  product_description: {
    system: `Tu es un expert en rédaction de fiches produits pour l'e-commerce. 
Tu dois créer des descriptions attrayantes, précises et optimisées pour la conversion.
Mets en valeur les bénéfices pour le client, pas seulement les caractéristiques techniques.`,
    user: (ctx) => {
      const {
        productName,
        category,
        features,
        specifications,
        targetAudience,
        tone,
        length,
      } = ctx;

      let prompt = `Crée une description ${length || 'medium'} pour le produit suivant :\n\n`;
      prompt += `Nom du produit : ${productName}\n`;

      if (category) prompt += `Catégorie : ${category}\n`;
      if (targetAudience) prompt += `Public cible : ${targetAudience}\n`;

      if (features && features.length > 0) {
        prompt += `\nCaractéristiques principales :\n`;
        features.forEach((f: string) => (prompt += `- ${f}\n`));
      }

      if (specifications && Object.keys(specifications).length > 0) {
        prompt += `\nSpécifications techniques :\n`;
        Object.entries(specifications).forEach(([key, value]) => {
          prompt += `- ${key}: ${value}\n`;
        });
      }

      prompt += `\nTon à utiliser : ${tone || 'professional'}\n`;
      prompt += `\nLa description doit être engageante, mettre en valeur les bénéfices client et inciter à l'achat.`;

      return prompt;
    },
  },

  seo_meta: {
    system: `Tu es un expert SEO spécialisé dans la création de méta-descriptions et titres optimisés.
Tu connais les meilleures pratiques : longueur optimale, inclusion de mots-clés, appel à l'action.`,
    user: (ctx) => {
      const { pageTitle, keywords, targetKeyword, businessType, pageUrl } = ctx;

      let prompt = `Génère une méta-description SEO optimisée pour :\n\n`;
      prompt += `Titre de la page : ${pageTitle}\n`;

      if (targetKeyword) prompt += `Mot-clé principal : ${targetKeyword}\n`;
      if (businessType) prompt += `Type d'entreprise : ${businessType}\n`;
      if (pageUrl) prompt += `URL : ${pageUrl}\n`;

      if (keywords && keywords.length > 0) {
        prompt += `\nMots-clés à inclure : ${keywords.join(', ')}\n`;
      }

      prompt += `\nLa méta-description doit :\n`;
      prompt += `- Faire entre 150 et 160 caractères\n`;
      prompt += `- Inclure le mot-clé principal naturellement\n`;
      prompt += `- Contenir un appel à l'action\n`;
      prompt += `- Être engageante et inciter au clic\n`;

      return prompt;
    },
  },

  marketing_copy: {
    system: `Tu es un copywriter expert en marketing digital.
Tu crées des textes persuasifs qui convertissent, en utilisant les principes de copywriting éprouvés.`,
    user: (ctx) => {
      const { objective, targetAudience, product, benefits, tone, length } =
        ctx;

      let prompt = `Crée un texte marketing ${length || 'medium'} pour :\n\n`;
      prompt += `Objectif : ${objective}\n`;

      if (product) prompt += `Produit/Service : ${product}\n`;
      if (targetAudience) prompt += `Audience cible : ${targetAudience}\n`;

      if (benefits && benefits.length > 0) {
        prompt += `\nBénéfices à mettre en avant :\n`;
        benefits.forEach((b: string) => (prompt += `- ${b}\n`));
      }

      prompt += `\nTon : ${tone || 'persuasive'}\n`;
      prompt += `\nUtilise des techniques de copywriting comme AIDA (Attention, Intérêt, Désir, Action).`;

      return prompt;
    },
  },

  blog_article: {
    system: `Tu es un rédacteur web expert qui crée des articles de blog informatifs et engageants.
Tu structures bien le contenu, utilises des sous-titres, et écris dans un style fluide et accessible.`,
    user: (ctx) => {
      const { topic, keywords, targetAudience, tone, length, outline } = ctx;

      let prompt = `Rédige un article de blog ${length || 'long'} sur :\n\n`;
      prompt += `Sujet : ${topic}\n`;

      if (targetAudience) prompt += `Pour : ${targetAudience}\n`;
      if (tone) prompt += `Ton : ${tone}\n`;

      if (keywords && keywords.length > 0) {
        prompt += `\nMots-clés à intégrer : ${keywords.join(', ')}\n`;
      }

      if (outline && outline.length > 0) {
        prompt += `\nPlan à suivre :\n`;
        outline.forEach((section: string, i: number) => {
          prompt += `${i + 1}. ${section}\n`;
        });
      }

      prompt += `\nL'article doit être structuré avec des titres H2 et H3, informatif et agréable à lire.`;

      return prompt;
    },
  },

  social_media: {
    system: `Tu es un expert des réseaux sociaux qui crée du contenu viral et engageant.
Tu connais les codes de chaque plateforme et sais créer des posts qui génèrent de l'interaction.`,
    user: (ctx) => {
      const { platform, message, callToAction, hashtags, tone, includeEmojis } =
        ctx;

      let prompt = `Crée un post pour ${platform || 'les réseaux sociaux'} :\n\n`;
      prompt += `Message principal : ${message}\n`;

      if (callToAction) prompt += `Call-to-action : ${callToAction}\n`;
      if (tone) prompt += `Ton : ${tone}\n`;

      prompt += `\n`;

      if (includeEmojis !== false) {
        prompt += `- Utilise des emojis pertinents\n`;
      }

      if (hashtags && hashtags.length > 0) {
        prompt += `- Inclus ces hashtags : ${hashtags.join(' ')}\n`;
      } else {
        prompt += `- Suggère 3-5 hashtags pertinents\n`;
      }

      prompt += `- Respecte les bonnes pratiques de ${platform || 'la plateforme'}\n`;
      prompt += `- Crée un contenu qui génère de l'engagement\n`;

      return prompt;
    },
  },

  email_campaign: {
    system: `Tu es un expert en email marketing qui crée des campagnes d'emailing performantes.
Tu sais structurer un email pour maximiser les taux d'ouverture et de clic.`,
    user: (ctx) => {
      const { subject, goal, targetAudience, tone, includeSubject, offer } =
        ctx;

      let prompt = `Crée un email marketing pour :\n\n`;
      prompt += `Objectif : ${goal}\n`;

      if (targetAudience) prompt += `Destinataires : ${targetAudience}\n`;
      if (offer) prompt += `Offre : ${offer}\n`;
      if (tone) prompt += `Ton : ${tone}\n`;

      prompt += `\n`;

      if (includeSubject !== false) {
        prompt += `Génère :\n`;
        prompt += `1. Une ligne d'objet accrocheuse (50-60 caractères)\n`;
        prompt += `2. Un pré-header engageant\n`;
        prompt += `3. Le corps de l'email\n`;
      } else {
        prompt += `Objet de l'email : ${subject}\n\nGénère le corps de l'email.\n`;
      }

      prompt += `\nL'email doit avoir :\n`;
      prompt += `- Une accroche forte\n`;
      prompt += `- Un message clair et concis\n`;
      prompt += `- Un appel à l'action visible\n`;
      prompt += `- Une structure facile à scanner\n`;

      return prompt;
    },
  },
};

export const TONE_MODIFIERS: Record<Tone, string> = {
  professional: 'Adopte un ton professionnel, formel et crédible.',
  casual:
    'Utilise un langage décontracté et accessible, comme si tu parlais à un ami.',
  friendly: 'Sois chaleureux, bienveillant et proche de ton audience.',
  technical:
    'Utilise un vocabulaire technique précis, adapté à des experts du domaine.',
  persuasive:
    "Sois convaincant et utilise des techniques de persuasion pour inciter à l'action.",
  informative:
    "Concentre-toi sur la transmission d'informations claires et objectives.",
};

export function buildPrompt(
  type: ContentType,
  context: Record<string, any>,
  tone?: Tone,
): { system: string; user: string } {
  const template = CONTENT_TEMPLATES[type];

  let systemPrompt = template.system;

  if (tone && TONE_MODIFIERS[tone]) {
    systemPrompt += `\n\n${TONE_MODIFIERS[tone]}`;
  }

  return {
    system: systemPrompt,
    user: template.user(context),
  };
}

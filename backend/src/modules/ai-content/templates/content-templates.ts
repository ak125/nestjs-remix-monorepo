import { ContentType, Tone } from '../dto/generate-content.dto';

export interface PromptTemplate {
  system: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: (context: Record<string, any>) => string;
}

// Sanitize brief fields to prevent prompt injection
function sanitizeBriefField(value: string): string {
  return value
    .replace(/\n{2,}/g, '\n') // collapse multiple newlines
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

  seo_descrip_polish: {
    system: `Tu es un expert SEO automobile français. Tu reçois un brouillon de méta-description (max 160 caractères) pour une page de pièces auto.
Ta mission : polir le texte pour le rendre plus naturel, engageant et optimisé pour le clic Google.
Règles strictes :
- Maximum 160 caractères (OBLIGATOIRE)
- Garder le nom de la pièce et le CTA livraison 24-48h
- Ton professionnel automobile, pas de jargon marketing
- INTERDICTION de commencer par "Découvrez" ou "Trouvez" — trop générique
- Commencer DIRECTEMENT par le nom de la pièce suivi de deux-points, ou par un bénéfice technique concret
- Varier les structures : "Pièce : fonction technique. CTA." ou "Fonction + pièce compatible. CTA."
- NE PAS inventer de données techniques absentes du brouillon
- Répondre UNIQUEMENT avec la méta-description polie, rien d'autre`,
    user: (ctx) => {
      return `Brouillon à polir :\n"${ctx.draft}"\n\nNom de la pièce : ${ctx.gammeName}`;
    },
  },

  seo_content_polish: {
    system: `Tu es un rédacteur technique automobile français expert en SEO. Tu reçois un brouillon HTML de contenu SEO pour une page pièces auto.
Ta mission : améliorer les formulations et le naturel du texte en conservant la structure HTML exacte.
Règles strictes :
- Conserver EXACTEMENT les balises HTML (h2, ul, li, b) — ne pas changer la structure
- Améliorer le français : fluidité, transitions, formulations naturelles
- Supprimer les phrases génériques ("joue un rôle essentiel", "assure le bon fonctionnement")
- Garder les accents français corrects
- Ton professionnel, orienté automobiliste
- NE PAS ajouter de sections, NE PAS inventer de contenu technique
- NE PAS dépasser la longueur originale de plus de 20%
- Répondre UNIQUEMENT avec le HTML poli, rien d'autre`,
    user: (ctx) => {
      return `Brouillon HTML à polir :\n${ctx.draft}\n\nNom de la gamme : ${ctx.gammeName}`;
    },
  },

  // ── Brief-aware templates (Phase 2 Page Briefs) ──

  seo_content_R1: {
    system: `Tu es un rédacteur SEO automobile français. Tu reçois un brouillon HTML pour une PAGE TRANSACTIONNELLE (R1) de pièces auto.
RÔLE DE CETTE PAGE : aider l'utilisateur à CHOISIR et ACHETER la bonne pièce compatible avec son véhicule.
Tu DOIS respecter STRICTEMENT les contraintes du BRIEF ÉDITORIAL fourni ci-dessous.
RÈGLES STRICTES :
- Conserver EXACTEMENT les balises HTML (h2, ul, li, b) et leur ordre
- NE PAS ajouter de nouvelles sections <h2>
- NE JAMAIS toucher au H1 (il est immuable)
- Ton TRANSACTIONNEL : orienter vers la décision d'achat
- INTERDICTION d'inclure : procédures de montage, étapes 1/2/3, outils nécessaires, couple de serrage, tutoriel
- Les termes techniques doivent apparaître naturellement, PAS en bourrage
- Les preuves doivent être intégrées dans le texte, PAS en liste brute
- NE PAS dépasser la longueur originale de plus de 20%
- Répondre UNIQUEMENT avec le HTML poli`,
    user: (ctx) => {
      if (!ctx.brief)
        return `Brouillon HTML à polir :\n${ctx.draft}\n\nNom de la gamme : ${ctx.gammeName}`;
      let prompt = `Brouillon HTML à polir :\n${ctx.draft}\n\nNom de la gamme : ${ctx.gammeName}\n\n`;
      prompt += `=== BRIEF ÉDITORIAL ===\n`;
      prompt += `Intention principale : ${sanitizeBriefField(ctx.brief.primary_intent ?? '')}\n`;
      const angles = sanitizeBriefArray(ctx.brief.angles_obligatoires);
      if (angles.length)
        prompt += `\nAngles OBLIGATOIRES à couvrir :\n${angles.map((a: string) => `- ${a}`).join('\n')}\n`;
      const forbidden = sanitizeBriefArray(ctx.brief.forbidden_overlap);
      if (forbidden.length)
        prompt += `\nCONTENU STRICTEMENT INTERDIT (appartient à une autre page) :\n${forbidden.map((f: string) => `- ${f}`).join('\n')}\n`;
      const termes = sanitizeBriefArray(ctx.brief.termes_techniques);
      if (termes.length)
        prompt += `\nTermes techniques à intégrer : ${termes.join(', ')}\n`;
      const preuves = sanitizeBriefArray(ctx.brief.preuves);
      if (preuves.length)
        prompt += `\nDonnées chiffrées à citer :\n${preuves.map((p: string) => `- ${p}`).join('\n')}\n`;
      const constraints = sanitizeBriefArray(ctx.brief.writing_constraints);
      if (constraints.length)
        prompt += `\nContraintes rédactionnelles :\n${constraints.map((c: string) => `- ${c}`).join('\n')}\n`;
      return prompt;
    },
  },

  seo_content_R3: {
    system: `Tu es un rédacteur technique automobile français. Tu reçois un brouillon HTML pour une PAGE INFORMATIONNELLE (R3) de type guide/conseil.
RÔLE DE CETTE PAGE : INFORMER et ÉDUQUER l'utilisateur sur l'entretien, le diagnostic et le remplacement de la pièce.
Tu DOIS respecter STRICTEMENT les contraintes du BRIEF ÉDITORIAL fourni ci-dessous.
RÈGLES STRICTES :
- Conserver EXACTEMENT les balises HTML et leur ordre
- NE JAMAIS toucher au H1 (il est immuable)
- Ton PÉDAGOGIQUE : expliquer clairement, donner des repères concrets
- INTERDICTION d'inclure : comparaison de prix entre marques, catalogue produits, call-to-action d'achat direct
- Privilégier les explications "pourquoi" et "comment savoir si"
- Les preuves techniques doivent être contextualisées (pas juste des chiffres bruts)
- NE PAS dépasser la longueur originale de plus de 20%
- Répondre UNIQUEMENT avec le HTML poli`,
    user: (ctx) => {
      if (!ctx.brief)
        return `Brouillon HTML à polir :\n${ctx.draft}\n\nNom de la gamme : ${ctx.gammeName}`;
      let prompt = `Brouillon HTML à polir :\n${ctx.draft}\n\nNom de la gamme : ${ctx.gammeName}\n\n`;
      prompt += `=== BRIEF ÉDITORIAL ===\n`;
      prompt += `Intention principale : ${sanitizeBriefField(ctx.brief.primary_intent ?? '')}\n`;
      const angles = sanitizeBriefArray(ctx.brief.angles_obligatoires);
      if (angles.length)
        prompt += `\nAngles OBLIGATOIRES à couvrir :\n${angles.map((a: string) => `- ${a}`).join('\n')}\n`;
      const forbidden = sanitizeBriefArray(ctx.brief.forbidden_overlap);
      if (forbidden.length)
        prompt += `\nCONTENU STRICTEMENT INTERDIT (appartient à une autre page) :\n${forbidden.map((f: string) => `- ${f}`).join('\n')}\n`;
      const termes = sanitizeBriefArray(ctx.brief.termes_techniques);
      if (termes.length)
        prompt += `\nTermes techniques à intégrer : ${termes.join(', ')}\n`;
      const preuves = sanitizeBriefArray(ctx.brief.preuves);
      if (preuves.length)
        prompt += `\nDonnées chiffrées à citer :\n${preuves.map((p: string) => `- ${p}`).join('\n')}\n`;
      const constraints = sanitizeBriefArray(ctx.brief.writing_constraints);
      if (constraints.length)
        prompt += `\nContraintes rédactionnelles :\n${constraints.map((c: string) => `- ${c}`).join('\n')}\n`;
      return prompt;
    },
  },

  seo_content_R4: {
    system: `Tu es un encyclopédiste technique automobile français. Tu reçois un brouillon pour une PAGE DE RÉFÉRENCE (R4) de type glossaire technique.
RÔLE DE CETTE PAGE : DÉFINIR la pièce avec précision technique, donner des repères stables et neutres.
Tu DOIS respecter STRICTEMENT les contraintes du BRIEF ÉDITORIAL fourni ci-dessous.
RÈGLES STRICTES :
- Ton ENCYCLOPÉDIQUE neutre — pas de marketing, pas de conseil d'achat
- NE JAMAIS toucher au H1 (il est immuable)
- INTERDICTION d'inclure : tutoriel, procédure de montage, comparaison prix, "cliquez ici", promotion
- La définition doit être autonome et stable dans le temps
- Pas de références à des modèles de véhicules spécifiques
- Les données techniques doivent être universelles et vérifiables
- Répondre UNIQUEMENT avec le contenu poli`,
    user: (ctx) => {
      if (!ctx.brief)
        return `Brouillon à polir :\n${ctx.draft}\n\nNom de la gamme : ${ctx.gammeName}`;
      let prompt = `Brouillon à polir :\n${ctx.draft}\n\nNom de la gamme : ${ctx.gammeName}\n\n`;
      prompt += `=== BRIEF ÉDITORIAL ===\n`;
      prompt += `Intention principale : ${sanitizeBriefField(ctx.brief.primary_intent ?? '')}\n`;
      const angles = sanitizeBriefArray(ctx.brief.angles_obligatoires);
      if (angles.length)
        prompt += `\nAngles OBLIGATOIRES à couvrir :\n${angles.map((a: string) => `- ${a}`).join('\n')}\n`;
      const forbidden = sanitizeBriefArray(ctx.brief.forbidden_overlap);
      if (forbidden.length)
        prompt += `\nCONTENU STRICTEMENT INTERDIT (appartient à une autre page) :\n${forbidden.map((f: string) => `- ${f}`).join('\n')}\n`;
      const termes = sanitizeBriefArray(ctx.brief.termes_techniques);
      if (termes.length)
        prompt += `\nTermes techniques à intégrer : ${termes.join(', ')}\n`;
      const preuves = sanitizeBriefArray(ctx.brief.preuves);
      if (preuves.length)
        prompt += `\nDonnées chiffrées à citer :\n${preuves.map((p: string) => `- ${p}`).join('\n')}\n`;
      return prompt;
    },
  },

  seo_descrip_R1: {
    system: `Tu es un expert SEO automobile français. Tu reçois un brouillon de méta-description pour une PAGE TRANSACTIONNELLE (R1).
Règles strictes :
- Maximum 160 caractères (OBLIGATOIRE)
- Commencer par le nom de la pièce suivi de deux-points
- Inclure le CTA livraison 24-48h
- Ton transactionnel : orienter vers l'achat
- INTERDICTION de commencer par "Découvrez" ou "Trouvez"
- Répondre UNIQUEMENT avec la méta-description polie`,
    user: (ctx) => {
      if (!ctx.brief)
        return `Brouillon à polir :\n"${ctx.draft}"\n\nNom de la pièce : ${ctx.gammeName}`;
      let prompt = `Brouillon à polir :\n"${ctx.draft}"\n\nNom de la pièce : ${ctx.gammeName}\n`;
      prompt += `Intention : ${sanitizeBriefField(ctx.brief.primary_intent ?? '')}\n`;
      const forbidden = sanitizeBriefArray(ctx.brief.forbidden_overlap);
      if (forbidden.length)
        prompt += `INTERDIT de mentionner : ${forbidden.join(', ')}\n`;
      return prompt;
    },
  },

  seo_descrip_R3: {
    system: `Tu es un expert SEO automobile français. Tu reçois un brouillon de méta-description pour une PAGE INFORMATIONNELLE (R3) de type guide.
Règles strictes :
- Maximum 160 caractères (OBLIGATOIRE)
- Commencer par le nom de la pièce suivi de deux-points
- CTA : "guide complet" ou "tout savoir"
- Ton pédagogique : informer et éduquer
- INTERDICTION de commencer par "Découvrez" ou "Trouvez"
- INTERDICTION de mentionner des prix ou promotions
- Répondre UNIQUEMENT avec la méta-description polie`,
    user: (ctx) => {
      if (!ctx.brief)
        return `Brouillon à polir :\n"${ctx.draft}"\n\nNom de la pièce : ${ctx.gammeName}`;
      let prompt = `Brouillon à polir :\n"${ctx.draft}"\n\nNom de la pièce : ${ctx.gammeName}\n`;
      prompt += `Intention : ${sanitizeBriefField(ctx.brief.primary_intent ?? '')}\n`;
      const forbidden = sanitizeBriefArray(ctx.brief.forbidden_overlap);
      if (forbidden.length)
        prompt += `INTERDIT de mentionner : ${forbidden.join(', ')}\n`;
      return prompt;
    },
  },

  seo_descrip_R4: {
    system: `Tu es un expert SEO automobile français. Tu reçois un brouillon de méta-description pour une PAGE DE RÉFÉRENCE (R4) technique.
Règles strictes :
- Maximum 160 caractères (OBLIGATOIRE)
- Commencer par le nom de la pièce suivi de deux-points
- Ton encyclopédique neutre — pas de CTA commercial
- INTERDICTION de commencer par "Découvrez" ou "Trouvez"
- INTERDICTION de mentionner des prix, promotions ou procédures
- Répondre UNIQUEMENT avec la méta-description polie`,
    user: (ctx) => {
      if (!ctx.brief)
        return `Brouillon à polir :\n"${ctx.draft}"\n\nNom de la pièce : ${ctx.gammeName}`;
      let prompt = `Brouillon à polir :\n"${ctx.draft}"\n\nNom de la pièce : ${ctx.gammeName}\n`;
      prompt += `Intention : ${sanitizeBriefField(ctx.brief.primary_intent ?? '')}\n`;
      const forbidden = sanitizeBriefArray(ctx.brief.forbidden_overlap);
      if (forbidden.length)
        prompt += `INTERDIT de mentionner : ${forbidden.join(', ')}\n`;
      return prompt;
    },
  },

  // ── Social channel-specific templates (Marketing Hub) ──

  social_instagram: {
    system: `Tu es un copywriter e-commerce automobile expert Instagram.
Marque : Automecanik (automecanik.com) | +500 000 references pieces auto.
REGLES STRICTES :
- Max 2200 caracteres, 2-3 emojis en debut de ligne, CTA obligatoire
- 20-25 hashtags EN COMMENTAIRE SEPARE (pas dans le texte), #automecanik en premier
- Tutoiement obligatoire, ton professionnel mais accessible
- Francais uniquement, pas d'anglicismes
- JAMAIS mentionner de concurrents ni de claims non prouves
- Si prix : uniquement si source DB fournie
- Livraison : "Livraison gratuite des 150€" (formulation exacte)
SORTIE : JSON {"caption":"...","hashtags":["#automecanik",...],"format":"carrousel|post|reel|story","visual_brief":"..."}`,
    user: (ctx) => {
      const brief = ctx.brief || {};
      const gamme = sanitizeBriefField(brief.gamme_name || ctx.prompt || '');
      const points = sanitizeBriefArray(
        brief.key_selling_points || ctx.features,
      );
      let prompt = `Cree un post Instagram pour :\n\nGamme : ${gamme}\n`;
      if (brief.utm_link) prompt += `Lien UTM : ${brief.utm_link}\n`;
      if (brief.pillar)
        prompt += `Pilier : ${sanitizeBriefField(brief.pillar)}\n`;
      if (brief.format)
        prompt += `Format : ${sanitizeBriefField(brief.format)}\n`;
      if (brief.price_range)
        prompt += `Prix : ${sanitizeBriefField(brief.price_range)}\n`;
      if (points.length)
        prompt += `\nArguments :\n${points.map((p: string) => `- ${p}`).join('\n')}\n`;
      if (brief.blog_excerpt)
        prompt += `\nExtrait a recycler :\n${sanitizeBriefField(brief.blog_excerpt)}\n`;
      if (brief.top_review)
        prompt += `\nReview verifiee : ${sanitizeBriefField(brief.top_review)}\n`;
      return prompt;
    },
  },

  social_facebook: {
    system: `Tu es un copywriter e-commerce automobile expert Facebook.
Marque : Automecanik (automecanik.com) | +500 000 references pieces auto.
REGLES STRICTES :
- Max 500 caracteres, ton professionnel, vouvoiement accepte
- Lien DIRECT avec preview (pas "lien en bio"), 3-5 hashtags integres
- #automecanik obligatoire
- Francais uniquement
- JAMAIS mentionner de concurrents ni de claims non prouves
- Si prix : uniquement si source DB fournie
- Livraison : "Livraison gratuite des 150€" (formulation exacte)
SORTIE : JSON {"caption":"...","hashtags":["#automecanik",...],"format":"post|story|reel","link_preview":true}`,
    user: (ctx) => {
      const brief = ctx.brief || {};
      const gamme = sanitizeBriefField(brief.gamme_name || ctx.prompt || '');
      const points = sanitizeBriefArray(
        brief.key_selling_points || ctx.features,
      );
      let prompt = `Cree un post Facebook pour :\n\nGamme : ${gamme}\n`;
      if (brief.utm_link) prompt += `Lien : ${brief.utm_link}\n`;
      if (brief.pillar)
        prompt += `Pilier : ${sanitizeBriefField(brief.pillar)}\n`;
      if (brief.price_range)
        prompt += `Prix : ${sanitizeBriefField(brief.price_range)}\n`;
      if (points.length)
        prompt += `\nArguments :\n${points.map((p: string) => `- ${p}`).join('\n')}\n`;
      if (brief.blog_excerpt)
        prompt += `\nExtrait :\n${sanitizeBriefField(brief.blog_excerpt)}\n`;
      return prompt;
    },
  },

  social_youtube: {
    system: `Tu es un createur de contenu video automobile expert YouTube.
Marque : Automecanik (automecanik.com) | +500 000 references pieces auto.
REGLES STRICTES :
- Titre max 100 caracteres, accrocheur
- Description 200-500 caracteres avec lien UTM
- 5-15 tags, dont "automecanik" et "pieces auto"
- Hook (0-5s) : question ou chiffre choc
- Short (15-60s) : Hook → Probleme → Solution → CTA
- Video longue (5-15min) : Hook → Chapitres → Outro + CTA
- Francais uniquement
- JAMAIS mentionner de concurrents
- Livraison : "Livraison gratuite des 150€" (formulation exacte)
SORTIE : JSON {"title":"...","description":"...","tags":["automecanik","pieces auto",...],"format":"short|video_long","hook_script":"...","thumbnail_brief":"..."}`,
    user: (ctx) => {
      const brief = ctx.brief || {};
      const gamme = sanitizeBriefField(brief.gamme_name || ctx.prompt || '');
      const points = sanitizeBriefArray(
        brief.key_selling_points || ctx.features,
      );
      let prompt = `Cree un contenu YouTube pour :\n\nGamme : ${gamme}\n`;
      if (brief.utm_link) prompt += `Lien : ${brief.utm_link}\n`;
      if (brief.pillar)
        prompt += `Pilier : ${sanitizeBriefField(brief.pillar)}\n`;
      if (brief.format)
        prompt += `Format : ${sanitizeBriefField(brief.format)}\n`;
      if (points.length)
        prompt += `\nPoints cles :\n${points.map((p: string) => `- ${p}`).join('\n')}\n`;
      if (brief.blog_excerpt)
        prompt += `\nExtrait blog :\n${sanitizeBriefField(brief.blog_excerpt)}\n`;
      if (brief.guide_excerpt)
        prompt += `\nExtrait guide :\n${sanitizeBriefField(brief.guide_excerpt)}\n`;
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

  // ============================================================================
  // R1 CONTENT PIPELINE — 4-prompt sequence
  // ============================================================================

  // ══════════════════════════════════════════════════════════════════
  // R1 Content Pipeline — 4 prompts RAG-first
  // Principe : RAG = source de verite. Le LLM reformule, il n'invente RIEN.
  // ══════════════════════════════════════════════════════════════════

  r1_intent_lock: {
    system: `Tu es un architecte SEO specialise en pages transactionnelles e-commerce automobile.
Ta mission : verrouiller l'intention de recherche d'une page categorie (gamme de pieces auto).

REGLE FONDAMENTALE — RAG = SOURCE DE VERITE :
- TOUTE information technique doit provenir EXCLUSIVEMENT du corpus RAG fourni ci-dessous.
- Si une donnee n'est pas dans le corpus RAG, ecris "NON_DISPONIBLE" pour ce champ.
- Tu ne dois JAMAIS inventer de chiffres, normes, certifications ou statistiques.
- Les termes techniques doivent apparaitre textuellement dans le corpus RAG.
- Les preuves doivent etre extraites du corpus RAG (pas inventees).

REGLES SUPPLEMENTAIRES :
- L'intention est TOUJOURS transactionnelle (achat de pieces).
- Interdit : conseils de montage, tutoriels, diagnostics, comparatifs detailles.
- Genere exactement 3 interest_nuggets, chacun avec angle, hook et rag_source tracable.
- Les listes doivent etre exhaustives : forbidden_lexicon (25-35 items), allowed_lexicon (12-16 items), forbidden_topics (12-24 sujets interdits).
- allowed_subintents : choisis 3-6 parmi compatibility_checks, mounting_variants, identifier_check, exchange_standard, consigne, delivery_returns_support.
- Reponds UNIQUEMENT en JSON valide, sans markdown ni commentaire.`,
    user: (ctx) => {
      let prompt = `Gamme : ${ctx.gammeName}\n\n`;
      if (ctx.ragContent) {
        prompt += `=== CORPUS RAG (source de verite) ===\n${ctx.ragContent}\n\n`;
      }
      if (ctx.frontmatter) {
        const fm = ctx.frontmatter;
        if (fm.domain_role) prompt += `Role du domaine : ${fm.domain_role}\n`;
        if (fm.must_be_true?.length)
          prompt += `Verites obligatoires : ${fm.must_be_true.join(' | ')}\n`;
        if (fm.confusion_with?.length)
          prompt += `Paires confuses (a distinguer) : ${fm.confusion_with.join(' | ')}\n`;
        prompt += '\n';
      }
      if (
        ctx.boundaries &&
        typeof ctx.boundaries === 'object' &&
        Object.keys(ctx.boundaries as Record<string, unknown>).length > 0
      ) {
        prompt += `=== BOUNDARIES (keyword plan) ===\n`;
        const b = ctx.boundaries as Record<string, unknown>;
        if (b.forbidden_terms && Array.isArray(b.forbidden_terms)) {
          prompt += `Termes INTERDITS (limites R1) : ${(b.forbidden_terms as string[]).join(', ')}\n`;
        }
        if (b.max_scope) {
          prompt += `Perimetre max : ${b.max_scope}\n`;
        }
        if (b.role_boundary) {
          prompt += `Limite de role : ${b.role_boundary}\n`;
        }
        prompt += '\n';
      }
      if (
        ctx.r3RiskTerms &&
        Array.isArray(ctx.r3RiskTerms) &&
        ctx.r3RiskTerms.length > 0
      ) {
        prompt += `=== TERMES R3 A EVITER (anti-cannibalisation) ===\n`;
        prompt += `${(ctx.r3RiskTerms as string[]).join(', ')}\n\n`;
      }
      prompt += `Extrais du corpus RAG ci-dessus un JSON avec ces champs exactement :\n`;
      prompt += `{
  "gamme": "string — nom de la gamme",
  "primary_intent": "string — intention principale en 1 phrase transactionnelle (min 20 chars)",
  "role_id": "R1_ROUTER",
  "allowed_subintents": ["string[3-6] — choisis parmi: compatibility_checks, mounting_variants, identifier_check, exchange_standard, consigne, delivery_returns_support"],
  "forbidden_topics": ["string[12-24] — sujets strictement interdits sur cette page R1 : montage, diagnostic, comparatif, reparation, entretien, demontage, symptome, panne, voyant, tutoriel, avis, occasion..."],
  "interest_nuggets": [
    { "angle": "string — ex: compatibilite_vehicule, pieces_associees, reference_oe", "hook": "string — 1-2 phrases accrocheuses EXTRAITES du RAG (min 10 chars)", "rag_source": "string — reference RAG tracable ex: rag:gammes/xxx.md#section" }
  ],
  "forbidden_lexicon": ["string[25-35] — mots/expressions interdits : diagnostic, symptome, tuto, montage, universel, homologue CT, garanti a vie, etape, demonter, visser..."],
  "allowed_lexicon": ["string[12-16] — mots autorises : nom gamme, pieces associees, equipementiers, termes techniques du RAG, reference, compatible, vehicule..."],
  "confusion_pairs": [{ "term": "string", "confused_with": "string", "distinction": "string (min 10 chars)" }],
  "writing_constraints": {
    "max_words": 520,
    "min_words": 350,
    "tone": "expert-accessible",
    "person": "vous",
    "zero_diagnostic": true,
    "zero_howto": true
  },
  "content_contract": {
    "total_words_target": [350, 520],
    "micro_seo_words_target": [140, 170],
    "faq_answer_words_target": [30, 45],
    "max_gamme_mentions": "number — max repetitions du nom de gamme (5-8)",
    "max_compatible_mentions": "number — max mentions 'compatible' (3-5)"
  },
  "hard_rules": {
    "ban_howto_markers": ["string[] — ex: etape, visser, demonter, tutoriel, pas-a-pas"],
    "ban_absolute_claims": ["string[] — ex: garanti a vie, le meilleur, imbattable"],
    "ban_price_push": ["string[] — ex: pas cher, promo, solde, remise, discount"]
  }
}\n`;
      return prompt;
    },
  },

  r1_serp_pack: {
    system: `Tu es un redacteur SEO expert en titres et meta-descriptions pour e-commerce automobile.
Ta mission : generer le pack SERP (title, meta, H1, H2s) pour une page categorie transactionnelle.

REGLE FONDAMENTALE — RAG = SOURCE DE VERITE :
- Les mots-cles du title et de la meta-description DOIVENT apparaitre dans le corpus RAG.
- Le H1 doit utiliser le vocabulaire technique du corpus RAG, pas des synonymes inventes.
- Les H2s doivent correspondre aux sections effectivement couvertes par le corpus RAG.

REGLES SEO :
- Title : max 60 caracteres, inclure nom gamme + "compatible vehicule" + valeur (prix/livraison).
- Meta-description : max 155 caracteres, commence par nom gamme, inclut CTA.
- H1 : entre 40 et 70 caracteres, contient le nom de la gamme, pas de duplication du title.
- H2s : 3-5 sous-titres pour les sections de la page (pas de "Comment monter").
- Reponds UNIQUEMENT en JSON valide, sans markdown ni commentaire.`,
    user: (ctx) => {
      let prompt = `Gamme : ${ctx.gammeName}\n`;
      if (ctx.familyLabel) {
        prompt += `Famille : ${ctx.familyLabel}\n`;
      }
      prompt += '\n';
      if (ctx.intentLock) {
        prompt += `=== INTENT LOCK (P1) ===\n`;
        prompt += `Intention : ${ctx.intentLock.primary_intent}\n`;
        prompt += `Lexique autorise : ${(ctx.intentLock.allowed_lexicon || ctx.intentLock.termes_techniques || []).join(', ')}\n`;
        prompt += `Interdit : ${(ctx.intentLock.forbidden_lexicon || ctx.intentLock.forbidden_overlap || []).join(', ')}\n\n`;
      }
      if (ctx.ragContent) {
        prompt += `=== CORPUS RAG (mots-cles a utiliser) ===\n${ctx.ragContent}\n\n`;
      }
      if (ctx.selectionCriteria?.length) {
        prompt += `=== CRITERES DE SELECTION (RAG) ===\n${ctx.selectionCriteria.join('\n')}\n\n`;
      }
      if (
        ctx.headingPlan &&
        typeof ctx.headingPlan === 'object' &&
        Object.keys(ctx.headingPlan as Record<string, unknown>).length > 0
      ) {
        prompt += `=== HEADING PLAN (keyword plan) ===\n`;
        const hp = ctx.headingPlan as Record<string, unknown>;
        if (hp.h1_pattern) prompt += `Pattern H1 : ${hp.h1_pattern}\n`;
        if (hp.h2_list && Array.isArray(hp.h2_list)) {
          prompt += `H2 planifies : ${(hp.h2_list as string[]).join(' | ')}\n`;
        }
        if (hp.h2_order && Array.isArray(hp.h2_order)) {
          prompt += `Ordre H2 : ${(hp.h2_order as string[]).join(' > ')}\n`;
        }
        prompt += '\n';
      }
      if (
        ctx.queryClusters &&
        typeof ctx.queryClusters === 'object' &&
        Object.keys(ctx.queryClusters as Record<string, unknown>).length > 0
      ) {
        prompt += `=== CLUSTERS DE REQUETES (keyword plan) ===\n`;
        for (const [cluster, queries] of Object.entries(
          ctx.queryClusters as Record<string, unknown>,
        )) {
          if (Array.isArray(queries)) {
            prompt += `${cluster} : ${(queries as string[]).join(', ')}\n`;
          } else if (queries && typeof queries === 'object') {
            const q = queries as Record<string, unknown>;
            if (q.head_query) prompt += `${cluster} — head : ${q.head_query}\n`;
            if (q.long_tails && Array.isArray(q.long_tails)) {
              prompt += `${cluster} — long tails : ${(q.long_tails as string[]).join(', ')}\n`;
            }
          }
        }
        prompt += '\n';
      }
      prompt += `Genere un JSON avec ces champs exactement :\n`;
      prompt += `{
  "gamme": "string — nom de la gamme",
  "title_main": "string — title tag principal max 60 chars (mots-cles du RAG)",
  "title_variants": ["string[] — 2 variantes du title tag pour A/B test"],
  "meta_main": "string — meta description max 155 chars",
  "meta_variants": ["string[] — 1-2 variantes meta description"],
  "h1": "string — H1 entre 40-70 chars, contient nom gamme",
  "h2": ["string[] — 4-6 H2 correspondant aux sections R1 de la page"],
  "slug_canonical": "string — URL canonique /pieces/{alias}-{pgId}.html"
}\n`;
      return prompt;
    },
  },

  r1_section_copy: {
    system: `Tu es un copywriter e-commerce automobile expert en conversion.
Ta mission : rediger le contenu court de chaque section d'une page categorie transactionnelle R1.

REGLE FONDAMENTALE — RAG = SOURCE DE VERITE :
- Tu REFORMULES le contenu du corpus RAG fourni. Tu n'inventes RIEN.
- Chaque affirmation technique doit etre tracable au corpus RAG.
- Si le RAG ne couvre pas un sujet, ecris une phrase neutre sans inventer de details.

BUDGET MOTS : 350-520 mots total
- micro_seo_block : 140-170 mots
- faq_selector : 4 paires × 30-45 mots = 120-180 mots
- microcopy (hero, badges, selector, intros) : 50-90 mots

REGLES PAR CHAMP :
- hero_subtitle : 1 phrase max 80 chars, renforce la promesse du H1.
- proof_badges : exactement 4 badges courts (max 25 chars chacun).
- selector_microcopy : 2 phrases d'aide max 60 chars chacune.
- micro_seo_block : 2-3 phrases (max 200 chars total) sur la gamme, REFORMULANT le RAG.
- compatibilities_intro : 1 phrase presentant la section compatibilites.
- equipementiers_line : 1 phrase presentant les equipementiers.
- faq_selector : 4 questions/reponses liees au selecteur vehicule et a l'achat.
- family_cross_sell_intro : 1 phrase de transition vers le catalogue famille.
- hero_cta_helper_line : 1 phrase (max 180 chars) expliquant le CTA hero "Utiliser le selecteur vehicule". Contextualiser avec la gamme. Reformuler depuis le RAG.
- safe_table_rows : array de 4-6 lignes de verification compatibilite. Chaque ligne = { element, how, icon }.
  SUGGESTIONS (choisir 4-6 parmi + 1-2 custom si pertinent) :
  * Montage / version vehicule → Selectionner marque, modele et motorisation
  * Reference OE constructeur → Comparer avec la fiche produit
  * Type / technologie → Verifier la compatibilite (hydraulique/electrique/mecanique)
  * Pieces associees recommandees → Commander groupe si usure simultanee
  * Consigne / echange standard → Verifier les conditions de retour
  * Connectique / fixation → Verifier le nombre de broches et le type de connecteur
  * Dimensions exactes → Mesurer l'ancienne piece ou verifier la fiche technique
  * Conditions de retour → Consulter la politique retour avant montage
- Interdit : conseils montage, diagnostics, tutoriels.
- Reponds UNIQUEMENT en JSON valide, sans markdown ni commentaire.`,
    user: (ctx) => {
      let prompt = `Gamme : ${ctx.gammeName}\n`;
      if (ctx.productCount) {
        prompt += `Nombre de produits dans la gamme : ${ctx.productCount}\n`;
      }
      prompt += '\n';
      if (ctx.ragContent) {
        prompt += `=== CORPUS RAG (source de verite — reformule, n'invente pas) ===\n${ctx.ragContent}\n\n`;
      }
      if (ctx.htmlDraft) {
        prompt += `=== SQUELETTE HTML (compile depuis le RAG — a reformuler et enrichir) ===\n${ctx.htmlDraft}\n\n`;
      }
      if (ctx.intentLock) {
        prompt += `=== INTENT LOCK ===\nIntention : ${ctx.intentLock.primary_intent}\n`;
        const wc = ctx.intentLock.writing_constraints;
        if (wc && typeof wc === 'object' && !Array.isArray(wc)) {
          prompt += `Ton : ${wc.tone || 'expert-accessible'}, Personne : ${wc.person || 'vous'}, Budget : ${wc.min_words || 350}-${wc.max_words || 520} mots\n`;
        } else {
          prompt += `Contraintes : ${(Array.isArray(wc) ? wc : []).join(', ')}\n`;
        }
        prompt += `Interdit : ${(ctx.intentLock.forbidden_lexicon || ctx.intentLock.forbidden_overlap || []).join(', ')}\n`;
        if (ctx.intentLock.content_contract) {
          const cc = ctx.intentLock.content_contract;
          prompt += `Budget mots detaille : total=${JSON.stringify(cc.total_words_target)}, micro_seo=${JSON.stringify(cc.micro_seo_words_target)}, faq=${JSON.stringify(cc.faq_answer_words_target)}\n`;
          prompt += `Limites mentions : gamme max ${cc.max_gamme_mentions}, compatible max ${cc.max_compatible_mentions}\n`;
        }
        if (ctx.intentLock.hard_rules) {
          const hr = ctx.intentLock.hard_rules;
          prompt += `INTERDIT howto : ${hr.ban_howto_markers.join(', ')}\n`;
          prompt += `INTERDIT absolus : ${hr.ban_absolute_claims.join(', ')}\n`;
          prompt += `INTERDIT prix : ${hr.ban_price_push.join(', ')}\n`;
        }
        prompt += '\n';
      }
      if (ctx.serpPack) {
        prompt += `=== SERP PACK ===\nH1 : ${ctx.serpPack.h1}\nH2s : ${(ctx.serpPack.h2 || ctx.serpPack.h2s || []).join(' | ')}\n\n`;
      }
      if (ctx.brief) {
        prompt += `=== BRIEF SEO (contraintes de la page) ===\n`;
        prompt += `Intention : ${ctx.brief.primary_intent || 'non definie'}\n`;
        prompt += `Interdit : ${(ctx.brief.forbidden_overlap || []).join(', ') || 'aucun'}\n`;
        const bwc = ctx.brief.writing_constraints;
        if (bwc && typeof bwc === 'object' && !Array.isArray(bwc)) {
          prompt += `Budget : ${bwc.min_words || 350}-${bwc.max_words || 520} mots\n`;
        } else {
          prompt += `Contraintes : ${(Array.isArray(bwc) ? bwc : []).join(', ') || 'aucune'}\n`;
        }
        prompt += '\n';
      }
      if (ctx.sectionTerms && typeof ctx.sectionTerms === 'object') {
        prompt += `=== MOTS-CLES SEO (keyword plan) ===\n`;
        for (const [section, terms] of Object.entries(ctx.sectionTerms)) {
          if (terms && typeof terms === 'object') {
            const t = terms as Record<string, unknown>;
            if (t.include_terms && Array.isArray(t.include_terms)) {
              prompt += `${section} — Termes a inclure : ${(t.include_terms as string[]).join(', ')}\n`;
            }
            if (t.micro_phrases && Array.isArray(t.micro_phrases)) {
              prompt += `${section} — Exemples de phrases : ${(t.micro_phrases as string[]).join(' | ')}\n`;
            }
            if (t.forbidden_overlap && Array.isArray(t.forbidden_overlap)) {
              prompt += `${section} — Termes INTERDITS : ${(t.forbidden_overlap as string[]).join(', ')}\n`;
            }
          }
        }
        prompt += '\n';
      }
      prompt += `Ta mission : REFORMULER et ENRICHIR le squelette HTML en respectant le brief et le corpus RAG.\n\n`;
      prompt += `Genere un JSON avec ces champs exactement :\n`;
      prompt += `{
  "hero_subtitle": "string — max 80 chars",
  "proof_badges": ["string[4] — exactement 4 badges max 25 chars"],
  "selector_microcopy": ["string[2] — 2 phrases d'aide max 60 chars"],
  "micro_seo_block": "string — 140-170 mots REFORMULANT le corpus RAG",
  "compatibilities_intro": "string — 1 phrase",
  "equipementiers_line": "string — 1 phrase",
  "faq_selector": [{ "question": "string", "answer": "string — 30-45 mots, TRACABLE au RAG" }],
  "family_cross_sell_intro": "string — 1 phrase",
  "hero_cta_helper_line": "string — 1 phrase max 180 chars, aide contextuelle CTA hero selecteur vehicule",
  "safe_table_rows": [{ "element": "string", "how": "string", "icon": "string|null" }]
}\n`;
      return prompt;
    },
  },

  r1_gatekeeper: {
    system: `Tu es un auditeur qualite SEO pour pages transactionnelles e-commerce automobile.
Ta mission : valider le contenu genere pour une page categorie R1.

REGLE FONDAMENTALE — TRACABILITE RAG :
- Verifie que chaque affirmation technique du contenu P3 est TRACABLE au corpus RAG.
- Compare les citations RAG fournies avec le contenu genere.
- Si une affirmation n'a pas de source RAG correspondante → flag "unverified_claim".
- Score < 80 automatiquement si des claims ne sont pas verifiables dans le RAG.

CRITERES DE SCORING (0-100) :
- Tracabilite RAG : chaque fait technique doit avoir une source (0-30)
- Coherence avec l'intention transactionnelle (0-20)
- Respect des contraintes de longueur et budget mots (0-20)
- Absence de contenu hors-role (montage, diagnostic, tutoriel) (0-15)
- Qualite redactionnelle et persuasion (0-15)

FLAGS possibles :
- "unverified_claim" — affirmation technique sans source RAG
- "too_long" — un champ depasse sa limite de caracteres
- "off_role" — contenu hors intention transactionnelle detecte
- "duplicate" — contenu trop similaire a une autre gamme
- "low_quality" — redaction generique ou sans valeur ajoutee
- "missing_field" — champ requis manquant ou vide
- "budget_exceeded" — budget mots total depasse 520

CHECKS SUPPLEMENTAIRES (si content_contract et hard_rules fournis) :
- Verifier que les termes de hard_rules.ban_howto_markers sont ABSENTS du contenu P3.
- Verifier que les termes de hard_rules.ban_absolute_claims sont ABSENTS du contenu P3.
- Verifier que les termes de hard_rules.ban_price_push sont ABSENTS du contenu P3.
- Verifier le budget mots total vs content_contract.total_words_target.

Si score >= 80 ET aucun "unverified_claim" : le contenu est valide.
Si score < 80 : renvoyer les corrections necessaires.
Reponds UNIQUEMENT en JSON valide, sans markdown ni commentaire.`,
    user: (ctx) => {
      let prompt = `Gamme : ${ctx.gammeName}\n\n`;
      prompt += `=== CONTENU A VALIDER (P3) ===\n${JSON.stringify(ctx.sectionCopy, null, 2)}\n\n`;
      if (ctx.intentLock) {
        prompt += `=== INTENT LOCK ===\nIntention : ${ctx.intentLock.primary_intent}\n`;
        prompt += `Interdit : ${(ctx.intentLock.forbidden_lexicon || ctx.intentLock.forbidden_overlap || []).join(', ')}\n`;
        if (ctx.intentLock.content_contract) {
          prompt += `Content contract : ${JSON.stringify(ctx.intentLock.content_contract)}\n`;
        }
        if (ctx.intentLock.hard_rules) {
          prompt += `Hard rules : ${JSON.stringify(ctx.intentLock.hard_rules)}\n`;
        }
        prompt += '\n';
      }
      if (ctx.ragCitationsUsed?.length) {
        prompt += `=== CITATIONS RAG DISPONIBLES (source de verite) ===\n`;
        ctx.ragCitationsUsed.forEach((citation: string, i: number) => {
          prompt += `[${i + 1}] ${citation}\n`;
        });
        prompt += `\nVerifie que chaque affirmation technique du contenu ci-dessus est tracable a l'une de ces citations.\n\n`;
      }
      prompt += `Genere un JSON avec ces champs exactement :\n`;
      prompt += `{
  "gamme": "string — nom de la gamme",
  "gate_score": "number 0-100",
  "gate_status": "PASS | WARN | FAIL",
  "checks": {
    "word_count": { "status": "PASS|WARN|FAIL", "total": "number", "range": "350-520" },
    "forbidden_words": { "status": "PASS|WARN|FAIL", "found": ["string[]"] },
    "anti_cannibalization": { "status": "PASS|WARN|FAIL", "diagnostic_words_found": [], "howto_markers_found": [] },
    "rag_traceability": { "status": "PASS|WARN|FAIL", "claims_checked": "number", "claims_sourced": "number", "unsourced_details": [] },
    "tone_check": { "status": "PASS|WARN|FAIL", "person": "vous", "superlatives_found": [] },
    "hard_rules_check": { "status": "PASS|WARN|FAIL", "howto_found": [], "absolutes_found": [], "price_push_found": [] },
    "content_contract_check": { "status": "PASS|WARN|FAIL", "total_words": "number", "target": [350, 520] }
  },
  "fixes_applied": [{ "field": "string", "before": "string", "after": "string" }],
  "version_clean": "string — ex: v1.0 — no fixes needed"
}\n`;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

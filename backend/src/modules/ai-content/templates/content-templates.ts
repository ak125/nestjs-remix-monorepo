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

/**
 * Brand Rules Seed — default rules for marketing hub
 *
 * Run via: npx ts-node scripts/marketing/seed-brand-rules.ts
 * Or import in a migration script to INSERT INTO __marketing_brand_rules
 */

import type {
  BrandRuleType,
  BrandRuleSeverity,
  SocialChannel,
} from '../interfaces/marketing-hub.interfaces';

interface BrandRuleSeed {
  rule_type: BrandRuleType;
  channel: SocialChannel | null; // null = all channels
  rule_key: string;
  rule_value: Record<string, unknown>;
  severity: BrandRuleSeverity;
}

export const BRAND_RULES_SEED: BrandRuleSeed[] = [
  // ── TONE ──
  {
    rule_type: 'tone',
    channel: 'instagram',
    rule_key: 'voice_style',
    rule_value: {
      style: 'tutoiement',
      description:
        'Tutoiement obligatoire sur Instagram. Ton professionnel mais accessible.',
      examples_good: [
        'Tu cherches des plaquettes de frein ?',
        'Sauvegarde ce post pour plus tard !',
      ],
      examples_bad: ['Vous trouverez nos produits...', 'Veuillez consulter...'],
    },
    severity: 'warn',
  },
  {
    rule_type: 'tone',
    channel: 'facebook',
    rule_key: 'voice_style',
    rule_value: {
      style: 'vouvoiement_accepte',
      description:
        'Vouvoiement ou tutoiement selon le contexte. Ton un peu plus formel que IG.',
      examples_good: [
        'Retrouvez nos meilleures offres',
        'Vous cherchez une piece compatible ?',
      ],
      examples_bad: ['Hey les gars !', 'PROMO FOLLE !!!'],
    },
    severity: 'warn',
  },
  {
    rule_type: 'tone',
    channel: 'youtube',
    rule_key: 'voice_style',
    rule_value: {
      style: 'pedagogique',
      description:
        'Ton pedagogique et expert. Tutoiement OK dans les Shorts, vouvoiement dans les longues.',
      examples_good: [
        'Dans cette video, on va voir comment...',
        'Tu te demandes quand changer tes plaquettes ?',
      ],
      examples_bad: ['ACHETEZ MAINTENANT', 'Cliquez sur le lien'],
    },
    severity: 'warn',
  },
  {
    rule_type: 'tone',
    channel: null,
    rule_key: 'emoji_count',
    rule_value: {
      min: 2,
      max: 3,
      position: 'debut_de_ligne',
      description: '2-3 emojis par post, en debut de ligne uniquement',
    },
    severity: 'warn',
  },
  {
    rule_type: 'tone',
    channel: null,
    rule_key: 'language',
    rule_value: {
      required: 'fr',
      description: 'Francais obligatoire. Pas d anglicismes inutiles.',
      forbidden_patterns: [
        'check out',
        'deal',
        'best price ever',
        'game changer',
      ],
    },
    severity: 'block',
  },

  // ── FORBIDDEN WORDS ──
  {
    rule_type: 'forbidden_word',
    channel: null,
    rule_key: 'competitors',
    rule_value: {
      words: [
        'oscaro',
        'mister-auto',
        'mister auto',
        'autodoc',
        'euromaster',
        'norauto',
        'feu vert',
        'carter-cash',
        'yakarouler',
      ],
      description: 'JAMAIS mentionner de concurrents',
    },
    severity: 'block',
  },
  {
    rule_type: 'forbidden_word',
    channel: null,
    rule_key: 'superlatives',
    rule_value: {
      words: [
        'le moins cher',
        'le meilleur prix',
        'garanti a vie',
        'imbattable',
        'le plus fiable',
        'numero 1',
        'n°1',
        'leader',
      ],
      description:
        'Pas de claims superlatifs non prouvables (concurrence deloyale)',
    },
    severity: 'block',
  },
  {
    rule_type: 'forbidden_word',
    channel: null,
    rule_key: 'aggressive_cta',
    rule_value: {
      words: [
        'ACHETEZ MAINTENANT',
        'OFFRE LIMITEE',
        'DERNIERE CHANCE',
        'URGENT',
        'NE RATEZ PAS',
        'PROFITEZ VITE',
      ],
      description: 'Pas de CTA agressifs en majuscules. Ton commercial mesure.',
    },
    severity: 'warn',
  },

  // ── REQUIRED ELEMENTS ──
  {
    rule_type: 'required_element',
    channel: 'instagram',
    rule_key: 'hashtags',
    rule_value: {
      min: 20,
      max: 25,
      must_include: ['#automecanik'],
      position: 'commentaire_separe',
      description:
        'IG : 20-25 hashtags en commentaire separe (pas dans le texte). #automecanik obligatoire en premier.',
    },
    severity: 'warn',
  },
  {
    rule_type: 'required_element',
    channel: 'facebook',
    rule_key: 'hashtags',
    rule_value: {
      min: 3,
      max: 5,
      must_include: ['#automecanik'],
      position: 'integre_texte',
      description: 'FB : 3-5 hashtags integres dans le texte.',
    },
    severity: 'info',
  },
  {
    rule_type: 'required_element',
    channel: 'youtube',
    rule_key: 'tags',
    rule_value: {
      min: 5,
      max: 15,
      must_include: ['automecanik', 'pieces auto'],
      description: 'YT : 5-15 tags, dont "automecanik" et "pieces auto".',
    },
    severity: 'warn',
  },
  {
    rule_type: 'required_element',
    channel: null,
    rule_key: 'cta',
    rule_value: {
      description:
        'Chaque post doit contenir au moins 1 CTA (lien bio, sauvegarde, partage, commentaire, achat).',
      valid_ctas: [
        'Lien en bio',
        'Sauvegarde ce post',
        'Partage avec un ami',
        'Dis-nous en commentaire',
        'Commandez en ligne',
        'Retrouvez-nous sur automecanik.com',
      ],
    },
    severity: 'warn',
  },
  {
    rule_type: 'required_element',
    channel: null,
    rule_key: 'utm_link',
    rule_value: {
      description:
        'Tous les liens doivent contenir utm_source, utm_medium, utm_campaign.',
      required_params: ['utm_source', 'utm_medium', 'utm_campaign'],
    },
    severity: 'block',
  },
  {
    rule_type: 'required_element',
    channel: null,
    rule_key: 'brand_mention',
    rule_value: {
      description:
        'Le nom "Automecanik" ou "automecanik.com" doit apparaitre au moins 1 fois.',
      patterns: ['Automecanik', 'automecanik.com', '@automecanik'],
    },
    severity: 'warn',
  },

  // ── LEGAL ──
  {
    rule_type: 'legal',
    channel: null,
    rule_key: 'max_caption_length',
    rule_value: {
      instagram: 2200,
      facebook: 500,
      youtube_title: 100,
      youtube_description: 5000,
    },
    severity: 'block',
  },

  // ── VISUAL ──
  {
    rule_type: 'visual',
    channel: 'instagram',
    rule_key: 'dimensions',
    rule_value: {
      post_carre: '1080x1080',
      post_portrait: '1080x1350',
      story_reel: '1080x1920',
      profil: '320x320',
      description: 'Dimensions Instagram obligatoires.',
    },
    severity: 'info',
  },
  {
    rule_type: 'visual',
    channel: null,
    rule_key: 'brand_colors',
    rule_value: {
      primary_red: '#FF3B30',
      navy_blue: '#0F4C81',
      green: '#1FDC93',
      white: '#FFFFFF',
      black: '#1A1A1A',
      description: 'Charte Automecanik. CTA = rouge, fonds = bleu marine.',
    },
    severity: 'info',
  },
  {
    rule_type: 'visual',
    channel: null,
    rule_key: 'typography',
    rule_value: {
      headings: 'Montserrat Bold',
      body: 'Inter Regular',
    },
    severity: 'info',
  },

  // ── CLAIMS POLICY ──
  {
    rule_type: 'claims_policy',
    channel: null,
    rule_key: 'price_claims',
    rule_value: {
      rule: 'Prix mentionne uniquement si price_source fourni dans le brief.',
      required_fields: ['value', 'table', 'updated_at'],
      max_age_hours: 24,
      description:
        'Un prix affiche doit venir de la DB avec source et timestamp < 24h.',
    },
    severity: 'block',
  },
  {
    rule_type: 'claims_policy',
    channel: null,
    rule_key: 'delivery_claims',
    rule_value: {
      exact_wording: 'Livraison gratuite des 150\u20ac',
      forbidden_variations: [
        'Livraison offerte',
        'Livraison gratuite sans minimum',
        'Frais de port offerts',
      ],
      description:
        'Seule la formulation exacte est autorisee. Pas de variations.',
    },
    severity: 'block',
  },
  {
    rule_type: 'claims_policy',
    channel: null,
    rule_key: 'compatibility_claims',
    rule_value: {
      exact_wording: 'Trouvez votre piece compatible sur automecanik.com',
      description:
        'Renvoyer vers le selecteur vehicule, ne pas lister de compatibilites specifiques dans les posts.',
    },
    severity: 'warn',
  },
  {
    rule_type: 'claims_policy',
    channel: null,
    rule_key: 'review_claims',
    rule_value: {
      rule: 'Social proof uniquement avec reviews verifiees (verified_purchase = true).',
      min_rating: 4,
      required_fields: ['rating', 'text', 'verified'],
      description:
        'Pilier confiance : DOIT utiliser des reviews reelles et verifiees.',
    },
    severity: 'block',
  },
];

/**
 * Generate SQL INSERT for seeding brand rules.
 * Usage: console.log(generateSeedSQL());
 */
export function generateSeedSQL(): string {
  const values = BRAND_RULES_SEED.map((rule) => {
    const channel = rule.channel ? `'${rule.channel}'` : 'NULL';
    const ruleValue = JSON.stringify(rule.rule_value).replace(/'/g, "''");
    return `  ('${rule.rule_type}', ${channel}, '${rule.rule_key}', '${ruleValue}'::jsonb, '${rule.severity}', true)`;
  }).join(',\n');

  return `INSERT INTO __marketing_brand_rules (rule_type, channel, rule_key, rule_value, severity, active)
VALUES
${values}
ON CONFLICT (rule_type, COALESCE(channel, '__all'), rule_key) DO UPDATE SET
  rule_value = EXCLUDED.rule_value,
  severity = EXCLUDED.severity,
  active = EXCLUDED.active;`;
}

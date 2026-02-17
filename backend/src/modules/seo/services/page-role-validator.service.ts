import { Injectable, Logger } from '@nestjs/common';
import {
  PageRole,
  getPageRoleFromUrl,
  getR3SubRoleFromUrl,
  PAGE_ROLE_META,
  isLinkAllowed,
  isRoleAbove,
} from '../types/page-role.types';

/**
 * Type de violation des règles de rôle
 */
export type RoleViolationType =
  | 'word_count'
  | 'forbidden_keyword'
  | 'forbidden_block'
  | 'invalid_link'
  | 'missing_element'
  | 'missing_canonical'
  | 'invalid_canonical'
  | 'role_mismatch'
  | 'exclusive_vocab_violation';

/**
 * Sévérité de la violation
 */
export type ViolationSeverity = 'warning' | 'error';

/**
 * Structure d'une violation de règle
 */
export interface RoleViolation {
  type: RoleViolationType;
  message: string;
  severity: ViolationSeverity;
  details?: Record<string, unknown>;
}

/**
 * Résultat de validation d'une page
 */
export interface PageValidationResult {
  url: string;
  detectedRole: PageRole | null;
  declaredRole?: PageRole;
  isValid: boolean;
  violations: RoleViolation[];
}

/**
 * Service de validation des rôles de pages SEO
 *
 * Vérifie que les pages respectent les règles de leur rôle:
 * - R1 Routeur: ≤150 mots, pas de symptômes
 * - R2 Produit: prix/CTA requis, compatibilité claire
 * - R3 Blog: pas de filtres, ton pédagogique
 * - R4 Référence: définition intemporelle, pas de véhicule
 * - R5 Diagnostic: symptômes requis
 * - R6 Support: contenu informatif
 */
@Injectable()
export class PageRoleValidatorService {
  private readonly logger = new Logger(PageRoleValidatorService.name);

  // =====================================================
  // GATES ANTI-ERREUR: Listes de mots interdits par rôle
  // =====================================================

  /**
   * R1 Routeur: Mots "expert" interdits
   * Ces mots indiquent du contenu diagnostic/expert qui n'a pas sa place
   */
  private readonly FORBIDDEN_KEYWORDS_R1 = [
    // Symptômes
    'bruit',
    'usé',
    'cassé',
    'problème',
    'symptôme',
    'panne',
    'défaillance',
    'vibration',
    'claquement',
    // Questions expertes
    'quand',
    'pourquoi',
    'comment diagnostiquer',
    'comment savoir',
    // Risques/Causes
    'causes',
    'risques',
    'danger',
    'conséquences',
    'si vous ne changez pas',
  ];

  /**
   * R2 Produit: Mots-clés requis (au moins un)
   */
  private readonly REQUIRED_KEYWORDS_R2 = [
    'prix',
    '€',
    'euro',
    'ajouter',
    'panier',
    'acheter',
    'commander',
    'en stock',
    'livraison',
  ];

  /**
   * R2 Produit: Blocs interdits (sélection véhicule globale)
   */
  private readonly FORBIDDEN_BLOCKS_R2 = [
    'choisir son véhicule',
    'choisissez votre véhicule',
    'sélectionnez votre marque',
    'toutes les marques',
    'tous les modèles',
  ];

  /**
   * R3/R4: Blocs "sélection véhicule" ou "filtres" interdits
   */
  private readonly FORBIDDEN_BLOCKS_R3_R4 = [
    'sélectionnez votre véhicule',
    'choisir votre véhicule',
    'filtrer par',
    'trier par',
    'affiner la recherche',
    'filtres',
    'tous les véhicules compatibles',
  ];

  /**
   * R4 Référence: Mots commerciaux interdits (prix/CTA)
   */
  private readonly FORBIDDEN_KEYWORDS_R4_COMMERCIAL = [
    'prix',
    '€',
    'euro',
    'acheter',
    'commander',
    'ajouter au panier',
    'livraison',
    'en stock',
    'promotion',
    'promo',
    'solde',
    '-% de réduction',
  ];

  /**
   * R5 Diagnostic: Mots-cles requis (au moins un pour identifier un diagnostic)
   */
  private readonly REQUIRED_KEYWORDS_R5 = [
    'symptôme',
    'symptômes',
    'diagnostic',
    'diagnostiquer',
    'bruit',
    'vibration',
    'panne',
    'problème',
    'signe',
    'code dtc',
    'code obd',
  ];

  /**
   * R5 Diagnostic: Mots commerciaux interdits
   */
  private readonly FORBIDDEN_KEYWORDS_R5_COMMERCIAL = [
    'prix',
    '€',
    'euro',
    'acheter',
    'commander',
    'ajouter au panier',
    'livraison',
    'en stock',
    'promotion',
  ];

  /**
   * R4 Référence: Mentions véhicules spécifiques interdites
   */
  private readonly FORBIDDEN_KEYWORDS_R4_VEHICLES = [
    'peugeot',
    'renault',
    'citroen',
    'volkswagen',
    'audi',
    'bmw',
    'mercedes',
    'ford',
    'opel',
    'fiat',
    'toyota',
    'nissan',
    '206',
    '208',
    '308',
    '3008',
    'clio',
    'megane',
    'golf',
    'polo',
    'a3',
    'a4',
  ];

  // =====================================================
  // VOCABULAIRE EXCLUSIF: Mots réservés à un seul rôle
  // (SEO "quasi-incopiable" - signaux anti-cannibalisation)
  // =====================================================

  /**
   * Vocabulaire EXCLUSIF R2 Produit
   * Ces mots ne peuvent apparaître QUE sur des pages R2
   * Présence ailleurs = cannibalisation potentielle
   */
  private readonly EXCLUSIVE_VOCAB_R2: string[] = [
    '€',
    'prix',
    'ajouter au panier',
    'commander',
    'livraison gratuite',
    'en stock',
    'rupture de stock',
    'garantie constructeur',
    'réf. constructeur',
    'frais de port',
  ];

  /**
   * Vocabulaire EXCLUSIF R4 Référence
   * Ces mots ne peuvent apparaître QUE sur des pages R4
   * Présence ailleurs = cannibalisation potentielle
   */
  private readonly EXCLUSIVE_VOCAB_R4: string[] = [
    'définition',
    "qu'est-ce que",
    "qu'est-ce qu'",
    'désigne',
    'se compose de',
    'composé de',
    'terme technique',
    'vocabulaire auto',
    'glossaire',
    'par définition',
    'au sens strict',
    'ne pas confondre avec',
  ];

  /**
   * Vocabulaire EXCLUSIF R5 Diagnostic
   * Ces mots ne peuvent apparaître QUE sur des pages R5
   * Présence ailleurs = cannibalisation potentielle
   */
  private readonly EXCLUSIVE_VOCAB_R5: string[] = [
    'symptôme',
    'symptômes',
    'bruit anormal',
    'vibration anormale',
    // 'quand changer', 'quand remplacer' — déplacés en PARTAGÉ R5/R3 (page-roles.md)
    'comment savoir si',
    'signe de',
    'signes de',
    'diagnostic',
    'diagnostiquer',
    'panne potentielle',
    'usure prématurée',
    'code dtc',
    'code obd',
  ];

  /**
   * Vocabulaire EXCLUSIF R3/conseils (How-To)
   * Ces mots ne peuvent apparaître QUE sur des pages R3/conseils
   * Présence ailleurs = cannibalisation potentielle
   */
  private readonly EXCLUSIVE_VOCAB_R3_CONSEILS: string[] = [
    'démontage',
    'démonter',
    'dépose',
    'remontage',
    'remonter',
    'repose',
    'étapes de remplacement',
    'pas à pas',
    'outils nécessaires',
    'outils indispensables',
    'couple de serrage',
    'ordre de démontage',
    'ordre de remontage',
    "temps d'intervention",
    'temps estimé',
    'niveau de difficulté',
    'vérifier après remontage',
    'vérification finale',
    'essai routier',
    'essai progressif',
    'avant de commencer',
    'contrôler en même temps',
  ];

  /**
   * Map rôle → vocabulaire exclusif pour validation croisée
   * Note: R3/conseils n'est pas dans cette map car il partage PageRole.R3_BLOG
   * avec guide-achat. La validation R3/conseils est gérée séparément via URL.
   */
  private readonly EXCLUSIVE_VOCAB_MAP: Map<PageRole, string[]> = new Map([
    [PageRole.R2_PRODUCT, this.EXCLUSIVE_VOCAB_R2],
    [PageRole.R4_REFERENCE, this.EXCLUSIVE_VOCAB_R4],
    [PageRole.R5_DIAGNOSTIC, this.EXCLUSIVE_VOCAB_R5],
  ]);

  /**
   * Valide une page R1 Routeur
   */
  validateR1Router(content: string): RoleViolation[] {
    const violations: RoleViolation[] = [];
    const wordCount = this.countWords(content);

    // Check: ≤ 150 mots
    const maxWords = PAGE_ROLE_META[PageRole.R1_ROUTER].maxWords || 150;
    if (wordCount > maxWords) {
      violations.push({
        type: 'word_count',
        message: `R1 Routeur: ${wordCount} mots (max ${maxWords})`,
        severity: 'error',
        details: { wordCount, maxWords },
      });
    }

    // Check: Aucun mot-clé symptôme
    const lowerContent = content.toLowerCase();
    for (const keyword of this.FORBIDDEN_KEYWORDS_R1) {
      if (lowerContent.includes(keyword)) {
        violations.push({
          type: 'forbidden_keyword',
          message: `R1 Routeur: mot interdit "${keyword}" (contenu diagnostic/expert)`,
          severity: 'error',
          details: { keyword },
        });
      }
    }

    return violations;
  }

  /**
   * Valide une page R2 Produit
   * GATES: prix/CTA requis, pas de "choisir son véhicule"
   */
  validateR2Product(content: string): RoleViolation[] {
    const violations: RoleViolation[] = [];
    const lowerContent = content.toLowerCase();

    // Check: Présence prix/CTA
    const hasRequiredElement = this.REQUIRED_KEYWORDS_R2.some((kw) =>
      lowerContent.includes(kw),
    );
    if (!hasRequiredElement) {
      violations.push({
        type: 'missing_element',
        message: 'R2 Produit: aucun prix ou CTA détecté',
        severity: 'warning',
        details: { requiredKeywords: this.REQUIRED_KEYWORDS_R2 },
      });
    }

    // GATE: Pas de bloc "choisir son véhicule" (réservé à R1)
    for (const block of this.FORBIDDEN_BLOCKS_R2) {
      if (lowerContent.includes(block)) {
        violations.push({
          type: 'forbidden_block',
          message: `R2 Produit: bloc interdit "${block}" (sélection véhicule = R1)`,
          severity: 'error',
          details: { block },
        });
      }
    }

    return violations;
  }

  /**
   * Valide une page R3 Blog/Expert
   * GATES: pas de filtres, pas de sélection produit
   */
  validateR3Blog(content: string): RoleViolation[] {
    const violations: RoleViolation[] = [];
    const lowerContent = content.toLowerCase();

    // GATE: Pas de blocs filtres/sélection véhicule
    for (const block of this.FORBIDDEN_BLOCKS_R3_R4) {
      if (lowerContent.includes(block)) {
        violations.push({
          type: 'forbidden_block',
          message: `R3 Blog: bloc interdit "${block}" (filtres/sélection = R1)`,
          severity: 'error',
          details: { block },
        });
      }
    }

    return violations;
  }

  /**
   * Valide une page R3/conseils (How-To)
   * GATES: pas de contenu encyclopédique, pas de vocabulaire commercial,
   * liens R4/R5 requis, phrases génériques détectées
   *
   * Phase 1: tous WARNING sauf ENCYCLOPEDIC_OVERLAP (ERROR immédiat)
   */
  validateR3Conseils(content: string, _url: string): RoleViolation[] {
    const violations: RoleViolation[] = [];
    const lowerContent = content.toLowerCase();

    // Appliquer d'abord les gates R3 génériques (filtres/sélection)
    violations.push(...this.validateR3Blog(content));

    // GATE: ENCYCLOPEDIC_OVERLAP (ERROR day 1 — cannibalisation réelle R4)
    const r4Terms = [
      'définition',
      'composé de',
      'glossaire',
      'par définition',
      'au sens strict',
      'terme technique',
    ];
    const foundR4Terms = r4Terms.filter((t) => lowerContent.includes(t));
    if (foundR4Terms.length >= 2) {
      violations.push({
        type: 'exclusive_vocab_violation',
        message: `R3/conseils: ${foundR4Terms.length} termes R4 Référence détectés (${foundR4Terms.join(', ')}) — contenu encyclopédique sur page how-to`,
        severity: 'error',
        details: { flag: 'ENCYCLOPEDIC_OVERLAP', terms: foundR4Terms },
      });
    }

    // GATE: PURCHASE_VOCABULARY (WARNING Phase 1)
    const purchaseTerms = [
      'prix',
      '€',
      'euro',
      'en stock',
      'livraison',
      'promotion',
      'frais de port',
      'ajouter au panier',
    ];
    for (const term of purchaseTerms) {
      if (lowerContent.includes(term)) {
        violations.push({
          type: 'forbidden_keyword',
          message: `R3/conseils: vocabulaire commercial "${term}" interdit (R2 Product)`,
          severity: 'warning',
          details: { flag: 'PURCHASE_VOCABULARY', keyword: term },
        });
        break; // Un seul suffit
      }
    }

    // GATE: GENERIC_PHRASES (WARNING Phase 1)
    const genericPhrases = [
      'joue un rôle essentiel',
      'assure le bon fonctionnement',
      'est un élément important',
      'il est important de noter',
    ];
    for (const phrase of genericPhrases) {
      if (lowerContent.includes(phrase)) {
        violations.push({
          type: 'forbidden_keyword',
          message: `R3/conseils: phrase générique AI "${phrase}" détectée`,
          severity: 'warning',
          details: { flag: 'GENERIC_PHRASES', phrase },
        });
        break;
      }
    }

    // GATE: NO_LINK_TO_R4 (WARNING Phase 1)
    if (!lowerContent.includes('/reference-auto/')) {
      violations.push({
        type: 'missing_element',
        message:
          'R3/conseils: aucun lien vers /reference-auto/ (maillage R4 manquant)',
        severity: 'warning',
        details: { flag: 'NO_LINK_TO_R4' },
      });
    }

    // GATE: NO_LINK_TO_R5 (WARNING Phase 1)
    if (!lowerContent.includes('/diagnostic-auto/')) {
      violations.push({
        type: 'missing_element',
        message:
          'R3/conseils: aucun lien vers /diagnostic-auto/ (maillage R5 manquant)',
        severity: 'warning',
        details: { flag: 'NO_LINK_TO_R5' },
      });
    }

    return violations;
  }

  /**
   * Valide une page R4 Référence
   * GATES: pas de véhicule, pas de prix/CTA, pas de filtres
   */
  validateR4Reference(content: string): RoleViolation[] {
    const violations: RoleViolation[] = [];
    const lowerContent = content.toLowerCase();

    // GATE: Pas de marques/modèles spécifiques (doit rester générique)
    for (const keyword of this.FORBIDDEN_KEYWORDS_R4_VEHICLES) {
      if (lowerContent.includes(keyword)) {
        violations.push({
          type: 'forbidden_keyword',
          message: `R4 Référence: mention véhicule "${keyword}" (doit rester générique)`,
          severity: 'error',
          details: { keyword },
        });
      }
    }

    // GATE: Pas de prix/livraison/CTA (contenu commercial = R2)
    for (const keyword of this.FORBIDDEN_KEYWORDS_R4_COMMERCIAL) {
      if (lowerContent.includes(keyword)) {
        violations.push({
          type: 'forbidden_keyword',
          message: `R4 Référence: mot commercial "${keyword}" interdit (prix/CTA = R2)`,
          severity: 'error',
          details: { keyword },
        });
      }
    }

    // GATE: Pas de blocs filtres/sélection véhicule
    for (const block of this.FORBIDDEN_BLOCKS_R3_R4) {
      if (lowerContent.includes(block)) {
        violations.push({
          type: 'forbidden_block',
          message: `R4 Référence: bloc interdit "${block}" (filtres/sélection = R1)`,
          severity: 'error',
          details: { block },
        });
      }
    }

    return violations;
  }

  /**
   * Valide une page R5 Diagnostic
   * GATES: contenu diagnostic requis, pas de prix/CTA
   */
  validateR5Diagnostic(content: string): RoleViolation[] {
    const violations: RoleViolation[] = [];
    const lowerContent = content.toLowerCase();

    // Check: Presence d'au moins un mot-cle diagnostic
    const hasDiagnosticContent = this.REQUIRED_KEYWORDS_R5.some((kw) =>
      lowerContent.includes(kw),
    );
    if (!hasDiagnosticContent) {
      violations.push({
        type: 'missing_element',
        message: 'R5 Diagnostic: aucun contenu diagnostic detecte',
        severity: 'warning',
        details: { requiredKeywords: this.REQUIRED_KEYWORDS_R5 },
      });
    }

    // GATE: Pas de prix/CTA (contenu commercial = R2)
    for (const keyword of this.FORBIDDEN_KEYWORDS_R5_COMMERCIAL) {
      if (lowerContent.includes(keyword)) {
        violations.push({
          type: 'forbidden_keyword',
          message: `R5 Diagnostic: mot commercial "${keyword}" interdit (prix/CTA = R2)`,
          severity: 'error',
          details: { keyword },
        });
      }
    }

    return violations;
  }

  /**
   * Valide le vocabulaire exclusif d'une page
   *
   * Vérifie qu'une page n'utilise PAS le vocabulaire réservé à d'autres rôles.
   * C'est un signal anti-cannibalisation fort: chaque rôle a son propre lexique.
   *
   * @param content Contenu textuel de la page
   * @param pageRole Rôle de la page à valider
   * @returns Liste des violations de vocabulaire exclusif
   */
  validateExclusiveVocabulary(
    content: string,
    pageRole: PageRole,
    url?: string,
  ): RoleViolation[] {
    const violations: RoleViolation[] = [];
    const lowerContent = content.toLowerCase();

    // Pour chaque rôle ayant un vocabulaire exclusif (R2, R4, R5)
    for (const [exclusiveRole, vocabList] of Array.from(
      this.EXCLUSIVE_VOCAB_MAP.entries(),
    )) {
      // Skip si c'est le même rôle (le vocabulaire est autorisé)
      if (exclusiveRole === pageRole) {
        continue;
      }

      // Chercher les mots exclusifs d'un autre rôle dans ce contenu
      for (const word of vocabList) {
        if (lowerContent.includes(word.toLowerCase())) {
          violations.push({
            type: 'exclusive_vocab_violation',
            message: `Vocabulaire exclusif ${exclusiveRole} trouvé sur page ${pageRole}: "${word}"`,
            severity: 'error',
            details: {
              word,
              foundOnRole: pageRole,
              belongsToRole: exclusiveRole,
              explanation: `Le mot "${word}" est réservé aux pages ${PAGE_ROLE_META[exclusiveRole].label}. Sa présence sur une page ${PAGE_ROLE_META[pageRole].label} crée de la cannibalisation SEO.`,
            },
          });
        }
      }
    }

    // Validation croisée R3/conseils (pas dans EXCLUSIVE_VOCAB_MAP car partage PageRole.R3_BLOG)
    const isConseilsPage =
      pageRole === PageRole.R3_BLOG &&
      url &&
      getR3SubRoleFromUrl(url) === 'conseils';

    if (!isConseilsPage) {
      for (const word of this.EXCLUSIVE_VOCAB_R3_CONSEILS) {
        if (lowerContent.includes(word.toLowerCase())) {
          violations.push({
            type: 'exclusive_vocab_violation',
            message: `Vocabulaire exclusif R3/conseils trouvé sur page ${pageRole}: "${word}"`,
            severity: 'error',
            details: {
              word,
              foundOnRole: pageRole,
              belongsToRole: 'R3/conseils',
              explanation: `Le mot "${word}" est réservé aux pages conseils how-to. Sa présence sur une page ${pageRole} crée de la cannibalisation SEO.`,
            },
          });
        }
      }
    }

    return violations;
  }

  /**
   * Vérifie si une page utilise correctement SON vocabulaire exclusif
   *
   * Pour R2/R4/R5: on s'attend à trouver au moins 1 mot du vocabulaire exclusif
   * Absence = la page ne remplit peut-être pas son rôle distinctif
   *
   * @param content Contenu textuel de la page
   * @param pageRole Rôle de la page
   * @returns Liste des violations (warning si vocabulaire absent)
   */
  validateOwnExclusiveVocabulary(
    content: string,
    pageRole: PageRole,
    url?: string,
  ): RoleViolation[] {
    const violations: RoleViolation[] = [];
    const lowerContent = content.toLowerCase();

    // Check R3/conseils own vocabulary (not in EXCLUSIVE_VOCAB_MAP)
    if (
      pageRole === PageRole.R3_BLOG &&
      url &&
      getR3SubRoleFromUrl(url) === 'conseils'
    ) {
      const hasConseilsVocab = this.EXCLUSIVE_VOCAB_R3_CONSEILS.some((word) =>
        lowerContent.includes(word.toLowerCase()),
      );
      if (!hasConseilsVocab) {
        violations.push({
          type: 'exclusive_vocab_violation',
          message:
            'Page R3/conseils sans vocabulaire distinctif how-to (démontage, outils, etc.)',
          severity: 'warning',
          details: {
            expectedRole: 'R3/conseils',
            expectedVocabulary: this.EXCLUSIVE_VOCAB_R3_CONSEILS.slice(0, 5),
            explanation:
              'Une page conseils how-to devrait contenir au moins un mot de procédure (démontage, remontage, outils nécessaires, etc.).',
          },
        });
      }
      return violations;
    }

    // Standard check for R2/R4/R5
    const vocabList = this.EXCLUSIVE_VOCAB_MAP.get(pageRole);
    if (!vocabList) {
      return violations;
    }

    const hasOwnVocab = vocabList.some((word) =>
      lowerContent.includes(word.toLowerCase()),
    );

    if (!hasOwnVocab) {
      violations.push({
        type: 'exclusive_vocab_violation',
        message: `Page ${pageRole} sans vocabulaire distinctif ${pageRole}`,
        severity: 'warning',
        details: {
          expectedRole: pageRole,
          expectedVocabulary: vocabList.slice(0, 5),
          explanation: `Une page ${PAGE_ROLE_META[pageRole].label} devrait contenir au moins un mot de son vocabulaire exclusif pour être clairement identifiée par Google.`,
        },
      });
    }

    return violations;
  }

  /**
   * Valide un lien entre deux URLs
   * @param sourceUrl URL de la page source
   * @param targetUrl URL de la page cible
   * @returns Violation si le lien n'est pas autorisé, null sinon
   */
  validateLink(sourceUrl: string, targetUrl: string): RoleViolation | null {
    const sourceRole = getPageRoleFromUrl(sourceUrl);
    const targetRole = getPageRoleFromUrl(targetUrl);

    if (!sourceRole || !targetRole) {
      this.logger.debug(
        `Cannot validate link: source=${sourceUrl} (${sourceRole}), target=${targetUrl} (${targetRole})`,
      );
      return null;
    }

    if (!isLinkAllowed(sourceRole, targetRole)) {
      return {
        type: 'invalid_link',
        message: `Lien interdit: ${sourceRole} (${PAGE_ROLE_META[sourceRole].label}) → ${targetRole} (${PAGE_ROLE_META[targetRole].label})`,
        severity: 'error',
        details: { sourceRole, targetRole, sourceUrl, targetUrl },
      };
    }

    // Avertissement si lien vers rôle supérieur (flux descendant préféré)
    if (isRoleAbove(targetRole, sourceRole)) {
      return {
        type: 'invalid_link',
        message: `Lien remontant: ${sourceRole} → ${targetRole} (préférer flux descendant)`,
        severity: 'warning',
        details: { sourceRole, targetRole },
      };
    }

    return null;
  }

  /**
   * Valide une page complète
   * @param url URL de la page
   * @param content Contenu textuel de la page
   * @param declaredRole Rôle déclaré (optionnel)
   */
  validatePage(
    url: string,
    content: string,
    declaredRole?: PageRole,
  ): PageValidationResult {
    const detectedRole = getPageRoleFromUrl(url);
    const violations: RoleViolation[] = [];

    // Vérifier cohérence rôle déclaré vs détecté
    if (declaredRole && detectedRole && declaredRole !== detectedRole) {
      violations.push({
        type: 'role_mismatch',
        message: `Rôle déclaré (${declaredRole}) différent du rôle détecté (${detectedRole})`,
        severity: 'warning',
        details: { declaredRole, detectedRole },
      });
    }

    const roleToValidate = declaredRole || detectedRole;

    // Valider selon le rôle
    if (roleToValidate) {
      switch (roleToValidate) {
        case PageRole.R1_ROUTER:
          violations.push(...this.validateR1Router(content));
          break;
        case PageRole.R2_PRODUCT:
          violations.push(...this.validateR2Product(content));
          break;
        case PageRole.R3_BLOG: {
          const r3Sub = getR3SubRoleFromUrl(url);
          if (r3Sub === 'conseils') {
            violations.push(...this.validateR3Conseils(content, url));
          } else {
            violations.push(...this.validateR3Blog(content));
          }
          break;
        }
        case PageRole.R4_REFERENCE:
          violations.push(...this.validateR4Reference(content));
          break;
        case PageRole.R5_DIAGNOSTIC:
          violations.push(...this.validateR5Diagnostic(content));
          break;
        // R6 n'a pas de validation spécifique pour l'instant
      }

      // ================================================
      // VALIDATION VOCABULAIRE EXCLUSIF (anti-cannibalisation)
      // ================================================

      // 1. Vérifier qu'on n'utilise PAS le vocabulaire d'autres rôles
      violations.push(
        ...this.validateExclusiveVocabulary(content, roleToValidate, url),
      );

      // 2. Vérifier qu'on utilise bien NOTRE vocabulaire exclusif (si applicable)
      violations.push(
        ...this.validateOwnExclusiveVocabulary(content, roleToValidate, url),
      );
    }

    return {
      url,
      detectedRole,
      declaredRole,
      isValid: violations.filter((v) => v.severity === 'error').length === 0,
      violations,
    };
  }

  /**
   * Valide un ensemble de liens sur une page
   * @param sourceUrl URL de la page source
   * @param targetUrls URLs des liens sur la page
   */
  validatePageLinks(sourceUrl: string, targetUrls: string[]): RoleViolation[] {
    const violations: RoleViolation[] = [];
    const sourceRole = getPageRoleFromUrl(sourceUrl);

    if (!sourceRole) {
      return violations;
    }

    // Compteur pour R2 (max 1 lien vers R4)
    let r4LinkCount = 0;

    for (const targetUrl of targetUrls) {
      const violation = this.validateLink(sourceUrl, targetUrl);
      if (violation) {
        violations.push(violation);
      }

      // Règle spéciale R2: max 1 lien vers référence
      if (sourceRole === PageRole.R2_PRODUCT) {
        const targetRole = getPageRoleFromUrl(targetUrl);
        if (targetRole === PageRole.R4_REFERENCE) {
          r4LinkCount++;
          if (r4LinkCount > 1) {
            violations.push({
              type: 'invalid_link',
              message: `R2 Produit: plus d'1 lien vers référence (${r4LinkCount} détectés)`,
              severity: 'warning',
              details: { r4LinkCount, maxAllowed: 1 },
            });
          }
        }
      }
    }

    return violations;
  }

  /**
   * Valide le canonical d'une page
   * GATE: canonical absent ou incohérent = erreur
   *
   * @param url URL de la page
   * @param canonical URL canonical déclarée (meta link rel="canonical")
   * @returns Violations si canonical invalide
   */
  validateCanonical(url: string, canonical?: string): RoleViolation[] {
    const violations: RoleViolation[] = [];

    // GATE: Canonical absent
    if (!canonical) {
      violations.push({
        type: 'missing_canonical',
        message: 'Canonical absent (rel="canonical" requis)',
        severity: 'error',
        details: { url },
      });
      return violations;
    }

    // Normaliser les URLs pour comparaison
    const normalizedUrl = this.normalizeUrl(url);
    const normalizedCanonical = this.normalizeUrl(canonical);

    // GATE: Canonical incohérent (pointe vers une autre page)
    if (normalizedUrl !== normalizedCanonical) {
      violations.push({
        type: 'invalid_canonical',
        message: `Canonical incohérent: page=${url}, canonical=${canonical}`,
        severity: 'error',
        details: { url, canonical, normalizedUrl, normalizedCanonical },
      });
    }

    return violations;
  }

  /**
   * Validation complète avec HTML (inclut canonical)
   *
   * @param url URL de la page
   * @param content Contenu textuel de la page
   * @param html HTML complet de la page (pour extraire canonical)
   * @param declaredRole Rôle déclaré (optionnel)
   */
  validatePageWithHtml(
    url: string,
    content: string,
    html: string,
    declaredRole?: PageRole,
  ): PageValidationResult {
    // Validation standard
    const result = this.validatePage(url, content, declaredRole);

    // Extraire et valider canonical
    const canonical = this.extractCanonical(html);
    const canonicalViolations = this.validateCanonical(url, canonical);
    result.violations.push(...canonicalViolations);

    // Recalculer isValid
    result.isValid =
      result.violations.filter((v) => v.severity === 'error').length === 0;

    return result;
  }

  /**
   * Extrait l'URL canonical depuis le HTML
   */
  private extractCanonical(html: string): string | undefined {
    const match = html.match(
      /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i,
    );
    if (match) {
      return match[1];
    }
    // Essayer l'ordre inverse (href avant rel)
    const match2 = html.match(
      /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i,
    );
    return match2 ? match2[1] : undefined;
  }

  /**
   * Normalise une URL pour comparaison
   * - Supprime trailing slash
   * - Supprime protocole/domaine si présent
   * - Lowercase
   */
  private normalizeUrl(url: string): string {
    let normalized = url.toLowerCase();

    // Supprimer protocole et domaine
    normalized = normalized.replace(/^https?:\/\/[^/]+/, '');

    // Supprimer trailing slash (sauf pour root)
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    // Supprimer paramètres de tracking courants
    normalized = normalized.replace(/[?&](utm_[^&=]+=[^&]*)/g, '');

    return normalized || '/';
  }

  /**
   * Compte le nombre de mots dans un texte
   */
  private countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }
}

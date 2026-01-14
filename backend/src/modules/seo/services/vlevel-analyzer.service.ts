import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Interface pour le résultat d'analyse V-Level
 */
export interface VLevelResult {
  gamme: string;
  model: string;
  v_levels: {
    diesel: {
      v2: string | null;
      v3: string[];
      v4: string[];
    };
    essence: {
      v2: string | null;
      v3: string[];
      v4: string[];
    };
  };
  analysis: string;
  timestamp: string;
}

/**
 * Interface pour les données de recherche Google
 */
export interface GoogleSearchData {
  query: string;
  results: string[];
  motorisations: string[];
}

/**
 * 🎯 VLevelAnalyzerService
 *
 * Service d'analyse V-Level utilisant WebSearch + Anthropic SDK
 * pour déterminer les niveaux V1/V2/V3/V4/V5 des motorisations
 *
 * Règles V-Level:
 * - V2 = Champion LOCAL par gamme+énergie (position #1 dans autosuggest)
 * - V3 = Challengers (positions #2, #3, #4)
 * - V4 = TOUT LE RESTE (non présent dans autosuggest)
 * - V5 = Bloc B (recherches inversées "véhicule → gamme")
 *
 * Séparation OBLIGATOIRE Diesel / Essence
 */
@Injectable()
export class VLevelAnalyzerService {
  private readonly logger = new Logger(VLevelAnalyzerService.name);
  private readonly anthropic: Anthropic | null = null;
  private readonly CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 jours en ms

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY', '');

    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
      this.logger.log('✅ VLevelAnalyzerService initialisé avec Anthropic SDK');
    } else {
      this.logger.warn(
        '⚠️ ANTHROPIC_API_KEY non configuré - VLevelAnalyzer désactivé',
      );
    }
  }

  /**
   * Analyse les V-Levels pour une gamme + modèle
   * Utilise les résultats WebSearch et Anthropic pour classifier
   *
   * @param gammeName - Nom de la gamme (ex: "plaquette frein")
   * @param modelName - Nom du modèle (ex: "clio 3")
   * @param variants - Liste des variants disponibles dans le catalogue
   * @param webSearchResults - Résultats bruts de WebSearch
   * @returns VLevelResult avec V2/V3/V4 par énergie
   */
  async analyzeGammeVLevels(
    gammeName: string,
    modelName: string,
    variants: string[],
    webSearchResults: string,
  ): Promise<VLevelResult> {
    if (!this.anthropic) {
      throw new Error('ANTHROPIC_API_KEY non configuré');
    }

    // Vérifier le cache
    const cacheKey = `vlevel:${gammeName}:${modelName}`;
    const cached = await this.cacheManager.get<VLevelResult>(cacheKey);
    if (cached) {
      this.logger.log(`📦 Cache hit pour ${gammeName} + ${modelName}`);
      return cached;
    }

    this.logger.log(`🔍 Analyse V-Level: ${gammeName} + ${modelName}`);

    const prompt = this.buildAnalysisPrompt(
      gammeName,
      modelName,
      variants,
      webSearchResults,
    );

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        temperature: 0.1, // Basse température pour résultats déterministes
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Réponse Anthropic invalide (pas de texte)');
      }

      // Extraire le JSON de la réponse
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Pas de JSON trouvé dans la réponse Anthropic');
      }

      const result: VLevelResult = {
        ...JSON.parse(jsonMatch[0]),
        timestamp: new Date().toISOString(),
      };

      // Mettre en cache
      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
      this.logger.log(`✅ Analyse terminée pour ${gammeName} + ${modelName}`);

      return result;
    } catch (error) {
      this.logger.error(
        `❌ Erreur analyse V-Level: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Construit le prompt d'analyse pour Anthropic
   */
  private buildAnalysisPrompt(
    gammeName: string,
    modelName: string,
    variants: string[],
    webSearchResults: string,
  ): string {
    return `Tu es un expert SEO automobile. Analyse ces résultats de recherche et détermine les V-Levels.

## Contexte
Gamme: ${gammeName}
Modèle: ${modelName}
Variants disponibles dans le catalogue: ${variants.join(', ')}

## Résultats WebSearch (données Google)
${webSearchResults}

## Règles V-Level (IMPORTANTES - à respecter strictement)

### RÈGLE 1: SÉPARATION DIESEL / ESSENCE
Diesel et Essence sont TOUJOURS traités séparément.
→ UN SEUL V2 par énergie (1 V2 Diesel + 1 V2 Essence possible)
→ Ne JAMAIS mélanger les énergies

### RÈGLE 2: V2 = CHAMPION LOCAL
V2 = variant le PLUS mentionné/populaire par énergie
→ Position #1 dans les résultats de recherche
→ Basé sur la fréquence d'apparition dans les résultats e-commerce
→ Identifier la puissance exacte si possible (ex: "90ch", "110cv")

### RÈGLE 3: V3 = CHALLENGERS
V3 = variants mentionnés mais pas en première position
→ Positions #2, #3, #4... dans les résultats
→ PEUT ÊTRE RECHERCHÉ (ne pas confondre avec "non recherché")
→ INCLUT les variantes de PUISSANCE du même moteur que V2

### RÈGLE 4: V4 = TOUT LE RESTE
V4 = ce qui n'est NI V2 NI V3
→ Motorisations du catalogue qui ne sont pas dans autosuggest
→ INCLUT: configs (Break, BVA, SW, CC) + motorisations rares
→ NE PAS limiter V4 aux seules "configurations"

### RÈGLE 5: TYPE EXACT
Chaque véhicule a un ID précis avec puissance si disponible.
→ "1.5 dCi 85cv" = type exact (préféré)
→ "1.5 dCi" = acceptable si puissance non disponible

## Output JSON (STRICT - pas d'explication avant/après)

{
  "gamme": "${gammeName}",
  "model": "${modelName}",
  "v_levels": {
    "diesel": {
      "v2": "nom_variant_champion_diesel ou null si aucun diesel trouvé",
      "v3": ["variant_diesel_2", "variant_diesel_3"],
      "v4": ["variants_diesel_non_recherchés"]
    },
    "essence": {
      "v2": "nom_variant_champion_essence ou null si aucun essence trouvé",
      "v3": ["variant_essence_2", "variant_essence_3"],
      "v4": ["variants_essence_non_recherchés"]
    }
  },
  "analysis": "Explication courte de la classification (1-2 phrases)"
}

Réponds UNIQUEMENT avec le JSON, pas d'explication avant ou après.`;
  }

  /**
   * Analyse multiple gammes en batch
   *
   * @param items - Liste des items à analyser
   * @returns Résultats d'analyse pour chaque item
   */
  async analyzeBatch(
    items: Array<{
      gammeName: string;
      modelName: string;
      variants: string[];
      webSearchResults: string;
    }>,
  ): Promise<VLevelResult[]> {
    const results: VLevelResult[] = [];

    for (const item of items) {
      try {
        const result = await this.analyzeGammeVLevels(
          item.gammeName,
          item.modelName,
          item.variants,
          item.webSearchResults,
        );
        results.push(result);

        // Rate limiting - 1 requête toutes les 2 secondes
        await this.sleep(2000);
      } catch (error) {
        this.logger.error(
          `Erreur batch pour ${item.gammeName} + ${item.modelName}: ${error.message}`,
        );
        // Continuer avec les autres items
      }
    }

    return results;
  }

  /**
   * Invalide le cache pour une gamme + modèle
   */
  async invalidateCache(gammeName: string, modelName: string): Promise<void> {
    const cacheKey = `vlevel:${gammeName}:${modelName}`;
    await this.cacheManager.del(cacheKey);
    this.logger.log(`🗑️ Cache invalidé pour ${gammeName} + ${modelName}`);
  }

  /**
   * Vérifie si le service est disponible
   */
  isAvailable(): boolean {
    return this.anthropic !== null;
  }

  /**
   * Utilitaire sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GenerateContentDto,
  GenerateProductDescriptionDto,
  GenerateSEOMetaDto,
  ContentResponse,
  ContentType,
} from './dto/generate-content.dto';
import { buildPrompt } from './templates/content-templates';
import { createHash } from 'crypto';
import { HuggingFaceProvider } from './providers/huggingface.provider';
import { GroqProvider } from './providers/groq.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import {
  ExternalServiceException,
  ConfigurationException,
  ErrorCodes,
} from '../../common/exceptions';
import { getErrorMessage, getErrorStack } from '../../common/utils/error.utils';

interface AIProvider {
  generateContent(
    systemPrompt: string,
    userPrompt: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    },
  ): Promise<string>;
  checkHealth?(): Promise<boolean>;
}

@Injectable()
export class AiContentService {
  private readonly logger = new Logger(AiContentService.name);
  private readonly providers = new Map<string, AIProvider>();
  private currentProvider: string = 'anthropic';
  private cacheService: any; // Will be injected if Redis is available
  private circuitBreaker: CircuitBreakerService | null = null;

  // Max retries across all providers
  private readonly MAX_FAILOVER_ATTEMPTS = 3;

  constructor(private configService: ConfigService) {
    this.initializeAllProviders();
    this.selectInitialProvider();
  }

  /**
   * 🔧 Initialize all available providers upfront
   * This allows instant failover without initialization delay
   */
  private initializeAllProviders(): void {
    this.logger.log('🤖 Initializing all AI providers...');

    // 1. Anthropic Claude
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      this.providers.set(
        'anthropic',
        new AnthropicProvider(this.configService),
      );
      this.logger.log('   ✅ Anthropic Claude ready');
    }

    // 2. Groq
    const groqKey = this.configService.get<string>('GROQ_API_KEY');
    if (groqKey) {
      this.providers.set('groq', new GroqProvider(this.configService));
      this.logger.log('   ✅ Groq ready');
    }

    // 3. HuggingFace
    const hfKey = this.configService.get<string>('HUGGINGFACE_API_KEY');
    if (hfKey) {
      this.providers.set(
        'huggingface',
        new HuggingFaceProvider(this.configService),
      );
      this.logger.log('   ✅ HuggingFace ready');
    }

    // 4. OpenAI
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      this.providers.set('openai', this.createOpenAIProvider(openaiKey));
      this.logger.log('   ✅ OpenAI ready');
    }

    if (this.providers.size === 0) {
      this.logger.error('❌ No AI providers configured! Add API keys to .env');
      this.providers.set('mock', this.createMockProvider());
    }

    this.logger.log(`🤖 ${this.providers.size} AI providers initialized`);
  }

  /**
   * 🎯 Select initial provider based on config or auto-detection
   */
  private async selectInitialProvider(): Promise<void> {
    const configuredProvider = this.configService.get<string>(
      'AI_PROVIDER',
      'auto',
    );

    if (configuredProvider !== 'auto') {
      // Manual selection
      if (this.providers.has(configuredProvider)) {
        this.currentProvider = configuredProvider;
        this.logger.log(`✅ Using configured provider: ${configuredProvider}`);
        return;
      }
      this.logger.warn(
        `⚠️ Configured provider '${configuredProvider}' not available`,
      );
    }

    // Auto-detection: pick first healthy provider
    const priorityOrder = ['anthropic', 'groq', 'huggingface', 'openai'];

    for (const providerName of priorityOrder) {
      const provider = this.providers.get(providerName);
      if (provider && provider.checkHealth) {
        try {
          const healthy = await provider.checkHealth();
          if (healthy) {
            this.currentProvider = providerName;
            this.logger.log(`✅ Auto-selected provider: ${providerName}`);
            return;
          }
        } catch {
          this.logger.debug(`Provider ${providerName} health check failed`);
        }
      } else if (provider) {
        // Provider without health check - assume OK
        this.currentProvider = providerName;
        this.logger.log(
          `✅ Auto-selected provider: ${providerName} (no health check)`,
        );
        return;
      }
    }

    // Fallback to first available
    const firstProvider = this.providers.keys().next().value;
    if (firstProvider) {
      this.currentProvider = firstProvider;
      this.logger.warn(`⚠️ Fallback to: ${firstProvider}`);
    }
  }

  private createOpenAIProvider(apiKey: string): AIProvider {
    return {
      async generateContent(systemPrompt, userPrompt, options) {
        const response = await fetch(
          'https://api.openai.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: options.model || 'gpt-4o-mini',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              temperature: options.temperature || 0.7,
              max_tokens: options.maxTokens || 1000,
            }),
          },
        );

        if (!response.ok) {
          const error = await response.text();
          throw new ExternalServiceException({
            message: `OpenAI API error: ${error}`,
            code: ErrorCodes.EXTERNAL.HTTP_ERROR,
            serviceName: 'openai',
            details: error,
          });
        }

        const data = await response.json();
        return data.choices[0].message.content;
      },
    };
  }

  private createMockProvider(): AIProvider {
    return {
      async generateContent() {
        throw new ConfigurationException({
          message:
            'Aucun provider IA disponible. ' +
            'Obtenez une clé API Groq gratuite sur https://console.groq.com ' +
            'ou configurez une clé HuggingFace sur https://huggingface.co/settings/tokens',
          code: ErrorCodes.EXTERNAL.API_KEY_MISSING,
        });
      },
    };
  }

  private generateCacheKey(
    type: ContentType,
    context: Record<string, any>,
  ): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify({ type, context }));
    return `ai-content:${type}:${hash.digest('hex')}`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 🔌 CIRCUIT BREAKER FAILOVER LOGIC
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Execute AI generation with automatic failover
   * If current provider fails, try next available provider
   */
  private async executeWithFailover(
    systemPrompt: string,
    userPrompt: string,
    options: { temperature?: number; maxTokens?: number },
  ): Promise<{ content: string; usedProvider: string }> {
    const priorityOrder = ['anthropic', 'groq', 'huggingface', 'openai'];
    const triedProviders: string[] = [];
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.MAX_FAILOVER_ATTEMPTS; attempt++) {
      // Find next available provider
      const providerName = this.findNextProvider(priorityOrder, triedProviders);
      if (!providerName) {
        break;
      }

      triedProviders.push(providerName);

      // Check circuit breaker
      if (
        this.circuitBreaker &&
        !this.circuitBreaker.canRequest(providerName)
      ) {
        this.logger.debug(`⚡ Circuit open for ${providerName}, skipping`);
        continue;
      }

      const provider = this.providers.get(providerName);
      if (!provider) continue;

      try {
        this.logger.debug(`🎯 Trying provider: ${providerName}`);

        const content = await provider.generateContent(
          systemPrompt,
          userPrompt,
          options,
        );

        // Success! Record it
        if (this.circuitBreaker) {
          this.circuitBreaker.recordSuccess(providerName);
        }

        // Update current provider for future requests
        this.currentProvider = providerName;

        return { content, usedProvider: providerName };
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `⚠️ Provider ${providerName} failed: ${getErrorMessage(error)}`,
        );

        // Record failure in circuit breaker
        if (this.circuitBreaker) {
          this.circuitBreaker.recordFailure(providerName, error as Error);
        }

        // Continue to next provider
      }
    }

    // All providers failed
    const availableProviders = this.circuitBreaker
      ? this.circuitBreaker.getAvailableProviders()
      : Array.from(this.providers.keys());

    throw new ExternalServiceException({
      message:
        `All AI providers failed. Tried: [${triedProviders.join(', ')}]. ` +
        `Available: [${availableProviders.join(', ')}]. ` +
        `Last error: ${lastError?.message || 'Unknown'}`,
      code: ErrorCodes.EXTERNAL.SERVICE_ERROR,
      details: lastError?.message,
      cause: lastError || undefined,
    });
  }

  private findNextProvider(
    priorityOrder: string[],
    exclude: string[],
  ): string | null {
    for (const name of priorityOrder) {
      if (!exclude.includes(name) && this.providers.has(name)) {
        return name;
      }
    }
    return null;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 📝 CONTENT GENERATION METHODS
  // ════════════════════════════════════════════════════════════════════════════

  async generateContent(dto: GenerateContentDto): Promise<ContentResponse> {
    const startTime = Date.now();

    try {
      // Check cache if enabled
      if (dto.useCache && this.cacheService) {
        const cacheKey = this.generateCacheKey(dto.type, dto.context || {});
        const cached = await this.cacheService.get(cacheKey);

        if (cached) {
          this.logger.log(`Cache hit for ${dto.type}`);
          return {
            ...cached,
            metadata: { ...cached.metadata, cached: true },
          };
        }
      }

      // Build prompt from template
      const context = {
        ...dto.context,
        prompt: dto.prompt,
        tone: dto.tone,
        language: dto.language,
        length: dto.maxLength,
      };

      const { system, user } = buildPrompt(dto.type, context, dto.tone);

      // Generate content WITH FAILOVER
      const { content, usedProvider } = await this.executeWithFailover(
        system,
        user,
        {
          temperature: dto.temperature,
          maxTokens: dto.maxLength,
        },
      );

      const response: ContentResponse = {
        id: this.generateContentId(),
        type: dto.type,
        content: content.trim(),
        metadata: {
          generatedAt: new Date(),
          cached: false,
          tokens: Math.ceil(content.length / 4), // Rough estimate
          model: this.getProviderModelName(usedProvider),
          language: dto.language || 'fr',
          provider: usedProvider, // Track which provider was used
        },
      };

      // Cache the result
      if (dto.useCache && this.cacheService) {
        const cacheKey = this.generateCacheKey(dto.type, dto.context || {});
        await this.cacheService.set(
          cacheKey,
          response,
          60 * 60 * 24 * 7, // 7 days
        );
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Generated ${dto.type} content in ${duration}ms (provider: ${usedProvider})`,
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Error generating content: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new HttpException(
        `Failed to generate content: ${getErrorMessage(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async generateProductDescription(
    dto: GenerateProductDescriptionDto,
  ): Promise<ContentResponse> {
    const lengthMap = {
      short: 200,
      medium: 500,
      long: 1000,
    };

    return this.generateContent({
      type: 'product_description',
      prompt: `Generate product description for ${dto.productName}`,
      tone: dto.tone,
      language: dto.language,
      maxLength: lengthMap[dto.length || 'medium'],
      context: {
        productName: dto.productName,
        category: dto.category,
        features: dto.features,
        specifications: dto.specifications,
        targetAudience: dto.targetAudience,
        length: dto.length,
      },
      useCache: true,
    });
  }

  async generateSEOMeta(dto: GenerateSEOMetaDto): Promise<ContentResponse> {
    return this.generateContent({
      type: 'seo_meta',
      prompt: `Generate SEO meta description for ${dto.pageTitle}`,
      tone: 'professional',
      language: dto.language,
      maxLength: 200,
      context: {
        pageTitle: dto.pageTitle,
        pageUrl: dto.pageUrl,
        keywords: dto.keywords,
        targetKeyword: dto.targetKeyword,
        businessType: dto.businessType,
      },
      useCache: true,
    });
  }

  async batchGenerate(
    requests: GenerateContentDto[],
  ): Promise<ContentResponse[]> {
    this.logger.log(`Batch generating ${requests.length} content items`);

    const results = await Promise.allSettled(
      requests.map((req) => this.generateContent(req)),
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        this.logger.error(`Batch item ${index} failed: ${result.reason}`);
        throw new HttpException(
          `Batch generation failed for item ${index}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    });
  }

  private generateContentId(): string {
    return `content_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private getProviderModelName(providerName?: string): string {
    const provider = providerName || this.currentProvider;

    switch (provider) {
      case 'anthropic':
      case 'claude':
        return this.configService.get<string>(
          'ANTHROPIC_MODEL',
          'claude-sonnet-4-20250514',
        );

      case 'groq':
        return this.configService.get<string>(
          'GROQ_MODEL',
          'llama-3.3-70b-versatile',
        );

      case 'huggingface':
        return this.configService.get<string>(
          'HUGGINGFACE_MODEL',
          'mistralai/Mistral-7B-Instruct-v0.2',
        );

      case 'openai':
        return this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');

      default:
        return 'unknown';
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 🔧 SERVICE INJECTION & CONFIGURATION
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Inject cache service if available
   */
  setCacheService(cacheService: any): void {
    this.cacheService = cacheService;
    this.logger.log('✅ Cache service configured for AI content generation');
  }

  /**
   * Inject circuit breaker service
   */
  setCircuitBreaker(circuitBreaker: CircuitBreakerService): void {
    this.circuitBreaker = circuitBreaker;
    this.logger.log('✅ Circuit breaker configured for AI failover');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 📊 MONITORING & HEALTH
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Get current provider status and circuit breaker metrics
   */
  getProviderStatus(): {
    currentProvider: string;
    availableProviders: string[];
    circuitBreakerMetrics: ReturnType<
      CircuitBreakerService['getMetrics']
    > | null;
  } {
    return {
      currentProvider: this.currentProvider,
      availableProviders: Array.from(this.providers.keys()),
      circuitBreakerMetrics: this.circuitBreaker?.getMetrics() || null,
    };
  }

  /**
   * Check health of all providers
   */
  async checkAllProvidersHealth(): Promise<
    Record<string, { available: boolean; healthy: boolean }>
  > {
    const results: Record<string, { available: boolean; healthy: boolean }> =
      {};

    for (const [name, provider] of this.providers) {
      const available = true;
      let healthy = false;

      if (provider.checkHealth) {
        try {
          healthy = await provider.checkHealth();
        } catch {
          healthy = false;
        }
      } else {
        healthy = true; // Assume healthy if no check available
      }

      results[name] = { available, healthy };
    }

    return results;
  }

  /**
   * Force reset circuit for a provider (manual recovery)
   */
  resetProviderCircuit(providerName: string): void {
    if (this.circuitBreaker) {
      this.circuitBreaker.resetCircuit(providerName);
      this.logger.log(`🔄 Circuit reset for provider: ${providerName}`);
    }
  }

  /**
   * Reset all circuits
   */
  resetAllCircuits(): void {
    if (this.circuitBreaker) {
      this.circuitBreaker.resetAllCircuits();
    }
  }
}

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
}

@Injectable()
export class AiContentService {
  private readonly logger = new Logger(AiContentService.name);
  private aiProvider: AIProvider;
  private cacheService: any; // Will be injected if Redis is available

  constructor(private configService: ConfigService) {
    this.initializeProvider();
  }

  private async initializeProvider() {
    const provider = this.configService.get<string>('AI_PROVIDER', 'auto');

    this.logger.log(`🤖 Initializing AI provider: ${provider}`);

    // Auto-detect: Try providers in order of preference
    if (provider === 'auto') {
      // 1. Try Groq (gratuit, ultra rapide, quota généreux)
      const groqKey = this.configService.get<string>('GROQ_API_KEY');
      if (groqKey) {
        const groqProvider = new GroqProvider(this.configService);
        if (await groqProvider.checkHealth()) {
          this.aiProvider = groqProvider;
          this.logger.log('✅ Using Groq (FREE, ultra fast)');
          return;
        }
      }

      // 3. Try HuggingFace (gratuit, quota limité)
      const hfKey = this.configService.get<string>('HUGGINGFACE_API_KEY');
      if (hfKey) {
        const hfProvider = new HuggingFaceProvider(this.configService);
        if (await hfProvider.checkHealth()) {
          this.aiProvider = hfProvider;
          this.logger.log('✅ Using HuggingFace (FREE)');
          return;
        }
      }

      // 4. Try OpenAI (payant mais fiable)
      const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
      if (openaiKey) {
        this.aiProvider = this.createOpenAIProvider(openaiKey);
        this.logger.log('✅ Using OpenAI (paid)');
        return;
      }

      // Aucun provider disponible
      this.logger.error('❌ No AI provider available! Install Ollama or configure an API key.');
      this.aiProvider = this.createMockProvider();
      return;
    }

    // Manuel provider selection
    switch (provider) {
      case 'groq':
        this.aiProvider = new GroqProvider(this.configService);
        this.logger.log('✅ Using Groq');
        break;

      case 'huggingface':
        this.aiProvider = new HuggingFaceProvider(this.configService);
        this.logger.log('✅ Using HuggingFace');
        break;

      case 'openai':
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');
        if (!apiKey) {
          throw new Error('OPENAI_API_KEY required for OpenAI provider');
        }
        this.aiProvider = this.createOpenAIProvider(apiKey);
        this.logger.log('✅ Using OpenAI');
        break;

      default:
        this.logger.warn(`Unknown provider: ${provider}. Using mock.`);
        this.aiProvider = this.createMockProvider();
    }
  }

  private createOpenAIProvider(apiKey: string): AIProvider {
    return {
      async generateContent(systemPrompt, userPrompt, options) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`OpenAI API error: ${error}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
      },
    };
  }

  private createMockProvider(): AIProvider {
    return {
      async generateContent() {
        throw new Error(
          'Aucun provider IA disponible. ' +
          'Obtenez une clé API Groq gratuite sur https://console.groq.com ' +
          'ou configurez une clé HuggingFace sur https://huggingface.co/settings/tokens',
        );
      },
    };
  }

  private generateCacheKey(type: ContentType, context: Record<string, any>): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify({ type, context }));
    return `ai-content:${type}:${hash.digest('hex')}`;
  }

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

      // Generate content
      const content = await this.aiProvider.generateContent(system, user, {
        temperature: dto.temperature,
        maxTokens: dto.maxLength,
      });

      const response: ContentResponse = {
        id: this.generateContentId(),
        type: dto.type,
        content: content.trim(),
        metadata: {
          generatedAt: new Date(),
          cached: false,
          tokens: Math.ceil(content.length / 4), // Rough estimate
          model: this.getProviderModelName(),
          language: dto.language || 'fr',
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
      this.logger.log(`Generated ${dto.type} content in ${duration}ms`);

      return response;
    } catch (error) {
      this.logger.error(`Error generating content: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to generate content: ${error.message}`,
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

  private getProviderModelName(): string {
    const provider = this.configService.get<string>('AI_PROVIDER', 'auto');
    
    if (provider === 'groq' || (provider === 'auto' && this.aiProvider instanceof GroqProvider)) {
      return this.configService.get<string>('GROQ_MODEL', 'llama-3.3-70b-versatile');
    }
    
    if (provider === 'huggingface' || (provider === 'auto' && this.aiProvider instanceof HuggingFaceProvider)) {
      return 'meta-llama/Meta-Llama-3-8B-Instruct';
    }
    
    return 'gpt-4o-mini'; // OpenAI fallback
  }

  // Method to inject cache service if available
  setCacheService(cacheService: any) {
    this.cacheService = cacheService;
    this.logger.log('Cache service configured for AI content generation');
  }
}

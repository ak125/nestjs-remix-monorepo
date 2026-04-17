import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  ExternalServiceException,
  ConfigurationException,
  ErrorCodes,
} from '../../../common/exceptions';
import { getErrorMessage } from '../../../common/utils/error.utils';

export interface GenerateWithMetricsResult {
  content: string;
  tokensInput: number;
  tokensOutput: number;
  tokensCached: number;
  model: string;
}

export interface AIProvider {
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
export class AnthropicProvider implements AIProvider {
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly client: Anthropic | null = null;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY', '');
    this.defaultModel = this.configService.get<string>(
      'ANTHROPIC_MODEL',
      'claude-sonnet-4-20250514',
    );

    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.logger.log('✅ Anthropic Claude provider initialized');
      this.logger.log(`   Default model: ${this.defaultModel}`);
    } else {
      this.logger.warn(
        '⚠️  ANTHROPIC_API_KEY not configured - AI features disabled',
      );
    }
  }

  /** Opus 4.7+ rejects temperature/top_p/top_k with 400 error */
  private isModelRejectingSampling(model: string): boolean {
    return model.includes('opus-4-7');
  }

  /** Opus 4.7 tokenizer uses ~35% more tokens for the same text */
  private adjustMaxTokens(maxTokens: number, model: string): number {
    return this.isModelRejectingSampling(model)
      ? Math.round(maxTokens * 1.35)
      : maxTokens;
  }

  async generateContent(
    systemPrompt: string,
    userPrompt: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    },
  ): Promise<string> {
    if (!this.client) {
      throw new ConfigurationException({
        message: 'ANTHROPIC_API_KEY not configured',
        code: ErrorCodes.EXTERNAL.API_KEY_MISSING,
      });
    }

    const model = options.model || this.defaultModel;

    try {
      this.logger.log(`Generating with Claude model: ${model}`);

      const maxTokens = this.adjustMaxTokens(options.maxTokens || 4096, model);
      const rejectsSampling = this.isModelRejectingSampling(model);

      const message = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        ...(rejectsSampling ? {} : { temperature: options.temperature || 0.7 }),
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const textContent = message.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new ExternalServiceException({
          message: 'No text response from Anthropic Claude',
          code: ErrorCodes.EXTERNAL.SERVICE_ERROR,
          serviceName: 'anthropic',
        });
      }

      const content = textContent.text;
      this.logger.log(`Generated ${content.length} characters with Claude`);

      return content.trim();
    } catch (error) {
      this.logger.error(
        `Anthropic generation error: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Generate with full metrics + optional prompt caching.
   *
   * When `cacheSystemPrompt: true`, the system prompt is marked with
   * `cache_control: ephemeral` so subsequent calls with the same system prompt
   * within 5 minutes are served from Anthropic's prompt cache at reduced cost.
   *
   * @returns content + token usage metrics (input, output, cached)
   */
  async generateWithMetrics(
    systemPrompt: string,
    userPrompt: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
      cacheSystemPrompt?: boolean;
    },
  ): Promise<GenerateWithMetricsResult> {
    if (!this.client) {
      throw new ConfigurationException({
        message: 'ANTHROPIC_API_KEY not configured',
        code: ErrorCodes.EXTERNAL.API_KEY_MISSING,
      });
    }

    const model = options.model || this.defaultModel;

    try {
      this.logger.log(
        `Generating with Claude ${model}${options.cacheSystemPrompt ? ' (cache-enabled)' : ''}`,
      );

      // Use system as array format to support cache_control
      const systemParam = options.cacheSystemPrompt
        ? [
            {
              type: 'text' as const,
              text: systemPrompt,
              cache_control: { type: 'ephemeral' as const },
            },
          ]
        : systemPrompt;

      const maxTokens = this.adjustMaxTokens(options.maxTokens || 8000, model);
      const rejectsSampling = this.isModelRejectingSampling(model);

      const message = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        ...(rejectsSampling ? {} : { temperature: options.temperature ?? 0.7 }),
        system: systemParam,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const textContent = message.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new ExternalServiceException({
          message: 'No text response from Anthropic Claude',
          code: ErrorCodes.EXTERNAL.SERVICE_ERROR,
          serviceName: 'anthropic',
        });
      }

      const usage = message.usage;
      const cachedTokens =
        (usage.cache_read_input_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0);

      this.logger.log(
        `Generated ${textContent.text.length} chars | tokens in=${usage.input_tokens} out=${usage.output_tokens} cached=${cachedTokens}`,
      );

      return {
        content: textContent.text.trim(),
        tokensInput: usage.input_tokens,
        tokensOutput: usage.output_tokens,
        tokensCached: cachedTokens,
        model,
      };
    } catch (error) {
      this.logger.error(
        `Anthropic generation error: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    if (!this.client) return false;

    try {
      const message = await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'test',
          },
        ],
      });
      return message.content.length > 0;
    } catch {
      return false;
    }
  }
}

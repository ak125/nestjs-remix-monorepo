import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  ExternalServiceException,
  ConfigurationException,
  ErrorCodes,
} from '../../../common/exceptions';
import { getErrorMessage } from '../../../common/utils/error.utils';
import { DEFAULT_EXECUTOR_MODEL } from '../config/models.constants';

export interface AiTokenUsage {
  input: number;
  output: number;
  cacheRead?: number;
  cacheCreation?: number;
}

export interface AiProviderOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface AIProvider {
  generateContent(
    systemPrompt: string,
    userPrompt: string,
    options: AiProviderOptions,
  ): Promise<string>;
  /** Returns both the generated text and real token usage from the provider. */
  generateContentWithUsage?(
    systemPrompt: string,
    userPrompt: string,
    options: AiProviderOptions,
  ): Promise<{ content: string; usage: AiTokenUsage }>;
  checkHealth?(): Promise<boolean>;
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
      DEFAULT_EXECUTOR_MODEL,
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

  async generateContent(
    systemPrompt: string,
    userPrompt: string,
    options: AiProviderOptions,
  ): Promise<string> {
    const { content } = await this.generateContentWithUsage(
      systemPrompt,
      userPrompt,
      options,
    );
    return content;
  }

  async generateContentWithUsage(
    systemPrompt: string,
    userPrompt: string,
    options: AiProviderOptions,
  ): Promise<{ content: string; usage: AiTokenUsage }> {
    if (!this.client) {
      throw new ConfigurationException({
        message: 'ANTHROPIC_API_KEY not configured',
        code: ErrorCodes.EXTERNAL.API_KEY_MISSING,
      });
    }

    const model = options.model || this.defaultModel;

    try {
      this.logger.log(`Generating with Claude model: ${model}`);

      const message = await this.client.messages.create({
        model,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
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

      const content = textContent.text.trim();
      const usage: AiTokenUsage = {
        input: message.usage.input_tokens,
        output: message.usage.output_tokens,
        cacheRead: message.usage.cache_read_input_tokens ?? undefined,
        cacheCreation: message.usage.cache_creation_input_tokens ?? undefined,
      };

      this.logger.log(
        `Generated ${content.length} chars (in=${usage.input} out=${usage.output} tokens)`,
      );

      return { content, usage };
    } catch (error) {
      this.logger.error(
        `Anthropic generation error: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Lightweight readiness probe: checks the SDK client is instantiated.
   * Does NOT spend tokens. The first real request is where we'd observe API
   * issues, and the circuit breaker handles that path.
   */
  async checkHealth(): Promise<boolean> {
    return this.client !== null;
  }
}

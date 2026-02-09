import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  ExternalServiceException,
  ConfigurationException,
  ErrorCodes,
} from '../../../common/exceptions';
import { getErrorMessage } from '../../../common/utils/error.utils';

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

      const message = await this.client.messages.create({
        model,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.7,
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

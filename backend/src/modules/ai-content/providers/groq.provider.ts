import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
export class GroqProvider implements AIProvider {
  private readonly logger = new Logger(GroqProvider.name);
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GROQ_API_KEY', '');
    this.defaultModel = this.configService.get<string>(
      'GROQ_MODEL',
      'llama3-70b-8192',
    );

    if (this.apiKey) {
      this.logger.log('Groq provider initialized (ULTRA RAPIDE!)');
      this.logger.log(`Default model: ${this.defaultModel}`);
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
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY not configured');
    }

    const model = options.model || this.defaultModel;

    try {
      this.logger.log(`Generating with Groq model: ${model} (ULTRA SPEED)`);

      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
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
        throw new Error(`Groq API error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      if (!data.choices?.[0]?.message?.content) {
        throw new Error('No response from Groq');
      }

      const content = data.choices[0].message.content;
      this.logger.log(`Generated ${content.length} characters (ULTRA FAST!)`);

      return content.trim();
    } catch (error) {
      this.logger.error(`Groq generation error: ${error.message}`);
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

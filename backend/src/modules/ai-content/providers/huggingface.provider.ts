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
export class HuggingFaceProvider implements AIProvider {
  private readonly logger = new Logger(HuggingFaceProvider.name);
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('HUGGINGFACE_API_KEY', '');
    this.defaultModel = this.configService.get<string>(
      'HUGGINGFACE_MODEL',
      'mistralai/Mistral-7B-Instruct-v0.2',
    );

    if (this.apiKey) {
      this.logger.log('HuggingFace provider initialized');
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
      throw new Error('HUGGINGFACE_API_KEY not configured');
    }

    const model = options.model || this.defaultModel;

    try {
      // Format prompt for instruction-tuned models
      const formattedPrompt = `<s>[INST] ${systemPrompt}

${userPrompt} [/INST]`;

      this.logger.log(`Generating with HuggingFace model: ${model}`);

      const response = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: formattedPrompt,
            parameters: {
              temperature: options.temperature || 0.7,
              max_new_tokens: options.maxTokens || 1000,
              top_p: 0.9,
              do_sample: true,
            },
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HuggingFace API error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      // Handle different response formats
      let generatedText = '';

      if (Array.isArray(data) && data[0]?.generated_text) {
        generatedText = data[0].generated_text;
      } else if (data.generated_text) {
        generatedText = data.generated_text;
      } else {
        throw new Error('Unexpected response format from HuggingFace');
      }

      // Remove the prompt from the response
      if (generatedText.includes('[/INST]')) {
        generatedText = generatedText.split('[/INST]')[1] || generatedText;
      }

      this.logger.log(`Generated ${generatedText.length} characters`);

      return generatedText.trim();
    } catch (error) {
      this.logger.error(`HuggingFace generation error: ${error.message}`);
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const response = await fetch(
        `https://api-inference.huggingface.co/models/${this.defaultModel}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}

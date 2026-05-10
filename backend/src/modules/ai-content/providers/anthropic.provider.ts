import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  ExternalServiceException,
  ConfigurationException,
  ErrorCodes,
} from '@common/exceptions';
import { getErrorMessage } from '@common/utils/error.utils';
import {
  DEFAULT_ADVISOR_MODEL,
  DEFAULT_EXECUTOR_MODEL,
} from '../config/models.constants';

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

/**
 * Configuration for the advisor-escalation strategy (Pattern A).
 * A fast/cheap executor model produces a draft. The caller's gate decides
 * whether to escalate to a stronger advisor model for a second pass.
 */
export interface AdvisorConfig {
  /** Advisor model ID. Defaults to ANTHROPIC_ADVISOR_MODEL env or DEFAULT_ADVISOR_MODEL. */
  model?: string;
  /**
   * Gate invoked on the executor draft. Return true to escalate to the advisor,
   * false to keep the executor draft. Errors thrown here skip escalation.
   */
  shouldEscalate: (
    draft: string,
    usage: AiTokenUsage,
  ) => boolean | Promise<boolean>;
  /**
   * Optional custom advisor prompt builder. If omitted, a default "review and
   * improve this draft" wrapper is used.
   */
  buildAdvisorPrompt?: (originalUserPrompt: string, draft: string) => string;
  /** Max tokens for the advisor call. Defaults to the executor options.maxTokens. */
  advisorMaxTokens?: number;
}

export interface AdvisorResult {
  /** Final content — advisor output if escalated, executor draft otherwise. */
  content: string;
  executorUsage: AiTokenUsage;
  advisorUsage: AiTokenUsage | null;
  escalated: boolean;
  /** Non-null when escalation was requested but did not run. */
  escalationSkipped: 'not_requested' | 'advisor_failed' | null;
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
   * Advisor-escalation strategy (Pattern A — documented subagent escalation).
   *
   * Flow:
   *   1. Executor model (e.g. Sonnet) produces a draft.
   *   2. `advisor.shouldEscalate(draft, usage)` decides if the draft is
   *      good enough. Keep the draft on false, escalate on true.
   *   3. On escalation, a stronger advisor model (e.g. Opus) receives the
   *      SAME system prompt (prompt-cache preserving) plus a wrapper prompt
   *      that exposes the original request and the executor draft.
   *   4. Advisor output replaces the draft. Advisor errors fall back to the
   *      executor draft so the caller never sees a total failure due to the
   *      advisor path.
   *
   * No beta APIs, no server-side tools — two independent Messages API calls.
   */
  async generateContentWithAdvisor(
    systemPrompt: string,
    userPrompt: string,
    options: AiProviderOptions,
    advisor: AdvisorConfig,
  ): Promise<AdvisorResult> {
    // Step 1: executor draft
    const executor = await this.generateContentWithUsage(
      systemPrompt,
      userPrompt,
      options,
    );

    // Step 2: gate
    let shouldEscalate: boolean;
    try {
      shouldEscalate = await advisor.shouldEscalate(
        executor.content,
        executor.usage,
      );
    } catch (err) {
      this.logger.warn(
        `Advisor gate threw, keeping executor draft: ${getErrorMessage(err)}`,
      );
      return {
        content: executor.content,
        executorUsage: executor.usage,
        advisorUsage: null,
        escalated: false,
        escalationSkipped: 'advisor_failed',
      };
    }

    if (!shouldEscalate) {
      return {
        content: executor.content,
        executorUsage: executor.usage,
        advisorUsage: null,
        escalated: false,
        escalationSkipped: 'not_requested',
      };
    }

    // Step 3: advisor call
    const advisorModel =
      advisor.model ??
      this.configService.get<string>(
        'ANTHROPIC_ADVISOR_MODEL',
        DEFAULT_ADVISOR_MODEL,
      );

    const advisorPrompt = advisor.buildAdvisorPrompt
      ? advisor.buildAdvisorPrompt(userPrompt, executor.content)
      : this.defaultAdvisorPrompt(userPrompt, executor.content);

    try {
      const advisorOutput = await this.generateContentWithUsage(
        systemPrompt, // identical — preserves any system-prompt cache entry
        advisorPrompt,
        {
          ...options,
          model: advisorModel,
          maxTokens: advisor.advisorMaxTokens ?? options.maxTokens,
        },
      );
      this.logger.log(
        `Advisor escalation success: executor_out=${executor.usage.output} advisor_out=${advisorOutput.usage.output}`,
      );
      return {
        content: advisorOutput.content,
        executorUsage: executor.usage,
        advisorUsage: advisorOutput.usage,
        escalated: true,
        escalationSkipped: null,
      };
    } catch (err) {
      this.logger.warn(
        `Advisor call failed, keeping executor draft: ${getErrorMessage(err)}`,
      );
      return {
        content: executor.content,
        executorUsage: executor.usage,
        advisorUsage: null,
        escalated: false,
        escalationSkipped: 'advisor_failed',
      };
    }
  }

  private defaultAdvisorPrompt(
    originalUserPrompt: string,
    draft: string,
  ): string {
    return [
      'You are reviewing a draft produced by a smaller model.',
      '',
      '---ORIGINAL REQUEST---',
      originalUserPrompt,
      '---END ORIGINAL REQUEST---',
      '',
      '---DRAFT---',
      draft,
      '---END DRAFT---',
      '',
      'If the draft correctly and fully addresses the request, return it unchanged.',
      'If the draft has issues (wrong format, missing info, factual errors, style problems),',
      'return an improved version. Return ONLY the final response content, no commentary.',
    ].join('\n');
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

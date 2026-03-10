/**
 * ClaudeCliService — Wrapper for Claude Code CLI
 *
 * Executes prompts via the `claude` binary (Claude Code CLI)
 * instead of external API calls. No API key needed.
 *
 * Usage: claude -p "prompt" --system-prompt "..." --output-format text
 */
import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getErrorMessage } from '../../../common/utils/error.utils';

const execFileAsync = promisify(execFile);

/** Path to the Claude CLI binary (VSCode extension) */
const CLAUDE_CLI_PATH =
  '/home/deploy/.vscode-server/.vscode-server/extensions/anthropic.claude-code-2.1.71-linux-x64/resources/native-binary/claude';

export interface ClaudeCliResponse {
  content: string;
  metadata: {
    provider: string;
    tokens: number;
    durationMs: number;
  };
}

@Injectable()
export class ClaudeCliService {
  private readonly logger = new Logger(ClaudeCliService.name);

  /** Default timeout: 120 seconds */
  private static readonly TIMEOUT_MS = 120_000;

  /** Max output buffer: 2MB */
  private static readonly MAX_BUFFER = 2 * 1024 * 1024;

  /**
   * Execute a prompt via Claude CLI and return the response.
   */
  async execute(
    prompt: string,
    options?: {
      systemPrompt?: string;
      timeoutMs?: number;
    },
  ): Promise<ClaudeCliResponse> {
    const startTime = performance.now();
    const timeout = options?.timeoutMs ?? ClaudeCliService.TIMEOUT_MS;

    this.logger.debug(
      `Executing Claude CLI (${prompt.length} chars, timeout: ${timeout}ms)`,
    );

    // Build args array
    const args = ['-p', prompt, '--output-format', 'text'];
    if (options?.systemPrompt) {
      args.push('--system-prompt', options.systemPrompt);
    }

    try {
      // Build clean env: unset CLAUDECODE to allow nested CLI sessions
      const cleanEnv: Record<string, string | undefined> = {
        ...process.env,
        CI: 'true',
      };
      delete cleanEnv.CLAUDECODE;

      const { stdout, stderr } = await execFileAsync(CLAUDE_CLI_PATH, args, {
        timeout,
        maxBuffer: ClaudeCliService.MAX_BUFFER,
        env: cleanEnv,
      });

      if (stderr && stderr.trim()) {
        this.logger.warn(
          `Claude CLI stderr: ${stderr.trim().substring(0, 200)}`,
        );
      }

      const content = stdout.trim();
      const durationMs = Math.round(performance.now() - startTime);

      if (!content) {
        throw new Error('Claude CLI returned empty response');
      }

      // Estimate tokens (~4 chars per token)
      const totalChars =
        prompt.length + (options?.systemPrompt?.length ?? 0) + content.length;
      const estimatedTokens = Math.round(totalChars / 4);

      this.logger.log(
        `Claude CLI response: ${content.length} chars in ${durationMs}ms (~${estimatedTokens} tokens)`,
      );

      return {
        content,
        metadata: {
          provider: 'claude-cli',
          tokens: estimatedTokens,
          durationMs,
        },
      };
    } catch (error: unknown) {
      const durationMs = Math.round(performance.now() - startTime);
      const msg = getErrorMessage(error);

      // Check for timeout
      if (
        typeof error === 'object' &&
        error !== null &&
        'killed' in error &&
        (error as { killed: boolean }).killed
      ) {
        throw new Error(`Claude CLI timeout after ${durationMs}ms`);
      }

      this.logger.error(`Claude CLI failed after ${durationMs}ms: ${msg}`);
      throw new Error(`Claude CLI error: ${msg}`);
    }
  }

  /**
   * Execute and parse JSON response.
   * Strips markdown code fences before parsing.
   */
  async executeJson<T = Record<string, unknown>>(
    prompt: string,
    options?: {
      systemPrompt?: string;
      timeoutMs?: number;
    },
  ): Promise<{ data: T; metadata: ClaudeCliResponse['metadata'] }> {
    const response = await this.execute(prompt, options);

    // Strip markdown code fences
    const cleaned = response.content
      .replace(/^```json?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    try {
      const data = JSON.parse(cleaned) as T;
      return { data, metadata: response.metadata };
    } catch {
      this.logger.warn(
        `Failed to parse JSON from Claude CLI response (${cleaned.length} chars)`,
      );
      throw new Error(
        `Claude CLI returned invalid JSON: ${cleaned.substring(0, 200)}...`,
      );
    }
  }

  /**
   * Health check: verify Claude CLI is accessible.
   */
  async checkHealth(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync(CLAUDE_CLI_PATH, ['--version'], {
        timeout: 5_000,
      });
      this.logger.log(`Claude CLI health OK: ${stdout.trim()}`);
      return true;
    } catch {
      this.logger.warn('Claude CLI health check failed');
      return false;
    }
  }
}

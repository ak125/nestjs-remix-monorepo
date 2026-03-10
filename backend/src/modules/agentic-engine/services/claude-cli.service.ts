/**
 * ClaudeCliService — Wrapper for Claude Code CLI
 *
 * Uses a shell wrapper script (`scripts/claude-cli-wrapper.sh`) that properly
 * unsets CLAUDECODE env vars before invoking the CLI binary.
 * This avoids the "nested session" blocking issue.
 */
import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** Path to the wrapper script (absolute — process.cwd() = backend/) */
const WRAPPER_PATH = '/opt/automecanik/app/scripts/claude-cli-wrapper.sh';

/** Max output buffer: 2MB */
const MAX_BUFFER = 2 * 1024 * 1024;

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

  /**
   * Execute a prompt via Claude CLI wrapper.
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

    // Wrapper args: <prompt> [system-prompt]
    const args = [prompt];
    if (options?.systemPrompt) {
      args.push(options.systemPrompt);
    }

    try {
      const { stdout, stderr } = await execFileAsync(WRAPPER_PATH, args, {
        timeout,
        maxBuffer: MAX_BUFFER,
      });

      // Use stdout first, fallback to stderr
      const content = (stdout || stderr || '').trim();

      if (stderr && stderr.trim()) {
        this.logger.warn(
          `Claude CLI stderr: ${stderr.trim().substring(0, 200)}`,
        );
      }

      const durationMs = Math.round(performance.now() - startTime);

      if (!content) {
        throw new Error(`Claude CLI returned empty response`);
      }

      const totalChars =
        prompt.length + (options?.systemPrompt?.length ?? 0) + content.length;
      const estimatedTokens = Math.round(totalChars / 4);

      this.logger.log(
        `Claude CLI: ${content.length} chars in ${durationMs}ms (~${estimatedTokens} tokens)`,
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

      if (
        typeof error === 'object' &&
        error !== null &&
        'killed' in error &&
        (error as { killed: boolean }).killed
      ) {
        throw new Error(`Claude CLI timeout after ${durationMs}ms`);
      }

      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Claude CLI failed after ${durationMs}ms: ${msg}`);
      throw new Error(`Claude CLI error: ${msg}`);
    }
  }

  /**
   * Execute and parse JSON response.
   */
  async executeJson<T = Record<string, unknown>>(
    prompt: string,
    options?: {
      systemPrompt?: string;
      timeoutMs?: number;
    },
  ): Promise<{ data: T; metadata: ClaudeCliResponse['metadata'] }> {
    const response = await this.execute(prompt, options);

    const cleaned = response.content
      .replace(/^```json?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    try {
      const data = JSON.parse(cleaned) as T;
      return { data, metadata: response.metadata };
    } catch {
      throw new Error(
        `Claude CLI invalid JSON: ${cleaned.substring(0, 200)}...`,
      );
    }
  }

  /**
   * Health check.
   */
  async checkHealth(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync(WRAPPER_PATH, ['--version'], {
        timeout: 10_000,
      });
      this.logger.log(`Claude CLI health OK: ${stdout.trim()}`);
      return true;
    } catch {
      return false;
    }
  }
}

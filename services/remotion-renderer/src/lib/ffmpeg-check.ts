import { execSync } from 'child_process';
import { accessSync, constants } from 'fs';

/**
 * Check if FFmpeg is available and return its version string.
 */
export function checkFfmpeg(): { available: boolean; version: string | null } {
  try {
    const output = execSync('ffmpeg -version', {
      timeout: 5000,
      encoding: 'utf-8',
    });
    const firstLine = output.split('\n')[0] ?? '';
    return { available: true, version: firstLine.trim() };
  } catch {
    return { available: false, version: null };
  }
}

/**
 * Check if Chromium binary is accessible and executable.
 */
export function checkChromium(): boolean {
  const chromiumPath = process.env.CHROMIUM_PATH ?? '/usr/bin/chromium';
  try {
    accessSync(chromiumPath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

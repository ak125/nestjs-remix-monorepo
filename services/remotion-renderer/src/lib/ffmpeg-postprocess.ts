/**
 * FFmpeg Post-Processing — Resize, normalize audio, merge audio, generate SRT.
 *
 * Operations applied after Remotion render to produce format variants.
 * Uses ffmpeg/ffprobe already available in the renderer container.
 */

import { execSync, execFileSync } from 'child_process';
import { existsSync, statSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import pino from 'pino';

const logger = pino({ name: 'FFmpegPostprocess' });

const WORK_DIR = '/tmp/postprocess';

export interface VariantSpec {
  name: string;
  width: number;
  height: number;
  codec: 'h264' | 'h265';
}

export interface PostprocessResult {
  name: string;
  localPath: string;
  codec: string;
  resolution: string;
  fileSizeBytes: number;
  durationSecs: number | null;
}

/**
 * Ensure work directory exists.
 */
function ensureWorkDir(): void {
  execSync(`mkdir -p ${WORK_DIR}`);
}

/**
 * Resize a video to a given resolution.
 */
export function resizeVideo(
  inputPath: string,
  variant: VariantSpec,
  outputSuffix: string,
): PostprocessResult {
  ensureWorkDir();
  const outputPath = join(WORK_DIR, `${outputSuffix}-${variant.name}.mp4`);

  const codecFlag = variant.codec === 'h265' ? 'libx265' : 'libx264';

  // Scale with pad to maintain aspect ratio (letterbox/pillarbox)
  const filterComplex = `scale=${variant.width}:${variant.height}:force_original_aspect_ratio=decrease,pad=${variant.width}:${variant.height}:(ow-iw)/2:(oh-ih)/2:color=black`;

  const cmd = [
    'ffmpeg', '-y',
    '-i', inputPath,
    '-vf', filterComplex,
    '-c:v', codecFlag,
    '-preset', 'medium',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    outputPath,
  ];

  logger.info({ variant: variant.name, resolution: `${variant.width}x${variant.height}` }, 'Resizing video');

  execFileSync(cmd[0], cmd.slice(1), { timeout: 300_000, stdio: 'pipe' });

  const stats = statSync(outputPath);
  const durationSecs = probeDuration(outputPath);

  return {
    name: variant.name,
    localPath: outputPath,
    codec: variant.codec,
    resolution: `${variant.width}x${variant.height}`,
    fileSizeBytes: stats.size,
    durationSecs,
  };
}

/**
 * Normalize audio loudness to target LUFS (2-pass loudnorm).
 */
export function normalizeAudio(
  inputPath: string,
  targetLufs: number,
  outputSuffix: string,
): string {
  ensureWorkDir();
  const outputPath = join(WORK_DIR, `${outputSuffix}-normalized.mp4`);

  // Pass 1: measure
  const pass1Cmd = [
    'ffmpeg', '-y',
    '-i', inputPath,
    '-af', `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11:print_format=json`,
    '-f', 'null', '-',
  ];

  let measured: string;
  try {
    // loudnorm prints to stderr
    execFileSync(pass1Cmd[0], pass1Cmd.slice(1), {
      timeout: 120_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // If we get here, the command succeeded but we need stderr
    // Re-run capturing stderr
    measured = execSync(pass1Cmd.join(' ') + ' 2>&1 | tail -12', {
      timeout: 120_000,
    }).toString();
  } catch {
    logger.warn('Loudnorm pass 1 failed — skipping normalization');
    return inputPath;
  }

  // Parse measured values
  let measuredI = targetLufs.toString();
  let measuredTP = '-1.5';
  let measuredLRA = '11';
  let measuredThresh = '-24';

  try {
    const jsonMatch = measured.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      measuredI = parsed.input_i ?? measuredI;
      measuredTP = parsed.input_tp ?? measuredTP;
      measuredLRA = parsed.input_lra ?? measuredLRA;
      measuredThresh = parsed.input_thresh ?? measuredThresh;
    }
  } catch {
    logger.warn('Failed to parse loudnorm pass 1 output — using defaults');
  }

  // Pass 2: normalize
  const pass2Cmd = [
    'ffmpeg', '-y',
    '-i', inputPath,
    '-af', `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11:measured_I=${measuredI}:measured_TP=${measuredTP}:measured_LRA=${measuredLRA}:measured_thresh=${measuredThresh}:linear=true`,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '128k',
    outputPath,
  ];

  execFileSync(pass2Cmd[0], pass2Cmd.slice(1), { timeout: 120_000, stdio: 'pipe' });

  logger.info({ targetLufs, measuredI }, 'Audio normalized');

  return outputPath;
}

/**
 * Merge a video (may be silent) with an external audio track.
 */
export function mergeAudio(
  videoPath: string,
  audioPath: string,
  outputSuffix: string,
): string {
  ensureWorkDir();
  const outputPath = join(WORK_DIR, `${outputSuffix}-merged.mp4`);

  const cmd = [
    'ffmpeg', '-y',
    '-i', videoPath,
    '-i', audioPath,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-shortest',
    '-movflags', '+faststart',
    outputPath,
  ];

  logger.info('Merging audio into video');

  execFileSync(cmd[0], cmd.slice(1), { timeout: 120_000, stdio: 'pipe' });

  return outputPath;
}

/**
 * Generate SRT subtitles from text segments.
 */
export interface SubtitleSegment {
  startSecs: number;
  endSecs: number;
  text: string;
}

export function generateSrt(segments: SubtitleSegment[]): string {
  return segments
    .map((seg, i) => {
      const start = formatSrtTime(seg.startSecs);
      const end = formatSrtTime(seg.endSecs);
      return `${i + 1}\n${start} --> ${end}\n${seg.text}\n`;
    })
    .join('\n');
}

function formatSrtTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.round((secs % 1) * 1000);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, '0');
}

/**
 * Write SRT to a file.
 */
export function writeSrtFile(srtContent: string, outputSuffix: string): string {
  ensureWorkDir();
  const outputPath = join(WORK_DIR, `${outputSuffix}.srt`);
  writeFileSync(outputPath, srtContent, 'utf-8');
  return outputPath;
}

/**
 * Probe duration with ffprobe.
 */
function probeDuration(filePath: string): number | null {
  try {
    const out = execSync(
      `ffprobe -v quiet -print_format json -show_format "${filePath}"`,
      { timeout: 10_000 },
    ).toString();
    const data = JSON.parse(out);
    return parseFloat(data.format?.duration ?? '0') || null;
  } catch {
    return null;
  }
}

/**
 * Cleanup temporary files.
 */
export function cleanupPostprocessFiles(paths: string[]): void {
  for (const p of paths) {
    try {
      if (existsSync(p)) unlinkSync(p);
    } catch {
      logger.warn({ path: p }, 'Failed to cleanup postprocess file');
    }
  }
}

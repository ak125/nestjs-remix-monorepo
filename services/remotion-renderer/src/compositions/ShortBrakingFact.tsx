import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Audio,
} from 'remotion';
import { BrakingSchematicSVG } from './components/BrakingSchematicSVG';

/**
 * ShortBrakingFact — Vertical short (1080x1920, 21s @ 30fps = 630 frames).
 *
 * Displays a single braking fact with animated schematic.
 *
 * Sections:
 *   Hook      (0-90)    : factValue spring-in with counter animation
 *   Schema    (90-540)  : Braking schematic SVG + fact text + source reference
 *   Closer    (540-630) : Brand + tagline fade-in
 *
 * Palette: #1a1a2e bg, #e94560 accent, #16213e panel, Liberation Sans.
 */

interface ShortBrakingFactProps {
  briefId?: string;
  videoType?: string;
  vertical?: string;
  factText: string;
  factValue: string;
  factUnit: string;
  sourceRef: string;
  schemaSvgId?: 'full' | 'caliper' | 'disc' | 'fluid';
  audioUrl?: string;
  brandName?: string;
  tagline?: string;
  disclaimerText?: string;
}

export const ShortBrakingFact: React.FC<ShortBrakingFactProps> = ({
  factText = 'Un disque ventile dissipe la chaleur 40% plus vite',
  factValue = '40',
  factUnit = '%',
  sourceRef = 'Norme ECE R90',
  schemaSvgId = 'full',
  audioUrl,
  brandName = 'AutoMecanik',
  tagline = 'Pièces auto de qualité',
  disclaimerText,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ── Section boundaries ──
  const HOOK_END = 90;
  const SCHEMA_END = 540;

  // ── Progress bar (bottom) ──
  const progress = frame / durationInFrames;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1a1a2e',
        fontFamily: 'Liberation Sans, Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Audio (if TTS provided) */}
      {audioUrl && <Audio src={audioUrl} />}

      {/* ── Section 1: Hook (0-90) ── */}
      <HookSection
        frame={frame}
        fps={fps}
        endFrame={HOOK_END}
        factValue={factValue}
        factUnit={factUnit}
      />

      {/* ── Section 2: Schema + Explanation (90-540) ── */}
      <SchemaSection
        frame={frame}
        fps={fps}
        startFrame={HOOK_END}
        endFrame={SCHEMA_END}
        factText={factText}
        sourceRef={sourceRef}
        schemaSvgId={schemaSvgId}
      />

      {/* ── Section 3: Closer (540-630) ── */}
      <CloserSection
        frame={frame}
        fps={fps}
        startFrame={SCHEMA_END}
        brandName={brandName}
        tagline={tagline}
      />

      {/* ── Disclaimer overlay ── */}
      {disclaimerText && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: 40,
            right: 40,
            textAlign: 'center',
            color: 'rgba(255,255,255,0.4)',
            fontSize: 18,
            lineHeight: 1.4,
          }}
        >
          {disclaimerText}
        </div>
      )}

      {/* ── Progress bar ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: `${progress * 100}%`,
          height: 4,
          backgroundColor: '#e94560',
        }}
      />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────
// Hook Section: Value spring-in with counting animation
// ─────────────────────────────────────────────────────────────

const HookSection: React.FC<{
  frame: number;
  fps: number;
  endFrame: number;
  factValue: string;
  factUnit: string;
}> = ({ frame, fps, endFrame, factValue, factUnit }) => {
  if (frame >= endFrame) return null;

  // Parse numeric value for counter animation
  const numericValue = parseFloat(factValue);
  const isNumeric = !isNaN(numericValue);

  // Counter animation (count up from 0 to value in first 60 frames)
  const counterProgress = interpolate(frame, [0, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const displayValue = isNumeric
    ? Math.round(numericValue * counterProgress).toString()
    : factValue;

  // Scale spring
  const valueScale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 60 },
  });

  // Unit fade in
  const unitOpacity = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 16,
          transform: `scale(${valueScale})`,
        }}
      >
        <span
          style={{
            color: '#e94560',
            fontSize: 180,
            fontWeight: 'bold',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {displayValue}
        </span>
        <span
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: 64,
            opacity: unitOpacity,
          }}
        >
          {factUnit}
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────
// Schema Section: Animated braking circuit + fact explanation
// ─────────────────────────────────────────────────────────────

const SchemaSection: React.FC<{
  frame: number;
  fps: number;
  startFrame: number;
  endFrame: number;
  factText: string;
  sourceRef: string;
  schemaSvgId: 'full' | 'caliper' | 'disc' | 'fluid';
}> = ({ frame, fps, startFrame, endFrame, factText, sourceRef, schemaSvgId }) => {
  if (frame < startFrame || frame >= endFrame) return null;

  const localFrame = frame - startFrame;
  const sectionDuration = endFrame - startFrame;

  // Schema animation progress (0-1 over the section)
  const schemaProgress = interpolate(localFrame, [0, sectionDuration * 0.7], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Fade in the whole section
  const fadeIn = interpolate(localFrame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Text slide up
  const textSlideY = interpolate(localFrame, [10, 40], [60, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Source ref fade in (delayed)
  const sourceOpacity = interpolate(localFrame, [60, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        opacity: fadeIn,
        padding: '80px 40px',
      }}
    >
      {/* Schema SVG (top area) */}
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 60,
        }}
      >
        <BrakingSchematicSVG
          focusArea={schemaSvgId}
          progress={schemaProgress}
          width={950}
          height={720}
        />
      </div>

      {/* Fact text (below schema) */}
      <div
        style={{
          transform: `translateY(${textSlideY}px)`,
          textAlign: 'center',
          maxWidth: 900,
          padding: '0 20px',
        }}
      >
        <div
          style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: 38,
            lineHeight: 1.5,
            fontWeight: 500,
          }}
        >
          {factText}
        </div>

        {/* Source reference badge */}
        <div
          style={{
            marginTop: 30,
            opacity: sourceOpacity,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#16213e',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 20,
            padding: '8px 20px',
            borderRadius: 8,
          }}
        >
          <span style={{ color: '#e94560', fontWeight: 'bold' }}>Source:</span>
          {sourceRef}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────
// Closer Section: Brand + tagline
// ─────────────────────────────────────────────────────────────

const CloserSection: React.FC<{
  frame: number;
  fps: number;
  startFrame: number;
  brandName: string;
  tagline: string;
}> = ({ frame, fps, startFrame, brandName, tagline }) => {
  if (frame < startFrame) return null;

  const localFrame = frame - startFrame;

  const brandScale = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  const taglineOpacity = interpolate(localFrame, [20, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          color: '#e94560',
          fontSize: 96,
          fontWeight: 'bold',
          letterSpacing: 6,
          transform: `scale(${brandScale})`,
        }}
      >
        {brandName}
      </div>

      <div
        style={{
          marginTop: 24,
          color: 'rgba(255,255,255,0.7)',
          fontSize: 36,
          opacity: taglineOpacity,
          letterSpacing: 2,
        }}
      >
        {tagline}
      </div>
    </AbsoluteFill>
  );
};

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';

/**
 * ShortProductHighlight — First real template (P8c).
 *
 * 15s vertical reel (1080x1920, 30fps = 450 frames).
 *
 * Sections:
 *   Hook     (0-60)   : Gamme name spring-in + vertical badge
 *   Claims   (60-360) : 2-3 verified claims slide-in carousel
 *   Closer   (360-450): Brand logo + tagline fade-in
 *
 * Palette: #1a1a2e bg, #e94560 accent, #16213e panel, Liberation Sans.
 */

interface ClaimProp {
  kind: string;
  value: string;
  unit: string;
  rawText: string;
}

interface ShortProductHighlightProps {
  briefId?: string;
  videoType?: string;
  vertical?: string;
  gammeAlias?: string | null;
  claims?: ClaimProp[];
  disclaimerText?: string | null;
  brandName?: string;
  tagline?: string;
}

export const ShortProductHighlight: React.FC<ShortProductHighlightProps> = ({
  vertical = 'freinage',
  gammeAlias = null,
  claims = [],
  disclaimerText = null,
  brandName = 'AutoMecanik',
  tagline = 'Pièces auto de qualité',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ── Section boundaries ──
  const HOOK_END = 60;
  const CLAIMS_END = 360;

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
      {/* ── Section 1: Hook (0-60) ── */}
      <HookSection
        frame={frame}
        fps={fps}
        endFrame={HOOK_END}
        gammeAlias={gammeAlias}
        vertical={vertical}
      />

      {/* ── Section 2: Claims carousel (60-360) ── */}
      <ClaimsSection
        frame={frame}
        fps={fps}
        startFrame={HOOK_END}
        endFrame={CLAIMS_END}
        claims={claims}
      />

      {/* ── Section 3: Brand closer (360-450) ── */}
      <CloserSection
        frame={frame}
        fps={fps}
        startFrame={CLAIMS_END}
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
            color: 'rgba(255,255,255,0.5)',
            fontSize: 20,
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
// Hook Section
// ─────────────────────────────────────────────────────────────

const HookSection: React.FC<{
  frame: number;
  fps: number;
  endFrame: number;
  gammeAlias: string | null;
  vertical: string;
}> = ({ frame, fps, endFrame, gammeAlias, vertical }) => {
  if (frame >= endFrame) return null;

  const titleScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  const badgeOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const displayName = gammeAlias
    ? gammeAlias.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : vertical.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Gamme name */}
      <div
        style={{
          color: '#ffffff',
          fontSize: 80,
          fontWeight: 'bold',
          textAlign: 'center',
          transform: `scale(${titleScale})`,
          textTransform: 'uppercase',
          letterSpacing: 6,
          padding: '0 60px',
        }}
      >
        {displayName}
      </div>

      {/* Vertical badge */}
      <div
        style={{
          marginTop: 30,
          opacity: badgeOpacity,
          backgroundColor: '#e94560',
          color: '#ffffff',
          fontSize: 28,
          fontWeight: 'bold',
          padding: '10px 30px',
          borderRadius: 8,
          textTransform: 'uppercase',
          letterSpacing: 2,
        }}
      >
        {vertical}
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────
// Claims Section
// ─────────────────────────────────────────────────────────────

const ClaimsSection: React.FC<{
  frame: number;
  fps: number;
  startFrame: number;
  endFrame: number;
  claims: ClaimProp[];
}> = ({ frame, fps, startFrame, endFrame, claims }) => {
  if (frame < startFrame || frame >= endFrame) return null;

  const localFrame = frame - startFrame;
  const sectionDuration = endFrame - startFrame; // 300 frames
  const claimCount = Math.min(claims.length, 3);

  if (claimCount === 0) {
    // Fallback: no claims available
    const opacity = interpolate(localFrame, [0, 20], [0, 1], {
      extrapolateRight: 'clamp',
    });
    return (
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          opacity,
        }}
      >
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 36 }}>
          Données produit en cours de validation
        </div>
      </AbsoluteFill>
    );
  }

  const framesPerClaim = Math.floor(sectionDuration / claimCount);

  return (
    <AbsoluteFill>
      {claims.slice(0, 3).map((claim, i) => {
        const claimStart = i * framesPerClaim;
        const claimEnd = (i + 1) * framesPerClaim;

        if (localFrame < claimStart || localFrame >= claimEnd) return null;

        const claimLocalFrame = localFrame - claimStart;

        // Slide in from right
        const slideX = interpolate(claimLocalFrame, [0, 15], [400, 0], {
          extrapolateRight: 'clamp',
        });

        // Fade out before next
        const fadeOut = interpolate(
          claimLocalFrame,
          [framesPerClaim - 15, framesPerClaim],
          [1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );

        const valueScale = spring({
          frame: claimLocalFrame - 10,
          fps,
          config: { damping: 15, stiffness: 100 },
        });

        return (
          <AbsoluteFill
            key={i}
            style={{
              justifyContent: 'center',
              alignItems: 'center',
              opacity: fadeOut,
              transform: `translateX(${slideX}px)`,
            }}
          >
            {/* Claim kind badge */}
            <div
              style={{
                backgroundColor: '#16213e',
                color: '#e94560',
                fontSize: 24,
                fontWeight: 'bold',
                padding: '8px 24px',
                borderRadius: 6,
                textTransform: 'uppercase',
                letterSpacing: 2,
                marginBottom: 30,
              }}
            >
              {claim.kind}
            </div>

            {/* Value + unit */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 12,
                transform: `scale(${valueScale})`,
              }}
            >
              <span
                style={{
                  color: '#e94560',
                  fontSize: 120,
                  fontWeight: 'bold',
                  lineHeight: 1,
                }}
              >
                {claim.value}
              </span>
              <span
                style={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 48,
                }}
              >
                {claim.unit}
              </span>
            </div>

            {/* Raw text */}
            <div
              style={{
                marginTop: 30,
                color: 'rgba(255,255,255,0.6)',
                fontSize: 28,
                maxWidth: 800,
                textAlign: 'center',
                lineHeight: 1.4,
                padding: '0 60px',
              }}
            >
              {claim.rawText}
            </div>

            {/* Claim index indicator */}
            <div
              style={{
                position: 'absolute',
                bottom: 120,
                display: 'flex',
                gap: 10,
              }}
            >
              {Array.from({ length: claimCount }).map((_, dotIdx) => (
                <div
                  key={dotIdx}
                  style={{
                    width: dotIdx === i ? 30 : 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor:
                      dotIdx === i ? '#e94560' : 'rgba(255,255,255,0.2)',
                  }}
                />
              ))}
            </div>
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────
// Closer Section
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
      {/* Brand name */}
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

      {/* Tagline */}
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

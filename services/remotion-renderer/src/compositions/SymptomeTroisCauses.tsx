import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Audio,
} from 'remotion';

/**
 * SymptomeTroisCauses — Vertical short (1080x1920, 33s @ 30fps = 990 frames).
 *
 * Format Fafa "symptome-3-causes" : un symptôme observable → 3 causes
 * possibles ordonnées par probabilité, chacune avec signe + check.
 *
 * Sections:
 *   Symptom  (0-120)   : symptôme observable, accroche
 *   Cause 1  (120-390) : cause fréquente + signe + check
 *   Cause 2  (390-630) : cause intermédiaire
 *   Cause 3  (630-870) : cause moins fréquente mais sérieuse
 *   Closer   (870-990) : brand + CTA
 *
 * Palette: #1a1a2e bg, #e94560 accent, #16213e panel, Liberation Sans.
 * Photos pièces autorisées en illustration (G6) — jamais comme preuve diagnostic.
 */

interface CauseDetail {
  cause: string;
  sign?: string;
  check?: string;
}

interface SymptomeTroisCausesProps {
  briefId?: string;
  videoType?: string;
  vertical?: string;
  symptom?: string;
  causes?: CauseDetail[];
  cta?: string;
  disclaimer?: string;
  audioUrl?: string;
  brandName?: string;
}

export const SymptomeTroisCauses: React.FC<SymptomeTroisCausesProps> = ({
  symptom = 'Perte de puissance',
  causes = [
    { cause: 'Filtre à air bouché', sign: 'Ralenti instable', check: 'Inspection visuelle' },
    { cause: 'Débitmètre encrassé', sign: 'À-coups à l’accélération', check: 'Lecture valeurs OBD' },
    { cause: 'Vanne EGR grippée', sign: 'Fumée + voyant moteur', check: 'Diagnostic atelier' },
  ],
  cta = 'Sur AutoMecanik, sélectionne ton véhicule pour voir les pièces compatibles.',
  disclaimer = 'Conseil informatif. Diagnostic à confirmer selon véhicule.',
  audioUrl,
  brandName = 'AutoMecanik',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const SYMPTOM_END = 120;
  const CAUSE_BOUNDS = [120, 390, 630, 870]; // start of cause1, cause2, cause3, closer
  const CLOSER_START = 870;

  const progress = frame / durationInFrames;
  const safeCauses = causes.slice(0, 3);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1a1a2e',
        fontFamily: 'Liberation Sans, Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      {audioUrl && <Audio src={audioUrl} />}

      <SymptomSection frame={frame} fps={fps} endFrame={SYMPTOM_END} symptom={symptom} />

      {safeCauses.map((c, i) => (
        <CauseSection
          key={i}
          frame={frame}
          index={i}
          startFrame={CAUSE_BOUNDS[i]}
          endFrame={CAUSE_BOUNDS[i + 1]}
          cause={c}
          total={safeCauses.length}
        />
      ))}

      <CloserSection frame={frame} fps={fps} startFrame={CLOSER_START} brandName={brandName} cta={cta} />

      {disclaimer && <DisclaimerOverlay text={disclaimer} />}

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

// ── Symptom hook ──
const SymptomSection: React.FC<{
  frame: number;
  fps: number;
  endFrame: number;
  symptom: string;
}> = ({ frame, fps, endFrame, symptom }) => {
  if (frame >= endFrame) return null;
  const scale = spring({ frame, fps, config: { damping: 12, stiffness: 70 } });
  const subOpacity = interpolate(frame, [45, 75], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 60px' }}>
      <div
        style={{
          color: '#ffffff',
          fontSize: 72,
          fontWeight: 'bold',
          textAlign: 'center',
          lineHeight: 1.2,
          transform: `scale(${scale})`,
        }}
      >
        {symptom}
      </div>
      <div
        style={{
          marginTop: 28,
          color: '#e94560',
          fontSize: 34,
          letterSpacing: 2,
          opacity: subOpacity,
        }}
      >
        3 causes possibles
      </div>
    </AbsoluteFill>
  );
};

// ── Single cause panel ──
const CauseSection: React.FC<{
  frame: number;
  index: number;
  startFrame: number;
  endFrame: number;
  cause: CauseDetail;
  total: number;
}> = ({ frame, index, startFrame, endFrame, cause, total }) => {
  if (frame < startFrame || frame >= endFrame) return null;
  const local = frame - startFrame;
  const fadeIn = interpolate(local, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
  const numScale = spring({ frame: local, fps: 30, config: { damping: 10, stiffness: 60 } });
  const detailSlideY = interpolate(local, [15, 40], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{ justifyContent: 'center', alignItems: 'center', opacity: fadeIn, padding: '0 60px' }}
    >
      {/* progress dots */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 50 }}>
        {Array.from({ length: total }).map((_, d) => (
          <div
            key={d}
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              backgroundColor: d === index ? '#e94560' : 'rgba(255,255,255,0.25)',
            }}
          />
        ))}
      </div>

      <div
        style={{
          color: '#e94560',
          fontSize: 96,
          fontWeight: 'bold',
          lineHeight: 1,
          transform: `scale(${numScale})`,
        }}
      >
        {index + 1}
      </div>

      <div
        style={{
          marginTop: 24,
          color: '#ffffff',
          fontSize: 52,
          fontWeight: 'bold',
          textAlign: 'center',
          maxWidth: 880,
        }}
      >
        {cause.cause}
      </div>

      <div style={{ transform: `translateY(${detailSlideY}px)`, marginTop: 40, width: '100%', maxWidth: 760 }}>
        {cause.sign && (
          <DetailRow label="Signe" value={cause.sign} />
        )}
        {cause.check && (
          <DetailRow label="Vérifie" value={cause.check} />
        )}
      </div>
    </AbsoluteFill>
  );
};

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      backgroundColor: '#16213e',
      borderRadius: 10,
      padding: '18px 24px',
      marginBottom: 16,
    }}
  >
    <span
      style={{
        color: '#e94560',
        fontSize: 22,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 2,
        minWidth: 110,
      }}
    >
      {label}
    </span>
    <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 30 }}>{value}</span>
  </div>
);

// ── Closer ──
const CloserSection: React.FC<{
  frame: number;
  fps: number;
  startFrame: number;
  brandName: string;
  cta: string;
}> = ({ frame, fps, startFrame, brandName, cta }) => {
  if (frame < startFrame) return null;
  const local = frame - startFrame;
  const brandScale = spring({ frame: local, fps, config: { damping: 12, stiffness: 80 } });
  const ctaOpacity = interpolate(local, [20, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 60px' }}>
      <div
        style={{
          color: '#e94560',
          fontSize: 80,
          fontWeight: 'bold',
          letterSpacing: 5,
          transform: `scale(${brandScale})`,
        }}
      >
        {brandName}
      </div>
      <div
        style={{
          marginTop: 32,
          color: 'rgba(255,255,255,0.85)',
          fontSize: 34,
          lineHeight: 1.4,
          textAlign: 'center',
          maxWidth: 820,
          opacity: ctaOpacity,
        }}
      >
        {cta}
      </div>
    </AbsoluteFill>
  );
};

const DisclaimerOverlay: React.FC<{ text: string }> = ({ text }) => (
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
    {text}
  </div>
);

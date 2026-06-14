import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Audio,
} from 'remotion';

/**
 * NeChangePasTropVite — Vertical short (1080x1920, 38s @ 30fps = 1140 frames).
 *
 * Format Fafa "ne-change-pas-trop-vite" : avant de changer la pièce X,
 * vérifie d'abord les causes alternatives.
 *
 * Sections:
 *   Hook     (0-150)     : accroche symptôme + "ne change pas trop vite"
 *   Problem  (150-330)   : pourquoi le réflexe "changer X" est risqué
 *   Causes   (330-870)   : 3 causes possibles (ordonnées par probabilité)
 *   Advice   (870-1050)  : conseil de vérification ordonné
 *   Closer   (1050-1140) : brand + CTA
 *
 * Palette: #0F1E38 bg, #F97316 accent, #0F4C81 panel, Liberation Sans.
 * Aucun visuel n'est une preuve (G6) — texte animé + schéma stylisé uniquement.
 */

interface Cause {
  cause: string;
  duration_sec?: number;
  check_suggestion?: string;
}

interface NeChangePasTropViteProps {
  briefId?: string;
  videoType?: string;
  vertical?: string;
  hook: string;
  symptom: string;
  pieceWrong: string;
  /** Optionnel : remplace le texte du bloc Problème (ex. cadrage compatibilité). Défaut = cadrage diagnostic. */
  problemText?: string;
  causes: Cause[];
  advice: string;
  cta: string;
  disclaimer?: string;
  audioUrl?: string;
  brandName?: string;
}

export const NeChangePasTropVite: React.FC<NeChangePasTropViteProps> = ({
  hook = 'Perte de puissance ? Ne change pas ta pièce trop vite.',
  symptom = 'Perte de puissance',
  pieceWrong = 'vanne EGR',
  problemText,
  causes = [
    { cause: 'Filtre à air bouché', check_suggestion: 'Inspection visuelle' },
    { cause: 'Débitmètre fatigué', check_suggestion: 'Test multimètre' },
    { cause: 'Durite percée', check_suggestion: 'Visuel + écoute' },
  ],
  advice = 'Vérifie dans l’ordre : visuel → test → atelier',
  cta = 'Sur AutoMecanik, sélectionne ton véhicule pour voir les pièces compatibles.',
  disclaimer = 'Conseil informatif. Diagnostic à confirmer selon véhicule.',
  audioUrl,
  brandName = 'AutoMecanik',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const HOOK_END = 150;
  const PROBLEM_END = 330;
  const CAUSES_END = 870;
  const ADVICE_END = 1050;

  const progress = frame / durationInFrames;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0F1E38',
        fontFamily: 'Liberation Sans, Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      {audioUrl && <Audio src={audioUrl} />}

      <HookSection frame={frame} fps={fps} endFrame={HOOK_END} hook={hook} symptom={symptom} />

      <ProblemSection
        frame={frame}
        startFrame={HOOK_END}
        endFrame={PROBLEM_END}
        pieceWrong={pieceWrong}
        problemText={problemText}
      />

      <CausesSection
        frame={frame}
        startFrame={PROBLEM_END}
        endFrame={CAUSES_END}
        causes={causes}
      />

      <AdviceSection
        frame={frame}
        startFrame={CAUSES_END}
        endFrame={ADVICE_END}
        advice={advice}
      />

      <CloserSection frame={frame} fps={fps} startFrame={ADVICE_END} brandName={brandName} cta={cta} />

      {disclaimer && <DisclaimerOverlay text={disclaimer} />}

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: `${progress * 100}%`,
          height: 4,
          backgroundColor: '#F97316',
        }}
      />
    </AbsoluteFill>
  );
};

// ── Hook ──
const HookSection: React.FC<{
  frame: number;
  fps: number;
  endFrame: number;
  hook: string;
  symptom: string;
}> = ({ frame, fps, endFrame, hook, symptom }) => {
  if (frame >= endFrame) return null;

  const titleScale = spring({ frame, fps, config: { damping: 12, stiffness: 70 } });
  const symptomOpacity = interpolate(frame, [40, 70], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 60px' }}>
      <div
        style={{
          color: '#F97316',
          fontSize: 28,
          fontWeight: 'bold',
          letterSpacing: 4,
          textTransform: 'uppercase',
          marginBottom: 24,
          opacity: symptomOpacity,
        }}
      >
        {symptom}
      </div>
      <div
        style={{
          color: '#ffffff',
          fontSize: 64,
          fontWeight: 'bold',
          lineHeight: 1.25,
          textAlign: 'center',
          transform: `scale(${titleScale})`,
        }}
      >
        {hook}
      </div>
    </AbsoluteFill>
  );
};

// ── Problem ──
const ProblemSection: React.FC<{
  frame: number;
  startFrame: number;
  endFrame: number;
  pieceWrong: string;
  problemText?: string;
}> = ({ frame, startFrame, endFrame, pieceWrong, problemText }) => {
  if (frame < startFrame || frame >= endFrame) return null;
  const local = frame - startFrame;
  const fadeIn = interpolate(local, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const slideY = interpolate(local, [0, 30], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{ justifyContent: 'center', alignItems: 'center', opacity: fadeIn, padding: '0 60px' }}
    >
      <div style={{ transform: `translateY(${slideY}px)`, textAlign: 'center', maxWidth: 900 }}>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 44, lineHeight: 1.5 }}>
          {problemText ? (
            problemText
          ) : (
            <>
              Changer directement{' '}
              <span style={{ color: '#F97316', fontWeight: 'bold' }}>la {pieceWrong}</span>, c’est
              tentant. Mais si la vraie cause est ailleurs, tu paies pour rien.
            </>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Causes (3 cards, sequential reveal) ──
const CausesSection: React.FC<{
  frame: number;
  startFrame: number;
  endFrame: number;
  causes: Cause[];
}> = ({ frame, startFrame, endFrame, causes }) => {
  if (frame < startFrame || frame >= endFrame) return null;
  const local = frame - startFrame;
  const sectionDuration = endFrame - startFrame;
  const perCard = sectionDuration / Math.max(causes.length, 1);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 50px' }}>
      <div
        style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: 24,
          letterSpacing: 3,
          textTransform: 'uppercase',
          marginBottom: 40,
        }}
      >
        Vérifie d’abord
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, width: '100%', maxWidth: 880 }}>
        {causes.slice(0, 3).map((c, i) => {
          const cardStart = i * perCard;
          const reveal = interpolate(local, [cardStart, cardStart + 18], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const slideX = interpolate(local, [cardStart, cardStart + 18], [-50, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={i}
              style={{
                opacity: reveal,
                transform: `translateX(${slideX}px)`,
                backgroundColor: '#0F4C81',
                borderLeft: '6px solid #F97316',
                borderRadius: 12,
                padding: '28px 32px',
                display: 'flex',
                alignItems: 'center',
                gap: 24,
              }}
            >
              <span style={{ color: '#F97316', fontSize: 52, fontWeight: 'bold', lineHeight: 1 }}>
                {i + 1}
              </span>
              <div>
                <div style={{ color: '#ffffff', fontSize: 38, fontWeight: 600 }}>{c.cause}</div>
                {c.check_suggestion && (
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 24, marginTop: 6 }}>
                    {c.check_suggestion}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── Advice ──
const AdviceSection: React.FC<{
  frame: number;
  startFrame: number;
  endFrame: number;
  advice: string;
}> = ({ frame, startFrame, endFrame, advice }) => {
  if (frame < startFrame || frame >= endFrame) return null;
  const local = frame - startFrame;
  const fadeIn = interpolate(local, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{ justifyContent: 'center', alignItems: 'center', opacity: fadeIn, padding: '0 60px' }}
    >
      <div style={{ textAlign: 'center', maxWidth: 900 }}>
        <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 46, lineHeight: 1.45, fontWeight: 500 }}>
          {advice}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Closer (brand + CTA) ──
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
          color: '#F97316',
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

// ── Disclaimer overlay (shared) ──
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

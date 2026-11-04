import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Audio,
} from 'remotion';

/**
 * PieceExpliquee — Vertical short (1080x1920, 40s @ 30fps = 1200 frames).
 *
 * Format Fafa "piece-expliquee" : à quoi sert la pièce X, comment elle s'use,
 * quand la changer.
 *
 * Sections:
 *   Intro      (0-120)     : nom de la pièce, accroche (`hook`)
 *   Function   (120-420)   : rôle mécanique + emplacement
 *   WearSigns  (420-720)   : 2-3 signes d'usure observables
 *   WhenChange (720-960)   : critère objectif (km / signe critique)
 *   Closer     (960-1200)  : brand + CTA
 *
 * Titres de section : `titles` (défauts = libellés historiques). Avertissement
 * propre à une fenêtre (disclaimer `overlay_segment`) : `windowWarnings`, en
 * plus du bandeau continu `disclaimer`.
 *
 * Palette: #0F1E38 bg, #F97316 accent, #0F4C81 panel, Liberation Sans.
 * Claim safety (ex. freinage compromis) → validation humaine obligatoire (G2 STRICT).
 */

interface WearSign {
  sign: string;
  severity?: 'low' | 'medium' | 'high';
}

export type PieceExpliqueeWindow =
  | 'intro'
  | 'function'
  | 'wearSigns'
  | 'whenToChange'
  | 'closer';

/** Fenêtres fixes en frames (30 fps) : [début, fin[. */
export const PIECE_EXPLIQUEE_WINDOWS: Record<PieceExpliqueeWindow, [number, number]> = {
  intro: [0, 120],
  function: [120, 420],
  wearSigns: [420, 720],
  whenToChange: [720, 960],
  closer: [960, 1200],
};

export interface PieceExpliqueeTitles {
  intro: string;
  function: string;
  location: string;
  wearSigns: string;
  whenToChange: string;
}

export const DEFAULT_PIECE_EXPLIQUEE_TITLES: PieceExpliqueeTitles = {
  intro: 'La pièce expliquée',
  function: 'À quoi ça sert',
  location: 'Emplacement',
  wearSigns: 'Signes d’usure',
  whenToChange: 'Quand la changer',
};

/** Fenêtre affichée à une frame donnée (la dernière court jusqu'à la fin). */
export function pieceExpliqueeWindowAt(frame: number): PieceExpliqueeWindow {
  const found = (Object.keys(PIECE_EXPLIQUEE_WINDOWS) as PieceExpliqueeWindow[]).find(
    (w) => frame >= PIECE_EXPLIQUEE_WINDOWS[w][0] && frame < PIECE_EXPLIQUEE_WINDOWS[w][1],
  );
  return found ?? 'closer';
}

export interface PieceExpliqueeProps {
  briefId?: string;
  videoType?: string;
  vertical?: string;
  piece?: string;
  pieceFunction?: string;
  location?: string;
  wearSigns?: WearSign[];
  whenToChange?: string;
  cta?: string;
  disclaimer?: string;
  audioUrl?: string;
  brandName?: string;
  hook?: string;
  titles?: Partial<PieceExpliqueeTitles>;
  windowWarnings?: Partial<Record<PieceExpliqueeWindow, string>>;
}

const SEVERITY_COLOR: Record<string, string> = {
  low: 'rgba(255,255,255,0.4)',
  medium: '#D68910',
  high: '#F97316',
};

export const PieceExpliquee: React.FC<PieceExpliqueeProps> = ({
  piece = 'Vanne EGR',
  pieceFunction = 'Elle recircule une partie des gaz d’échappement pour réduire les émissions.',
  location = 'Entre le collecteur d’échappement et l’admission',
  wearSigns = [
    { sign: 'Perte de puissance', severity: 'medium' },
    { sign: 'Fumée noire à l’accélération', severity: 'medium' },
    { sign: 'Voyant moteur allumé', severity: 'high' },
  ],
  whenToChange = 'En général vers 120 000 km, ou dès que les symptômes persistent après nettoyage.',
  cta = 'Sur AutoMecanik, sélectionne ton véhicule pour vérifier la compatibilité.',
  disclaimer = 'Conseil informatif. Diagnostic à confirmer selon véhicule.',
  audioUrl,
  brandName = 'AutoMecanik',
  hook,
  titles,
  windowWarnings,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const INTRO_END = PIECE_EXPLIQUEE_WINDOWS.intro[1];
  const FUNCTION_END = PIECE_EXPLIQUEE_WINDOWS.function[1];
  const WEAR_END = PIECE_EXPLIQUEE_WINDOWS.wearSigns[1];
  const WHEN_END = PIECE_EXPLIQUEE_WINDOWS.whenToChange[1];
  const t = { ...DEFAULT_PIECE_EXPLIQUEE_TITLES, ...titles };
  const windowWarning = windowWarnings?.[pieceExpliqueeWindowAt(frame)];

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

      <IntroSection
        frame={frame}
        fps={fps}
        endFrame={INTRO_END}
        piece={piece}
        label={t.intro}
        hook={hook}
      />

      <LabelSection
        frame={frame}
        startFrame={INTRO_END}
        endFrame={FUNCTION_END}
        label={t.function}
        body={pieceFunction}
        footnote={location}
        footLabel={t.location}
      />

      <WearSignsSection
        frame={frame}
        startFrame={FUNCTION_END}
        endFrame={WEAR_END}
        title={t.wearSigns}
        wearSigns={wearSigns}
      />

      <LabelSection
        frame={frame}
        startFrame={WEAR_END}
        endFrame={WHEN_END}
        label={t.whenToChange}
        body={whenToChange}
      />

      <CloserSection frame={frame} fps={fps} startFrame={WHEN_END} brandName={brandName} cta={cta} />

      {windowWarning && <WindowWarning text={windowWarning} />}

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

// ── Intro ──
const IntroSection: React.FC<{
  frame: number;
  fps: number;
  endFrame: number;
  piece: string;
  label: string;
  hook?: string;
}> = ({ frame, fps, endFrame, piece, label, hook }) => {
  if (frame >= endFrame) return null;
  const scale = spring({ frame, fps, config: { damping: 12, stiffness: 70 } });
  const subOpacity = interpolate(frame, [45, 75], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hookOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 60px' }}>
      <div
        style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: 30,
          letterSpacing: 4,
          textTransform: 'uppercase',
          marginBottom: 24,
          opacity: subOpacity,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: '#ffffff',
          fontSize: 80,
          fontWeight: 'bold',
          textAlign: 'center',
          lineHeight: 1.15,
          transform: `scale(${scale})`,
        }}
      >
        {piece}
      </div>
      {hook && (
        <div
          style={{
            marginTop: 40,
            color: '#F97316',
            fontSize: 46,
            fontWeight: 'bold',
            lineHeight: 1.3,
            textAlign: 'center',
            maxWidth: 900,
            opacity: hookOpacity,
          }}
        >
          {hook}
        </div>
      )}
    </AbsoluteFill>
  );
};

// ── Generic label + body section (Function, WhenChange) ──
const LabelSection: React.FC<{
  frame: number;
  startFrame: number;
  endFrame: number;
  label: string;
  body: string;
  footnote?: string;
  footLabel?: string;
}> = ({ frame, startFrame, endFrame, label, body, footnote, footLabel }) => {
  if (frame < startFrame || frame >= endFrame) return null;
  const local = frame - startFrame;
  const fadeIn = interpolate(local, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const slideY = interpolate(local, [0, 30], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const footOpacity = interpolate(local, [50, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{ justifyContent: 'center', alignItems: 'center', opacity: fadeIn, padding: '0 60px' }}
    >
      <div
        style={{
          color: '#F97316',
          fontSize: 30,
          fontWeight: 'bold',
          letterSpacing: 3,
          textTransform: 'uppercase',
          marginBottom: 32,
        }}
      >
        {label}
      </div>
      <div
        style={{
          transform: `translateY(${slideY}px)`,
          color: 'rgba(255,255,255,0.9)',
          fontSize: 46,
          lineHeight: 1.45,
          textAlign: 'center',
          maxWidth: 900,
        }}
      >
        {body}
      </div>
      {footnote && (
        <div
          style={{
            marginTop: 36,
            opacity: footOpacity,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            backgroundColor: '#0F4C81',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 24,
            padding: '12px 24px',
            borderRadius: 8,
          }}
        >
          {footLabel && <span style={{ color: '#F97316', fontWeight: 'bold' }}>{footLabel}:</span>}
          {footnote}
        </div>
      )}
    </AbsoluteFill>
  );
};

// ── Wear signs (list reveal) ──
const WearSignsSection: React.FC<{
  frame: number;
  startFrame: number;
  endFrame: number;
  title: string;
  wearSigns: WearSign[];
}> = ({ frame, startFrame, endFrame, title, wearSigns }) => {
  if (frame < startFrame || frame >= endFrame) return null;
  const local = frame - startFrame;
  const signs = wearSigns.slice(0, 3);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 50px' }}>
      <div
        style={{
          color: '#F97316',
          fontSize: 30,
          fontWeight: 'bold',
          letterSpacing: 3,
          textTransform: 'uppercase',
          marginBottom: 48,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', maxWidth: 860 }}>
        {signs.map((s, i) => {
          const cardStart = 20 + i * 50;
          const reveal = interpolate(local, [cardStart, cardStart + 18], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const slideX = interpolate(local, [cardStart, cardStart + 18], [-40, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const dot = SEVERITY_COLOR[s.severity ?? 'low'] ?? SEVERITY_COLOR.low;
          return (
            <div
              key={i}
              style={{
                opacity: reveal,
                transform: `translateX(${slideX}px)`,
                backgroundColor: '#0F4C81',
                borderRadius: 12,
                padding: '26px 30px',
                display: 'flex',
                alignItems: 'center',
                gap: 22,
              }}
            >
              <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: dot, flex: '0 0 auto' }} />
              <div style={{ color: '#ffffff', fontSize: 38, fontWeight: 500 }}>{s.sign}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

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

const WindowWarning: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: 'absolute',
      bottom: 150,
      left: 50,
      right: 50,
      textAlign: 'center',
      color: '#ffffff',
      fontSize: 28,
      fontWeight: 'bold',
      lineHeight: 1.35,
      backgroundColor: 'rgba(15,30,56,0.92)',
      border: '2px solid #F97316',
      borderRadius: 12,
      padding: '16px 24px',
    }}
  >
    {text}
  </div>
);

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

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Audio,
  Img,
} from 'remotion';
import type { CalculateMetadataFunction } from 'remotion';

/**
 * SequencesCourtes — Vertical short (1080x1920 @ 30fps), durée = fin de la dernière
 * séquence (`calculateMetadata`).
 *
 * Format Fafa "sequences-courtes" : une question, puis des séquences minutées
 * (étapes, critères comparés, rôles d'un schéma). Chaque séquence porte :
 *   - `title`   : titre de la séquence ;
 *   - `items`   : textes à l'écran, apparus l'un après l'autre et conservés ;
 *   - `imageUrl`: visuel de la séquence (pictogramme, photo, schéma) ;
 *   - `warning` : avertissement limité à la séquence (disclaimer `overlay_segment`).
 * Le bandeau `disclaimer` reste affiché toute la durée.
 *
 * Aucune valeur de démonstration : sans séquence, le rendu échoue.
 *
 * Palette: #0F1E38 bg, #F97316 accent, #0F4C81 panel, Liberation Sans.
 */

export interface SequenceCourte {
  startSec: number;
  endSec: number;
  title?: string;
  items?: string[];
  imageUrl?: string;
  warning?: string;
}

// Alias de type : `CalculateMetadataFunction` exige un `Record<string, unknown>`.
export type SequencesCourtesProps = {
  briefId?: string;
  videoType?: string;
  vertical?: string;
  sequences?: SequenceCourte[];
  disclaimer?: string;
  audioUrl?: string;
  brandName?: string;
};

export const SEQUENCES_COURTES_FPS = 30;

/** Séquences ordonnées, sans celles dont la fin ne suit pas le début. */
export function orderedSequences(sequences: SequenceCourte[] | undefined): SequenceCourte[] {
  return (sequences ?? [])
    .filter((s) => Number.isFinite(s.startSec) && Number.isFinite(s.endSec) && s.endSec > s.startSec)
    .sort((a, b) => a.startSec - b.startSec);
}

/** Durée en frames : fin de la dernière séquence (1 frame sans séquence). */
export function sequencesDurationInFrames(
  sequences: SequenceCourte[] | undefined,
  fps: number,
): number {
  const ends = orderedSequences(sequences).map((s) => s.endSec);
  return ends.length ? Math.round(Math.max(...ends) * fps) : 1;
}

/** Séquence affichée à une frame donnée, ou null entre deux séquences. */
export function sequenceAt(
  sequences: SequenceCourte[] | undefined,
  frame: number,
  fps: number,
): SequenceCourte | null {
  return (
    orderedSequences(sequences).find(
      (s) => frame >= Math.round(s.startSec * fps) && frame < Math.round(s.endSec * fps),
    ) ?? null
  );
}

export const calculateSequencesCourtesMetadata: CalculateMetadataFunction<
  SequencesCourtesProps
> = ({ props }) => ({
  durationInFrames: sequencesDurationInFrames(props.sequences, SEQUENCES_COURTES_FPS),
});

export const SequencesCourtes: React.FC<SequencesCourtesProps> = ({
  sequences,
  disclaimer,
  audioUrl,
  brandName = 'AutoMecanik',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  if (orderedSequences(sequences).length === 0) {
    throw new Error('SequencesCourtes : au moins une séquence (startSec < endSec) est requise');
  }

  const current = sequenceAt(sequences, frame, fps);
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

      <div
        style={{
          position: 'absolute',
          top: 70,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: '#F97316',
          fontSize: 30,
          fontWeight: 'bold',
          letterSpacing: 3,
        }}
      >
        {brandName}
      </div>

      {current && <SequenceView frame={frame} fps={fps} sequence={current} />}

      {current?.warning && <SequenceWarning text={current.warning} />}

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

const SequenceView: React.FC<{ frame: number; fps: number; sequence: SequenceCourte }> = ({
  frame,
  fps,
  sequence,
}) => {
  const start = Math.round(sequence.startSec * fps);
  const length = Math.round(sequence.endSec * fps) - start;
  const local = frame - start;
  const items = sequence.items ?? [];
  const step = items.length ? length / items.length : length;
  const titleOpacity = interpolate(local, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const imageScale = interpolate(local, [0, length], [1, 1.05], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{ justifyContent: 'center', alignItems: 'center', padding: '180px 60px 260px' }}
    >
      {sequence.imageUrl && (
        <Img
          src={sequence.imageUrl}
          style={{
            maxWidth: 900,
            maxHeight: 640,
            objectFit: 'contain',
            borderRadius: 16,
            marginBottom: 48,
            transform: `scale(${imageScale})`,
          }}
        />
      )}
      {sequence.title && (
        <div
          style={{
            color: '#F97316',
            fontSize: 34,
            fontWeight: 'bold',
            letterSpacing: 3,
            textTransform: 'uppercase',
            textAlign: 'center',
            marginBottom: 36,
            opacity: titleOpacity,
          }}
        >
          {sequence.title}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, alignItems: 'center' }}>
        {items.map((item, i) => {
          const appear = Math.round(i * step);
          if (local < appear) return null;
          const opacity = interpolate(local - appear, [0, 10], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={i}
              style={{
                color: '#ffffff',
                fontSize: items.length > 2 ? 44 : 58,
                fontWeight: 'bold',
                lineHeight: 1.25,
                textAlign: 'center',
                maxWidth: 940,
                backgroundColor: items.length > 1 ? '#0F4C81' : undefined,
                borderRadius: 14,
                padding: items.length > 1 ? '16px 28px' : 0,
                opacity,
              }}
            >
              {item}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const SequenceWarning: React.FC<{ text: string }> = ({ text }) => (
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

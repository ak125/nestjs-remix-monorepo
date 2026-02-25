import { registerRoot, Composition } from 'remotion';
import { TestCard } from './TestCard';
import { ShortProductHighlight } from './ShortProductHighlight';
import { ShortBrakingFact } from './ShortBrakingFact';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TestCard"
        component={TestCard}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          briefId: 'test',
          executionLogId: 0,
          videoType: 'short',
          vertical: 'test',
        }}
      />
      <Composition
        id="ShortProductHighlight"
        component={ShortProductHighlight}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          vertical: 'freinage',
          gammeAlias: 'disque-de-frein',
          claims: [
            {
              kind: 'dimension',
              value: '280',
              unit: 'mm',
              rawText: 'Diamètre 280mm',
            },
          ],
          brandName: 'AutoMecanik',
          tagline: 'Pièces auto de qualité',
        }}
      />
      <Composition
        id="ShortBrakingFact"
        component={ShortBrakingFact}
        durationInFrames={630}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          factText: 'Un disque ventilé dissipe la chaleur 40% plus vite',
          factValue: '40',
          factUnit: '%',
          sourceRef: 'Norme ECE R90',
          schemaSvgId: 'full' as const,
          brandName: 'AutoMecanik',
          tagline: 'Pièces auto de qualité',
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);

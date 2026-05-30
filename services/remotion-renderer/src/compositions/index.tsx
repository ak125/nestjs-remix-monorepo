import { registerRoot, Composition } from 'remotion';
import { TestCard } from './TestCard';
import { ShortProductHighlight } from './ShortProductHighlight';
import { ShortBrakingFact } from './ShortBrakingFact';
import { NeChangePasTropVite } from './NeChangePasTropVite';
import { SymptomeTroisCauses } from './SymptomeTroisCauses';
import { PieceExpliquee } from './PieceExpliquee';

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
      <Composition
        id="NeChangePasTropVite"
        component={NeChangePasTropVite}
        durationInFrames={1140}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          hook: 'Perte de puissance et fumée noire ? Ne change pas ta vanne EGR trop vite.',
          symptom: 'Perte de puissance',
          pieceWrong: 'vanne EGR',
          causes: [
            { cause: 'Filtre à air bouché', check_suggestion: 'Inspection visuelle' },
            { cause: 'Débitmètre fatigué', check_suggestion: 'Test multimètre' },
            { cause: 'Durite percée', check_suggestion: 'Visuel + écoute' },
          ],
          advice: 'Vérifie dans l’ordre : visuel → multimètre → atelier.',
          cta: 'Sur AutoMecanik, sélectionne ton véhicule pour voir les pièces compatibles.',
          disclaimer: 'Conseil informatif. Diagnostic à confirmer selon véhicule.',
          brandName: 'AutoMecanik',
        }}
      />
      <Composition
        id="SymptomeTroisCauses"
        component={SymptomeTroisCauses}
        durationInFrames={990}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          symptom: 'Perte de puissance',
          causes: [
            { cause: 'Filtre à air bouché', sign: 'Ralenti instable', check: 'Inspection visuelle' },
            { cause: 'Débitmètre encrassé', sign: 'À-coups à l’accélération', check: 'Lecture valeurs OBD' },
            { cause: 'Vanne EGR grippée', sign: 'Fumée + voyant moteur', check: 'Diagnostic atelier' },
          ],
          cta: 'Sur AutoMecanik, sélectionne ton véhicule pour voir les pièces compatibles.',
          disclaimer: 'Conseil informatif. Diagnostic à confirmer selon véhicule.',
          brandName: 'AutoMecanik',
        }}
      />
      <Composition
        id="PieceExpliquee"
        component={PieceExpliquee}
        durationInFrames={1200}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          piece: 'Vanne EGR',
          pieceFunction:
            'Elle recircule une partie des gaz d’échappement pour réduire les émissions.',
          location: 'Entre le collecteur d’échappement et l’admission',
          wearSigns: [
            { sign: 'Perte de puissance', severity: 'medium' as const },
            { sign: 'Fumée noire à l’accélération', severity: 'medium' as const },
            { sign: 'Voyant moteur allumé', severity: 'high' as const },
          ],
          whenToChange:
            'En général vers 120 000 km, ou dès que les symptômes persistent après nettoyage.',
          cta: 'Sur AutoMecanik, sélectionne ton véhicule pour vérifier la compatibilité.',
          disclaimer: 'Conseil informatif. Diagnostic à confirmer selon véhicule.',
          brandName: 'AutoMecanik',
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);

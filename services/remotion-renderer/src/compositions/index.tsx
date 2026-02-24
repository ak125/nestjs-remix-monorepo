import { registerRoot, Composition } from 'remotion';
import { TestCard } from './TestCard';

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
    </>
  );
};

registerRoot(RemotionRoot);

import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

/**
 * TestCard — Minimal test composition for render validation.
 *
 * Displays: briefId, videoType, vertical, executionLogId, frame counter.
 * 5 seconds @ 30fps = 150 frames.
 * Background: #1a1a2e, accent: #e94560.
 */
export const TestCard: React.FC<{
  briefId?: string;
  executionLogId?: number;
  videoType?: string;
  vertical?: string;
}> = ({ briefId = 'test', executionLogId = 0, videoType = 'short', vertical = 'test' }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  // Fade-in during first second
  const opacity = interpolate(frame, [0, fps], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const seconds = (frame / fps).toFixed(1);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'Liberation Sans, Arial, sans-serif',
        opacity,
      }}
    >
      {/* Title */}
      <div
        style={{
          color: '#e94560',
          fontSize: 72,
          fontWeight: 'bold',
          marginBottom: 20,
          letterSpacing: 4,
        }}
      >
        AutoMecanik
      </div>

      {/* Subtitle */}
      <div
        style={{
          color: '#ffffff',
          fontSize: 32,
          marginBottom: 60,
          opacity: 0.8,
        }}
      >
        Render Test Card v1.0.0
      </div>

      {/* Info grid */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          backgroundColor: 'rgba(255,255,255,0.05)',
          padding: '30px 60px',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <InfoRow label="briefId" value={briefId} />
        <InfoRow label="videoType" value={videoType} />
        <InfoRow label="vertical" value={vertical} />
        <InfoRow label="executionLogId" value={String(executionLogId)} />
        <InfoRow label="resolution" value={`${width}x${height}`} />
        <InfoRow label="fps" value={String(fps)} />
        <InfoRow label="frame" value={`${frame} / ${durationInFrames}`} />
        <InfoRow label="time" value={`${seconds}s`} />
      </div>

      {/* Bottom watermark */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          color: 'rgba(255,255,255,0.3)',
          fontSize: 18,
        }}
      >
        P6 Render Engine — {new Date().toISOString().split('T')[0]}
      </div>
    </AbsoluteFill>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', gap: 20, fontSize: 24 }}>
    <span style={{ color: '#e94560', fontWeight: 'bold', minWidth: 220, textAlign: 'right' }}>
      {label}:
    </span>
    <span style={{ color: '#ffffff' }}>{value}</span>
  </div>
);

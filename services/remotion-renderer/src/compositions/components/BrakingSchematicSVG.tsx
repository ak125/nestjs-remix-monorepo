import { interpolate } from 'remotion';

/**
 * Animated SVG schematic of a braking system circuit.
 * Shows the flow: pedal → master cylinder → brake lines → caliper → pads → disc.
 *
 * The `focusArea` prop highlights a specific section of the circuit.
 * The `progress` prop (0-1) controls the animation stroke-dashoffset.
 */

interface BrakingSchematicSVGProps {
  focusArea?: 'full' | 'caliper' | 'disc' | 'fluid';
  progress: number; // 0-1 animation progress
  width?: number;
  height?: number;
}

const COLORS = {
  bg: '#16213e',
  stroke: '#e94560',
  strokeDim: 'rgba(233, 69, 96, 0.3)',
  fill: 'rgba(233, 69, 96, 0.15)',
  text: 'rgba(255, 255, 255, 0.7)',
  highlight: '#e94560',
  line: 'rgba(255, 255, 255, 0.4)',
};

export const BrakingSchematicSVG: React.FC<BrakingSchematicSVGProps> = ({
  focusArea = 'full',
  progress,
  width = 900,
  height = 700,
}) => {
  // Animated stroke progress
  const pathLength = 1200;
  const dashOffset = interpolate(progress, [0, 1], [pathLength, 0]);

  // Focus opacity for each section
  const pedalOpacity = focusArea === 'full' || focusArea === 'fluid' ? 1 : 0.3;
  const lineOpacity = focusArea === 'full' || focusArea === 'fluid' ? 1 : 0.3;
  const caliperOpacity = focusArea === 'full' || focusArea === 'caliper' ? 1 : 0.3;
  const discOpacity = focusArea === 'full' || focusArea === 'disc' ? 1 : 0.3;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={{ overflow: 'visible' }}
    >
      {/* Background rounded rect */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={24}
        fill={COLORS.bg}
        opacity={0.6}
      />

      {/* ── Pedal (left side) ── */}
      <g opacity={pedalOpacity}>
        {/* Pedal body */}
        <rect x={60} y={280} width={80} height={140} rx={12} fill={COLORS.fill} stroke={COLORS.stroke} strokeWidth={3} />
        {/* Pedal pad */}
        <rect x={70} y={300} width={60} height={40} rx={6} fill={COLORS.stroke} opacity={0.6} />
        {/* Push rod */}
        <line x1={140} y1={350} x2={200} y2={350} stroke={COLORS.stroke} strokeWidth={4} strokeLinecap="round" />
        <text x={100} y={455} fill={COLORS.text} fontSize={18} textAnchor="middle" fontFamily="Liberation Sans, Arial">
          Pedale
        </text>
      </g>

      {/* ── Master cylinder ── */}
      <g opacity={pedalOpacity}>
        <rect x={200} y={310} width={120} height={80} rx={10} fill={COLORS.fill} stroke={COLORS.stroke} strokeWidth={3} />
        <circle cx={260} cy={350} r={20} fill={COLORS.stroke} opacity={0.3} />
        <text x={260} y={425} fill={COLORS.text} fontSize={16} textAnchor="middle" fontFamily="Liberation Sans, Arial">
          Maitre-cylindre
        </text>
      </g>

      {/* ── Brake fluid lines (animated flow) ── */}
      <g opacity={lineOpacity}>
        {/* Main line from master cylinder to T-junction */}
        <path
          d="M 320 350 L 450 350"
          fill="none"
          stroke={COLORS.strokeDim}
          strokeWidth={4}
          strokeLinecap="round"
        />
        {/* Animated flow overlay */}
        <path
          d="M 320 350 L 450 350"
          fill="none"
          stroke={COLORS.stroke}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={pathLength}
          strokeDashoffset={dashOffset}
        />

        {/* T-junction to top caliper */}
        <path
          d="M 450 350 L 450 200 L 580 200"
          fill="none"
          stroke={COLORS.strokeDim}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 450 350 L 450 200 L 580 200"
          fill="none"
          stroke={COLORS.stroke}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength}
          strokeDashoffset={dashOffset}
        />

        {/* T-junction to bottom caliper */}
        <path
          d="M 450 350 L 450 500 L 580 500"
          fill="none"
          stroke={COLORS.strokeDim}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 450 350 L 450 500 L 580 500"
          fill="none"
          stroke={COLORS.stroke}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength}
          strokeDashoffset={dashOffset}
        />

        <text x={385} y={335} fill={COLORS.text} fontSize={14} textAnchor="middle" fontFamily="Liberation Sans, Arial">
          Liquide de frein
        </text>
      </g>

      {/* ── Top caliper + disc ── */}
      <g opacity={caliperOpacity}>
        {/* Caliper body */}
        <rect x={580} y={160} width={80} height={80} rx={8} fill={COLORS.fill} stroke={COLORS.stroke} strokeWidth={3} />
        {/* Pads (inner) */}
        <rect x={660} y={175} width={12} height={50} rx={3} fill={COLORS.stroke} opacity={0.7} />
        <rect x={672} y={175} width={12} height={50} rx={3} fill={COLORS.stroke} opacity={0.7} />
        <text x={620} y={268} fill={COLORS.text} fontSize={16} textAnchor="middle" fontFamily="Liberation Sans, Arial">
          Etrier + Plaquettes
        </text>
      </g>

      <g opacity={discOpacity}>
        {/* Disc (rotor) */}
        <circle cx={740} cy={200} r={55} fill="none" stroke={COLORS.stroke} strokeWidth={3} />
        <circle cx={740} cy={200} r={35} fill="none" stroke={COLORS.strokeDim} strokeWidth={2} />
        {/* Ventilation slots */}
        {[0, 60, 120, 180, 240, 300].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const x1 = 740 + 38 * Math.cos(rad);
          const y1 = 200 + 38 * Math.sin(rad);
          const x2 = 740 + 52 * Math.cos(rad);
          const y2 = 200 + 52 * Math.sin(rad);
          return (
            <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLORS.strokeDim} strokeWidth={2} />
          );
        })}
        <circle cx={740} cy={200} r={12} fill={COLORS.stroke} opacity={0.3} />
        <text x={740} y={280} fill={COLORS.text} fontSize={16} textAnchor="middle" fontFamily="Liberation Sans, Arial">
          Disque
        </text>
      </g>

      {/* ── Bottom caliper + disc ── */}
      <g opacity={caliperOpacity}>
        <rect x={580} y={460} width={80} height={80} rx={8} fill={COLORS.fill} stroke={COLORS.stroke} strokeWidth={3} />
        <rect x={660} y={475} width={12} height={50} rx={3} fill={COLORS.stroke} opacity={0.7} />
        <rect x={672} y={475} width={12} height={50} rx={3} fill={COLORS.stroke} opacity={0.7} />
        <text x={620} y={568} fill={COLORS.text} fontSize={16} textAnchor="middle" fontFamily="Liberation Sans, Arial">
          Etrier + Plaquettes
        </text>
      </g>

      <g opacity={discOpacity}>
        <circle cx={740} cy={500} r={55} fill="none" stroke={COLORS.stroke} strokeWidth={3} />
        <circle cx={740} cy={500} r={35} fill="none" stroke={COLORS.strokeDim} strokeWidth={2} />
        {[0, 60, 120, 180, 240, 300].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const x1 = 740 + 38 * Math.cos(rad);
          const y1 = 500 + 38 * Math.sin(rad);
          const x2 = 740 + 52 * Math.cos(rad);
          const y2 = 500 + 52 * Math.sin(rad);
          return (
            <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLORS.strokeDim} strokeWidth={2} />
          );
        })}
        <circle cx={740} cy={500} r={12} fill={COLORS.stroke} opacity={0.3} />
        <text x={740} y={580} fill={COLORS.text} fontSize={16} textAnchor="middle" fontFamily="Liberation Sans, Arial">
          Disque
        </text>
      </g>

      {/* ── Title label ── */}
      <text x={width / 2} y={40} fill={COLORS.text} fontSize={22} textAnchor="middle" fontFamily="Liberation Sans, Arial" fontWeight="bold">
        Circuit de freinage hydraulique
      </text>

      {/* ── Flow direction arrows ── */}
      <g opacity={lineOpacity}>
        <polygon points="370,342 385,350 370,358" fill={COLORS.stroke} />
        <polygon points="530,192 545,200 530,208" fill={COLORS.stroke} />
        <polygon points="530,492 545,500 530,508" fill={COLORS.stroke} />
      </g>
    </svg>
  );
};

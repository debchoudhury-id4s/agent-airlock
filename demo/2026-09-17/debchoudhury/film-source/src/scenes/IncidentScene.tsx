import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, Camera, Courier, Dust, ease, lerp, Office, Packet, SvgStage, Tunnel, wave} from '../visuals';

export const IncidentScene: React.FC = () => {
  const t = useCurrentFrame() / 30;
  const crossing = ease(t, 3, 4);
  if (t > 11.2) {
    return (
      <>
        <SvgStage>
          <Camera x={810} y={439} zoom={1.55 + (t - 11.2) * 0.018}>
            <Office t={t + 28} mood="alarm" clock="17:59" />
            <rect width="1920" height="1080" fill={C.red} opacity={0.06 + wave(t, 1.5, 0.025)} />
            <Dust t={t} warm />
          </Camera>
        </SvgStage>
        <div style={{position: 'absolute', top: 168, right: 135, color: C.paper, fontSize: 54, fontWeight: 650, maxWidth: 645, lineHeight: 1.2}}>
          A local update.<br /><span style={{color: C.coral}}>An outside consequence.</span>
        </div>
      </>
    );
  }
  return (
    <SvgStage>
      <Camera x={940 + t * 7} y={533} zoom={1.04 + t * 0.002} roll={-0.8}>
        <Tunnel t={t} speed={1.9} danger={t > 6.4} />
        <path d="M1185 180V873" stroke={C.warm} strokeWidth="3" strokeDasharray="15 16" opacity="0.55" />
        <text x="1040" y="208" textAnchor="end" fill={C.muted} fontSize="25" letterSpacing="2" fontFamily="Segoe UI, sans-serif">LOCAL WORKSPACE</text>
        <text x="1530" y="198" textAnchor="middle" fill={C.paper} fontSize="30" letterSpacing="2" fontFamily="Segoe UI, sans-serif">SHARED REPOSITORY</text>
        <g transform="translate(1510 455)">
          <circle r="231" fill="#173647" stroke="#6a9fa5" strokeWidth="8" />
          <circle r="190" fill="#0b1f2e" stroke={t > 6.5 ? C.red : C.cyan} strokeWidth="3" strokeDasharray="22 14" transform={`rotate(${t * 9})`} />
          <path d="M-80-58L0-102L80-58V54L0 102L-80 54Z M0-8V101 M-80-58L0-8L80-58" fill="#294a5b" stroke="#9dc3c5" strokeWidth="4" />
          <path d="M0-125V-145M0 125V145M125 0H145M-125 0H-145" stroke={C.teal} strokeWidth="8" strokeLinecap="round" />
        </g>
        <Courier t={t * 1.4} x={lerp(245, 1100, crossing)} y={680 - crossing * 70} scale={1.1} carrying={t < 5.1} lean={12 * (1 - crossing)} />
        {t >= 5.1 && <Packet t={t} x={lerp(1110, 1520, ease(t, 5.1, 1.65))} y={lerp(621, 465, ease(t, 5.1, 1.65))} scale={1.2} rotate={-20 + t * 2} sensitive label="UPDATE" />}
        {t > 6.65 && Array.from({length: 6}, (_, i) => {
          const fly = ease(t, 6.6 + i * 0.18, 2);
          const angle = -1.3 + i * 0.52;
          return <Packet key={i} t={t} x={1510 + Math.cos(angle) * fly * 650} y={460 + Math.sin(angle) * fly * 350}
            scale={0.43 + fly * 0.19} rotate={i * 17 - 40 + fly * 15} sensitive label="" />;
        })}
        {t > 7.3 && (
          <g opacity={ease(t, 7.3, 0.3)}>
            <rect x="220" y="309" width="660" height="166" rx="14" fill="#502b37" stroke={C.coral} strokeWidth="3" />
            <text x="262" y="374" fill={C.paper} fontFamily="Segoe UI, sans-serif" fontSize="40" fontWeight="700">INTERNAL-ONLY</text>
            <text x="262" y="429" fill="#efb9aa" fontFamily="Segoe UI, sans-serif" fontSize="31">was not meant to travel.</text>
          </g>
        )}
      </Camera>
    </SvgStage>
  );
};

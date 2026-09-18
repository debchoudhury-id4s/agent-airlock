import React from 'react';
import {useCurrentFrame} from 'remotion';
import {AirlockDoor, C, Camera, Courier, ease, lerp, Packet, SvgStage, Tunnel, wave} from '../visuals';

export const RewindScene: React.FC = () => {
  const t = useCurrentFrame() / 30;
  const assembly = ease(t, 2.2, 2.2);
  return (
    <>
      <SvgStage>
        <Camera x={960 + wave(t, 0.13, 9)} y={535} zoom={1.02}>
          <Tunnel t={44 - t * 2} speed={1.2} />
          {t < 3.6 && Array.from({length: 5}, (_, i) => {
            const back = ease(t, i * 0.15, 2.9);
            return <Packet key={i} t={t} x={lerp(1700 + i * 115, 550, back)} y={lerp(230 + i * 105, 697, back)}
              scale={lerp(0.55, 0.7, back)} rotate={i * 22 * (1 - back)} sensitive label="" />;
          })}
          <Courier t={t} x={570} y={693} scale={1.05} carrying={t > 3.1} />
          <AirlockDoor t={t} x={1290} y={490 + (1 - assembly) * 850} scale={1.02} />
          {Array.from({length: 8}, (_, i) => (
            <path key={i} d={`M${1200 - i * 133} ${130 + i * 91}L${1600 - i * 128} ${130 + i * 91}`}
              stroke={C.cyan} strokeWidth="2" opacity={(1 - ease(t, 0.4, 2.2)) * 0.4} />
          ))}
          <g opacity={ease(t, 4.2, 1)}>
            <path d="M755 332H980V477H755Z" fill="#2e4e5c" stroke="#709493" strokeWidth="3" />
            <path d="M781 369H952 M781 393H931 M781 417H915 M781 441H942" stroke="#9cc4bb" strokeWidth="5" />
            <path d="M980 405H1056" stroke={C.teal} strokeWidth="5" strokeDasharray="10 8" strokeDashoffset={-t * 30} />
            <circle cx="746" cy="440" r="34" fill={C.paper} />
            <path d="M730 438V424Q746 403 761 424V438 M727 438H765V462H727Z" fill="none" stroke="#41585b" strokeWidth="6" strokeLinejoin="round" />
            <text x="868" y="305" textAnchor="middle" fill={C.teal} fontFamily="Segoe UI, sans-serif" fontWeight="700" fontSize="28">ORG-SUPPLIED POLICY</text>
            <text x="863" y="518" textAnchor="middle" fill={C.muted} fontFamily="Consolas, monospace" fontSize="23">outside the prompt</text>
          </g>
        </Camera>
      </SvgStage>
      <div style={{position: 'absolute', left: 115, top: 157, opacity: ease(t, 0.3, 0.7) * (1 - ease(t, 5.5, 0.5)), color: C.paper, fontSize: 68, lineHeight: 1.11, fontWeight: 700}}>
        A prompt<br />is not a policy.
      </div>
      <div style={{position: 'absolute', left: 126, top: 172, opacity: ease(t, 5.9, 0.6), maxWidth: 525}}>
        <div style={{fontSize: 60, fontWeight: 700, color: C.paper, lineHeight: 1.1}}>Rules belong<br />to the organization.</div>
        <div style={{fontSize: 29, lineHeight: 1.5, color: C.muted, marginTop: 23}}>Not the model.<br />Not the individual chat.</div>
      </div>
    </>
  );
};

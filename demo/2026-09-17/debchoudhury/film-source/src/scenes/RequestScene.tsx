import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, Camera, Courier, Dust, ease, Office, Packet, SvgStage, Typed, wave} from '../visuals';
import {Terminal} from '../components/Terminal';
import evidence from '../evidence.json';

export const RequestScene: React.FC = () => {
  const t = useCurrentFrame() / 30;
  const packet = ease(t, 6.5, 2.5);
  return (
    <>
      <SvgStage>
        <Camera x={1120 - t * 2} y={496} zoom={1.13}>
          <Office t={t + 14} showCourier={false} />
          <Dust t={t + 14} />
        </Camera>
        <Courier t={t} x={1450 + packet * 130} y={673 - packet * 40} scale={1.3} carrying={t > 8.7} lean={packet * 5} />
        {t < 8.8 && <Packet t={t} x={1190 + packet * 390} y={581 + packet * 72} scale={0.4 + packet * 0.53} rotate={12 - packet * 18} sensitive label="UPDATE" />}
        {t > 9.4 && (
          <g transform={`translate(${1400 + wave(t, 0.3, 6)} 425)`}>
            <path d="M0 0H320L350 48L320 95H0Z" fill="#183e4e" stroke="#68979c" strokeWidth="3" />
            <text x="159" y="42" textAnchor="middle" fontFamily="Segoe UI, sans-serif" fill={C.paper} fontSize="27">SHARED REPOSITORY</text>
            <text x="159" y="77" textAnchor="middle" fontFamily="Consolas, monospace" fill={C.warm} fontSize="24">git push ...</text>
          </g>
        )}
      </SvgStage>
      <Terminal style={{left: 140, top: 171, width: 1115, minHeight: 445, rotate: '-0.5deg'}}
        title="Illustrated agent conversation">
        <div style={{fontSize: 24, color: C.muted, marginBottom: 26}}>Maya / local workspace</div>
        <div style={{fontSize: 37, lineHeight: 1.45, color: C.paper, minHeight: 178}}>
          <span style={{color: C.teal}}>&gt; </span>
          <Typed text={evidence.localIntent.input.prompt} t={t} start={0.6} speed={20} />
          {Math.floor(t * 2) % 2 === 0 && t < 4.5 && <span style={{color: C.teal}}>_</span>}
        </div>
        {t > 4.5 && <div style={{display: 'flex', alignItems: 'center', gap: 16, marginTop: 16}}>
          {[0, 1, 2].map((i) => <span key={i} style={{width: 9, height: 9, background: C.teal, borderRadius: '50%', opacity: 0.3 + Math.max(0, wave(t + i * 0.15, 0.65, 0.7))}} />)}
          <span style={{fontSize: 25, color: C.muted}}>an agent turns intent into action</span>
        </div>}
      </Terminal>
    </>
  );
};

import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, Camera, Courier, Dust, ease, lerp, Office, SvgStage, wave} from '../visuals';

export const ShiftScene: React.FC = () => {
  const t = useCurrentFrame() / 30;
  const pull = ease(t, 0.9, 3.2);
  const title = ease(t, 6.6, 0.9);
  return (
    <>
      <SvgStage>
        <Camera x={lerp(1620, 980, pull)} y={lerp(264, 516, pull)} zoom={lerp(2.7, 1.055, pull)}>
          <Office t={t} showCourier={false} />
          <text x="1718" y="282" textAnchor="middle" fill={C.muted} fontFamily="Segoe UI, sans-serif" fontSize="21" letterSpacing="2">NEXT SHIFT 18:00</text>
          <g opacity={ease(t, 3.5, 0.8) * (1 - ease(t, 8.7, 0.6))}>
            <rect x="1300" y="421" width="386" height="112" rx="14" fill="#f2dbb8" />
            <path d="M1345 530L1320 565L1318 525Z" fill="#f2dbb8" />
            <text x="1328" y="460" fill="#725a45" fontSize="22" fontWeight="700" fontFamily="Segoe UI, sans-serif">SHIFT TEAM</text>
            <text x="1328" y="501" fill="#223b43" fontSize="30" fontWeight="600" fontFamily="Segoe UI, sans-serif">Ready when you are.</text>
          </g>
          <Courier t={t} x={1630 - ease(t, 9, 3) * 148} y={651 - ease(t, 9, 3) * 113} scale={0.68} />
          <Dust t={t} warm />
        </Camera>
      </SvgStage>
      <div style={{position: 'absolute', left: 133, top: 125, opacity: title, translate: `0 ${16 * (1 - title)}px`}}>
        <div style={{fontSize: 23, color: C.warm, letterSpacing: 3.3}}>LANTERN WORKSHOP</div>
        <div style={{fontSize: 76, lineHeight: 1.02, fontWeight: 750, color: C.paper, marginTop: 17}}>Before it<br />leaves.</div>
      </div>
      <div style={{position: 'absolute', right: 123, top: 310, opacity: ease(t, 4.7, 0.6) * (1 - ease(t, 9.9, 0.7)), fontSize: 25, color: C.paper, rotate: `${wave(t, 0.8, 1)}deg`}}>
        Two minutes.
      </div>
    </>
  );
};

import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, Camera, Courier, Dust, ease, Office, Packet, SvgStage} from '../visuals';

export const ReturnScene: React.FC = () => {
  const t = useCurrentFrame() / 30;
  return (
    <>
      <SvgStage>
        <Camera x={1040 - t * 6} y={530} zoom={1.06 - t * 0.0015}>
          <Office t={107 + t} mood="relief" clock="17:59" dawn={0.45} showCourier={false}
            screen={<g>
              <text x="917" y="366" fontFamily="Segoe UI, sans-serif" fill={C.teal} fontSize="25" fontWeight="700">LOCAL DRAFT READY</text>
              <text x="917" y="411" fontFamily="Segoe UI, sans-serif" fill={C.paper} fontSize="21">Ready for review.</text>
              <path d="M918 446H1290 M918 471H1212 M918 496H1246" stroke="#5a858d" strokeWidth="6" />
              <circle cx="1306" cy="481" r="27" fill={C.teal} />
              <path d="M1294 481L1303 491L1320 471" stroke="#1c4b4c" strokeWidth="5" fill="none" />
            </g>} />
          <Courier t={t} x={1585 - ease(t, 0.5, 4) * 285} y={697 - ease(t, 0.5, 4) * 85} scale={0.72} mood="happy" carrying={t < 4.7} />
          {t > 4.7 && <Packet t={t} x={1240 - ease(t, 4.7, 1.7) * 17} y={597} rotate={-6} scale={0.62} label="LOCAL" approved />}
          <Dust t={t} warm />
        </Camera>
      </SvgStage>
      <div style={{position: 'absolute', left: 120, top: 151, color: C.paper, maxWidth: 1070}}>
        <div style={{fontSize: 22, letterSpacing: 3, color: C.teal, opacity: ease(t, 0.4, 0.5)}}>KEEP THE WORK MOVING. KEEP THE RULES OUTSIDE IT.</div>
        <div style={{fontSize: 76, fontWeight: 750, lineHeight: 1.05, marginTop: 19, opacity: ease(t, 3.8, 0.8)}}>
          The org sets the rules.
        </div>
      </div>
      <div style={{position: 'absolute', left: 968, top: 707, color: C.paper, opacity: ease(t, 7.4, 0.8)}}>
        <div style={{fontSize: 61, fontWeight: 750, letterSpacing: 3}}>AGENT AIRLOCK</div>
        <div style={{fontSize: 31, color: C.teal, marginTop: 8}}>Binding on supported routes.</div>
      </div>
      <div style={{position: 'absolute', left: 130, top: 864, color: '#b5c8ca', fontSize: 22}}>
        Local prototype. Org identity is not verified. Not a sandbox for arbitrary processes.
      </div>
    </>
  );
};

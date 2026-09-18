import React from 'react';
import {useCurrentFrame} from 'remotion';
import {AirlockDoor, C, Camera, Courier, Dust, ease, Office, Packet, SvgStage, Typed} from '../visuals';
import {Field, Terminal} from '../components/Terminal';
import evidence from '../evidence.json';

export const LocalScene: React.FC = () => {
  const t = useCurrentFrame() / 30;
  const move = ease(t, 5.6, 3.5);
  return (
    <>
      <SvgStage>
        <Camera x={1130} y={535} zoom={1.04}>
          <Office t={53 + t} mood="focus" showCourier={false} />
          <Dust t={t} />
        </Camera>
        <rect width="1920" height="1080" fill="#041724" opacity="0.34" />
        <AirlockDoor t={t} x={1525} y={433} scale={0.6} open={ease(t, 3.6, 1.2)} mode={t > 3.6 ? 'allow' : 'idle'} />
        <g transform="translate(1492 783)">
          <path d="M-155-66H176L215 4H-188Z" fill="#607d7d" stroke="#b2c4b6" strokeWidth="3" />
          <path d="M-188 4H215V48H-188Z" fill="#34565b" stroke="#a0b4ac" strokeWidth="3" />
          <text x="14" y="35" textAnchor="middle" fill={C.paper} fontFamily="Segoe UI, sans-serif" fontSize="22" letterSpacing="2">LOCAL REVIEW OUTBOX</text>
        </g>
        <Courier t={t} x={1300 + move * 367} y={635 + move * 7} scale={0.91} mood={move > 0.8 ? 'happy' : 'ready'} carrying={t < 8.3 && t > 4.6} />
        {t > 8.3 && <Packet t={t} x={1508} y={647 + ease(t, 8.3, 1) * 101} scale={1.05} rotate={-5} approved label="LOCAL DRAFT" />}
      </SvgStage>
      <Terminal style={{left: 100, top: 151, width: 1115, minHeight: 647}}>
        <div style={{fontSize: 23, color: C.muted}}>PS ...\debchoudhury&gt;</div>
        <div style={{fontSize: 30, color: C.paper, marginTop: 5}}>
          <Typed t={t} start={0.4} speed={29} text={'node .\\film-evidence\\replay.mjs'} />
        </div>
        <div style={{opacity: ease(t, 2, 0.35), marginTop: 25, fontSize: 25, color: '#a9c5cd', lineHeight: 1.45}}>
          prompt: "{evidence.localIntent.input.prompt}"
        </div>
        {t > 3.4 && <div style={{marginTop: 23}}>
          <Field name="decision" value={evidence.localIntent.output.decision} color={C.teal} size={35} />
          <Field name="reason" value={evidence.localIntent.output.reason} size={28} />
        </div>}
        {t > 5.6 && <div style={{borderTop: '1px solid #3d5c67', marginTop: 24, paddingTop: 20, opacity: ease(t, 5.6, 0.4)}}>
          <div style={{color: C.muted, fontSize: 24, marginBottom: 6}}>createPublishDraft(...) / local file</div>
          <Field name="decision" value={evidence.localWork.output.decision} color={C.teal} size={35} />
          <Field name="reason" value={evidence.localWork.output.reason} size={28} />
          <Field name="execution" value={evidence.localWork.output.execution} color={C.teal} size={28} />
        </div>}
      </Terminal>
      <div style={{position: 'absolute', top: 861, left: 121, color: C.paper, fontSize: 29, opacity: ease(t, 9.1, 0.3)}}>
        Copied to the local review outbox. Nothing was sent online.
      </div>
    </>
  );
};

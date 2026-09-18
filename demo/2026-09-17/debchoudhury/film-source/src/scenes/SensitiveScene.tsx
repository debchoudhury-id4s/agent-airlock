import React from 'react';
import {useCurrentFrame} from 'remotion';
import {AirlockDoor, C, Camera, Courier, ease, SvgStage, Tunnel, wave} from '../visuals';
import {Field, SourceWindow} from '../components/Terminal';
import evidence from '../evidence.json';

export const SensitiveScene: React.FC = () => {
  const t = useCurrentFrame() / 30;
  const check = evidence.sensitiveCheck;
  const decisionLine = evidence.sensitiveCode.excerpt.split('\n').find((line) => line.includes('decision:'))?.trim();
  const paperY = 284 + wave(t, 0.19, 6);
  return (
    <>
      <SvgStage>
        <Camera x={960 + wave(t, 0.14, 4)} zoom={1.005}>
          <Tunnel t={80 + t} speed={0.4} />
          <AirlockDoor t={t} x={1530} y={463} scale={0.8} label="SENSITIVE INFORMATION" mode={t > 9.4 ? 'deny' : 'scan'} />
          <Courier t={t} x={1260 - ease(t, 9.4, 0.6) * 20} y={716} scale={0.9} carrying mood={t > 9.4 ? 'alarm' : 'ready'} />
          <g transform={`translate(123 ${paperY}) rotate(-0.7)`}>
            <path d="M0 0H552L597 45V270H0Z" fill="url(#paper)" stroke="#c7ac87" strokeWidth="3" />
            <path d="M552 0V45H597" fill="#c4a985" />
            <rect x="27" y="28" width="386" height="54" rx="5" fill={C.red} />
            <text x="48" y="66" fill="white" fontFamily="Consolas, monospace" fontSize="34" fontWeight="700">INTERNAL-ONLY</text>
            <text x="29" y="135" fill="#5b5144" fontFamily="Consolas, monospace" fontSize="23">Synthetic maintenance note for the</text>
            <text x="29" y="170" fill="#5b5144" fontFamily="Consolas, monospace" fontSize="23">imaginary Lantern workshop.</text>
            <path d="M29 212H489 M29 239H380" stroke="#bbab91" strokeWidth="4" />
            <rect x="0" y={10 + ((t * 67) % 249)} width="595" height="4" fill={C.teal} opacity={t < 5.7 ? 0.8 : 0} />
          </g>
          <path d="M725 407H776" stroke={C.warm} strokeWidth="3" strokeDasharray="5 5" strokeDashoffset={-t * 14} />
        </Camera>
      </SvgStage>
      <div style={{position: 'absolute', left: 98, top: 137}}>
        <div style={{color: C.cyan, fontSize: 24, letterSpacing: 2}}>ORG POLICY / GATE 2</div>
        <div style={{color: C.paper, fontSize: 54, fontWeight: 700, marginTop: 9}}>sensitive-information</div>
      </div>
      <div style={{position: 'absolute', left: 130, top: 571, color: C.muted, fontSize: 21, letterSpacing: 1.5}}>SYNTHETIC PAYLOAD / NO REAL INCIDENT DATA</div>
      <div style={{position: 'absolute', left: 783, top: 307, opacity: ease(t, 4.2, 0.4)}}>
        <div style={{color: C.muted, fontSize: 22, marginBottom: 8}}>LABEL CHECK</div>
        <Field name="decision" value={check.decision} color={C.warm} size={37} />
        <div style={{fontFamily: 'Consolas, monospace', fontSize: 26, lineHeight: 1.5, color: C.muted, marginTop: 10}}>reason:<br /><span style={{color: C.paper}}>"{check.reason}"</span></div>
        <div style={{fontFamily: 'Consolas, monospace', fontSize: 24, color: C.muted, marginTop: 10}}>ruleId: "{check.findings[0].ruleId}"</div>
      </div>
      <SourceWindow path={'gates\\sensitive-information\\index.mjs:10-17'}
        symbol="reviewGate().evaluate()"
        style={{top: 640, opacity: ease(t, 5.4, 0.5)}}>
        <div>{decisionLine}</div>
        <div style={{fontSize: 25, color: C.muted, marginTop: 8}}>internal-label.mjs:4 / detectInternalLabel()</div>
      </SourceWindow>
      <div style={{position: 'absolute', left: 1260, top: 808, opacity: ease(t, 9.4, 0.25)}}>
        <Field name="status" value={evidence.sensitive.output.status} color={C.red} size={33} />
        <Field name="execution" value={evidence.sensitive.output.execution} size={25} />
      </div>
      <div style={{position: 'absolute', left: 120, top: 842, color: C.muted, fontSize: 23}}>
        {t > 9.4 ? 'Approval flow not implemented. No action was executed.' : 'Pattern checks do not prove that all content is safe.'}
      </div>
    </>
  );
};

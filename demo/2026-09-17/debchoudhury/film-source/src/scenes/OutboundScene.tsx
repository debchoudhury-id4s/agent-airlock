import React from 'react';
import {useCurrentFrame} from 'remotion';
import {AirlockDoor, C, Camera, Courier, ease, Packet, SvgStage, Tunnel, Typed, wave} from '../visuals';
import {Field, SourceWindow} from '../components/Terminal';
import evidence from '../evidence.json';

export const OutboundScene: React.FC = () => {
  const t = useCurrentFrame() / 30;
  const stopped = t >= 4.4;
  const advance = ease(t, 0.5, 3.9);
  const recoil = stopped ? Math.sin(Math.min(1, (t - 4.4) / 0.6) * Math.PI) * 34 : 0;
  const verdict = evidence.outbound.checkIntent.output;
  const decisionLine = evidence.noOnlineCode.excerpt.split('\n').find((line) => line.includes('decision:'))?.trim();
  return (
    <>
      <SvgStage>
        <Camera x={960 + wave(t, 0.17, 4)} y={540} zoom={1.005}>
          <Tunnel t={t + 66} speed={stopped ? 0.4 : 1.15} danger={stopped} />
          <AirlockDoor t={t} x={1518} y={470} scale={0.8} mode={stopped ? 'deny' : 'scan'} label="NO ONLINE WRITES" />
          <Courier t={t} x={555 + advance * 674 - recoil} y={688 - advance * 53} scale={0.95}
            mood={stopped ? 'alarm' : 'ready'} lean={stopped ? -recoil * 0.17 : 10} />
          <Packet t={t} x={620 + advance * 598 - recoil} y={748 - advance * 53} scale={0.67} rotate={stopped ? -8 : 12} label="PUSH" />
          {stopped && <g opacity={0.25 + Math.max(0, wave(t, 1.1, 0.25))}>
            <path d="M1301 490L1263 466 M1305 516L1256 516 M1301 544L1267 566" stroke={C.red} strokeWidth="5" strokeLinecap="round" />
          </g>}
        </Camera>
      </SvgStage>
      <div style={{position: 'absolute', left: 99, top: 137}}>
        <div style={{color: C.cyan, fontSize: 24, letterSpacing: 2}}>ORG POLICY / GATE 1</div>
        <div style={{color: C.paper, fontSize: 54, fontWeight: 700, marginTop: 9}}>no-online-writes</div>
      </div>
      <div style={{position: 'absolute', left: 102, top: 274, width: 1100, padding: '22px 28px', background: '#0b2331ed', border: '1px solid #52727e', borderRadius: 10}}>
        <div style={{fontSize: 21, color: C.muted, marginBottom: 9}}>PROPOSED COMMAND / EVALUATED ONLY</div>
        <div style={{fontFamily: 'Consolas, monospace', color: C.paper, fontSize: 31}}>
          <Typed t={t} start={0.2} speed={22} text={evidence.outbound.input.toolArgs.command} />
        </div>
      </div>
      <div style={{position: 'absolute', left: 121, top: 422, opacity: ease(t, 4.4, 0.18), translate: `0 ${18 * (1 - ease(t, 4.4, 0.3))}px`}}>
        <Field name="decision" value={verdict.decision} color={C.red} size={54} />
        <Field name="reason" value={verdict.reason} color={C.paper} size={31} />
        <Field name="execution" value={verdict.execution} size={30} />
      </div>
      <SourceWindow path={'gates\\no-online-writes\\index.mjs:30-46'}
        symbol="createNoOnlineWritesGate().evaluate()"
        style={{top: 642, opacity: ease(t, 5.7, 0.5)}}>
        <div>{decisionLine}</div>
        <div style={{fontSize: 25, color: C.muted, marginTop: 8}}>
          rules.json / git-push / <span style={{color: C.warm}}>{'\\bgit\\s+push\\b'}</span>
        </div>
      </SourceWindow>
      <div style={{position: 'absolute', top: 837, left: 120, opacity: ease(t, 10, 0.4)}}>
        <Field name="permissionDecision" value={evidence.outbound.output.permissionDecision} color={C.red} size={29} />
      </div>
      <div style={{position: 'absolute', top: 849, right: 110, fontSize: 21, color: C.muted, textAlign: 'right'}}>
        Recognized routes and patterns.<br />Not all outbound behavior.
      </div>
    </>
  );
};

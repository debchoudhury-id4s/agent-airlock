import React from 'react';
import {useCurrentFrame} from 'remotion';
import {AirlockDoor, C, Courier, Dust, ease, SvgStage, Tunnel, wave} from '../visuals';
import evidence from '../evidence.json';

export const ReceiptScene: React.FC = () => {
  const t = useCurrentFrame() / 30;
  const print = ease(t, 0.2, 1.5);
  const record = evidence.pushReceipt.records[0];
  const lines = [
    '{',
    `  "policy": "${record.policy}",`,
    `  "policyVersion": "${record.policyVersion}",`,
    `  "timestamp": "${record.timestamp}",`,
    `  "event": "${record.event}",`,
    `  "decision": "${record.decision}",`,
    `  "reason": "${record.reason}",`,
    `  "findings": [{"ruleId": "${record.findings[0].ruleId}", "line": ${record.findings[0].line}}]`,
    '}',
  ];
  return (
    <>
      <SvgStage>
        <Tunnel t={94 + t} speed={0.3} />
        <AirlockDoor t={t} x={1660} y={470} scale={0.64} mode="idle" />
        <g transform="translate(265 673)">
          <path d="M-120-171H88L144-85V46H-148V-103Z" fill="url(#steel)" stroke="#7c969c" strokeWidth="5" />
          <rect x="-108" y="-144" width="170" height="45" rx="5" fill="#122d3c" />
          <text x="-25" y="-114" textAnchor="middle" fill={C.teal} fontSize="20" fontFamily="Consolas, monospace">runtime</text>
          <path d="M-113-64H111" stroke="#041521" strokeWidth="17" />
          <path d="M-90 16H80" stroke="#97b0b0" strokeWidth="6" strokeLinecap="round" />
          {Array.from({length: 6}, (_, i) => <circle key={i} cx={-85 + i * 30} cy="-22" r="4" fill={i === Math.floor(t * 8) % 6 ? C.teal : '#304f5a'} />)}
        </g>
        <Courier t={t} x={289 + wave(t, 0.1, 20)} y={810} scale={0.75} mood="happy" />
        <Dust t={t} />
      </SvgStage>
      <div style={{
        position: 'absolute', left: 476, top: 148 + (1 - print) * 370, width: 1190, height: 687,
        background: '#f2e5cd', borderRadius: 5, boxShadow: '15px 24px 60px #0007',
        padding: '34px 41px', color: C.ink, rotate: `${-1.2 + print * 1.6 + wave(t, 0.16, 0.1)}deg`,
      }}>
        <div style={{fontSize: 22, fontWeight: 800, letterSpacing: 2.1, color: '#487066'}}>ACTUAL LOCAL RECEIPT / SELECTED FIELDS</div>
        <div style={{fontSize: 25, fontFamily: 'Consolas, monospace', marginTop: 17, paddingBottom: 19, borderBottom: '2px solid #c7b697'}}>
          receipts\{evidence.pushReceipt.file}
        </div>
        <div style={{marginTop: 20, fontSize: 29, fontFamily: 'Consolas, monospace', lineHeight: 1.62}}>
          {lines.map((line, i) => <div key={i} style={{
            opacity: ease(t, 1.15 + i * 0.12, 0.2), whiteSpace: 'pre',
            background: line.includes('"decision"') || line.includes('"reason"') ? '#b33f4020' : 'transparent',
            color: line.includes('"decision"') || line.includes('"reason"') ? '#923d3d' : '#223d47',
          }}>{line}</div>)}
        </div>
        <div style={{marginTop: 15, color: '#637667', fontSize: 22, fontFamily: 'Consolas, monospace'}}>
          runtime\broker.mjs / original JSONL retained beside the film
        </div>
      </div>
      <div style={{position: 'absolute', left: 503, top: 869, color: C.muted, fontSize: 24, opacity: ease(t, 8.9, 0.4)}}>
        Local evidence. Not a tamper-proof attestation.
      </div>
    </>
  );
};

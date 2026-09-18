import React from 'react';
import {C} from '../visuals';

export const Terminal: React.FC<{
  children: React.ReactNode;
  title?: string;
  style?: React.CSSProperties;
}> = ({children, title = 'Agency / Copilot-style terminal', style}) => (
  <div style={{
    position: 'absolute', left: 104, top: 148, width: 1170, minHeight: 560,
    background: 'rgba(7,24,35,0.97)', color: C.white,
    border: '2px solid #456675', borderRadius: 18, overflow: 'hidden',
    boxShadow: '0 25px 65px #0007', ...style,
  }}>
    <div style={{height: 62, background: '#203c4b', display: 'flex', alignItems: 'center', gap: 10, padding: '0 24px'}}>
      {[C.coral, C.warm, C.teal].map((color) => <div key={color} style={{width: 12, height: 12, borderRadius: '50%', background: color, opacity: 0.8}} />)}
      <div style={{marginLeft: 16, fontSize: 23, letterSpacing: 1.1, color: '#c6d7db'}}>{title}</div>
    </div>
    <div style={{padding: '28px 33px 32px', fontFamily: 'Consolas, monospace', fontSize: 30, lineHeight: 1.5}}>
      {children}
    </div>
  </div>
);

export const Field: React.FC<{name: string; value: string; color?: string; size?: number}> = ({name, value, color = C.white, size = 32}) => (
  <div style={{fontFamily: 'Consolas, monospace', fontSize: size, lineHeight: 1.45, color: '#a8c1cc'}}>
    {name}: <span style={{color}}>"{value}"</span>
  </div>
);

export const SourceWindow: React.FC<{
  path: string;
  symbol: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({path, symbol, children, style}) => (
  <div style={{
    position: 'absolute', left: 95, top: 606, width: 1020,
    padding: '15px 22px 16px', border: '1px solid #64808b',
    borderLeft: `5px solid ${C.cyan}`, borderRadius: 10,
    background: 'rgba(7,25,36,0.94)', boxShadow: '0 12px 35px #0003', ...style,
  }}>
    <div style={{fontSize: 22, lineHeight: 1.15, color: C.muted, fontFamily: 'Consolas, monospace', marginBottom: 6}}>{path}</div>
    <div style={{fontSize: 29, lineHeight: 1.2, fontFamily: 'Consolas, monospace', color: C.cyan, marginBottom: 6}}>{symbol}</div>
    <div style={{fontSize: 28, lineHeight: 1.3, fontFamily: 'Consolas, monospace', color: C.paper}}>{children}</div>
  </div>
);

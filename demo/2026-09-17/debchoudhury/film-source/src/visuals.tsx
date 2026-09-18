import React from 'react';
import {Easing} from 'remotion';

export const C = {
  ink: '#102432',
  night: '#091a29',
  navy: '#163848',
  steel: '#315564',
  teal: '#63e0c0',
  cyan: '#9beaf1',
  paper: '#fff2d8',
  warm: '#ffbc76',
  coral: '#ff765f',
  red: '#fa5766',
  muted: '#91adb8',
  white: '#f4f8f6',
};

export const clamp = (n: number, low = 0, high = 1) => Math.min(high, Math.max(low, n));
export const ease = (time: number, start: number, duration: number) =>
  Easing.bezier(0.22, 1, 0.36, 1)(clamp((time - start) / duration));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const wave = (t: number, speed = 1, amplitude = 1) =>
  Math.sin(t * speed * Math.PI * 2) * amplitude;

export const Definitions: React.FC = () => (
  <defs>
    <linearGradient id="night" x2="0.3" y2="1">
      <stop stopColor="#10273a" />
      <stop offset="1" stopColor="#07131e" />
    </linearGradient>
    <linearGradient id="glass" x2="1" y2="1">
      <stop stopColor="#9beaf1" stopOpacity="0.12" />
      <stop offset="1" stopColor="#386178" stopOpacity="0.05" />
    </linearGradient>
    <linearGradient id="steel" x2="1" y2="1">
      <stop stopColor="#527786" />
      <stop offset="0.55" stopColor="#254857" />
      <stop offset="1" stopColor="#122c3b" />
    </linearGradient>
    <linearGradient id="paper" x2="0.4" y2="1">
      <stop stopColor="#fff6e4" />
      <stop offset="1" stopColor="#e8cb9f" />
    </linearGradient>
    <linearGradient id="jacket" x2="1" y2="0.8">
      <stop stopColor="#fbb577" />
      <stop offset="0.6" stopColor="#e17b53" />
      <stop offset="1" stopColor="#b55047" />
    </linearGradient>
    <linearGradient id="floor" x2="0" y2="1">
      <stop stopColor="#173645" />
      <stop offset="1" stopColor="#08141d" />
    </linearGradient>
    <radialGradient id="lamp">
      <stop stopColor="#ffbf7b" stopOpacity="0.23" />
      <stop offset="1" stopColor="#ffbf7b" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="tealGlow">
      <stop stopColor="#63e0c0" stopOpacity="0.28" />
      <stop offset="1" stopColor="#63e0c0" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="redGlow">
      <stop stopColor="#fa5766" stopOpacity="0.32" />
      <stop offset="1" stopColor="#fa5766" stopOpacity="0" />
    </radialGradient>
    <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#000" floodOpacity="0.25" />
    </filter>
    <filter id="smallGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="5" />
    </filter>
  </defs>
);

export const SvgStage: React.FC<{children: React.ReactNode}> = ({children}) => (
  <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0}}>
    <Definitions />
    {children}
  </svg>
);

export const Camera: React.FC<{
  children: React.ReactNode;
  x?: number;
  y?: number;
  zoom?: number;
  roll?: number;
}> = ({children, x = 960, y = 540, zoom = 1, roll = 0}) => (
  <g transform={`translate(960 540) rotate(${roll}) scale(${zoom}) translate(${-x} ${-y})`}>
    {children}
  </g>
);

export const RainWindow: React.FC<{t: number; dawn?: number}> = ({t, dawn = 0}) => (
  <g>
    <rect x="0" y="0" width="1920" height="805" fill="url(#night)" />
    <rect width="1920" height="805" fill="#8b806f" opacity={dawn * 0.34} />
    <circle cx={1490 - t * 1.4} cy={205 + t * 0.4} r="77" fill="#c8dee0" opacity="0.46" />
    <g opacity="0.75">
      {Array.from({length: 18}, (_, i) => {
        const height = 100 + ((i * 71) % 230);
        const x = i * 126 - 100;
        return (
          <g key={i}>
            <rect x={x} y={760 - height} width="93" height={height} fill={i % 2 ? '#0b2638' : '#1c3648'} />
            {Array.from({length: 12}, (__, j) => (
              <rect
                key={j}
                x={x + 16 + (j % 3) * 23}
                y={782 - height + Math.floor(j / 3) * 42}
                width="8"
                height="14"
                fill={j % 4 ? '#799b9d' : C.warm}
                opacity={0.18 + (((i + j) * 7) % 8) * 0.06}
              />
            ))}
          </g>
        );
      })}
    </g>
    {Array.from({length: 55}, (_, i) => {
      const x = ((i * 137 + t * 52) % 2200) - 140;
      const y = (i * 83 + t * (210 + (i % 5) * 35)) % 810;
      return <path key={i} d={`M${x},${y} l-10,27`} stroke="#b6dae4" opacity={0.06 + (i % 4) * 0.025} strokeWidth={i % 3 ? 1.3 : 2} />;
    })}
    <path d="M100 50H1810V814H100Z M640 50V814 M1270 50V814 M100 415H1810" stroke="#071720" strokeWidth="28" fill="none" />
    <path d="M126 66H628 M660 66H1258 M1290 66H1790" stroke="#4b6570" strokeWidth="3" opacity="0.5" />
    <path d="M158 165L505 505 M180 130L590 542" stroke="#e1f4f5" strokeWidth="2" opacity="0.04" />
  </g>
);

export const Maya: React.FC<{
  t: number;
  x?: number;
  y?: number;
  scale?: number;
  mood?: 'focus' | 'alarm' | 'relief';
  typing?: boolean;
  reach?: number;
}> = ({t, x = 605, y = 492, scale = 1, mood = 'focus', typing = true, reach = 0}) => {
  const breathing = wave(t, 0.34, 2.2);
  const blink = (t % 4.6) > 4.4 ? 0.12 : 1;
  const surprised = mood === 'alarm';
  const headTilt = surprised ? -7 : mood === 'relief' ? 3 : 8;
  const leftHand = typing ? wave(t, 4.6, 4) : 0;
  const rightHand = typing ? wave(t + 0.1, 5.1, 5) : 0;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="15" cy="334" rx="129" ry="28" fill="#02080e" opacity="0.4" />
      <path d="M-55 128Q-87 240-65 323L-15 323L4 206L43 322H94L67 157Z" fill="#1c394b" stroke="#102b3b" strokeWidth="8" />
      <path d="M-67 312Q-18 300-3 326L-4 340H-96Q-104 326-67 312 M44 317Q84 306 110 331L110 343H37Z" fill="#e6cba7" />
      <path d="M-68 65Q-152 86-126 228" fill="none" stroke="#112a39" strokeWidth="34" />
      <path d="M-118 238H11 M-68 241V319 M-98 330H-16" fill="none" stroke="#426271" strokeWidth="15" strokeLinecap="round" />
      <g transform={`translate(0 ${breathing})`}>
        <path d="M-63-18Q-106 23-88 140Q-20 173 61 139L76 33Q49-10 16-20Z" fill="url(#jacket)" stroke="#1a2c37" strokeWidth="5" />
        <path d="M-27-7L-12 139 M-55 72L-20 79 M16 96L52 86" fill="none" stroke="#ffcc91" strokeWidth="3" opacity="0.55" />
        <path d="M-33-40V-6Q-5 20 22-10L21-51Z" fill="#b77558" />
        <path d={`M-65 22Q-46 106 31 105L${175 + reach * 35} ${113 + leftHand - reach * 90}`}
          fill="none" stroke="#c76249" strokeWidth="37" strokeLinecap="round" />
        <path d={`M32 20Q89 111 115 112L${218 + reach * 25} ${111 + rightHand - reach * 120}`}
          fill="none" stroke="#efa675" strokeWidth="34" strokeLinecap="round" />
        <path d={`M${175 + reach * 35} ${113 + leftHand - reach * 90} l29 2`}
          stroke="#d39473" strokeWidth="21" strokeLinecap="round" />
        <path d={`M${218 + reach * 25} ${111 + rightHand - reach * 120} l29 2`}
          stroke="#dfa784" strokeWidth="20" strokeLinecap="round" />
        <g transform={`rotate(${headTilt + wave(t, 0.25, 1.1)} 0 -92)`}>
          <ellipse cx="-15" cy="-101" rx="64" ry="70" fill="#14242b" />
          <circle cx="-56" cy="-149" r="32" fill="#14242b" />
          <circle cx="-71" cy="-125" r="26" fill="#14242b" />
          <path d="M-56-86Q-67-161 9-161Q75-143 47-64L26-33Q-22-25-49-59Z" fill="#dca079" stroke="#172a32" strokeWidth="4" />
          <path d="M-58-75Q-65-106-36-142Q-10-122 51-128Q42-169-2-174Q-74-179-66-105Z" fill="#17282e" />
          <path d="M-43-148Q-11-167 23-144" stroke="#425054" strokeWidth="4" fill="none" />
          <ellipse cx="-48" cy="-83" rx="13" ry="18" fill="#d09371" />
          <path d="M-8-77Q0-91 7-78 M34-73Q44-88 49-73" stroke="#563c35" strokeWidth="3" fill="none" opacity="0.35" />
          <g stroke="#d9b975" strokeWidth="4" fill="#142937" fillOpacity="0.12">
            <ellipse cx="-5" cy="-94" rx="23" ry="21" />
            <ellipse cx="43" cy="-90" rx="20" ry="20" />
            <path d="M17-96L23-95 M-28-95L-45-98" fill="none" />
          </g>
          <ellipse cx={surprised ? 2 : 3} cy="-93" rx={surprised ? 5 : 3.2} ry={(surprised ? 9 : 6) * blink} fill="#15232a" />
          <ellipse cx="47" cy="-90" rx={surprised ? 5 : 3.2} ry={(surprised ? 9 : 6) * blink} fill="#15232a" />
          <path d={surprised ? 'M-16-128L6-131 M34-127L54-121' : mood === 'relief' ? 'M-17-118Q-5-126 7-118 M33-115Q45-122 54-111' : 'M-17-120L8-115 M34-112L55-111'} stroke="#50352e" strokeWidth="5" strokeLinecap="round" fill="none" />
          <path d="M22-94L27-69L17-66" fill="none" stroke="#b77656" strokeWidth="3" />
          {surprised ? <ellipse cx="17" cy="-50" rx="9" ry="10" fill="#8e4e43" /> :
            <path d={mood === 'relief' ? 'M1-54Q16-37 30-53' : 'M4-48Q16-51 26-49'} fill="none" stroke="#874c42" strokeWidth="4" strokeLinecap="round" />}
          <circle cx="-42" cy="-62" r="5" fill={C.warm} />
        </g>
      </g>
    </g>
  );
};

export const Courier: React.FC<{
  t: number;
  x: number;
  y: number;
  scale?: number;
  facing?: number;
  mood?: 'ready' | 'alarm' | 'happy';
  carrying?: boolean;
  lean?: number;
}> = ({t, x, y, scale = 1, facing = 1, mood = 'ready', carrying = false, lean = 0}) => (
  <g transform={`translate(${x} ${y + wave(t, 0.85, 7)}) scale(${scale * facing} ${scale}) rotate(${lean})`}>
    <ellipse cx="0" cy="109" rx="68" ry="13" fill="#020d14" opacity="0.36" />
    <path d="M-18 72L-30 101 M18 72L30 101" stroke="#b1c3bd" strokeWidth="12" strokeLinecap="round" />
    <path d="M-42 98L-20 99 M20 99L42 98" stroke="#45646b" strokeWidth="12" strokeLinecap="round" />
    <path d="M-66-8Q-101 14-87 48 M66-8Q94 3 88 40" fill="none" stroke="#809d9c" strokeWidth="13" strokeLinecap="round" />
    <rect x="-69" y="-65" width="138" height="139" rx="31" fill="url(#paper)" stroke="#55727a" strokeWidth="4" />
    <path d="M-47-60H47 M-60 50Q0 72 60 50" stroke="#fff9e9" strokeWidth="5" opacity="0.68" fill="none" />
    <path d="M0-67V-87L13-98" stroke="#93b6b5" strokeWidth="6" strokeLinecap="round" />
    <circle cx="16" cy="-101" r="9" fill={mood === 'alarm' ? C.red : C.teal} />
    <rect x="-53" y="-42" width="106" height="66" rx="18" fill="#153342" />
    {mood === 'happy' ? (
      <path d="M-36-5Q-27-22-17-5 M17-5Q27-22 37-5" stroke={C.teal} strokeWidth="7" fill="none" strokeLinecap="round" />
    ) : (
      <>
        <rect x="-34" y={mood === 'alarm' ? -27 : -23} width="13" height={mood === 'alarm' ? 30 : 22} rx="6" fill={mood === 'alarm' ? C.red : C.cyan} />
        <rect x="21" y={mood === 'alarm' ? -27 : -23} width="13" height={mood === 'alarm' ? 30 : 22} rx="6" fill={mood === 'alarm' ? C.red : C.cyan} />
      </>
    )}
    <path d="M-8 10H8" stroke={C.cyan} strokeWidth="3" strokeLinecap="round" />
    <circle cx="-35" cy="45" r="5" fill="#c28b5b" />
    <path d="M-18 44H30" stroke="#c8b490" strokeWidth="4" strokeLinecap="round" />
    {carrying && <Packet t={t} x={3} y={63} scale={0.67} label="" />}
  </g>
);

export const Packet: React.FC<{
  t: number;
  x: number;
  y: number;
  scale?: number;
  rotate?: number;
  label?: string;
  sensitive?: boolean;
  approved?: boolean;
}> = ({t, x, y, scale = 1, rotate = 0, label = 'DRAFT', sensitive = false, approved = false}) => (
  <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
    <rect x="-76" y="-49" width="152" height="103" rx="10" fill="url(#paper)" stroke="#ac9577" strokeWidth="3" />
    <path d="M-73-43L0 12L73-43 M-73 49L-26 0 M73 49L26 0" stroke="#c6ac8b" strokeWidth="3" fill="none" />
    {label && <text x="0" y="37" textAnchor="middle" fill="#775642" fontFamily="Segoe UI, sans-serif" fontWeight="800" fontSize="17" letterSpacing="2">{label}</text>}
    {sensitive && (
      <g transform={`rotate(-9) translate(0 ${wave(t, 1, 1)})`}>
        <rect x="-60" y="-26" width="120" height="33" rx="3" fill={C.red} />
        <text y="-3" textAnchor="middle" fontFamily="Consolas, monospace" fontSize="13" fontWeight="700" fill="white">INTERNAL-ONLY</text>
      </g>
    )}
    {approved && <g transform="translate(63 -37)"><circle r="20" fill={C.teal} /><path d="M-10 0L-2 8L11-8" stroke="#153a3c" strokeWidth="5" strokeLinecap="round" fill="none" /></g>}
  </g>
);

export const Office: React.FC<{
  t: number;
  mood?: 'focus' | 'alarm' | 'relief';
  clock?: string;
  screen?: React.ReactNode;
  dawn?: number;
  showCourier?: boolean;
}> = ({t, mood = 'focus', clock = '17:58', screen, dawn = 0, showCourier = true}) => (
  <g>
    <RainWindow t={t} dawn={dawn} />
    <path d="M0 803H1920V1080H0Z" fill="url(#floor)" />
    <path d="M0 850H1920 M0 934H1920 M0 1052H1920 M960 800L410 1080 M960 800L1530 1080" stroke="#365365" strokeWidth="2" opacity="0.33" />
    <rect x="1640" y="148" width="206" height="105" rx="10" fill="#112936" stroke="#54717c" strokeWidth="3" />
    <text x="1743" y="216" textAnchor="middle" fill={mood === 'alarm' ? C.red : C.warm} fontFamily="Consolas, monospace" fontSize="51">{clock}</text>
    <path d="M1755 0V117" stroke="#0a141c" strokeWidth="8" />
    <ellipse cx="1748" cy="288" rx="254" ry="224" fill="url(#lamp)" />
    <path d="M1745 118Q1689 110 1680 152H1811Q1801 110 1745 118Z" fill="#bb9674" />
    <path d="M1684 153H1806" stroke="#ffe0a3" strokeWidth="7" />
    <g transform="translate(242 731)">
      <path d="M-47-68Q-156-184-52-207Q-6-180-27-68 M-23-97Q-58-250 27-245Q60-202-8-74 M0-75Q54-209 105-159Q106-116 17-49" fill="#345952" stroke="#427366" strokeWidth="4" />
      <path d="M-40-118L-17-26 M24-191L-17-25 M82-141L-12-25" stroke="#76a384" strokeWidth="3" fill="none" />
      <path d="M-58-34H44L28 65H-40Z" fill="#8d6762" />
      <rect x="-61" y="-43" width="108" height="23" rx="5" fill="#b48b77" />
    </g>
    <Maya t={t} mood={mood} />
    <path d="M468 616H1483L1518 650H443Z" fill="#b59074" stroke="#4d4743" strokeWidth="3" />
    <path d="M443 650H1518V674H443Z" fill="#645650" />
    <path d="M475 673L457 931H490L529 673 M1430 673L1479 928H1512L1481 673" fill="#203c4a" stroke="#547079" strokeWidth="3" />
    <ellipse cx="1024" cy="576" rx="505" ry="316" fill="url(#tealGlow)" opacity="0.29" />
    <path d="M1064 570V620H1208L1168 603V570Z" fill="#2a4653" stroke="#66818b" strokeWidth="3" />
    <rect x="873" y="292" width="520" height="285" rx="18" fill="#071720" stroke="#637c86" strokeWidth="7" />
    <rect x="892" y="312" width="482" height="238" rx="5" fill="#102a39" />
    {screen ?? (
      <g opacity="0.75">
        {Array.from({length: 8}, (_, i) => <rect key={i} x="917" y={337 + i * 24} width={105 + ((i * 37 + Math.floor(t) * 7) % 300)} height="7" rx="3" fill={i === 6 ? C.teal : '#557783'} />)}
      </g>
    )}
    <circle cx="1132" cy="564" r="4" fill={C.teal} />
    <path d="M798 601H1056L1083 625H778Z" fill="#2c414b" stroke="#78898c" strokeWidth="2" />
    {Array.from({length: 22}, (_, i) => <path key={i} d={`M${800 + (i % 11) * 23} ${608 + Math.floor(i / 11) * 9}h15`} stroke={i % 6 === Math.floor(t * 5) % 6 ? '#cb9f79' : '#789197'} strokeWidth="3" />)}
    <g transform="translate(1393 589)">
      <path d="M-26-23H25L19 33H-18Z" fill="#d6aa80" />
      <path d="M25-11Q58-15 48 10Q42 18 22 14" fill="none" stroke="#c49977" strokeWidth="8" />
      <path d={`M-9-36Q${12 + wave(t, 0.5, 10)}-58-2-79 M12-38Q${-8 + wave(t, 0.4, 8)}-68 14-92`} fill="none" stroke="#c7d2d0" strokeWidth="3" opacity="0.24" />
    </g>
    <g transform={`translate(1294 ${592 + (mood === 'alarm' ? wave(t, 8, 2) : 0)}) rotate(-7)`}>
      <rect x="-24" y="-31" width="52" height="82" rx="8" fill="#172c38" stroke="#a09a87" strokeWidth="3" />
      <rect x="-18" y="-21" width="40" height="60" rx="4" fill={mood === 'alarm' ? '#5e303a' : '#204f59'} />
      <path d="M-6-5Q-16 10 9 21L16 13L8 6L2 10L-3 5L2 0Z" fill={C.paper} opacity="0.8" />
    </g>
    {showCourier && <Courier t={t} x={1630 + wave(t, 0.12, 12)} y={649} scale={0.68} mood={mood === 'alarm' ? 'alarm' : mood === 'relief' ? 'happy' : 'ready'} />}
    <path d="M0 1038H1920V1080H0Z" fill="#020910" opacity="0.3" />
  </g>
);

export const Tunnel: React.FC<{t: number; speed?: number; danger?: boolean}> = ({t, speed = 1, danger = false}) => (
  <g>
    <rect width="1920" height="1080" fill="url(#night)" />
    <ellipse cx="1400" cy="435" rx="550" ry="560" fill={danger ? 'url(#redGlow)' : 'url(#tealGlow)'} />
    <path d="M0 0L1330 312H1920 M0 960L1310 644H1920 M0 254L1330 390H1920" stroke="#345466" strokeWidth="5" fill="none" />
    <path d="M0 791L1310 584H1920L1920 1080H0Z" fill="url(#floor)" />
    {Array.from({length: 10}, (_, i) => {
      const p = ((i / 10 + t * 0.045 * speed) % 1);
      const x = lerp(1340, -680, p * p);
      const upper = lerp(350, -180, p * p);
      const lower = lerp(620, 1290, p * p);
      return (
        <g key={i} opacity={0.16 + p * 0.36}>
          <path d={`M${x} ${upper}L${x} ${lower}`} stroke="#34576b" strokeWidth={3 + p * 15} />
          <path d={`M${x + 12} ${upper + 40}V${upper + 125 + p * 45}`} stroke={danger ? C.red : C.cyan} strokeWidth={3 + p * 5} opacity="0.6" />
          <path d={`M${x} ${lower - 110}L1920 ${590 + p * 460}`} stroke="#46636e" strokeWidth="2" />
        </g>
      );
    })}
    <path d="M0 852L1920 644M0 985L1920 711" stroke="#669195" strokeWidth="8" />
    <path d="M0 870L1920 659M0 1000L1920 726" stroke="#163b45" strokeWidth="11" />
    {Array.from({length: 24}, (_, i) => {
      const x = (i * 124 - t * 200 * speed + 200000) % 2300 - 250;
      return <path key={i} d={`M${x} ${879 - x * 0.108}l80 89`} stroke="#416a74" strokeWidth="6" opacity="0.65" />;
    })}
    {Array.from({length: 20}, (_, i) => {
      const x = ((i * 307 - t * 81 * speed) % 2300 + 2300) % 2300 - 190;
      return <circle key={i} cx={x} cy={160 + ((i * 71) % 600)} r={i % 4 === 0 ? 2.5 : 1.4} fill={C.paper} opacity="0.2" />;
    })}
  </g>
);

export const AirlockDoor: React.FC<{
  t: number;
  x?: number;
  y?: number;
  scale?: number;
  open?: number;
  mode?: 'idle' | 'allow' | 'deny' | 'scan';
  label?: string;
}> = ({t, x = 1250, y = 490, scale = 1, open = 0, mode = 'idle', label = 'AGENT AIRLOCK'}) => {
  const color = mode === 'deny' ? C.red : mode === 'allow' ? C.teal : C.cyan;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="30" rx="330" ry="340" fill={mode === 'deny' ? 'url(#redGlow)' : 'url(#tealGlow)'} />
      <path d="M-215-313H179L237-258V311H-253V-262Z" fill="url(#steel)" stroke="#728b90" strokeWidth="6" />
      <path d="M-182-254H149L181-218V242H-198V-217Z" fill="#051b28" stroke="#0d303d" strokeWidth="13" />
      <g>
        <path d={`M${-181 - open * 174}-241H${-12 - open * 174}V233H${-184 - open * 174}Z`} fill="#284956" stroke="#5f7983" strokeWidth="3" />
        <path d={`M${12 + open * 174}-241H${148 + open * 174}L${173 + open * 174}-213V233H${12 + open * 174}Z`} fill="#345664" stroke="#6e8b93" strokeWidth="3" />
        <path d={`M${-17 - open * 174}-205V194 M${17 + open * 174}-205V194`} stroke={color} strokeWidth="7" opacity="0.9" />
        {!open && <path d="M-70 0L-19-34H22L71 0L22 34H-19Z" fill="#193b48" stroke={color} strokeWidth="4" />}
        {mode === 'scan' && <rect x="-181" y={-231 + ((t * 130) % 445)} width="354" height="8" fill={C.teal} opacity="0.7" />}
      </g>
      <path d="M-215-313H179L206-286H-234Z M-253 262H237V311H-253Z" fill="#274956" />
      <rect x="-198" y="-306" width="368" height="42" rx="4" fill="#102d3a" />
      <text x="-14" y="-278" textAnchor="middle" fill={C.paper} fontSize={label.length > 19 ? 17 : 22} letterSpacing="3" fontFamily="Segoe UI, sans-serif" fontWeight="800">{label}</text>
      <path d="M-225-234V231 M210-234V231" stroke={color} strokeWidth="5" opacity={0.62 + wave(t, 0.7, 0.18)} />
      {Array.from({length: 8}, (_, i) => <rect key={i} x={-212 + i * 57} y="280" width="27" height="10" rx="2" fill={i % 2 ? '#102a35' : '#dbb179'} />)}
      {mode === 'deny' && <path d="M-35-16L4 23M4-16L-35 23" stroke={C.red} strokeWidth="10" strokeLinecap="round" />}
      {mode === 'allow' && <path d="M-39-3L-13 20L24-25" stroke={C.teal} strokeWidth="11" strokeLinecap="round" fill="none" />}
    </g>
  );
};

export const Dust: React.FC<{t: number; warm?: boolean}> = ({t, warm = false}) => (
  <g opacity="0.26">
    {Array.from({length: 20}, (_, i) => (
      <circle key={i} cx={(i * 107 + t * (4 + i % 4)) % 1920} cy={(i * 183 - t * 7 + 10800) % 1080}
        r={i % 5 === 0 ? 2.4 : 1.3} fill={warm ? C.warm : C.cyan} />
    ))}
  </g>
);

export const Typed: React.FC<{text: string; t: number; start?: number; speed?: number}> = ({text, t, start = 0, speed = 35}) => (
  <>{text.slice(0, Math.max(0, Math.floor((t - start) * speed)))}</>
);

export const Tag: React.FC<{children: React.ReactNode; color?: string; style?: React.CSSProperties}> = ({children, color = C.muted, style}) => (
  <div style={{color, fontSize: 22, fontWeight: 700, letterSpacing: 2.2, textTransform: 'uppercase', ...style}}>{children}</div>
);

export const Lens: React.FC<{t: number}> = ({t}) => (
  <>
    <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 42%, transparent 45%, rgba(0,8,15,0.4) 100%)', pointerEvents: 'none'}} />
    <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 36, background: '#06121b'}} />
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 36, background: '#06121b'}} />
    <div style={{position: 'absolute', top: 51, right: 67, color: '#9bb5c0', fontFamily: 'Consolas, monospace', fontSize: 17, opacity: 0.68}}>
      {String(Math.floor(t / 60)).padStart(2, '0')}:{String(Math.floor(t % 60)).padStart(2, '0')}
    </div>
  </>
);

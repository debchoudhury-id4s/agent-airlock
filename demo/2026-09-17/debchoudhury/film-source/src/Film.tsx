import React from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {TransitionSeries} from '@remotion/transitions';
import {Lens} from './visuals';
import {Captions} from './components/Captions';
import {ShiftScene} from './scenes/ShiftScene';
import {RequestScene} from './scenes/RequestScene';
import {IncidentScene} from './scenes/IncidentScene';
import {RewindScene} from './scenes/RewindScene';
import {LocalScene} from './scenes/LocalScene';
import {OutboundScene} from './scenes/OutboundScene';
import {SensitiveScene} from './scenes/SensitiveScene';
import {ReceiptScene} from './scenes/ReceiptScene';
import {ReturnScene} from './scenes/ReturnScene';

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  return (
    <AbsoluteFill className="airlock-film" style={{background: '#091a29', fontFamily: 'Segoe UI, sans-serif'}}>
      <style>{'.airlock-film, .airlock-film * { box-sizing: border-box; }'}</style>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={420}><ShiftScene /></TransitionSeries.Sequence>
        <TransitionSeries.Sequence durationInFrames={420}><RequestScene /></TransitionSeries.Sequence>
        <TransitionSeries.Sequence durationInFrames={450}><IncidentScene /></TransitionSeries.Sequence>
        <TransitionSeries.Sequence durationInFrames={300}><RewindScene /></TransitionSeries.Sequence>
        <TransitionSeries.Sequence durationInFrames={390}><LocalScene /></TransitionSeries.Sequence>
        <TransitionSeries.Sequence durationInFrames={420}><OutboundScene /></TransitionSeries.Sequence>
        <TransitionSeries.Sequence durationInFrames={420}><SensitiveScene /></TransitionSeries.Sequence>
        <TransitionSeries.Sequence durationInFrames={390}><ReceiptScene /></TransitionSeries.Sequence>
        <TransitionSeries.Sequence durationInFrames={390}><ReturnScene /></TransitionSeries.Sequence>
      </TransitionSeries>
      <Lens t={t} />
      <div style={{position: 'absolute', top: 54, left: 67, fontSize: 20, letterSpacing: 1.3, color: t < 43 ? '#d9b29a' : '#abc4cb'}}>
        {t < 43
          ? 'FICTIONAL INCIDENT / ILLUSTRATION / NO ACTUAL PUBLICATION'
          : t < 53
            ? 'CONTROL PATH ILLUSTRATION / LOCAL PROTOTYPE'
            : t < 107
              ? 'REAL LOCAL GATE REPLAY / NOT LIVE AGENCY FOOTAGE'
              : 'LOCAL PROTOTYPE / SUPPORTED ROUTED TOOLS ONLY'}
      </div>
      <Captions />
      <Audio src={staticFile('soundtrack.wav')} />
    </AbsoluteFill>
  );
};

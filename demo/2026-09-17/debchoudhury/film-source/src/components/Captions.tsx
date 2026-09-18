import React from 'react';
import type {Caption} from '@remotion/captions';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import data from '../captions.json';

const captions: Caption[] = data;

export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const now = frame * 1000 / fps;
  const caption = captions.find((item) => item.startMs <= now && item.endMs > now);
  if (!caption) return null;
  return (
    <div style={{position: 'absolute', bottom: 65, left: 160, right: 160, display: 'flex', justifyContent: 'center'}}>
      <div style={{
        maxWidth: 1490, padding: '13px 28px 16px', borderRadius: 11,
        background: 'rgba(3,14,22,0.91)', color: '#fff8eb',
        fontSize: 41, fontWeight: 550, lineHeight: 1.25, textAlign: 'center',
        boxShadow: '0 6px 25px rgba(0,0,0,0.15)',
      }}>
        {caption.text}
      </div>
    </div>
  );
};

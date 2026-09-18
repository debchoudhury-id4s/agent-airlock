import React from 'react';
import {Composition} from 'remotion';
import {Film} from './Film';

export const Root: React.FC = () => (
  <Composition
    id="AgentAirlock"
    component={Film}
    durationInFrames={3600}
    fps={30}
    width={1920}
    height={1080}
  />
);

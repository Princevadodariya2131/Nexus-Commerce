'use client';

import { Suspense } from 'react';
import { HeroScene } from './HeroScene';

export function HeroSceneWrapper() {
  return (
    <Suspense fallback={<div className="h-full w-full animate-pulse rounded-full bg-primary/10" />}>
      <HeroScene />
    </Suspense>
  );
}

'use client';

import { useSmoothScroll } from '@/hooks/useSmoothScroll';

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useSmoothScroll();
  return <>{children}</>;
}

'use client';

import { useEffect, useState, useCallback } from 'react';

interface CursorState {
  x: number;
  y: number;
  isHovering: boolean;
  isDragging: boolean;
  cursorType: 'default' | 'pointer' | 'text' | 'view';
}

export function useCursor() {
  const [state, setState] = useState<CursorState>({
    x: 0,
    y: 0,
    isHovering: false,
    isDragging: false,
    cursorType: 'default',
  });

  const onMouseMove = useCallback((e: MouseEvent) => {
    setState((prev) => ({ ...prev, x: e.clientX, y: e.clientY }));
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);

    const handleHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const interactive = target.closest('a, button, [data-cursor="pointer"]');
      const text = target.closest('[data-cursor="text"]');
      const view = target.closest('[data-cursor="view"]');

      setState((prev) => ({
        ...prev,
        isHovering: !!interactive,
        cursorType: view ? 'view' : text ? 'text' : interactive ? 'pointer' : 'default',
      }));
    };

    document.addEventListener('mouseover', handleHover);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseover', handleHover);
    };
  }, [onMouseMove]);

  return state;
}

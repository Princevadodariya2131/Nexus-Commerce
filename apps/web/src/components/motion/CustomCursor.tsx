'use client';

import { motion, useSpring } from 'framer-motion';
import { useCursor } from '@/hooks/useCursor';

export function CustomCursor() {
  const { x, y, isHovering, cursorType } = useCursor();

  const springConfig = { damping: 25, stiffness: 400 };
  const cursorX = useSpring(x, springConfig);
  const cursorY = useSpring(y, springConfig);

  const scale = isHovering ? (cursorType === 'view' ? 2.5 : 1.8) : 1;

  return (
    <>
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[9999] hidden mix-blend-difference md:block"
        style={{ x: cursorX, y: cursorY }}
      >
        <motion.div
          className="relative -translate-x-1/2 -translate-y-1/2 rounded-full border border-white"
          animate={{ width: 12 * scale, height: 12 * scale }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        />
      </motion.div>
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[9998] hidden md:block"
        style={{ x: cursorX, y: cursorY }}
      >
        <motion.div
          className="relative -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20"
          animate={{ width: 40 * scale, height: 40 * scale, opacity: isHovering ? 0.6 : 0.2 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        />
      </motion.div>
    </>
  );
}

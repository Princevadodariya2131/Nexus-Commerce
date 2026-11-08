'use client';

import { motion } from 'framer-motion';

const COLORS = ['#8b5cf6', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#60a5fa'];

export function SuccessConfetti() {
  const particles = Array.from({ length: 48 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 1.2 + Math.random() * 1.5,
    size: 6 + Math.random() * 8,
    color: COLORS[i % COLORS.length],
    rotate: Math.random() * 360,
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: '-5%',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
          }}
          initial={{ y: 0, opacity: 1, rotate: 0 }}
          animate={{
            y: '110vh',
            opacity: [1, 1, 0],
            rotate: p.rotate + 720,
            x: [0, (Math.random() - 0.5) * 120],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

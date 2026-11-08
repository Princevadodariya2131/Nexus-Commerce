'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { MagneticButton } from '@/components/motion/MagneticButton';
import dynamic from 'next/dynamic';

const HeroScene = dynamic(() => import('@/components/three/HeroScene').then((m) => m.HeroScene), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-full bg-primary/10" />,
});
import { fadeUp, staggerContainer, blurReveal } from '@/lib/motion/variants';

export function HeroSection() {
  return (
    <section className="relative min-h-screen overflow-hidden pt-32">
      <motion.div
        className="absolute inset-0 bg-gradient-glow"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      <motion.div
        className="absolute right-0 top-1/4 h-[600px] w-[600px] opacity-40 md:opacity-60"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.5, scale: 1 }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <HeroScene />
      </motion.div>

      <div className="relative mx-auto max-w-7xl px-4 md:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="max-w-3xl"
        >
          <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-2 glass rounded-full px-4 py-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">Premium Commerce Platform</span>
          </motion.div>

          <motion.h1 variants={blurReveal} className="font-display text-5xl font-bold leading-[1.1] tracking-tight md:text-7xl lg:text-8xl">
            <span className="gradient-text">Commerce</span>
            <br />
            reimagined.
          </motion.h1>

          <motion.p variants={fadeUp} className="mt-6 max-w-xl text-lg text-muted-foreground md:text-xl">
            Experience the future of shopping. Curated premium products, seamless checkout,
            and cinematic experiences — built for the modern enterprise.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10 flex flex-wrap gap-4">
            <Link href="/shop">
              <MagneticButton size="lg" className="gap-2">
                Explore Collection
                <ArrowRight className="h-4 w-4" />
              </MagneticButton>
            </Link>
            <Link href="/about">
              <MagneticButton variant="outline" size="lg">
                Our Story
              </MagneticButton>
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-16 flex gap-12">
            {[
              { value: '50K+', label: 'Products' },
              { value: '99.9%', label: 'Uptime' },
              { value: '4.9★', label: 'Rating' },
            ].map((stat) => (
              <motion.div key={stat.label}>
                <div className="text-2xl font-bold md:text-3xl">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="h-12 w-6 rounded-full border border-white/20 p-1">
          <motion.div
            className="h-2 w-2 rounded-full bg-primary mx-auto"
            animate={{ y: [0, 16, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </section>
  );
}

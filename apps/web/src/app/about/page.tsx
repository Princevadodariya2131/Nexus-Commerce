'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import {
  Sparkles,
  Target,
  Heart,
  Shield,
  Leaf,
  Users,
  Award,
  Globe,
  ArrowRight,
  Quote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { blurReveal, fadeUp, staggerContainer, luxuryScale } from '@/lib/motion/variants';

const stats = [
  { value: '2019', label: 'Founded' },
  { value: '50K+', label: 'Products' },
  { value: '120+', label: 'Countries' },
  { value: '4.9★', label: 'Customer rating' },
];

const values = [
  {
    icon: Target,
    title: 'Curated excellence',
    desc: 'Every product passes a rigorous quality review. We partner only with brands that share our standards.',
  },
  {
    icon: Heart,
    title: 'Customer first',
    desc: 'From discovery to delivery, your experience drives every decision we make.',
  },
  {
    icon: Shield,
    title: 'Trust & security',
    desc: 'Encrypted checkout, buyer protection, and transparent policies you can rely on.',
  },
  {
    icon: Leaf,
    title: 'Sustainable future',
    desc: 'Carbon-neutral shipping options and eco-conscious packaging across our catalog.',
  },
];

const milestones = [
  { year: '2019', title: 'Nexus is born', desc: 'Started as a small curated boutique in San Francisco.' },
  { year: '2021', title: 'Global expansion', desc: 'Opened warehouses in EU and Asia-Pacific regions.' },
  { year: '2023', title: '1M customers', desc: 'Reached one million happy customers worldwide.' },
  { year: '2025', title: 'Next chapter', desc: 'Launching immersive 3D shopping and same-day delivery.' },
];

const team = [
  {
    name: 'Sarah Chen',
    role: 'Founder & CEO',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
  },
  {
    name: 'Marcus Webb',
    role: 'Head of Design',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
  },
  {
    name: 'Elena Rodriguez',
    role: 'VP of Operations',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
  },
];

function AnimatedCounter({ value, label }: { value: string; label: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="text-center"
    >
      <p className="font-display text-3xl md:text-4xl font-bold text-primary">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </motion.div>
  );
}

export default function AboutPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[800px] bg-gradient-glow opacity-60" />
      <div className="pointer-events-none absolute bottom-1/4 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-[100px]" />

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-20 px-4 md:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-7xl text-center"
        >
          <motion.div
            variants={fadeUp}
            className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-6"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">Our story</span>
          </motion.div>

          <motion.h1
            variants={blurReveal}
            className="font-display text-5xl font-bold md:text-7xl lg:text-8xl leading-[1.05] max-w-4xl mx-auto"
          >
            We believe shopping should feel{' '}
            <span className="gradient-text">extraordinary</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-balance"
          >
            Nexus Commerce was built to merge premium curation, cinematic design, and
            seamless technology — so every visit feels less like a transaction and more
            like an experience.
          </motion.p>
        </motion.div>
      </section>

      {/* ── Stats ── */}
      <section className="py-16 px-4 md:px-8 border-y border-white/5">
        <div className="mx-auto max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <AnimatedCounter key={s.label} value={s.value} label={s.label} />
          ))}
        </div>
      </section>

      {/* ── Story + Image ── */}
      <section className="py-24 px-4 md:px-8">
        <div className="mx-auto max-w-7xl grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative aspect-[4/5] rounded-2xl overflow-hidden glass-card"
          >
            <Image
              src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800"
              alt="Nexus Commerce studio"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="absolute bottom-6 left-6 right-6 glass rounded-xl p-4"
            >
              <Quote className="h-5 w-5 text-primary mb-2" />
              <p className="text-sm italic text-muted-foreground">
                &ldquo;Design is not just what it looks like — it&apos;s how it makes you feel when you shop.&rdquo;
              </p>
            </motion.div>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="space-y-6"
          >
            <motion.div variants={fadeUp}>
              <p className="text-sm text-primary font-medium mb-2">Who we are</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold">
                Redefining modern retail
              </h2>
            </motion.div>
            <motion.p variants={fadeUp} className="text-muted-foreground leading-relaxed">
              Founded in 2019, Nexus began with a simple idea: online shopping had become
              functional but forgettable. We set out to build a platform where discovery,
              storytelling, and checkout flow together as one cohesive journey.
            </motion.p>
            <motion.p variants={fadeUp} className="text-muted-foreground leading-relaxed">
              Today we serve customers in over 120 countries, partnering with independent
              artisans and global brands alike. Our team of designers, engineers, and
              merchandisers work around the clock to keep every pixel and every package
              worthy of the Nexus name.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-wrap gap-3 pt-2">
              {[Globe, Award, Users].map((Icon, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 text-sm text-muted-foreground"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  {i === 0 ? 'Global reach' : i === 1 ? 'Award-winning UX' : '50+ team members'}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Mission & Vision ── */}
      <section className="py-24 px-4 md:px-8 bg-white/[0.02]">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <p className="text-sm text-primary font-medium mb-2">Purpose</p>
            <h2 className="font-display text-3xl md:text-5xl font-bold">Mission & vision</h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: 'Our mission',
                text: 'To deliver a shopping experience that is beautiful, trustworthy, and effortless — empowering people to find products they love without compromise.',
              },
              {
                title: 'Our vision',
                text: 'A world where every brand, big or small, can reach customers through immersive digital storefronts that rival the best physical boutiques.',
              },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                whileHover={{ y: -4 }}
                className="glass-card p-8 md:p-10 gradient-border"
              >
                <h3 className="font-display text-2xl font-bold mb-4">{card.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{card.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="py-24 px-4 md:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-14"
          >
            <p className="text-sm text-primary font-medium mb-2">What we stand for</p>
            <h2 className="font-display text-3xl md:text-5xl font-bold">Our core values</h2>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="grid sm:grid-cols-2 gap-6"
          >
            {values.map((v) => (
              <motion.div
                key={v.title}
                variants={luxuryScale}
                whileHover={{ scale: 1.02 }}
                className="glass-card p-8 group hover:border-primary/30 transition-colors"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center mb-5 group-hover:bg-primary/25 transition-colors">
                  <v.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{v.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Timeline ── */}
      <section className="py-24 px-4 md:px-8 border-t border-white/5">
        <div className="mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-sm text-primary font-medium mb-2">Journey</p>
            <h2 className="font-display text-3xl md:text-5xl font-bold">Milestones</h2>
          </motion.div>

          <div className="relative pl-8">
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gradient-to-b from-primary via-primary/40 to-transparent" />
            {milestones.map((m, i) => (
              <motion.div
                key={m.year}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="relative mb-10 last:mb-0"
              >
                <div className="absolute -left-8 top-2 h-4 w-4 rounded-full bg-primary border-4 border-background z-10" />
                <div className="glass-card p-6">
                  <span className="text-primary font-mono font-bold text-sm">{m.year}</span>
                  <h3 className="font-semibold text-lg mt-1">{m.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{m.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Team ── */}
      <section className="py-24 px-4 md:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <p className="text-sm text-primary font-medium mb-2">The people</p>
            <h2 className="font-display text-3xl md:text-5xl font-bold">Meet the team</h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
              Passionate creators, operators, and dreamers building the future of commerce.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid sm:grid-cols-3 gap-8"
          >
            {team.map((member) => (
              <motion.div
                key={member.name}
                variants={fadeUp}
                className="group text-center"
              >
                <div className="relative aspect-square rounded-2xl overflow-hidden glass-card mb-4 mx-auto max-w-[280px]">
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                    sizes="280px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="font-semibold text-lg">{member.name}</h3>
                <p className="text-sm text-muted-foreground">{member.role}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-4xl glass-card p-12 md:p-16 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Ready to explore?
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              Discover thousands of curated products crafted for quality, design, and everyday luxury.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/shop">
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  Shop collection <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/collections">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  View collections
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

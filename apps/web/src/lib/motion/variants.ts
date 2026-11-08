import { DURATION, EASING, STAGGER } from './tokens';

export const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.normal, ease: EASING.luxury },
  },
};

export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: STAGGER.normal, delayChildren: 0.1 },
  },
};

export const cinematicReveal = {
  hidden: { opacity: 0, y: 60, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: DURATION.cinematic, ease: EASING.cinematic },
  },
};

export const blurReveal = {
  hidden: { opacity: 0, filter: 'blur(12px)', y: 20 },
  visible: {
    opacity: 1,
    filter: 'blur(0px)',
    y: 0,
    transition: { duration: DURATION.slow, ease: EASING.luxury },
  },
};

export const luxuryScale = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: DURATION.normal, ease: EASING.luxury },
  },
};

export const smoothSlide = {
  hidden: { opacity: 0, x: -40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATION.normal, ease: EASING.smooth },
  },
};

export const floatingAnimation = {
  animate: {
    y: [-10, 10, -10],
    transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
  },
};

export const glassHover = {
  rest: { scale: 1 },
  hover: {
    scale: 1.02,
    transition: { duration: DURATION.fast, ease: EASING.luxury },
  },
};

export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.fast, ease: EASING.luxury } },
  exit: { opacity: 0, y: -8, transition: { duration: DURATION.instant } },
};

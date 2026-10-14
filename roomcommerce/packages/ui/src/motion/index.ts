export * from './gsap';
export * from './lenis';
export * from './SmoothScroll';

// Re-export core motion/react utilities for unified motion imports
export {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  useInView,
  useAnimation,
} from 'motion/react';
export type {
  MotionProps,
  Transition,
  Variants,
} from 'motion/react';

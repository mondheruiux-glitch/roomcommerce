import { describe, it, expect } from 'vitest';
import { gsap, ScrollTrigger, useGSAP, connectLenisWithGSAP, SmoothScrollProvider, useLenis, motion } from './index';

describe('@roomcommerce/ui motion suite', () => {
  it('exports GSAP engine and plugins correctly', () => {
    expect(gsap).toBeDefined();
    expect(typeof gsap.to).toBe('function');
    expect(typeof gsap.timeline).toBe('function');
    expect(ScrollTrigger).toBeDefined();
    expect(useGSAP).toBeDefined();
  });

  it('exports Lenis synchronization utilities and SmoothScrollProvider', () => {
    expect(typeof connectLenisWithGSAP).toBe('function');
    expect(typeof SmoothScrollProvider).toBe('function');
    expect(typeof useLenis).toBe('function');
  });

  it('exports motion/react components and hooks', () => {
    expect(motion).toBeDefined();
    expect(typeof motion.div).toBe('object');
  });
});

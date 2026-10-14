'use client';

import React, { useEffect, useRef } from 'react';
import type { LenisOptions } from 'lenis';
import { ReactLenis, useLenis, type LenisRef } from 'lenis/react';
import { connectLenisWithGSAP } from './lenis';

export interface SmoothScrollProps {
  children?: React.ReactNode;
  /**
   * Whether Lenis controls root window scroll or a nested container
   * @default true
   */
  root?: boolean | 'asChild';
  /**
   * Custom Lenis smooth scroll configuration
   */
  options?: LenisOptions;
  /**
   * Automatically synchronize with GSAP ticker & ScrollTrigger
   * @default true
   */
  syncScrollTrigger?: boolean;
  className?: string;
}

/**
 * Production-ready SmoothScrollProvider combining Lenis and GSAP ScrollTrigger.
 * When syncScrollTrigger is active (default), GSAP's ticker drives Lenis's RAF,
 * guaranteeing jitter-free parallax, pinned sections, and scroll scrubbing.
 */
export function SmoothScrollProvider({
  children,
  root = true,
  options = {
    lerp: 0.1,
    duration: 1.2,
    smoothWheel: true,
  },
  syncScrollTrigger = true,
  className,
}: SmoothScrollProps) {
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    if (!syncScrollTrigger) return;
    const lenisInstance = lenisRef.current?.lenis;
    if (!lenisInstance) return;

    const cleanup = connectLenisWithGSAP(lenisInstance);
    return cleanup;
  }, [syncScrollTrigger]);

  return (
    <ReactLenis
      ref={lenisRef}
      root={root}
      options={{
        ...options,
        autoRaf: !syncScrollTrigger,
      }}
      className={className}
    >
      {children}
    </ReactLenis>
  );
}

export { useLenis, ReactLenis };

import Lenis, { type LenisOptions } from 'lenis';
import { gsap, ScrollTrigger } from './gsap';

/**
 * Synchronize a Lenis smooth scroll instance with GSAP ScrollTrigger.
 * - Routes Lenis scroll updates to GSAP ScrollTrigger.update()
 * - Drives Lenis requestAnimationFrame from the GSAP ticker for frame-locked sync
 * - Sets gsap.ticker.lagSmoothing(0) to prevent jumpiness on lag spikes
 *
 * @returns Disconnect cleanup function
 */
export function connectLenisWithGSAP(lenis: Lenis): () => void {
  const onScroll = () => {
    ScrollTrigger.update();
  };

  lenis.on('scroll', onScroll);

  const tickerCallback = (time: number) => {
    lenis.raf(time * 1000);
  };

  gsap.ticker.add(tickerCallback);
  gsap.ticker.lagSmoothing(0);

  return () => {
    lenis.off('scroll', onScroll);
    gsap.ticker.remove(tickerCallback);
  };
}

export { Lenis, type LenisOptions };

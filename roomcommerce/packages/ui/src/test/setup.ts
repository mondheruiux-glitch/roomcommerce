import '@testing-library/jest-dom';

// ── ResizeObserver polyfill ───────────────────────────────────────────────────
// Radix UI's react-use-size hook (used by Slider) calls ResizeObserver.
// jsdom does not ship with it; add a minimal no-op stub.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ── matchMedia polyfill ───────────────────────────────────────────────────────
// GSAP ScrollTrigger calls window.matchMedia on register.
// jsdom does not implement it; stub it to return a minimal MediaQueryList.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

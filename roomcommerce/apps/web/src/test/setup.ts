import '@testing-library/jest-dom';

// ── ResizeObserver polyfill ────────────────────────────────────────────────
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ── matchMedia polyfill ────────────────────────────────────────────────────
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

// ── URL.createObjectURL stub ─────────────────────────────────────────────
// jsdom does not implement createObjectURL; stub for EXIF scrubber tests
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = () => 'blob:mock-object-url';
  URL.revokeObjectURL = () => {};
}

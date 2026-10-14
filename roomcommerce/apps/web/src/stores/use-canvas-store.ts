import { create } from 'zustand';

interface CanvasState {
  /** Current zoom multiplier (1.0 = 100%) */
  zoomScale: number;
  /** Pan translation in CSS pixels */
  panOffset: { x: number; y: number };
  /** Currently selected hotspot pin ID (null = none) */
  selectedHotspotId: string | null;
  /** Controls product drawer visibility */
  isDrawerOpen: boolean;
  /** Toggles the pulsing pin overlay */
  showHotspots: boolean;

  // — Actions ——————————————————————————————————————————————————
  setZoomScale: (scale: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  /** Select a hotspot pin — also opens the product drawer (FR-401) */
  selectHotspot: (id: string | null) => void;
  toggleHotspots: () => void;
  closeDrawer: () => void;
  resetCanvas: () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  zoomScale: 1.0,
  panOffset: { x: 0, y: 0 },
  selectedHotspotId: null,
  isDrawerOpen: false,
  showHotspots: true,

  setZoomScale: (zoomScale) =>
    set({ zoomScale: Math.max(0.5, Math.min(5.0, zoomScale)) }), // clamp 0.5×–5×

  setPanOffset: (panOffset) => set({ panOffset }),

  selectHotspot: (id) =>
    set({ selectedHotspotId: id, isDrawerOpen: Boolean(id) }),

  toggleHotspots: () => set((s) => ({ showHotspots: !s.showHotspots })),

  closeDrawer: () =>
    set({ isDrawerOpen: false, selectedHotspotId: null }),

  resetCanvas: () =>
    set({ zoomScale: 1.0, panOffset: { x: 0, y: 0 }, selectedHotspotId: null, isDrawerOpen: false }),
}));

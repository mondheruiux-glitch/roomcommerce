import { create } from 'zustand';

export interface SwappedSkuData {
  skuId: string;
  title: string;
  retailer: string;
  priceCents: number;
  imageUrl?: string;
  redirectUrl?: string;
}

export interface CanvasState {
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
  /** Toggles before/after comparison mode */
  isCompareMode: boolean;
  /** Split curtain comparison slider position (0 = all before, 100 = all after, default: 50) */
  compareSliderPosition: number;
  /** Overrides of original hotspot SKUs by hotspot ID */
  swappedHotspotSkus: Record<string, SwappedSkuData>;

  // — Actions ——————————————————————————————————————————————————
  setZoomScale: (scale: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  /** Select a hotspot pin — also opens the product drawer (FR-401) */
  selectHotspot: (id: string | null) => void;
  toggleHotspots: () => void;
  closeDrawer: () => void;
  toggleCompareMode: () => void;
  setCompareMode: (enabled: boolean) => void;
  setCompareSliderPosition: (position: number) => void;
  swapHotspotSku: (hotspotId: string, newSku: SwappedSkuData) => void;
  resetCanvas: () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  zoomScale: 1.0,
  panOffset: { x: 0, y: 0 },
  selectedHotspotId: null,
  isDrawerOpen: false,
  showHotspots: true,
  isCompareMode: false,
  compareSliderPosition: 50,
  swappedHotspotSkus: {},

  setZoomScale: (zoomScale) =>
    set({ zoomScale: Math.max(0.5, Math.min(5.0, zoomScale)) }), // clamp 0.5×–5×

  setPanOffset: (panOffset) => set({ panOffset }),

  selectHotspot: (id) =>
    set({ selectedHotspotId: id, isDrawerOpen: Boolean(id) }),

  toggleHotspots: () => set((s) => ({ showHotspots: !s.showHotspots })),

  closeDrawer: () =>
    set({ isDrawerOpen: false, selectedHotspotId: null }),

  toggleCompareMode: () => set((s) => ({ isCompareMode: !s.isCompareMode })),

  setCompareMode: (isCompareMode) => set({ isCompareMode }),

  setCompareSliderPosition: (position) =>
    set({ compareSliderPosition: Math.max(0, Math.min(100, Math.round(position))) }),

  swapHotspotSku: (hotspotId, newSku) =>
    set((s) => ({
      swappedHotspotSkus: {
        ...s.swappedHotspotSkus,
        [hotspotId]: newSku,
      },
    })),

  resetCanvas: () =>
    set({
      zoomScale: 1.0,
      panOffset: { x: 0, y: 0 },
      selectedHotspotId: null,
      isDrawerOpen: false,
      isCompareMode: false,
      compareSliderPosition: 50,
      swappedHotspotSkus: {},
    }),
}));

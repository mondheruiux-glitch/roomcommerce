import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { StylePresetEnum, RoomFunctionEnum } from '@roomcommerce/contracts';
import { useWizardStore } from '../stores/use-wizard-store';

describe('useWizardStore', () => {
  beforeEach(() => {
    // Reset to defaults before each test
    useWizardStore.getState().reset();
  });

  it('initializes with JAPANDI style and $1,500 budget defaults', () => {
    const state = useWizardStore.getState();
    expect(state.stylePreset).toBe(StylePresetEnum.JAPANDI);
    expect(state.budgetCents).toBe(150_000);
    expect(state.roomFunction).toBe(RoomFunctionEnum.LIVING_ROOM);
    expect(state.rawImageFile).toBeNull();
    expect(state.projectId).toBeNull();
  });

  it('setRawImage stores file, sanitized blob, and preview URL', () => {
    const file = new File(['data'], 'room.jpg', { type: 'image/jpeg' });
    const blob = new Blob(['clean'], { type: 'image/jpeg' });
    const previewUrl = 'blob:preview';

    act(() => {
      useWizardStore.getState().setRawImage(file, blob, previewUrl);
    });

    const state = useWizardStore.getState();
    expect(state.rawImageFile).toBe(file);
    expect(state.sanitizedBlob).toBe(blob);
    expect(state.previewUrl).toBe(previewUrl);
  });

  it('setStylePreset updates style preset', () => {
    act(() => {
      useWizardStore.getState().setStylePreset(StylePresetEnum.MINIMALIST);
    });
    expect(useWizardStore.getState().stylePreset).toBe(StylePresetEnum.MINIMALIST);
  });

  it('setBudgetCents updates budget', () => {
    act(() => {
      useWizardStore.getState().setBudgetCents(50_000);
    });
    expect(useWizardStore.getState().budgetCents).toBe(50_000);
  });

  it('setProjectId stores the project ID', () => {
    act(() => {
      useWizardStore.getState().setProjectId('proj_abc123');
    });
    expect(useWizardStore.getState().projectId).toBe('proj_abc123');
  });

  it('reset() clears all transient fields back to defaults', () => {
    const file = new File(['data'], 'room.jpg', { type: 'image/jpeg' });
    const blob = new Blob(['clean'], { type: 'image/jpeg' });

    act(() => {
      useWizardStore.getState().setRawImage(file, blob, 'blob:preview');
      useWizardStore.getState().setProjectId('proj_xyz');
      useWizardStore.getState().setStylePreset(StylePresetEnum.INDUSTRIAL);
      useWizardStore.getState().reset();
    });

    const state = useWizardStore.getState();
    expect(state.rawImageFile).toBeNull();
    expect(state.sanitizedBlob).toBeNull();
    expect(state.previewUrl).toBeNull();
    expect(state.projectId).toBeNull();
    expect(state.stylePreset).toBe(StylePresetEnum.JAPANDI);
    expect(state.budgetCents).toBe(150_000);
    expect(state.lockedAnchorCategories).toEqual([]);
  });

  it('toggleAnchorCategory adds and removes categories cleanly (US-03)', () => {
    expect(useWizardStore.getState().lockedAnchorCategories).toEqual([]);

    act(() => {
      useWizardStore.getState().toggleAnchorCategory('sofa');
    });
    expect(useWizardStore.getState().lockedAnchorCategories).toEqual(['sofa']);

    act(() => {
      useWizardStore.getState().toggleAnchorCategory('coffee_table');
    });
    expect(useWizardStore.getState().lockedAnchorCategories).toEqual(['sofa', 'coffee_table']);

    act(() => {
      useWizardStore.getState().toggleAnchorCategory('sofa');
    });
    expect(useWizardStore.getState().lockedAnchorCategories).toEqual(['coffee_table']);

    act(() => {
      useWizardStore.getState().reset();
    });
    expect(useWizardStore.getState().lockedAnchorCategories).toEqual([]);
  });
});

describe('useCanvasStore', () => {
  it('selectHotspot opens drawer and stores ID', async () => {
    const { useCanvasStore } = await import('../stores/use-canvas-store');
    useCanvasStore.getState().resetCanvas();

    act(() => {
      useCanvasStore.getState().selectHotspot('hotspot_1');
    });

    const state = useCanvasStore.getState();
    expect(state.selectedHotspotId).toBe('hotspot_1');
    expect(state.isDrawerOpen).toBe(true);
  });

  it('closeDrawer clears selection and closes drawer', async () => {
    const { useCanvasStore } = await import('../stores/use-canvas-store');

    act(() => {
      useCanvasStore.getState().selectHotspot('hotspot_1');
      useCanvasStore.getState().closeDrawer();
    });

    const state = useCanvasStore.getState();
    expect(state.selectedHotspotId).toBeNull();
    expect(state.isDrawerOpen).toBe(false);
  });

  it('setZoomScale clamps to 0.5–5.0 range', async () => {
    const { useCanvasStore } = await import('../stores/use-canvas-store');

    act(() => useCanvasStore.getState().setZoomScale(0.1));
    expect(useCanvasStore.getState().zoomScale).toBe(0.5);

    act(() => useCanvasStore.getState().setZoomScale(99));
    expect(useCanvasStore.getState().zoomScale).toBe(5.0);

    act(() => useCanvasStore.getState().setZoomScale(2.5));
    expect(useCanvasStore.getState().zoomScale).toBe(2.5);
  });

  it('toggleHotspots flips showHotspots', async () => {
    const { useCanvasStore } = await import('../stores/use-canvas-store');
    useCanvasStore.getState().resetCanvas();

    act(() => useCanvasStore.getState().toggleHotspots());
    expect(useCanvasStore.getState().showHotspots).toBe(false);

    act(() => useCanvasStore.getState().toggleHotspots());
    expect(useCanvasStore.getState().showHotspots).toBe(true);
  });
});

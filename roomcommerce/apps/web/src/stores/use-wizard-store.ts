import { create } from 'zustand';
import { StylePresetEnum, RoomFunctionEnum } from '@roomcommerce/contracts';

interface WizardState {
  /** Original file before EXIF scrubbing */
  rawImageFile: File | null;
  /** Clean Blob with EXIF stripped — this is what gets uploaded (FR-102) */
  sanitizedBlob: Blob | null;
  /** Object URL for in-app preview display */
  previewUrl: string | null;
  /** Style preset selected in step 3 (SCR-06) */
  stylePreset: StylePresetEnum;
  /** Room function classification */
  roomFunction: RoomFunctionEnum;
  /** Budget guardrail in cents, default $1,500 (FR-202) */
  budgetCents: number;
  /** Project ID returned from POST /api/v1/projects */
  projectId: string | null;
  /** Anchor furniture categories locked to preserve in inpainting (US-03, FR-104) */
  lockedAnchorCategories: string[];

  // — Actions ——————————————————————————————————————————————————
  setRawImage: (file: File, sanitized: Blob, previewUrl: string) => void;
  setStylePreset: (style: StylePresetEnum) => void;
  setRoomFunction: (roomFn: RoomFunctionEnum) => void;
  setBudgetCents: (cents: number) => void;
  setProjectId: (id: string) => void;
  toggleAnchorCategory: (category: string) => void;
  /** Reset all transient wizard state (called after successful job submission) */
  reset: () => void;
}

const DEFAULTS = {
  rawImageFile: null,
  sanitizedBlob: null,
  previewUrl: null,
  stylePreset: StylePresetEnum.JAPANDI,
  roomFunction: RoomFunctionEnum.LIVING_ROOM,
  budgetCents: 150_000, // $1,500.00
  projectId: null,
  lockedAnchorCategories: [] as string[],
} as const;

export const useWizardStore = create<WizardState>((set) => ({
  ...DEFAULTS,

  setRawImage: (file, sanitized, previewUrl) =>
    set({ rawImageFile: file, sanitizedBlob: sanitized, previewUrl }),

  setStylePreset: (stylePreset) => set({ stylePreset }),

  setRoomFunction: (roomFunction) => set({ roomFunction }),

  setBudgetCents: (budgetCents) => set({ budgetCents }),

  setProjectId: (projectId) => set({ projectId }),

  toggleAnchorCategory: (category) =>
    set((state) => {
      const exists = state.lockedAnchorCategories.includes(category);
      return {
        lockedAnchorCategories: exists
          ? state.lockedAnchorCategories.filter((c) => c !== category)
          : [...state.lockedAnchorCategories, category],
      };
    }),

  reset: () => set({ ...DEFAULTS }),
}));

// Primitives
export { AdsButton, buttonVariants } from './primitives/button/ads-button';
export type { AdsButtonProps } from './primitives/button/ads-button';
export { AdsBadge } from './primitives/badge/ads-badge';
export type { AdsBadgeProps } from './primitives/badge/ads-badge';
export { AdsDivider } from './primitives/divider/ads-divider';
export type { AdsDividerProps } from './primitives/divider/ads-divider';

// Inputs
export { AdsBudgetSlider } from './inputs/slider/ads-budget-slider';
export type { AdsBudgetSliderProps } from './inputs/slider/ads-budget-slider';
export { AdsStyleCardSelector, STYLE_PRESETS } from './inputs/style-selector/ads-style-card-selector';
export type { AdsStyleCardSelectorProps, StylePreset } from './inputs/style-selector/ads-style-card-selector';
export { AdsDropzone } from './inputs/dropzone/ads-dropzone';
export type { AdsDropzoneProps } from './inputs/dropzone/ads-dropzone';

// Feedback
export { AdsProgressBar } from './feedback/progress-bar/ads-progress-bar';
export type { AdsProgressBarProps, ProgressStage } from './feedback/progress-bar/ads-progress-bar';
export { AdsModalDialog, AdsModalTrigger } from './feedback/modal/ads-modal-dialog';
export type { AdsModalDialogProps } from './feedback/modal/ads-modal-dialog';
export { AdsToast } from './feedback/toast/ads-toast';
export type { AdsToastProps, ToastVariant } from './feedback/toast/ads-toast';

// Data Display
export { AdsCanvasHotspot } from './data-display/hotspot/ads-canvas-hotspot';
export type { AdsCanvasHotspotProps } from './data-display/hotspot/ads-canvas-hotspot';
export { AdsSkuSpecTable } from './data-display/spec-table/ads-sku-spec-table';
export type { AdsSkuSpecTableProps } from './data-display/spec-table/ads-sku-spec-table';

// Navigation
export { AdsProductDrawer } from './navigation/product-drawer/ads-product-drawer';
export type { AdsProductDrawerProps, ProductDrawerData } from './navigation/product-drawer/ads-product-drawer';

// Lib
export { cn } from './lib/utils';

// Motion (from previous milestone)
export * from './motion';

// React Bits (from previous milestone)
export * from './react-bits';

export const ADS_VERSION = '0.1.0' as const;

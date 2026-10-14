export const spacing = {
  '0': '0px',
  '1': '4px',   // 0.25rem - Micro padding, badge vertical
  '2': '8px',   // 0.50rem - Icon-to-text gap, compact buttons
  '3': '12px',  // 0.75rem - Input vertical padding, chip spacing
  '4': '16px',  // 1.00rem - Container padding, card inner gaps
  '5': '24px',  // 1.50rem - Desktop gutters, drawer padding
  '6': '32px',  // 2.00rem - Section separation
  '8': '48px',  // 3.00rem - Major viewport division
  '12': '64px', // 4.00rem - Hero section vertical padding
} as const;

export const radii = {
  none: '0px',
  sm: '4px',     // Form inputs, badges, budget slider handles
  md: '8px',     // Drawer cards, thumbnails, dialog modals
  lg: '16px',    // Mobile sheet top edges
  full: '9999px', // Hotspot pins, pill chips, action buttons
} as const;

export const colors = {
  bg: {
    canvas: '#F9F8F6',    // Alabaster - Primary screen background
    surface: '#FFFFFF',   // Pure White - Elevated cards and modal surfaces
    subtle: '#F2EFEB',    // Warm Stone - Table header, hover fills
    muted: '#E6E2DC',     // Sandstone - Inactive boundaries, chip borders
    overlay: 'rgba(26, 25, 23, 0.45)', // Modal dimming backdrop
  },
  ink: {
    primary: '#1A1917',   // Charcoal Ash - High contrast body (15.8:1 WCAG AAA)
    secondary: '#57534E', // Slate Stone - Secondary labels, spec keys (6.8:1 WCAG AA)
    muted: '#6B655B',     // Dry Clay - Timestamps, helper notes (4.6:1 WCAG AA on white)
    inverted: '#FFFFFF',  // Pure White - Text on dark buttons & terracotta CTA (≥4.5:1)
  },
  brand: {
    terracotta: '#B85D3A',        // Terre Battue - Primary CTA, active hotspots
    'terracotta-hover': '#984B2E', // Pressed / hover button state
    'terracotta-subtle': '#F7EBE6', // Pill badge backgrounds
    olive: '#4E5E4A',             // Spatial dimensions & bounding wireframes
  },
  semantic: {
    success: '#2E6945',            // Verified stock, valid payment
    'success-subtle': '#EDF5F0',
    warning: '#A16207',            // Low stock alert (<= 2 left)
    'warning-subtle': '#FEF9C3',
    danger: '#B91C1C',             // Blur failure, payment error, purge action
    'danger-subtle': '#FEE2E2',
    info: '#2563EB',               // Depth guidelines & tips
  },
  border: {
    default: '#E6E2DC',
    strong: '#D6D1CA',
    interactive: '#1A1917',
  },
} as const;

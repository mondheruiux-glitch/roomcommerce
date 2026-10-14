import { z } from 'zod';

export const CanvasHotspotSchema = z.object({
  hotspot_id: z.string().uuid(),
  project_id: z.string().uuid(),
  sku_id: z.string(),
  x_pct: z.number().min(0).max(100),
  y_pct: z.number().min(0).max(100),
  width_pct: z.number().min(0).max(100),
  height_pct: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  label: z.string(),
});

export type CanvasHotspotDto = z.infer<typeof CanvasHotspotSchema>;

export const AffiliateRedirectSchema = z.object({
  click_id: z.string().uuid(),
  sku_id: z.string(),
  retailer_id: z.string(),
  affiliate_url: z.string().url(),
  user_agent: z.string().optional(),
  referrer: z.string().optional(),
  timestamp: z.string().datetime(),
});

export type AffiliateRedirectDto = z.infer<typeof AffiliateRedirectSchema>;

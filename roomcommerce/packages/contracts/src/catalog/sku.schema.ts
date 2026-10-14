import { z } from 'zod';
import { RetailerEnum } from '../enums/index.js';

export const CatalogSkuSchema = z.object({
  sku_id: z.string(),
  retailer_id: z.nativeEnum(RetailerEnum),
  title: z.string().min(1).max(512),
  category: z.string(),
  price_cents: z.number().int().nonnegative(),
  currency: z.literal('USD').default('USD'),
  dimensions_cm: z.object({
    width: z.number().positive(),
    depth: z.number().positive(),
    height: z.number().positive(),
  }),
  in_stock: z.boolean(),
  canonical_url: z.string().url(),
  affiliate_url: z.string().url(),
  primary_image_url: z.string().url(),
  last_verified_at: z.string().datetime(),
});

export type CatalogSkuDto = z.infer<typeof CatalogSkuSchema>;

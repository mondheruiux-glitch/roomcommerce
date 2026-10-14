import { z } from 'zod';

export const CatalogIngestDtoSchema = z.object({
  sku: z.string().min(1).max(128),
  retailerId: z.enum(['IKEA', 'TARGET', 'WAYFAIR', 'AMAZON']),
  title: z.string().min(1).max(512),
  category: z.enum([
    'sofa',
    'coffee_table',
    'accent_chair',
    'rug',
    'floor_lamp',
    'storage_credenza',
    'dining_table',
    'wall_art',
  ]),
  priceCents: z.number().int().positive(),
  currency: z.literal('USD').default('USD'),
  widthCm: z.number().positive().optional(),
  depthCm: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
  canonicalUrl: z.string().url(),
  affiliateUrl: z.string().url(),
  primaryImageUrl: z.string().url(),
  inStock: z.boolean().default(true),
});

export type CatalogIngestDto = z.infer<typeof CatalogIngestDtoSchema>;

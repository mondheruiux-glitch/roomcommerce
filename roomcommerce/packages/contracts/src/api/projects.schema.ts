import { z } from 'zod';
import { StylePresetEnum, RoomFunctionEnum } from '../enums/index.js';

export const CreateProjectSchema = z.object({
  style_preset: z.nativeEnum(StylePresetEnum),
  room_function: z.nativeEnum(RoomFunctionEnum).default(RoomFunctionEnum.LIVING_ROOM),
  budget_ceiling_cents: z
    .number()
    .int()
    .min(30000, 'Budget must be at least $300')
    .max(1000000, 'Budget ceiling is $10,000'),
  currency: z.literal('USD').default('USD'),
});

export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;

export const PresignedUploadResponseSchema = z.object({
  project_id: z.string().uuid(),
  upload_url: z.string().url(),
  upload_method: z.literal('PUT'),
  expires_in_seconds: z.number().int().default(300),
  max_size_bytes: z.number().int().default(20971520), // 20MB (FR-101)
  key: z.string(),
});

export type PresignedUploadResponseDto = z.infer<typeof PresignedUploadResponseSchema>;

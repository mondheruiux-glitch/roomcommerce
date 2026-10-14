import { z } from 'zod';

export const ApiSuccessEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z
      .object({
        timestamp: z.string().datetime(),
        requestId: z.string().uuid().optional(),
      })
      .optional(),
  });

export const ApiErrorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z
      .array(
        z.object({
          field: z.string(),
          message: z.string(),
        }),
      )
      .optional(),
  }),
});

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  meta?: { timestamp: string; requestId?: string };
};

export type ApiErrorResponse = z.infer<typeof ApiErrorEnvelopeSchema>;

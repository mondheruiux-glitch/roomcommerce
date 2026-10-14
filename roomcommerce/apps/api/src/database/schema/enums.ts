import { pgEnum } from 'drizzle-orm/pg-core';

export const stylePresetEnum = pgEnum('style_preset_enum', [
  'JAPANDI',
  'MID_CENTURY_MODERN',
  'SCANDINAVIAN',
  'INDUSTRIAL',
  'MINIMALIST',
  'CONTEMPORARY',
  'BOHEMIAN',
  'MODERN_FARMHOUSE',
]);

export const roomFunctionEnum = pgEnum('room_function_enum', [
  'LIVING_ROOM',
  'BEDROOM',
  'HOME_OFFICE',
  'DINING_ROOM',
  'PATIO',
]);

export const retailerIdEnum = pgEnum('retailer_id_enum', [
  'IKEA',
  'TARGET',
  'WAYFAIR',
  'AMAZON',
]);

export const jobStatusEnum = pgEnum('job_status_enum', [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'TIMED_OUT',
]);

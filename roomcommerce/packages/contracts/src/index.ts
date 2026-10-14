// Enums
export {
  StylePresetEnum,
  RoomFunctionEnum,
  RetailerEnum,
  JobStatusEnum,
} from './enums/index.js';

// API Envelopes
export {
  ApiSuccessEnvelopeSchema,
  ApiErrorEnvelopeSchema,
  type ApiSuccessResponse,
  type ApiErrorResponse,
} from './api/envelope.schema.js';

// Project Schemas
export {
  CreateProjectSchema,
  type CreateProjectDto,
  PresignedUploadResponseSchema,
  type PresignedUploadResponseDto,
} from './api/projects.schema.js';

// Catalog Schemas
export { CatalogSkuSchema, type CatalogSkuDto } from './catalog/sku.schema.js';

// Canvas Schemas
export {
  CanvasHotspotSchema,
  type CanvasHotspotDto,
  AffiliateRedirectSchema,
  type AffiliateRedirectDto,
} from './canvas/hotspot.schema.js';

// Telemetry Schemas
export { TelemetryEventSchema, type TelemetryEvent } from './events/telemetry.schema.js';

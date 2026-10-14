// Schema barrel — all tables, enums, and types exported from a single entry point
export { stylePresetEnum, roomFunctionEnum, retailerIdEnum, jobStatusEnum } from './enums.js';
export { users, type User, type NewUser } from './users.js';
export { movePasses, type MovePass, type NewMovePass } from './move-passes.js';
export { projects, type Project, type NewProject } from './projects.js';
export { catalogSkus, type CatalogSku, type NewCatalogSku } from './catalog-skus.js';
export { canvasHotspots, type CanvasHotspot, type NewCanvasHotspot } from './canvas-hotspots.js';
export {
  affiliateClickEvents,
  type AffiliateClickEvent,
  type NewAffiliateClickEvent,
} from './affiliate-clicks.js';

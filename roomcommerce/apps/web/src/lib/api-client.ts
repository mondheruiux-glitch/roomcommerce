/**
 * API client for apps/web — typed fetch wrappers for all RoomCommerce API endpoints.
 * All requests include credentials (cookies: prc_token, prc_session, prc_guest_session)
 * and optional Bearer auth token for session authentication.
 */
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function getApiBaseUrl(): string {
  return API_BASE;
}

/** Generic fetch helper with error propagation and credential forwarding */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) ?? {}),
  };

  // Forward client session token if set and not already specified
  if (authToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      const parsed = JSON.parse(body);
      message = parsed?.error?.message || parsed?.message || body;
    } catch {
      // not JSON
    }
    throw new Error(`API ${res.status}: ${message}`);
  }

  return res.json() as Promise<T>;
}

// ── Auth & Session ──────────────────────────────────────────────────────────

export interface MagicLinkResponse {
  success: boolean;
  message: string;
}

export function requestMagicLink(email: string): Promise<MagicLinkResponse> {
  return apiFetch<MagicLinkResponse>('/api/v1/auth/magic-link', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export interface VerifyMagicLinkResponse {
  session_token: string;
  user: {
    id: string;
    email: string;
  };
}

export async function verifyMagicLink(token: string): Promise<VerifyMagicLinkResponse> {
  const res = await apiFetch<VerifyMagicLinkResponse>(`/api/v1/auth/verify?token=${encodeURIComponent(token)}`);
  if (res.session_token) {
    setAuthToken(res.session_token);
  }
  return res;
}

export interface UserProfile {
  id: string;
  email: string;
  freeRendersUsed: number;
  entitlement: {
    tier: 'FREE_TIER' | 'MOVE_IN_PASS';
    passId?: string;
  };
}

export function fetchCurrentUser(): Promise<UserProfile> {
  return apiFetch<UserProfile>('/api/v1/auth/me');
}

export async function logout(): Promise<{ success: boolean }> {
  const res = await apiFetch<{ success: boolean }>('/api/v1/auth/logout', { method: 'POST' });
  setAuthToken(null);
  return res;
}

// ── Projects ────────────────────────────────────────────────────────────────

export interface CreateProjectResponse {
  projectId: string;
  uploadUrl: string; // presigned PUT URL for Cloudflare R2
  uploadMethod?: string;
  expiresInSeconds?: number;
}

export async function createProject(payload?: {
  style_preset?: string;
  room_function?: string;
  budget_ceiling_cents?: number;
}): Promise<CreateProjectResponse> {
  const raw = await apiFetch<any>('/api/v1/projects', {
    method: 'POST',
    body: JSON.stringify(
      payload ?? {
        style_preset: 'JAPANDI',
        room_function: 'LIVING_ROOM',
        budget_ceiling_cents: 150_000,
      },
    ),
  });

  const data = raw.data ?? raw;
  return {
    projectId: data.projectId ?? data.project_id ?? data.id,
    uploadUrl: data.uploadUrl ?? data.upload_url,
    uploadMethod: data.uploadMethod ?? data.upload_method ?? 'PUT',
    expiresInSeconds: data.expiresInSeconds ?? data.expires_in_seconds ?? 300,
  };
}

export interface TriggerRenderPayload {
  stylePreset?: string;
  roomFunction?: string;
  budgetCents?: number;
  style_preset?: string;
  room_function?: string;
  budget_ceiling_cents?: number;
  assetKey?: string;
  asset_key?: string;
  lockedAnchorCategories?: string[];
  locked_anchor_categories?: string[];
}

export interface TriggerRenderResponse {
  jobId: string;
  status?: string;
}

export async function triggerRender(
  projectId: string,
  payload: TriggerRenderPayload,
): Promise<TriggerRenderResponse> {
  const locked =
    payload.lockedAnchorCategories ?? payload.locked_anchor_categories ?? [];

  const body = {
    stylePreset: payload.stylePreset ?? payload.style_preset ?? 'JAPANDI',
    style_preset: payload.style_preset ?? payload.stylePreset ?? 'JAPANDI',
    roomFunction: payload.roomFunction ?? payload.room_function ?? 'LIVING_ROOM',
    room_function: payload.room_function ?? payload.roomFunction ?? 'LIVING_ROOM',
    budgetCents: payload.budgetCents ?? payload.budget_ceiling_cents ?? 150_000,
    budget_ceiling_cents: payload.budget_ceiling_cents ?? payload.budgetCents ?? 150_000,
    assetKey: payload.assetKey ?? payload.asset_key,
    asset_key: payload.asset_key ?? payload.assetKey,
    lockedAnchorCategories: locked,
    locked_anchor_categories: locked,
  };

  const raw = await apiFetch<any>(
    `/api/v1/projects/${projectId}/render`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );

  const data = raw.data ?? raw;
  return {
    jobId: data.jobId ?? data.job_id ?? projectId,
    status: data.status,
  };
}

export interface ProjectData {
  id: string;
  renderUrl: string | null;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETE' | 'COMPLETED' | 'FAILED';
  isFreeUser: boolean;
  createdAt: string;
  expiresAt: string;
  hotspots: HotspotData[];
}

export interface HotspotData {
  id: string;
  normX: number;
  normY: number;
  category: string;
  priceCents: number;
  productId: string;
}

export async function fetchProject(projectId: string): Promise<ProjectData> {
  const raw = await apiFetch<any>(`/api/v1/projects/${projectId}`);
  const data = raw.data ?? raw;

  return {
    id: data.id ?? projectId,
    renderUrl: data.renderUrl ?? data.render_url ?? data.renderedImageUrl ?? data.rendered_image_url ?? null,
    status: data.status,
    isFreeUser: data.isFreeUser ?? data.is_free_user ?? false,
    createdAt: data.createdAt ?? data.created_at ?? new Date().toISOString(),
    expiresAt: data.expiresAt ?? data.expires_at ?? new Date(Date.now() + 7 * 86400000).toISOString(),
    hotspots: (data.hotspots ?? []).map((h: any) => ({
      id: h.id ?? `spot-${h.category}`,
      normX: Number(h.normX ?? h.norm_x ?? 0),
      normY: Number(h.normY ?? h.norm_y ?? 0),
      category: h.category,
      priceCents: h.priceCents ?? h.price_cents ?? 0,
      productId: h.productId ?? h.product_id ?? h.matchedSkuId ?? h.matched_sku_id ?? '',
    })),
  };
}

export interface ProjectListResponse {
  projects: ProjectData[];
}

export function fetchProjects(): Promise<ProjectListResponse> {
  return apiFetch<ProjectListResponse>('/api/v1/projects');
}

// ── Commerce ────────────────────────────────────────────────────────────────

export interface ProductDetail {
  id: string;
  title: string;
  retailer: string;
  priceCents: number;
  inStock: boolean;
  imageUrl: string;
  affiliateUrl: string;
  similarityScore: number;
  isAlternative?: boolean;
  dimensions: {
    widthCm: number;
    heightCm: number;
    depthCm: number;
  };
}

export async function fetchProductDetail(productId: string): Promise<ProductDetail> {
  try {
    const raw = await apiFetch<any>(`/api/v1/catalog/products/${productId}`).catch(() =>
      apiFetch<any>(`/api/v1/commerce/products/${productId}`),
    );
    const data = raw.data ?? raw;
    return {
      id: data.id ?? productId,
      title: data.title ?? '',
      retailer: data.retailer ?? data.retailerName ?? '',
      priceCents: data.priceCents ?? data.price_cents ?? 0,
      inStock: data.inStock ?? data.in_stock ?? true,
      imageUrl: data.imageUrl ?? data.image_url ?? '',
      affiliateUrl: data.affiliateUrl ?? data.affiliate_url ?? getCommerceRedirectUrl(productId),
      similarityScore: data.similarityScore ?? data.similarity_score ?? 0.9,
      isAlternative: Boolean(data.isAlternative ?? data.is_alternative),
      dimensions: {
        widthCm: data.dimensions?.widthCm ?? data.dimensions?.width_cm ?? data.dimensionsCm?.width ?? 0,
        heightCm: data.dimensions?.heightCm ?? data.dimensions?.height_cm ?? data.dimensionsCm?.height ?? 0,
        depthCm: data.dimensions?.depthCm ?? data.dimensions?.depth_cm ?? data.dimensionsCm?.depth ?? 0,
      },
    };
  } catch (err) {
    // If primary product fails (RSK-01 404 / dead link), fallback to alternatives
    const altRaw = await apiFetch<any>(`/api/v1/catalog/products/${productId}/alternatives`);
    const alts = altRaw.data ?? altRaw;
    const firstAlt = Array.isArray(alts) ? alts[0] : alts;
    if (!firstAlt) throw err;
    return {
      id: firstAlt.id ?? productId,
      title: firstAlt.title ?? 'Alternative Product',
      retailer: firstAlt.retailer ?? firstAlt.retailerName ?? 'Retailer Partner',
      priceCents: firstAlt.priceCents ?? firstAlt.price_cents ?? 0,
      inStock: firstAlt.inStock ?? firstAlt.in_stock ?? true,
      imageUrl: firstAlt.imageUrl ?? firstAlt.image_url ?? '',
      affiliateUrl: firstAlt.affiliateUrl ?? firstAlt.affiliate_url ?? getCommerceRedirectUrl(firstAlt.id),
      similarityScore: firstAlt.similarityScore ?? firstAlt.similarity_score ?? 0.9,
      isAlternative: true,
      dimensions: {
        widthCm: firstAlt.dimensions?.widthCm ?? firstAlt.dimensions?.width_cm ?? firstAlt.dimensionsCm?.width ?? 0,
        heightCm: firstAlt.dimensions?.heightCm ?? firstAlt.dimensions?.height_cm ?? firstAlt.dimensionsCm?.height ?? 0,
        depthCm: firstAlt.dimensions?.depthCm ?? firstAlt.dimensions?.depth_cm ?? firstAlt.dimensionsCm?.depth ?? 0,
      },
    };
  }
}

export function getCommerceRedirectUrl(productId: string): string {
  return `${API_BASE}/api/v1/commerce/redirect/${productId}`;
}

// ── Upload to Cloudflare R2 ──────────────────────────────────────────────────

/**
 * Uploads a sanitized Blob directly to Cloudflare R2 via a presigned PUT URL.
 * No API intermediary — direct S3-compatible upload.
 */
export async function uploadToR2(presignedUrl: string, blob: Blob): Promise<void> {
  const res = await fetch(presignedUrl, {
    method: 'PUT',
    body: blob,
    headers: {
      'Content-Type': blob.type || 'image/jpeg',
    },
  });

  if (!res.ok) {
    throw new Error(`R2 upload failed: ${res.status} ${res.statusText}`);
  }
}

// ── Privacy / Account ───────────────────────────────────────────────────────

export function triggerHardPurge(): Promise<void> {
  return apiFetch('/api/v1/privacy/purge-me', { method: 'DELETE' });
}

export interface AccountData {
  userId: string;
  email: string;
  hasActivePlan: boolean;
  planExpiresAt: string | null;
  createdAt: string;
}

export function fetchAccount(): Promise<AccountData> {
  return apiFetch<AccountData>('/api/v1/account');
}

// ── Checkout / Stripe ───────────────────────────────────────────────────────

export interface CreateCheckoutSessionResponse {
  sessionUrl: string;
}

export function createCheckoutSession(): Promise<CreateCheckoutSessionResponse> {
  return apiFetch<CreateCheckoutSessionResponse>(
    '/api/v1/billing/checkout-session',
    { method: 'POST' },
  );
}

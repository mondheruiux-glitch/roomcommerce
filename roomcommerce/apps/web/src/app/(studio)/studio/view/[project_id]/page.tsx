'use client';
import * as React from 'react';
import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchProject,
  fetchProductDetail,
  fetchProductAlternatives,
  getCommerceRedirectUrl,
} from '@/lib/api-client';
import { InteractiveCanvas } from '@/components/canvas/interactive-canvas';
import { AdsProductDrawer, AdsSkuSpecTable } from '@roomcommerce/ui';
import type { ProductDrawerData, ProductAlternativeItem } from '@roomcommerce/ui';
import { useCanvasStore } from '@/stores/use-canvas-store';

interface ViewPageProps {
  params: Promise<{ project_id: string }>;
}

export default function ViewPage({ params }: ViewPageProps) {
  const { project_id } = use(params);
  const {
    selectedHotspotId,
    isDrawerOpen,
    closeDrawer,
    showHotspots,
    toggleHotspots,
    isCompareMode,
    toggleCompareMode,
    swappedHotspotSkus,
    swapHotspotSku,
  } = useCanvasStore();

  // Fetch project data
  const { data: project, isLoading, isError } = useQuery({
    queryKey: ['project', project_id],
    queryFn: () => fetchProject(project_id),
    enabled: Boolean(project_id),
  });

  // Merge any live swapped SKU overrides onto project hotspots
  const effectiveHotspots = React.useMemo(() => {
    return (project?.hotspots ?? []).map((h) => {
      const swapped = swappedHotspotSkus[h.id];
      if (swapped) {
        return {
          ...h,
          productId: swapped.skuId,
          priceCents: swapped.priceCents,
        };
      }
      return h;
    });
  }, [project?.hotspots, swappedHotspotSkus]);

  // Find active hotspot (original or swapped)
  const activeHotspot = effectiveHotspots.find((h) => h.id === selectedHotspotId);
  const swappedActiveSku = selectedHotspotId ? swappedHotspotSkus[selectedHotspotId] : undefined;

  // Fetch active product detail when a hotspot is selected
  const { data: productDetail } = useQuery({
    queryKey: ['product', activeHotspot?.productId],
    queryFn: () => (activeHotspot?.productId ? fetchProductDetail(activeHotspot.productId) : null),
    enabled: Boolean(activeHotspot?.productId && project),
  });

  // Fetch alternatives for active product
  const { data: apiAlternatives } = useQuery({
    queryKey: ['product-alternatives', activeHotspot?.productId],
    queryFn: () => (activeHotspot?.productId ? fetchProductAlternatives(activeHotspot.productId) : []),
    enabled: Boolean(activeHotspot?.productId),
  });

  // Build ProductDrawerData from detail or swapped override
  const drawerProduct: ProductDrawerData | null = React.useMemo(() => {
    if (!selectedHotspotId) return null;

    if (swappedActiveSku) {
      return {
        hotspotId: selectedHotspotId,
        skuId: swappedActiveSku.skuId,
        retailerName: swappedActiveSku.retailer,
        title: swappedActiveSku.title,
        priceCents: swappedActiveSku.priceCents,
        inStock: true,
        imageUrl: swappedActiveSku.imageUrl || productDetail?.imageUrl || '',
        redirectUrl: swappedActiveSku.redirectUrl || getCommerceRedirectUrl(swappedActiveSku.skuId),
        similarityScore: productDetail?.similarityScore ?? 0.95,
        isAlternative: true,
        dimensionsCm: productDetail?.dimensions
          ? {
              width: productDetail.dimensions.widthCm,
              height: productDetail.dimensions.heightCm,
              depth: productDetail.dimensions.depthCm,
            }
          : { width: 180, depth: 85, height: 78 },
      };
    }

    if (!productDetail) return null;

    return {
      hotspotId: selectedHotspotId,
      skuId: productDetail.id,
      retailerName: productDetail.retailer,
      title: productDetail.title,
      priceCents: productDetail.priceCents,
      inStock: productDetail.inStock,
      imageUrl: productDetail.imageUrl,
      redirectUrl: getCommerceRedirectUrl(productDetail.id),
      similarityScore: productDetail.similarityScore,
      isAlternative: productDetail.isAlternative,
      dimensionsCm: {
        width: productDetail.dimensions.widthCm,
        height: productDetail.dimensions.heightCm,
        depth: productDetail.dimensions.depthCm,
      },
    };
  }, [selectedHotspotId, swappedActiveSku, productDetail]);

  // Compute deterministic catalog alternatives if endpoint returns empty (mock mode)
  const alternatives: ProductAlternativeItem[] = React.useMemo(() => {
    if (apiAlternatives && apiAlternatives.length > 0) {
      return apiAlternatives;
    }
    if (!drawerProduct) return [];

    const baseTitle = drawerProduct.title
      .replace(/Modern|Japandi|Linen|Leather|Accessible|Chair|Sofa|Table/gi, '')
      .trim();

    return [
      {
        skuId: `${drawerProduct.skuId}-alt-budget`,
        title: `Budget Essential ${baseTitle || 'Nordic'} Option`,
        retailer: 'IKEA',
        priceCents: Math.max(2999, Math.round(drawerProduct.priceCents * 0.72)),
        imageUrl: drawerProduct.imageUrl,
        matchScore: 0.89,
      },
      {
        skuId: `${drawerProduct.skuId}-alt-curated`,
        title: `Curated Artisan ${baseTitle || 'Comfort'} Choice`,
        retailer: 'Target',
        priceCents: Math.max(3499, Math.round(drawerProduct.priceCents * 0.86)),
        imageUrl: drawerProduct.imageUrl,
        matchScore: 0.93,
      },
    ];
  }, [apiAlternatives, drawerProduct]);

  // Live SKU Swapping handler
  const handleSwapSku = React.useCallback(
    (sku: { skuId: string; title: string; retailer: string; priceCents: number; imageUrl?: string }) => {
      if (!selectedHotspotId) return;
      swapHotspotSku(selectedHotspotId, {
        skuId: sku.skuId,
        title: sku.title,
        retailer: sku.retailer,
        priceCents: sku.priceCents,
        imageUrl: sku.imageUrl,
        redirectUrl: getCommerceRedirectUrl(sku.skuId),
      });
    },
    [selectedHotspotId, swapHotspotSku],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <p className="text-ink-muted text-sm">Loading render…</p>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <p className="text-status-danger text-sm">Failed to load project. Please try again.</p>
      </div>
    );
  }

  if (!project.renderUrl) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <p className="text-ink-muted text-sm">Render not available yet.</p>
      </div>
    );
  }

  // Real-time recalculation of total cart budget with active swaps
  const totalCartCents = effectiveHotspots.reduce(
    (sum: number, h: { priceCents?: number }) => sum + (h.priceCents || 0),
    0,
  );
  const formattedCartTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(totalCartCents / 100);

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)]">
      {/* ── Canvas toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-default bg-bg-surface flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleHotspots}
            aria-pressed={showHotspots}
            className="text-xs px-3 py-1.5 rounded-md border border-border-default text-ink-secondary hover:bg-bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta"
          >
            {showHotspots ? 'Hide Pins' : 'Show Pins'}
          </button>

          {/* Before/After Split Curtain Comparison Toggle */}
          <button
            onClick={toggleCompareMode}
            aria-pressed={isCompareMode}
            data-testid="toggle-compare-mode"
            className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta ${
              isCompareMode
                ? 'bg-brand-terracotta text-white shadow-xs'
                : 'border border-border-default text-ink-secondary bg-bg-surface hover:bg-bg-subtle hover:text-ink-primary'
            }`}
          >
            Compare Before / After
          </button>

          <div
            data-testid="cart-total-gauge"
            className="text-xs font-mono font-semibold text-ink-primary px-3 py-1.5 rounded-md bg-bg-subtle border border-border-default"
          >
            Total: {formattedCartTotal}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* SCR-08B: table view hash anchor */}
          <a
            href="#list"
            className="text-xs px-3 py-1.5 rounded-md border border-border-default text-ink-secondary hover:bg-bg-subtle transition-colors"
          >
            List View
          </a>
          <a
            href="/checkout"
            className="text-xs px-3 py-1.5 rounded-lg bg-brand-terracotta text-white font-semibold hover:bg-brand-terracotta-hover transition-colors shadow-xs"
          >
            Unlock Full Res
          </a>
        </div>
      </div>

      {/* ── Main canvas + drawer layout ───────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-hidden">
          <InteractiveCanvas
            renderedImageUrl={project.renderUrl}
            rawImageUrl={project.rawImageUrl}
            isWatermarked={project.isFreeUser}
            hotspots={effectiveHotspots}
            className="h-full"
          />
        </div>

        {/* Product Drawer — desktop sidebar (SCR-08A) */}
        <AdsProductDrawer
          product={drawerProduct}
          isOpen={isDrawerOpen}
          onClose={closeDrawer}
          alternatives={alternatives}
          onSwapSku={handleSwapSku}
        />
      </div>

      {/* ── SCR-08B: Accessible DOM list table ──────────────────────────── */}
      <section
        id="list"
        aria-labelledby="product-list-heading"
        className="border-t border-border-default px-4 py-8 bg-bg-canvas"
      >
        <h2 id="product-list-heading" className="text-lg font-bold text-ink-primary mb-4">
          Shoppable Product List
        </h2>
        <AdsSkuSpecTable
          products={effectiveHotspots.map((h, i) => {
            const swapped = swappedHotspotSkus[h.id];
            return {
              hotspotId: h.id,
              skuId: h.productId,
              retailerName: swapped?.retailer || 'Retailer Partner',
              title: swapped?.title || `${h.category || 'Product'} ${i + 1}`,
              priceCents: h.priceCents,
              inStock: true,
              imageUrl: swapped?.imageUrl || '',
              redirectUrl: swapped?.redirectUrl || getCommerceRedirectUrl(h.productId),
              similarityScore: 0.95,
              dimensionsCm: { width: 0, height: 0, depth: 0 },
            };
          })}
          onSelectProduct={(id: string) => useCanvasStore.getState().selectHotspot(id)}
        />
      </section>
    </div>
  );
}

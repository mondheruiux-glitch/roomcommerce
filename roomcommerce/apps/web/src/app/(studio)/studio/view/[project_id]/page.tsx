'use client';
import * as React from 'react';
import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchProject, fetchProductDetail, getCommerceRedirectUrl } from '@/lib/api-client';
import { InteractiveCanvas } from '@/components/canvas/interactive-canvas';
import { AdsProductDrawer, AdsSkuSpecTable } from '@roomcommerce/ui';
import type { ProductDrawerData } from '@roomcommerce/ui';
import { useCanvasStore } from '@/stores/use-canvas-store';

interface ViewPageProps {
  params: Promise<{ project_id: string }>;
}

export default function ViewPage({ params }: ViewPageProps) {
  const { project_id } = use(params);
  const { selectedHotspotId, isDrawerOpen, closeDrawer, showHotspots, toggleHotspots } =
    useCanvasStore();

  // Fetch project data
  const { data: project, isLoading, isError } = useQuery({
    queryKey: ['project', project_id],
    queryFn: () => fetchProject(project_id),
    enabled: Boolean(project_id),
  });

  // Fetch active product detail when a hotspot is selected
  const { data: productDetail } = useQuery({
    queryKey: ['product', selectedHotspotId],
    queryFn: () => {
      const hotspot = project?.hotspots.find((h: { id: string; productId: string }) => h.id === selectedHotspotId);
      return hotspot ? fetchProductDetail(hotspot.productId) : null;
    },
    enabled: Boolean(selectedHotspotId && project),
  });

  // Build ProductDrawerData from fetched detail
  const drawerProduct: ProductDrawerData | null = productDetail
    ? {
        hotspotId: selectedHotspotId ?? '',
        skuId: productDetail.id,
        retailerName: productDetail.retailer,
        title: productDetail.title,
        priceCents: productDetail.priceCents,
        inStock: productDetail.inStock,
        imageUrl: productDetail.imageUrl,
        redirectUrl: getCommerceRedirectUrl(productDetail.id),
        similarityScore: productDetail.similarityScore,
        dimensionsCm: {
          width: productDetail.dimensions.widthCm,
          height: productDetail.dimensions.heightCm,
          depth: productDetail.dimensions.depthCm,
        },
      }
    : null;

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

  const totalCartCents = (project.hotspots ?? []).reduce(
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
            className="text-xs px-3 py-1.5 rounded-md border border-border-default text-ink-secondary hover:bg-bg-subtle transition-colors"
          >
            {showHotspots ? 'Hide Pins' : 'Show Pins'}
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
            className="text-xs px-3 py-1.5 rounded-lg bg-brand-terracotta text-white font-semibold hover:opacity-90 transition-opacity"
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
            isWatermarked={project.isFreeUser}
            hotspots={project.hotspots}
            className="h-full"
          />
        </div>

        {/* Product Drawer — desktop sidebar (SCR-08A) */}
        <AdsProductDrawer
          product={drawerProduct}
          isOpen={isDrawerOpen}
          onClose={closeDrawer}
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
          products={project.hotspots.map((h: { id: string; productId: string; priceCents: number; category?: string }, i: number) => ({
            hotspotId: h.id,
            skuId: h.productId,
            retailerName: 'Retailer Partner',
            title: `${h.category || 'Product'} ${i + 1}`,
            priceCents: h.priceCents,
            inStock: true,
            imageUrl: '',
            redirectUrl: getCommerceRedirectUrl(h.productId),
            similarityScore: 0.95,
            dimensionsCm: { width: 0, height: 0, depth: 0 },
          }))}
          onSelectProduct={(id: string) => useCanvasStore.getState().selectHotspot(id)}
        />
      </section>
    </div>
  );
}

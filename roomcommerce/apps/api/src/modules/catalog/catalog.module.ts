import { Module } from '@nestjs/common';
import { VectorRetrievalService } from './vector/vector-retrieval.service.js';
import { QdrantInitService } from './vector/qdrant-init.service.js';
import { CatalogSyncService } from './sync/catalog-sync.service.js';
import { AmazonStockAdapter } from './sync/adapters/amazon.adapter.js';
import { WayfairStockAdapter } from './sync/adapters/wayfair.adapter.js';
import { TargetStockAdapter } from './sync/adapters/target.adapter.js';
import { IkeaStockAdapter } from './sync/adapters/ikea.adapter.js';
import { CompositeStockCheckerAdapter } from './sync/adapters/composite-stock-checker.adapter.js';
import { CatalogController } from './catalog.controller.js';

@Module({
  controllers: [CatalogController],
  providers: [
    VectorRetrievalService,
    QdrantInitService,
    // Stock checker adapters — one per retailer
    AmazonStockAdapter,
    WayfairStockAdapter,
    TargetStockAdapter,
    IkeaStockAdapter,
    CompositeStockCheckerAdapter,
    // Inject composite adapter as the IStockCheckerAdapter for CatalogSyncService
    {
      provide: CatalogSyncService,
      useFactory: (composite: CompositeStockCheckerAdapter) => new CatalogSyncService(composite),
      inject: [CompositeStockCheckerAdapter],
    },
  ],
  exports: [VectorRetrievalService, QdrantInitService, CatalogSyncService],
})
export class CatalogModule {}

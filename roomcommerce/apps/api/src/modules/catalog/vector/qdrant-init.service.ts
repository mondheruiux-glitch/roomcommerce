import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createQdrantClient, QdrantClient } from './qdrant.client.js';

@Injectable()
export class QdrantInitService implements OnModuleInit {
  private readonly logger = new Logger(QdrantInitService.name);
  private readonly client: QdrantClient = createQdrantClient();

  // Collection constants — single source of truth for all catalog services
  public static readonly COLLECTION_NAME = 'retail_catalog_v1';
  public static readonly VECTOR_SIZE = 768; // SigLIP-SO400M multimodal embedding dims

  async onModuleInit() {
    await this.ensureCollectionExists();
  }

  async ensureCollectionExists(): Promise<void> {
    const { collections } = await this.client.getCollections();
    const exists = collections.some((c) => c.name === QdrantInitService.COLLECTION_NAME);

    if (!exists) {
      this.logger.log(`Creating Qdrant collection: ${QdrantInitService.COLLECTION_NAME}`);
      await this.client.createCollection(QdrantInitService.COLLECTION_NAME, {
        vectors: {
          size: QdrantInitService.VECTOR_SIZE,
          distance: 'Cosine',
        },
        // HNSW tuning for <= 50ms retrieval latency (NFR-03)
        hnsw_config: {
          m: 16,
          ef_construct: 128,
          full_scan_threshold: 10000,
        },
        optimizers_config: {
          default_segment_number: 4,
          indexing_threshold: 20000,
        },
      });

      await this.createPayloadIndexes();
      this.logger.log(
        `Qdrant collection "${QdrantInitService.COLLECTION_NAME}" + payload indexes ready.`,
      );
    } else {
      this.logger.log(
        `Qdrant collection "${QdrantInitService.COLLECTION_NAME}" already exists — skipping creation.`,
      );
    }
  }

  private async createPayloadIndexes(): Promise<void> {
    const fields: Array<{ field_name: string; field_schema: 'keyword' | 'integer' | 'bool' }> = [
      { field_name: 'sku_id', field_schema: 'keyword' },
      { field_name: 'retailer_id', field_schema: 'keyword' },
      { field_name: 'category', field_schema: 'keyword' },
      { field_name: 'price_cents', field_schema: 'integer' },
      { field_name: 'in_stock', field_schema: 'bool' },
      { field_name: 'last_sync_timestamp', field_schema: 'integer' },
    ];

    for (const field of fields) {
      await this.client.createPayloadIndex(QdrantInitService.COLLECTION_NAME, {
        field_name: field.field_name,
        field_schema: field.field_schema,
      });
      this.logger.debug(`Payload index created: ${field.field_name} (${field.field_schema})`);
    }
  }
}

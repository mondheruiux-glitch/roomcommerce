import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * Singleton Qdrant REST client.
 * Consumed by QdrantInitService, VectorRetrievalService, and CatalogSyncService.
 */
export function createQdrantClient(): QdrantClient {
  const url = process.env['QDRANT_URL'] ?? 'http://localhost:6333';
  const apiKey = process.env['QDRANT_API_KEY'];

  return new QdrantClient({ url, apiKey });
}

export { QdrantClient };

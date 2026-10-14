/**
 * Stock checker result interface — abstracts over Impact Radius, CJ, Amazon PA-API adapters
 */
export interface StockCheckResult {
  inStock: boolean;
  /** Updated price in cents if the merchant reported a change */
  updatedPriceCents?: number;
}

/**
 * Stock checker contract — implement per merchant for live feed integration.
 * In Phase 1 (Plan 02), this returns mock data; real adapters built in Plan 04.
 */
export interface IStockCheckerAdapter {
  checkStock(retailerId: string, sku: string): Promise<StockCheckResult>;
}

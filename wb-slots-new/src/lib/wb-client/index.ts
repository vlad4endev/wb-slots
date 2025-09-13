import { WBSuppliesClient } from './supplies-client';
import { WBMarketplaceClient } from './marketplace-client';
import { TOKEN_CATEGORY_TO_BASE_URL } from './types';
import { TokenCategory } from '@prisma/client';

export class WBClientFactory {
  /**
   * Create WB client based on token category
   */
  static createClient(category: TokenCategory, token: string) {
    switch (category) {
      case 'SUPPLIES':
        return new WBSuppliesClient(token);
      case 'MARKETPLACE':
        return new WBMarketplaceClient(token);
      default:
        throw new Error(`Unsupported token category: ${category}`);
    }
  }

  /**
   * Create supplies client
   */
  static createSuppliesClient(token: string): WBSuppliesClient {
    return new WBSuppliesClient(token);
  }

  /**
   * Create marketplace client
   */
  static createMarketplaceClient(token: string): WBMarketplaceClient {
    return new WBMarketplaceClient(token);
  }
}

// Re-export types and classes
export * from './types';
export * from './base-client';
export * from './supplies-client';
export * from './marketplace-client';

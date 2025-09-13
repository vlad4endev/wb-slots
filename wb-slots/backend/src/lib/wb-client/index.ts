import { WBSuppliesClient } from './supplies-client';
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
}

// Re-export types and classes
export * from './types';
export * from './base-client';
export * from './supplies-client';

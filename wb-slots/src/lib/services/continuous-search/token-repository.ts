import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { WBClientFactory } from '@/lib/wb-client';
import type { WBSuppliesClient } from '@/lib/wb-client';

/**
 * Repository для работы с токенами пользователей
 * Отвечает за получение и расшифровку токенов
 */
export class TokenRepository {
  /**
   * Получить активный SUPPLIES токен пользователя и создать клиент WB
   */
  async getSuppliesClient(userId: string): Promise<WBSuppliesClient> {
    const suppliesToken = await prisma.userToken.findFirst({
      where: {
        userId,
        category: 'SUPPLIES',
        isActive: true,
      },
    });

    if (!suppliesToken) {
      throw new Error('No active SUPPLIES token found');
    }

    const decryptedToken = decrypt(suppliesToken.tokenEncrypted);
    return WBClientFactory.createSuppliesClient(decryptedToken);
  }
}


import { getTelegramService } from '../notifications/telegram-service';
import { NotificationType } from '../notifications/telegram-config';

export interface CaptchaDetection {
  isCaptcha: boolean;
  captchaType?: 'image' | 'recaptcha' | 'hcaptcha' | 'unknown';
  captchaUrl?: string;
  captchaId?: string;
  challengeData?: any;
  detectedAt: Date;
}

export interface CaptchaNotification {
  userId: string;
  taskName: string;
  supplyName: string;
  supplyId: string;
  warehouseName: string;
  slotDate: string;
  slotTime: string;
  coefficient: number;
  captchaType: string;
  captchaUrl?: string;
  detectedAt: Date;
}

export class CaptchaService {
  private static instance: CaptchaService;
  private activeCaptchas: Map<string, CaptchaDetection> = new Map();

  private constructor() {}

  public static getInstance(): CaptchaService {
    if (!CaptchaService.instance) {
      CaptchaService.instance = new CaptchaService();
    }
    return CaptchaService.instance;
  }

  /**
   * Обнаруживает капчу на странице
   */
  detectCaptcha(page: any, url: string): CaptchaDetection {
    try {
      const detection: CaptchaDetection = {
        isCaptcha: false,
        detectedAt: new Date(),
      };

      // Проверяем различные типы капчи
      const captchaSelectors = [
        // reCAPTCHA
        'iframe[src*="recaptcha"]',
        '.g-recaptcha',
        '#recaptcha',
        '[data-sitekey]',
        
        // hCaptcha
        'iframe[src*="hcaptcha"]',
        '.h-captcha',
        '#hcaptcha',
        
        // Обычная капча
        'img[src*="captcha"]',
        'img[alt*="captcha" i]',
        'img[alt*="капча" i]',
        '.captcha',
        '#captcha',
        
        // Текстовые индикаторы
        'text*="captcha" i',
        'text*="капча" i',
        'text*="verification" i',
        'text*="verification code" i',
      ];

      // Проверяем наличие элементов капчи
      for (const selector of captchaSelectors) {
        const elements = page.$$(selector);
        if (elements && elements.length > 0) {
          detection.isCaptcha = true;
          
          // Определяем тип капчи
          if (selector.includes('recaptcha')) {
            detection.captchaType = 'recaptcha';
          } else if (selector.includes('hcaptcha')) {
            detection.captchaType = 'hcaptcha';
          } else if (selector.includes('img')) {
            detection.captchaType = 'image';
          } else {
            detection.captchaType = 'unknown';
          }
          
          // Получаем URL капчи для изображений
          if (detection.captchaType === 'image') {
            const imgElement = elements[0];
            const src = imgElement.getAttribute('src');
            if (src) {
              detection.captchaUrl = src.startsWith('http') ? src : new URL(src, url).href;
            }
          }
          
          // Получаем ID капчи
          const captchaId = elements[0].getAttribute('id') || 
                           elements[0].getAttribute('data-sitekey') ||
                           elements[0].getAttribute('name');
          if (captchaId) {
            detection.captchaId = captchaId;
          }
          
          break;
        }
      }

      // Проверяем текст страницы на наличие упоминаний капчи
      if (!detection.isCaptcha) {
        const pageText = page.textContent?.toLowerCase() || '';
        const captchaKeywords = [
          'captcha',
          'капча',
          'verification',
          'verification code',
          'security check',
          'prove you are human',
          'robot check',
          'anti-bot',
        ];
        
        for (const keyword of captchaKeywords) {
          if (pageText.includes(keyword)) {
            detection.isCaptcha = true;
            detection.captchaType = 'unknown';
            break;
          }
        }
      }

      // Проверяем URL на наличие параметров капчи
      if (!detection.isCaptcha) {
        const urlObj = new URL(url);
        const captchaParams = ['captcha', 'recaptcha', 'hcaptcha', 'verify'];
        
        for (const param of captchaParams) {
          if (urlObj.searchParams.has(param)) {
            detection.isCaptcha = true;
            detection.captchaType = 'unknown';
            break;
          }
        }
      }

      if (detection.isCaptcha) {
        console.warn(`🤖 Captcha detected: ${detection.captchaType} at ${url}`);
      }

      return detection;
    } catch (error) {
      console.error('❌ Captcha detection error:', error);
      return {
        isCaptcha: false,
        detectedAt: new Date(),
      };
    }
  }

  /**
   * Обрабатывает обнаруженную капчу
   */
  async handleCaptcha(
    detection: CaptchaDetection,
    context: {
      userId: string;
      taskName: string;
      supplyName: string;
      supplyId: string;
      warehouseName: string;
      slotDate: string;
      slotTime: string;
      coefficient: number;
    }
  ): Promise<void> {
    try {
      if (!detection.isCaptcha) {
        return;
      }

      // Сохраняем информацию о капче
      const captchaKey = `${context.userId}:${context.taskName}:${Date.now()}`;
      this.activeCaptchas.set(captchaKey, detection);

      // Отправляем уведомление в Telegram
      await this.sendCaptchaNotification({
        userId: context.userId,
        taskName: context.taskName,
        supplyName: context.supplyName,
        supplyId: context.supplyId,
        warehouseName: context.warehouseName,
        slotDate: context.slotDate,
        slotTime: context.slotTime,
        coefficient: context.coefficient,
        captchaType: detection.captchaType || 'unknown',
        captchaUrl: detection.captchaUrl,
        detectedAt: detection.detectedAt,
      });

      console.log(`📱 Captcha notification sent to user ${context.userId}`);

    } catch (error) {
      console.error('❌ Captcha handling error:', error);
    }
  }

  /**
   * Отправляет уведомление о капче в Telegram
   */
  private async sendCaptchaNotification(notification: CaptchaNotification): Promise<void> {
    try {
      if (!getTelegramService().isInitialized()) {
        console.warn('⚠️ Telegram service not initialized. Skipping captcha notification.');
        return;
      }

      const user = getTelegramService().getUser(notification.userId);
      if (!user || !user.isActive) {
        console.warn(`⚠️ User ${notification.userId} not registered or inactive. Skipping captcha notification.`);
        return;
      }

      const success = await getTelegramService().sendNotification(
        notification.userId,
        NotificationType.BOOKING_CAPTCHA,
        {
          supplyName: notification.supplyName,
          supplyId: notification.supplyId,
          warehouseName: notification.warehouseName,
          slotDate: notification.slotDate,
          slotTime: notification.slotTime,
          coefficient: notification.coefficient.toString(),
          taskName: notification.taskName,
        }
      );

      if (success) {
        console.log(`✅ Captcha notification sent to user ${notification.userId}`);
      } else {
        console.error(`❌ Failed to send captcha notification to user ${notification.userId}`);
      }
    } catch (error) {
      console.error('❌ Error sending captcha notification:', error);
    }
  }

  /**
   * Проверяет, есть ли активная капча для пользователя
   */
  hasActiveCaptcha(userId: string, taskName?: string): boolean {
    for (const [key, detection] of this.activeCaptchas) {
      if (key.startsWith(`${userId}:`)) {
        if (!taskName || key.includes(taskName)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Получает информацию об активной капче
   */
  getActiveCaptcha(userId: string, taskName?: string): CaptchaDetection | null {
    for (const [key, detection] of this.activeCaptchas) {
      if (key.startsWith(`${userId}:`)) {
        if (!taskName || key.includes(taskName)) {
          return detection;
        }
      }
    }
    return null;
  }

  /**
   * Очищает информацию о капче
   */
  clearCaptcha(userId: string, taskName?: string): boolean {
    const keysToDelete: string[] = [];
    
    for (const key of this.activeCaptchas.keys()) {
      if (key.startsWith(`${userId}:`)) {
        if (!taskName || key.includes(taskName)) {
          keysToDelete.push(key);
        }
      }
    }

    for (const key of keysToDelete) {
      this.activeCaptchas.delete(key);
    }

    return keysToDelete.length > 0;
  }

  /**
   * Очищает старые записи о капче
   */
  cleanupOldCaptchas(maxAge: number = 30 * 60 * 1000): number { // 30 минут по умолчанию
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, detection] of this.activeCaptchas) {
      if (now - detection.detectedAt.getTime() > maxAge) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.activeCaptchas.delete(key);
    }

    if (keysToDelete.length > 0) {
      console.log(`🧹 Cleaned up ${keysToDelete.length} old captcha records`);
    }

    return keysToDelete.length;
  }

  /**
   * Получает статистику капчи
   */
  getCaptchaStats(): {
    total: number;
    byType: Record<string, number>;
    byUser: Record<string, number>;
  } {
    const stats = {
      total: this.activeCaptchas.size,
      byType: {} as Record<string, number>,
      byUser: {} as Record<string, number>,
    };

    for (const [key, detection] of this.activeCaptchas) {
      // Статистика по типам
      const type = detection.captchaType || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // Статистика по пользователям
      const userId = key.split(':')[0];
      stats.byUser[userId] = (stats.byUser[userId] || 0) + 1;
    }

    return stats;
  }

  /**
   * Проверяет, нужно ли ждать решения капчи
   */
  shouldWaitForCaptcha(userId: string, taskName?: string): boolean {
    const captcha = this.getActiveCaptcha(userId, taskName);
    if (!captcha) {
      return false;
    }

    // Ждем не более 10 минут
    const maxWaitTime = 10 * 60 * 1000;
    const age = Date.now() - captcha.detectedAt.getTime();
    
    return age < maxWaitTime;
  }

  /**
   * Получает время ожидания до истечения капчи
   */
  getCaptchaWaitTime(userId: string, taskName?: string): number {
    const captcha = this.getActiveCaptcha(userId, taskName);
    if (!captcha) {
      return 0;
    }

    const maxWaitTime = 10 * 60 * 1000; // 10 минут
    const age = Date.now() - captcha.detectedAt.getTime();
    const remaining = maxWaitTime - age;
    
    return Math.max(0, remaining);
  }
}

// Экспортируем singleton instance
export const captchaService = CaptchaService.getInstance();

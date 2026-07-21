import { Page } from 'playwright';
import { Logger } from '../logging/logger';
import { WB_SELECTORS } from '../utils/wb-auth-selectors';

/**
 * Сервис для авторизации WB по номеру телефона
 */

export interface PhoneAuthConfig {
  phoneNumber: string;
  smsCode?: string;
  timeout?: number;
}

export interface PhoneAuthResult {
  success: boolean;
  step: 'phone_entered' | 'sms_sent' | 'sms_entered' | 'authenticated' | 'failed';
  message: string;
  error?: string;
}

export class WBPhoneAuthService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  /**
   * Выполняет авторизацию по номеру телефона
   */
  async authenticateWithPhone(page: Page, config: PhoneAuthConfig): Promise<PhoneAuthResult> {
    try {
      this.logger.info('📱 Starting phone authentication', { phone: config.phoneNumber });

      // Шаг 1: Ввод номера телефона
      const phoneResult = await this.enterPhoneNumber(page, config.phoneNumber);
      if (!phoneResult.success) {
        return phoneResult;
      }

      // Ждем появления поля для SMS кода
      await page.waitForTimeout(3000);

      // Шаг 2: Ввод SMS кода (если предоставлен)
      if (config.smsCode) {
        const smsResult = await this.enterSMSCode(page, config.smsCode);
        if (!smsResult.success) {
          return smsResult;
        }

        // Ждем завершения авторизации
        await page.waitForTimeout(5000);

        // Проверяем успешность авторизации
        const currentUrl = page.url();
        if (currentUrl.includes('seller.wildberries.ru') && !currentUrl.includes('/login')) {
          return {
            success: true,
            step: 'authenticated',
            message: 'Авторизация по номеру телефона успешна'
          };
        }
      }

      return {
        success: true,
        step: 'sms_sent',
        message: 'Номер телефона введен, ожидается SMS код'
      };

    } catch (error) {
      this.logger.error('❌ Phone authentication failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        success: false,
        step: 'failed',
        message: 'Ошибка авторизации по номеру телефона',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Вводит номер телефона
   */
  private async enterPhoneNumber(page: Page, phoneNumber: string): Promise<PhoneAuthResult> {
    try {
      this.logger.info('📱 Entering phone number', { phone: phoneNumber });

      // Ждем появления поля ввода номера
      await page.waitForSelector(WB_SELECTORS.AUTH.PHONE_INPUT, { timeout: 10000 });

      // Очищаем поле и вводим номер
      await page.fill(WB_SELECTORS.AUTH.PHONE_INPUT, '');
      await page.type(WB_SELECTORS.AUTH.PHONE_INPUT, phoneNumber);

      // Нажимаем кнопку входа
      await page.click(WB_SELECTORS.AUTH.LOGIN_BUTTON);

      this.logger.info('✅ Phone number entered successfully');
      return {
        success: true,
        step: 'phone_entered',
        message: 'Номер телефона введен'
      };

    } catch (error) {
      this.logger.error('❌ Failed to enter phone number', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        success: false,
        step: 'failed',
        message: 'Ошибка ввода номера телефона',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Вводит SMS код
   */
  private async enterSMSCode(page: Page, smsCode: string): Promise<PhoneAuthResult> {
    try {
      this.logger.info('📱 Entering SMS code', { codeLength: smsCode.length });

      // Ждем появления поля для SMS кода
      await page.waitForSelector(WB_SELECTORS.AUTH.SMS_CODE_INPUT, { timeout: 15000 });

      // Вводим SMS код
      await page.fill(WB_SELECTORS.AUTH.SMS_CODE_INPUT, smsCode);

      // Нажимаем кнопку подтверждения
      await page.click(WB_SELECTORS.AUTH.SMS_SEND_BUTTON);

      this.logger.info('✅ SMS code entered successfully');
      return {
        success: true,
        step: 'sms_entered',
        message: 'SMS код введен'
      };

    } catch (error) {
      this.logger.error('❌ Failed to enter SMS code', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        success: false,
        step: 'failed',
        message: 'Ошибка ввода SMS кода',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Проверяет, появилось ли поле для SMS кода
   */
  async isSMSCodeFieldVisible(page: Page): Promise<boolean> {
    try {
      await page.waitForSelector(WB_SELECTORS.AUTH.SMS_CODE_INPUT, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ждет SMS код от пользователя
   */
  async waitForSMSCode(page: Page, timeout: number = 300000): Promise<string | null> {
    try {
      this.logger.info('⏳ Waiting for SMS code field to appear');
      
      // Ждем появления поля для SMS кода
      await page.waitForSelector(WB_SELECTORS.AUTH.SMS_CODE_INPUT, { timeout });
      
      this.logger.info('📱 SMS code field appeared, waiting for user input');
      
      // Здесь можно добавить логику для автоматического получения SMS кода
      // или ожидания ввода от пользователя
      
      return null; // Пока возвращаем null, так как нужен ввод от пользователя
      
    } catch (error) {
      this.logger.error('❌ Timeout waiting for SMS code field', { error: error instanceof Error ? error.message : 'Unknown error' });
      return null;
    }
  }
}

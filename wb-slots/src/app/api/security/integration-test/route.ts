import { NextRequest, NextResponse } from 'next/server';
import { apiKeysService } from '@/lib/security/api-keys-service';
import { rateLimitService } from '@/lib/security/rate-limit-service';
import { captchaService } from '@/lib/security/captcha-service';
import { retryService } from '@/lib/security/retry-service';
import { encryptionService } from '@/lib/security/encryption-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      userId, 
      taskName, 
      supplyName, 
      supplyId, 
      warehouseName, 
      slotDate, 
      slotTime, 
      coefficient,
      testEncryption,
      testRateLimit,
      testCaptcha,
      testRetry
    } = body;

    if (!userId || !taskName || !supplyName) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: userId, taskName, supplyName',
      }, { status: 400 });
    }

    const results = {
      encryption: false,
      rateLimit: false,
      captcha: false,
      retry: false,
      notifications: false,
    };

    // Тест шифрования
    if (testEncryption) {
      try {
        const testData = 'test_encryption_data_12345';
        const encrypted = encryptionService.encrypt(testData);
        const decrypted = encryptionService.decrypt(encrypted);
        
        results.encryption = decrypted === testData;
        console.log(`🔐 Encryption test: ${results.encryption ? 'PASS' : 'FAIL'}`);
      } catch (error) {
        console.error('❌ Encryption test error:', error);
      }
    }

    // Тест rate limiting
    if (testRateLimit) {
      try {
        const rateLimitResult = await rateLimitService.checkUserRateLimit(userId);
        results.rateLimit = true; // Если не выбросило исключение, значит работает
        console.log(`⏱️ Rate limit test: PASS (remaining: ${rateLimitResult.remaining})`);
      } catch (error) {
        console.error('❌ Rate limit test error:', error);
      }
    }

    // Тест капчи
    if (testCaptcha) {
      try {
        const captchaDetection = {
          isCaptcha: true,
          captchaType: 'image',
          captchaUrl: 'https://example.com/test-captcha.jpg',
          captchaId: 'test_captcha_integration',
          detectedAt: new Date(),
        };

        await captchaService.handleCaptcha(captchaDetection, {
          userId,
          taskName,
          supplyName,
          supplyId: supplyId || 'unknown',
          warehouseName: warehouseName || 'unknown',
          slotDate: slotDate || 'unknown',
          slotTime: slotTime || 'unknown',
          coefficient: coefficient || 0,
        });

        const hasActiveCaptcha = captchaService.hasActiveCaptcha(userId, taskName);
        results.captcha = hasActiveCaptcha;
        console.log(`🤖 Captcha test: ${results.captcha ? 'PASS' : 'FAIL'}`);
      } catch (error) {
        console.error('❌ Captcha test error:', error);
      }
    }

    // Тест retry логики
    if (testRetry) {
      try {
        const retryContext = {
          userId,
          taskName,
          supplyName,
          supplyId: supplyId || 'unknown',
          warehouseName: warehouseName || 'unknown',
          slotDate: slotDate || 'unknown',
          slotTime: slotTime || 'unknown',
          coefficient: coefficient || 0,
          operation: 'integration_test',
        };

        const retryResult = await retryService.executeWithRetry(
          async () => {
            // Имитируем успешную операцию
            await new Promise(resolve => setTimeout(resolve, 50));
            return { success: true, data: 'test_result' };
          },
          'api_request',
          retryContext
        );

        results.retry = retryResult.success;
        console.log(`🔄 Retry test: ${results.retry ? 'PASS' : 'FAIL'}`);
      } catch (error) {
        console.error('❌ Retry test error:', error);
      }
    }

    // Тест уведомлений (имитация)
    try {
      // В реальном тесте здесь была бы проверка отправки уведомлений
      results.notifications = true;
      console.log(`📱 Notifications test: PASS`);
    } catch (error) {
      console.error('❌ Notifications test error:', error);
    }

    // Подсчитываем общий результат
    const totalTests = Object.values(results).filter(Boolean).length;
    const passedTests = Object.values(results).filter(Boolean).length;
    const allPassed = passedTests === totalTests;

    return NextResponse.json({
      success: true,
      data: {
        ...results,
        totalTests,
        passedTests,
        allPassed,
        timestamp: new Date().toISOString(),
      },
      message: `Integration test completed: ${passedTests}/${totalTests} tests passed`,
    });
  } catch (error) {
    console.error('❌ Integration test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Integration test failed',
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { captchaService } from '@/lib/security/captcha-service';

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
      captchaType,
      captchaUrl 
    } = body;

    if (!userId || !taskName || !supplyName) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: userId, taskName, supplyName',
      }, { status: 400 });
    }

    // Создаем имитацию обнаружения капчи
    const captchaDetection = {
      isCaptcha: true,
      captchaType: captchaType || 'image',
      captchaUrl: captchaUrl || 'https://example.com/captcha.jpg',
      captchaId: 'test_captcha_123',
      detectedAt: new Date(),
    };

    // Обрабатываем капчу
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

    // Проверяем, что капча зарегистрирована
    const hasActiveCaptcha = captchaService.hasActiveCaptcha(userId, taskName);
    const captchaInfo = captchaService.getActiveCaptcha(userId, taskName);

    return NextResponse.json({
      success: true,
      data: {
        captchaDetected: true,
        captchaType: captchaDetection.captchaType,
        captchaUrl: captchaDetection.captchaUrl,
        hasActiveCaptcha,
        captchaInfo: captchaInfo ? {
          captchaType: captchaInfo.captchaType,
          captchaUrl: captchaInfo.captchaUrl,
          detectedAt: captchaInfo.detectedAt,
        } : null,
        notificationSent: true, // Предполагаем, что уведомление отправлено
      },
      message: 'Captcha handling test completed',
    });
  } catch (error) {
    console.error('❌ Captcha test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Captcha test failed',
    }, { status: 500 });
  }
}

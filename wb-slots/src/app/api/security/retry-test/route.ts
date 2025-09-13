import { NextRequest, NextResponse } from 'next/server';
import { retryService, RetryContext } from '@/lib/security/retry-service';

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
      simulateErrors,
      maxRetries = 3
    } = body;

    if (!userId || !taskName || !supplyName) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: userId, taskName, supplyName',
      }, { status: 400 });
    }

    // Создаем контекст для retry
    const retryContext: RetryContext = {
      userId,
      taskName,
      supplyName,
      supplyId: supplyId || 'unknown',
      warehouseName: warehouseName || 'unknown',
      slotDate: slotDate || 'unknown',
      slotTime: slotTime || 'unknown',
      coefficient: coefficient || 0,
      operation: 'test_retry',
    };

    let attemptCount = 0;
    let notificationsSent = 0;

    // Выполняем операцию с retry логикой
    const retryResult = await retryService.executeWithRetry(
      async () => {
        attemptCount++;
        
        // Имитируем ошибки для тестирования
        if (simulateErrors && attemptCount < maxRetries) {
          const errors = [
            'RATE_LIMIT_EXCEEDED',
            'NETWORK_ERROR',
            'TIMEOUT',
            'SERVER_ERROR',
          ];
          const randomError = errors[Math.floor(Math.random() * errors.length)];
          throw new Error(randomError);
        }

        // Имитируем успешное выполнение
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
          success: true,
          result: 'Test operation completed successfully',
          attempt: attemptCount,
        };
      },
      'api_request',
      retryContext
    );

    // Подсчитываем отправленные уведомления (имитация)
    if (retryResult.attempts > 1) {
      notificationsSent = retryResult.attempts - 1; // Уведомления о повторных попытках
    }
    if (!retryResult.success) {
      notificationsSent++; // Уведомление о неудаче
    } else {
      notificationsSent++; // Уведомление об успехе
    }

    return NextResponse.json({
      success: true,
      data: {
        retryResult: {
          success: retryResult.success,
          attempts: retryResult.attempts,
          totalTime: retryResult.totalTime,
          error: retryResult.error,
        },
        attemptCount,
        notificationsSent,
        retryContext: {
          userId: retryContext.userId,
          taskName: retryContext.taskName,
          operation: retryContext.operation,
        },
      },
      message: 'Retry logic test completed',
    });
  } catch (error) {
    console.error('❌ Retry test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Retry test failed',
    }, { status: 500 });
  }
}

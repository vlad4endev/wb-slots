import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { WBAuthPopupService } from '@/lib/services/wb-auth-popup-service';

// Глобальный экземпляр сервиса
let authPopupService: WBAuthPopupService | null = null;

function getAuthPopupService(): WBAuthPopupService {
  if (!authPopupService) {
    authPopupService = new WBAuthPopupService();
  }
  return authPopupService;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { action } = body;

    const service = getAuthPopupService();

    if (action === 'start') {
      // Проверяем, не запущен ли уже popup
      if (service.isPopupActive()) {
        return NextResponse.json({
          success: false,
          error: 'Popup авторизации уже запущен'
        }, { status: 409 });
      }

      // Запускаем popup авторизацию
      await service.startAuthPopup({
        userId: user.id,
        onSuccess: (sessionData) => {
          console.log('✅ Auth popup success:', sessionData);
        },
        onError: (error) => {
          console.error('❌ Auth popup error:', error);
        },
        onProgress: (message) => {
          console.log('📝 Auth popup progress:', message);
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Popup авторизации запущен'
      });

    } else if (action === 'close') {
      // Закрываем popup
      await service.closePopup();

      return NextResponse.json({
        success: true,
        message: 'Popup авторизации закрыт'
      });

    } else if (action === 'status') {
      // Проверяем статус popup
      return NextResponse.json({
        success: true,
        data: {
          isActive: service.isPopupActive()
        }
      });

    } else if (action === 'force-save') {
      // Принудительное сохранение сессии
      if (!service.isPopupActive()) {
        return NextResponse.json({
          success: false,
          error: 'Popup не активен'
        }, { status: 400 });
      }

      try {
        await service.forceSaveSession();
        return NextResponse.json({
          success: true,
          message: 'Сессия сохранена принудительно'
        });
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 500 });
      }

    } else {
      return NextResponse.json({
        success: false,
        error: 'Неверное действие'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('WB Auth Popup API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const service = getAuthPopupService();

    return NextResponse.json({
      success: true,
      data: {
        isActive: service.isPopupActive(),
        userId: user.id
      }
    });

  } catch (error) {
    console.error('WB Auth Popup Status API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

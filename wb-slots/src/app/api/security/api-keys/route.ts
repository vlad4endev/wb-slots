import { NextRequest, NextResponse } from 'next/server';
import { apiKeysService } from '@/lib/security/api-keys-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, keyType, keyName, keyValue, description, expiresAt, metadata } = body;

    if (!userId || !keyType || !keyName || !keyValue) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: userId, keyType, keyName, keyValue',
      }, { status: 400 });
    }

    const storedKey = await apiKeysService.storeApiKey({
      userId,
      keyType,
      keyName,
      keyValue,
      description,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      metadata,
      isActive: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: storedKey.id,
        keyType: storedKey.keyType,
        keyName: storedKey.keyName,
        description: storedKey.description,
        isActive: storedKey.isActive,
        expiresAt: storedKey.expiresAt,
        createdAt: storedKey.createdAt,
        // Не возвращаем зашифрованные данные
      },
      message: 'API key stored successfully',
    });
  } catch (error) {
    console.error('❌ Error storing API key:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to store API key',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const keyType = searchParams.get('keyType');
    const keyName = searchParams.get('keyName');

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId is required',
      }, { status: 400 });
    }

    if (keyName) {
      // Получить конкретный ключ
      const keyValue = await apiKeysService.getApiKey(userId, keyType || '', keyName);
      
      if (!keyValue) {
        return NextResponse.json({
          success: false,
          error: 'API key not found',
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: {
          keyValue,
          keyType: keyType || '',
          keyName,
        },
      });
    } else {
      // Получить все ключи пользователя
      const keys = await apiKeysService.getUserApiKeys(userId);
      
      return NextResponse.json({
        success: true,
        data: keys,
      });
    }
  } catch (error) {
    console.error('❌ Error retrieving API keys:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve API keys',
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { keyId, updates } = body;

    if (!keyId) {
      return NextResponse.json({
        success: false,
        error: 'keyId is required',
      }, { status: 400 });
    }

    const updatedKey = await apiKeysService.updateApiKey(keyId, updates);

    if (!updatedKey) {
      return NextResponse.json({
        success: false,
        error: 'API key not found or update failed',
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedKey.id,
        keyType: updatedKey.keyType,
        keyName: updatedKey.keyName,
        description: updatedKey.description,
        isActive: updatedKey.isActive,
        expiresAt: updatedKey.expiresAt,
        updatedAt: updatedKey.updatedAt,
      },
      message: 'API key updated successfully',
    });
  } catch (error) {
    console.error('❌ Error updating API key:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update API key',
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('keyId');

    if (!keyId) {
      return NextResponse.json({
        success: false,
        error: 'keyId is required',
      }, { status: 400 });
    }

    const success = await apiKeysService.deleteApiKey(keyId);

    if (!success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to delete API key',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'API key deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting API key:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete API key',
    }, { status: 500 });
  }
}

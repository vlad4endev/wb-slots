import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

const ADMIN_USER_ID = 'cmf8sg2w8000085vkomhit4hv';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.id !== ADMIN_USER_ID) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { botToken } = await request.json();

    if (!botToken) {
      return NextResponse.json({ 
        error: 'Bot token is required' 
      }, { status: 400 });
    }

    // Валидируем токен
    const testResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    if (!testResponse.ok) {
      return NextResponse.json({ 
        error: 'Invalid bot token' 
      }, { status: 400 });
    }

    const botInfo = await testResponse.json();
    
    // Путь к .env.local файлу
    const envPath = path.join(process.cwd(), '.env.local');
    
    try {
      // Читаем существующий файл
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      } else {
        // Если файл не существует, создаем базовый шаблон
        envContent = `# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/wb_slots?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-super-secret-jwt-key-here-change-in-production"
JWT_EXPIRES_IN="7d"

# Encryption
ENCRYPTION_KEY="your-32-byte-base64-encryption-key-here"

# App
APP_BASE_URL="http://localhost:3000"
NODE_ENV="development"

# Email (optional)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="noreply@wb-slots.com"

# Telegram
TELEGRAM_BOT_TOKEN=""
TELEGRAM_WEBHOOK_URL=""

# Rate limiting
RATE_LIMIT_MAX="100"
RATE_LIMIT_WINDOW="900000"

# WB API (base URLs are constants in code)
# Tokens are stored encrypted in database per user
`;
      }

      // Обновляем или добавляем TELEGRAM_BOT_TOKEN
      const tokenRegex = /^TELEGRAM_BOT_TOKEN=.*$/m;
      if (tokenRegex.test(envContent)) {
        // Заменяем существующий токен
        envContent = envContent.replace(tokenRegex, `TELEGRAM_BOT_TOKEN="${botToken}"`);
      } else {
        // Добавляем новый токен
        envContent += `\nTELEGRAM_BOT_TOKEN="${botToken}"\n`;
      }

      // Записываем обновленный файл
      fs.writeFileSync(envPath, envContent, 'utf8');

      return NextResponse.json({ 
        success: true, 
        message: `Bot token updated successfully! Bot: @${botInfo.result.username}`,
        botInfo: {
          id: botInfo.result.id,
          username: botInfo.result.username,
          firstName: botInfo.result.first_name
        }
      });

    } catch (fileError) {
      console.error('Error updating .env.local:', fileError);
      return NextResponse.json({ 
        error: 'Failed to update .env.local file. Please check file permissions.' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error updating bot token:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.id !== ADMIN_USER_ID) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Проверяем текущий токен
    const currentToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!currentToken) {
      return NextResponse.json({
        hasToken: false,
        message: 'No bot token configured'
      });
    }

    // Проверяем валидность токена
    try {
      const testResponse = await fetch(`https://api.telegram.org/bot${currentToken}/getMe`);
      if (testResponse.ok) {
        const botInfo = await testResponse.json();
        return NextResponse.json({
          hasToken: true,
          valid: true,
          botInfo: {
            id: botInfo.result.id,
            username: botInfo.result.username,
            firstName: botInfo.result.first_name
          }
        });
      } else {
        return NextResponse.json({
          hasToken: true,
          valid: false,
          message: 'Invalid bot token'
        });
      }
    } catch (error) {
      return NextResponse.json({
        hasToken: true,
        valid: false,
        message: 'Error validating token'
      });
    }

  } catch (error) {
    console.error('Error checking bot token:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

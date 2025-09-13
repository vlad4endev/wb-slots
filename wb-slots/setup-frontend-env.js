/**
 * Скрипт для настройки переменных окружения frontend
 * Создает файл .env.local в корне проекта с правильными настройками
 */

const fs = require('fs');
const path = require('path');

const frontendEnvPath = path.join(__dirname, '.env.local');

const envContent = `# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wb_slots?schema=public"

# JWT - должен совпадать с backend
JWT_SECRET="wb-slots-super-secret-jwt-key-2024"
JWT_EXPIRES_IN="7d"

# Encryption
ENCRYPTION_KEY="your-32-character-encryption-key-here"

# App
APP_BASE_URL="http://localhost:3000"
NODE_ENV="development"

# Backend URL
BACKEND_URL="http://localhost:3001"

# Email (optional)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="noreply@wb-slots.com"

# Telegram (optional)
TELEGRAM_BOT_TOKEN=""
TELEGRAM_WEBHOOK_URL=""

# Rate limiting
RATE_LIMIT_MAX="100"
RATE_LIMIT_WINDOW="900000"
`;

try {
  fs.writeFileSync(frontendEnvPath, envContent);
  console.log('✅ Файл .env.local создан в корне проекта');
  console.log('📁 Путь:', frontendEnvPath);
  console.log('🔑 JWT_SECRET настроен для совместимости с backend');
  console.log('\n🚀 Теперь можно перезапустить frontend:');
  console.log('   npm run dev');
} catch (error) {
  console.error('❌ Ошибка при создании файла .env.local:', error.message);
  console.log('\n📝 Создайте файл .env.local вручную в корне проекта со следующим содержимым:');
  console.log(envContent);
}

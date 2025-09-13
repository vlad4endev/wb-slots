/**
 * Скрипт для настройки переменных окружения backend
 * Создает файл .env в папке backend с правильными настройками
 */

const fs = require('fs');
const path = require('path');

const backendEnvPath = path.join(__dirname, 'backend', '.env');

const envContent = `# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wb_slots?schema=public"

# JWT - должен совпадать с frontend
JWT_SECRET="wb-slots-super-secret-jwt-key-2024"
JWT_EXPIRES_IN="7d"

# App
PORT=3001
NODE_ENV="development"
FRONTEND_URL="http://localhost:3000"

# Redis
REDIS_URL="redis://localhost:6379"

# Encryption
ENCRYPTION_KEY="your-32-character-encryption-key-here"

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="WB Slots <noreply@wb-slots.com>"

# Telegram
TELEGRAM_BOT_TOKEN=""
TELEGRAM_WEBHOOK_URL=""

# Wildberries API
WB_API_BASE_URL="https://suppliers-api.wildberries.ru"
WB_MARKETPLACE_API_BASE_URL="https://marketplace-api.wildberries.ru"
`;

try {
  fs.writeFileSync(backendEnvPath, envContent);
  console.log('✅ Файл .env создан в папке backend');
  console.log('📁 Путь:', backendEnvPath);
  console.log('🔑 JWT_SECRET настроен для совместимости с frontend');
  console.log('\n🚀 Теперь можно запустить backend:');
  console.log('   cd backend && npm run start:dev');
} catch (error) {
  console.error('❌ Ошибка при создании файла .env:', error.message);
  console.log('\n📝 Создайте файл .env вручную в папке backend со следующим содержимым:');
  console.log(envContent);
}

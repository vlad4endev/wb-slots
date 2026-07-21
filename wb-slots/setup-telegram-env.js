const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🤖 Telegram Bot Token Setup via .env.local');
console.log('===========================================');
console.log('');
console.log('This will set up the Telegram bot token in .env.local file.');
console.log('After setup, you need to restart the server.');
console.log('');

rl.question('Enter your Telegram bot token: ', (token) => {
  if (!token || token.trim() === '') {
    console.log('❌ No token provided. Exiting.');
    rl.close();
    return;
  }

  setupTokenInEnv(token.trim());
});

function setupTokenInEnv(token) {
  const envPath = path.join(process.cwd(), '.env.local');
  
  console.log('\n🔄 Setting up token in .env.local...');
  console.log('File path:', envPath);
  
  try {
    let envContent = '';
    
    // Read existing file if it exists
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      console.log('✅ Existing .env.local file found');
    } else {
      console.log('📝 Creating new .env.local file');
      // Create basic template
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

    // Update or add TELEGRAM_BOT_TOKEN
    const tokenRegex = /^TELEGRAM_BOT_TOKEN=.*$/m;
    if (tokenRegex.test(envContent)) {
      // Replace existing token
      envContent = envContent.replace(tokenRegex, `TELEGRAM_BOT_TOKEN="${token}"`);
      console.log('✅ Updated existing TELEGRAM_BOT_TOKEN');
    } else {
      // Add new token
      envContent += `\nTELEGRAM_BOT_TOKEN="${token}"\n`;
      console.log('✅ Added new TELEGRAM_BOT_TOKEN');
    }

    // Write updated file
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✅ .env.local file updated successfully!');
    
    console.log('\n📋 Next steps:');
    console.log('1. Restart the server: npm run dev');
    console.log('2. Check the token: node check-telegram-token.js');
    console.log('3. Open http://localhost:3000/settings/telegram');
    
  } catch (error) {
    console.log('❌ Error updating .env.local:', error.message);
  }
  
  rl.close();
}

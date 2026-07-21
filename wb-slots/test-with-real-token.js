const http = require('http');

// Реальный токен для тестирования
const token = '7690700894:AAEGUGIqOeNcU30kG2bUrARxqht5qj058bI';

const tokenData = {
  action: 'update_bot_token',
  data: {
    botToken: token,
    skipValidation: false  // Включаем валидацию
  }
};

const postData = JSON.stringify(tokenData);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/settings/telegram/admin',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🧪 Testing with real Telegram token...');
console.log('Token:', token);
console.log('Token length:', token.length);

const req = http.request(options, (res) => {
  console.log(`\nStatus: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('\n=== Response ===');
      console.log(JSON.stringify(response, null, 2));
      
      if (res.statusCode === 200) {
        console.log('\n✅ Token saved successfully!');
      } else {
        console.log('\n❌ Error occurred:');
        console.log('Status:', res.statusCode);
        console.log('Error:', response.error);
        
        if (res.statusCode === 400) {
          console.log('\n💡 400 Error Analysis:');
          if (response.error === 'Bot token is required') {
            console.log('- The token was not received by the server');
          } else if (response.error.includes('Invalid bot token')) {
            console.log('- The token failed Telegram API validation');
            console.log('- Check if the token is correct and the bot exists');
          } else if (response.error.includes('Network error')) {
            console.log('- Network connection issue with Telegram API');
          } else {
            console.log('- Unknown 400 error:', response.error);
          }
        }
      }
    } catch (error) {
      console.log('Error parsing response:', error.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (err) => {
  console.log(`Error: ${err.message}`);
});

req.write(postData);
req.end();

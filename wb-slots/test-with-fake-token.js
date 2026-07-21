const http = require('http');

// Тестируем с фиктивным токеном для диагностики
const testToken = '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz';

const tokenData = {
  action: 'update_bot_token',
  data: {
    botToken: testToken,
    skipValidation: true  // Пропускаем валидацию для теста
  }
};

const postData = JSON.stringify(tokenData);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/debug/telegram-detailed-log',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🧪 Testing Telegram admin endpoint with fake token...');
console.log('Token:', testToken);
console.log('Skip validation:', true);

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
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
        console.log('\n✅ Endpoint works correctly!');
        console.log('The issue might be with token validation or authentication.');
      } else {
        console.log('\n❌ Endpoint returned error:');
        console.log('Status:', res.statusCode);
        console.log('Error:', response.error);
        if (response.details) {
          console.log('Details:', response.details);
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

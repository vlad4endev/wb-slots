const http = require('http');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔍 Detailed Telegram Token Test');
console.log('================================');
console.log('');

rl.question('Enter your Telegram bot token: ', (token) => {
  if (!token || token.trim() === '') {
    console.log('❌ No token provided. Exiting.');
    rl.close();
    return;
  }

  testWithDetailedLogging(token.trim());
});

function testWithDetailedLogging(token) {
  const tokenData = {
    action: 'update_bot_token',
    data: {
      botToken: token,
      skipValidation: false  // Включаем валидацию для полной диагностики
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

  console.log(`\n🔄 Testing with detailed logging...`);
  console.log('Token length:', token.length);
  console.log('Token preview:', token.substring(0, 10) + '...');

  const req = http.request(options, (res) => {
    console.log(`\nStatus: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('\n=== Detailed Response ===');
        console.log(JSON.stringify(response, null, 2));
        
        if (res.statusCode === 200) {
          console.log('\n✅ Token saved successfully!');
          console.log('Check the server logs for detailed information.');
        } else {
          console.log('\n❌ Error occurred:');
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
      
      rl.close();
    });
  });

  req.on('error', (err) => {
    console.log(`Error: ${err.message}`);
    rl.close();
  });

  req.write(postData);
  req.end();
}

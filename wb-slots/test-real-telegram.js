const http = require('http');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🧪 Real Telegram Token Test');
console.log('============================');
console.log('');
console.log('This will test the actual /api/settings/telegram/admin endpoint');
console.log('with detailed logging to see what causes the 400 error.');
console.log('');

rl.question('Enter your Telegram bot token: ', (token) => {
  if (!token || token.trim() === '') {
    console.log('❌ No token provided. Exiting.');
    rl.close();
    return;
  }

  testRealEndpoint(token.trim());
});

function testRealEndpoint(token) {
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

  console.log(`\n🔄 Testing real endpoint with token...`);
  console.log('Token length:', token.length);
  console.log('Token preview:', token.substring(0, 10) + '...');
  console.log('Endpoint: /api/settings/telegram/admin');

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
      
      console.log('\n📋 Check the server logs for detailed information.');
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

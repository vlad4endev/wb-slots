const http = require('http');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🧪 Telegram Token Save Test');
console.log('============================');
console.log('');

rl.question('Enter your Telegram bot token: ', (token) => {
  if (!token || token.trim() === '') {
    console.log('❌ No token provided. Exiting.');
    rl.close();
    return;
  }

  // Test with validation
  testTokenSave(token.trim(), false);
});

function testTokenSave(token, skipValidation) {
  const tokenData = {
    action: 'update_bot_token',
    data: {
      botToken: token,
      skipValidation: skipValidation
    }
  };

  const postData = JSON.stringify(tokenData);

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/debug/telegram-admin-test',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  console.log(`\n🔄 Testing token save (validation: ${!skipValidation})...`);

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('Response:', JSON.stringify(response, null, 2));
        
        if (res.statusCode === 200 && response.success) {
          console.log('✅ Token saved successfully!');
        } else {
          console.log('❌ Error saving token:');
          console.log('Error:', response.error);
          
          if (res.statusCode === 400 && response.error.includes('Invalid bot token') && !skipValidation) {
            console.log('\n💡 Token validation failed. Trying without validation...');
            testTokenSave(token, true);
            return;
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

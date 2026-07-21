const http = require('http');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🤖 Telegram Bot Token Setup');
console.log('============================');
console.log('');
console.log('1. Go to https://t.me/botfather in Telegram');
console.log('2. Send /newbot command');
console.log('3. Follow the instructions to create a bot');
console.log('4. Copy the bot token (format: 1234567890:ABCdef...)');
console.log('');

rl.question('Enter your Telegram bot token: ', (token) => {
  if (!token || token.trim() === '') {
    console.log('❌ No token provided. Exiting.');
    rl.close();
    return;
  }

  const tokenData = {
    action: 'update_bot_token',
    data: {
      botToken: token.trim(),
      skipValidation: false
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

  console.log('\n🔄 Saving bot token...');

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (res.statusCode === 200 && response.success) {
          console.log('✅ Bot token saved successfully!');
          console.log('Bot info:', response.botInfo);
        } else {
          console.log('❌ Error saving bot token:');
          console.log('Status:', res.statusCode);
          console.log('Response:', response);
          
          if (res.statusCode === 403) {
            console.log('\n💡 You need DEVELOPER or ADMIN role to save bot token.');
            console.log('Contact your administrator to change your role.');
          } else if (res.statusCode === 400) {
            console.log('\n💡 Invalid bot token. Please check the token and try again.');
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
});

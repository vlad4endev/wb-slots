const http = require('http');

// Данные для изменения роли
const roleData = {
  email: 'vl4en.95@yandex.ru',
  role: 'DEVELOPER'
};

const postData = JSON.stringify(roleData);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/debug/set-user-role',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🔄 Changing user role: vl4en.95@yandex.ru -> DEVELOPER...');

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
        console.log('✅ User role updated successfully!');
        console.log('User:', response.user);
        console.log('\n🎉 Now you can configure Telegram bot token!');
        console.log('Next step: Run "node set-telegram-token.js" to set up your bot.');
      } else {
        console.log('❌ Error updating user role:');
        console.log('Status:', res.statusCode);
        console.log('Response:', response);
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
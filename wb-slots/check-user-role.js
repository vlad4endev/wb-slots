const http = require('http');

// Функция для получения cookies из браузера
// Вам нужно скопировать cookies из браузера и вставить их сюда
const cookies = ''; // Вставьте сюда cookies из браузера

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/me',
  method: 'GET',
  headers: {
    'Cookie': cookies,
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      if (response.data && response.data.user) {
        console.log('User ID:', response.data.user.id);
        console.log('User Email:', response.data.user.email);
        console.log('User Role:', response.data.user.role);
        
        if (response.data.user.role === 'DEVELOPER' || response.data.user.role === 'ADMIN') {
          console.log('✅ You can configure Telegram bot token');
        } else {
          console.log('❌ You need DEVELOPER or ADMIN role to configure bot token');
          console.log('Current role:', response.data.user.role);
        }
      } else {
        console.log('No user data found');
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

req.end();

console.log('To use this script:');
console.log('1. Open browser and go to http://localhost:3000');
console.log('2. Open Developer Tools (F12)');
console.log('3. Go to Application/Storage tab');
console.log('4. Copy cookies from the request');
console.log('5. Paste cookies into the script and run again');

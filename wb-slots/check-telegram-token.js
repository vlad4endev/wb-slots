const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/debug/telegram-token',
  method: 'GET',
  headers: {
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
      if (response.success) {
        console.log('\n=== Telegram Token Status ===');
        console.log('Environment token exists:', response.data.environment.hasToken);
        console.log('Environment token length:', response.data.environment.tokenLength);
        console.log('Database token exists:', response.data.database.hasToken);
        console.log('Database token length:', response.data.database.tokenLength);
        console.log('Bot configured:', response.data.configuration.isConfigured);
        console.log('Has any token:', response.data.configuration.hasAnyToken);
        
        if (!response.data.configuration.hasAnyToken) {
          console.log('\n❌ No Telegram bot token found!');
          console.log('You need to configure a bot token.');
        } else {
          console.log('\n✅ Telegram bot token is configured!');
        }
      } else {
        console.log('Error:', response.error);
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

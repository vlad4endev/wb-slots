const http = require('http');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('👤 User Role Setup');
console.log('==================');
console.log('');
console.log('Available roles:');
console.log('- USER: Basic user (cannot configure bot)');
console.log('- DEVELOPER: Can configure bot and manage settings');
console.log('- ADMIN: Full access to all features');
console.log('');

rl.question('Enter user email: ', (email) => {
  if (!email || email.trim() === '') {
    console.log('❌ No email provided. Exiting.');
    rl.close();
    return;
  }

  rl.question('Enter new role (USER/DEVELOPER/ADMIN): ', (role) => {
    if (!role || !['USER', 'DEVELOPER', 'ADMIN'].includes(role.toUpperCase())) {
      console.log('❌ Invalid role. Must be USER, DEVELOPER, or ADMIN. Exiting.');
      rl.close();
      return;
    }

    const roleData = {
      email: email.trim(),
      role: role.toUpperCase()
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

    console.log(`\n🔄 Changing user role: ${email} -> ${role.toUpperCase()}...`);

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
          } else {
            console.log('❌ Error updating user role:');
            console.log('Status:', res.statusCode);
            console.log('Response:', response);
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
});

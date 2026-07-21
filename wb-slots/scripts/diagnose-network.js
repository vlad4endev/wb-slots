#!/usr/bin/env node

/**
 * Скрипт для диагностики сетевых проблем с WB API
 * Проверяет доступность различных endpoints Wildberries
 */

const https = require('https');
const dns = require('dns');
const { promisify } = require('util');

const dnsLookup = promisify(dns.lookup);

// Список endpoints для проверки
const endpoints = [
  'suppliers-api.wildberries.ru',
  'api.wildberries.ru', 
  'seller.wildberries.ru',
  'wildberries.ru',
  'www.wildberries.ru'
];

// Функция для проверки DNS
async function checkDNS(hostname) {
  try {
    const result = await dnsLookup(hostname);
    console.log(`✅ DNS: ${hostname} -> ${result.address}`);
    return true;
  } catch (error) {
    console.log(`❌ DNS: ${hostname} - ${error.message}`);
    return false;
  }
}

// Функция для проверки HTTPS соединения
function checkHTTPS(hostname, path = '/') {
  return new Promise((resolve) => {
    const options = {
      hostname,
      port: 443,
      path,
      method: 'GET',
      timeout: 10000,
      rejectUnauthorized: false // Игнорируем проблемы с сертификатами для диагностики
    };

    const req = https.request(options, (res) => {
      console.log(`✅ HTTPS: ${hostname}${path} - ${res.statusCode} ${res.statusMessage}`);
      resolve(true);
    });

    req.on('error', (error) => {
      console.log(`❌ HTTPS: ${hostname}${path} - ${error.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log(`⏰ HTTPS: ${hostname}${path} - Timeout`);
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Основная функция диагностики
async function diagnoseNetwork() {
  console.log('🔍 Диагностика сетевых проблем с WB API...\n');

  console.log('📡 Проверка DNS разрешения:');
  const dnsResults = {};
  for (const endpoint of endpoints) {
    dnsResults[endpoint] = await checkDNS(endpoint);
  }

  console.log('\n🌐 Проверка HTTPS соединений:');
  const httpsResults = {};
  for (const endpoint of endpoints) {
    httpsResults[endpoint] = await checkHTTPS(endpoint);
  }

  console.log('\n📊 Результаты диагностики:');
  console.log('='.repeat(50));
  
  for (const endpoint of endpoints) {
    const dnsOk = dnsResults[endpoint];
    const httpsOk = httpsResults[endpoint];
    const status = dnsOk && httpsOk ? '✅ Доступен' : '❌ Недоступен';
    console.log(`${endpoint.padEnd(30)} ${status}`);
  }

  console.log('\n💡 Рекомендации:');
  
  const allDNSFailed = Object.values(dnsResults).every(result => !result);
  const allHTTPSFailed = Object.values(httpsResults).every(result => !result);
  
  if (allDNSFailed) {
    console.log('🚨 Все домены Wildberries недоступны через DNS');
    console.log('   Возможные причины:');
    console.log('   - Блокировка доменов на уровне провайдера');
    console.log('   - Проблемы с DNS серверами');
    console.log('   - Изменение доменов Wildberries');
    console.log('   - Региональные ограничения');
    console.log('\n   Решения:');
    console.log('   - Попробуйте использовать VPN');
    console.log('   - Измените DNS серверы (8.8.8.8, 1.1.1.1)');
    console.log('   - Проверьте актуальные домены WB API');
  } else if (allHTTPSFailed) {
    console.log('🚨 DNS работает, но HTTPS соединения недоступны');
    console.log('   Возможные причины:');
    console.log('   - Блокировка на уровне файрвола');
    console.log('   - Проблемы с SSL сертификатами');
    console.log('   - Изменение API endpoints');
  } else {
    console.log('✅ Некоторые endpoints доступны');
    console.log('   Проверьте, какие именно endpoints работают');
  }

  console.log('\n🔧 Дополнительные проверки:');
  console.log('1. Проверьте настройки прокси/файрвола');
  console.log('2. Попробуйте использовать альтернативные DNS серверы');
  console.log('3. Проверьте актуальную документацию WB API');
  console.log('4. Рассмотрите использование VPN для обхода блокировок');
}

// Запуск диагностики
if (require.main === module) {
  diagnoseNetwork().catch(console.error);
}

module.exports = { diagnoseNetwork, checkDNS, checkHTTPS };

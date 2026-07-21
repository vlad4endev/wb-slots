# 🔐 Руководство по внедрению системы безопасности

## 📋 Обзор

Это руководство описывает пошаговое внедрение комплексной системы безопасности в проект WB Slots, включающей:

- 🔑 Продвинутое шифрование с ротацией ключей
- 🔐 Двухфакторную аутентификацию (2FA)
- 🛡️ Систему аудита и мониторинга безопасности
- ✅ Продвинутую валидацию входных данных
- 🛡️ Security Middleware для API

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
# Основные зависимости
npm install speakeasy qrcode validator xss isomorphic-dompurify

# Типы для TypeScript
npm install --save-dev @types/speakeasy @types/qrcode @types/validator
```

### 2. Настройка переменных окружения

Создайте файл `.env.local`:

```env
# Шифрование
ENCRYPTION_MASTER_KEY=your-very-strong-master-key-here-min-32-chars

# 2FA
TOTP_ISSUER=WB Slots
TOTP_ALGORITHM=sha256
TOTP_DIGITS=6
TOTP_PERIOD=30

# Аудит безопасности
SECURITY_AUDIT_ENABLED=true
SECURITY_RETENTION_DAYS=90
SECURITY_ALERT_THRESHOLDS={"failedLogins":5,"suspiciousActivity":3,"rateLimitViolations":10}

# Redis для rate limiting (опционально)
REDIS_URL=redis://localhost:6379
```

### 3. Базовое использование

```typescript
import { createSecurityServices } from '@/lib/security';

// Создание всех сервисов безопасности
const security = createSecurityServices();

// Использование в API
export default async function handler(req: NextRequest) {
  return security.middleware.processRequest(req, async (request) => {
    // Ваша логика API
    return NextResponse.json({ success: true });
  });
}
```

## 🔑 Продвинутое шифрование

### Настройка

```typescript
import { AdvancedEncryptionService } from '@/lib/security';

const encryptionService = AdvancedEncryptionService.getInstance();

// Проверка силы мастер-ключа
const keyValidation = await encryptionService.validateKeyStrength(
  process.env.ENCRYPTION_MASTER_KEY!
);
console.log('Key strength:', keyValidation.strength, 'bits');
```

### Использование

```typescript
// Шифрование данных
const sensitiveData = 'WB API Token: wb_1234567890abcdef';
const encrypted = await encryptionService.encrypt(sensitiveData);

// Дешифрование
const decrypted = await encryptionService.decrypt(encrypted);

// Ротация ключей (автоматическая каждые 30 дней)
const rotationResult = await encryptionService.rotateKeys();
```

### Интеграция с базой данных

```typescript
// В Prisma схеме
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  apiKey    String   // Зашифрованный API ключ
  createdAt DateTime @default(now())
}

// При сохранении
const encryptedApiKey = await encryptionService.encrypt(userApiKey);
await prisma.user.create({
  data: {
    email: user.email,
    apiKey: JSON.stringify(encryptedApiKey)
  }
});

// При чтении
const user = await prisma.user.findUnique({ where: { email } });
const decryptedApiKey = await encryptionService.decrypt(
  JSON.parse(user.apiKey)
);
```

## 🔐 Двухфакторная аутентификация

### Настройка 2FA для пользователя

```typescript
import { TwoFactorAuthService } from '@/lib/security';

const twoFactorService = TwoFactorAuthService.getInstance();

// 1. Настройка 2FA
const setup = await twoFactorService.setupTwoFactor('user123');

// 2. Отправка QR кода пользователю
console.log('QR Code URL:', setup.qrCodeUrl);
console.log('Backup codes:', setup.backupCodes);

// 3. Включение после верификации
const enabled = await twoFactorService.enableTwoFactor(
  'user123', 
  '123456' // Токен из приложения-аутентификатора
);
```

### API эндпоинт для настройки 2FA

```typescript
// pages/api/security/2fa/setup.ts
import { TwoFactorAuthService } from '@/lib/security';

export default async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const { userId } = await req.json();
  const twoFactorService = TwoFactorAuthService.getInstance();

  try {
    const setup = await twoFactorService.setupTwoFactor(userId);
    
    return NextResponse.json({
      success: true,
      qrCodeUrl: setup.qrCodeUrl,
      backupCodes: setup.backupCodes,
      manualEntryKey: setup.manualEntryKey
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to setup 2FA' },
      { status: 500 }
    );
  }
}
```

### Проверка 2FA токена

```typescript
// pages/api/security/2fa/verify.ts
export default async function handler(req: NextRequest) {
  const { userId, token } = await req.json();
  const twoFactorService = TwoFactorAuthService.getInstance();

  const verification = await twoFactorService.verifyTwoFactor(userId, token);
  
  if (verification.isValid) {
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.json(
      { error: verification.error },
      { status: 403 }
    );
  }
}
```

## 🛡️ Аудит безопасности

### Логирование событий

```typescript
import { SecurityAuditService } from '@/lib/security';

const auditService = SecurityAuditService.getInstance();

// Логирование успешного входа
await auditService.logEvent({
  type: 'LOGIN_SUCCESS',
  severity: 'LOW',
  userId: 'user123',
  ipAddress: '192.168.1.100',
  userAgent: req.headers.get('user-agent') || '',
  resource: '/api/auth/login',
  action: 'POST',
  details: { loginMethod: 'password' }
});

// Логирование неудачной попытки входа
await auditService.logEvent({
  type: 'LOGIN_FAILED',
  severity: 'MEDIUM',
  userId: 'user123',
  ipAddress: '192.168.1.100',
  resource: '/api/auth/login',
  action: 'POST',
  details: { reason: 'Invalid password', attemptCount: 3 }
});
```

### Получение метрик безопасности

```typescript
// API для получения метрик
export default async function handler(req: NextRequest) {
  const auditService = SecurityAuditService.getInstance();
  
  const metrics = auditService.getSecurityMetrics({
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Последние 24 часа
    end: new Date()
  });
  
  return NextResponse.json({
    success: true,
    metrics: {
      totalEvents: metrics.totalEvents,
      eventsByType: metrics.eventsByType,
      eventsBySeverity: metrics.eventsBySeverity,
      topUsers: metrics.topUsers.slice(0, 10),
      topIPs: metrics.topIPs.slice(0, 10)
    }
  });
}
```

### Управление блокировками

```typescript
// Разблокировка IP
await auditService.unblockIP('192.168.1.100', 'Manual review completed');

// Разблокировка пользователя
await auditService.unlockUser('user123', 'Password reset completed');

// Проверка статуса
const isIPBlocked = auditService.isIPBlocked('192.168.1.100');
const isUserLocked = auditService.isUserLocked('user123');
```

## ✅ Валидация входных данных

### Настройка правил валидации

```typescript
import { AdvancedInputValidationService } from '@/lib/security';

const validationService = AdvancedInputValidationService.getInstance();

// Определение правил валидации
const userValidationRules = {
  email: {
    type: 'email' as const,
    required: true,
    sanitize: true
  },
  password: {
    type: 'password' as const,
    required: true,
    minLength: 8,
    maxLength: 128
  },
  name: {
    type: 'string' as const,
    required: true,
    maxLength: 100,
    sanitize: true,
    pattern: /^[a-zA-Z\s]+$/
  },
  age: {
    type: 'number' as const,
    required: true,
    customValidator: (value: any) => {
      const num = Number(value);
      if (num < 18 || num > 120) {
        return 'Age must be between 18 and 120';
      }
      return true;
    }
  }
};
```

### Использование в API

```typescript
// pages/api/users/create.ts
export default async function handler(req: NextRequest) {
  const validationService = AdvancedInputValidationService.getInstance();
  
  const body = await req.json();
  const result = await validationService.validateInput(body, userValidationRules);
  
  if (!result.isValid) {
    return NextResponse.json({
      success: false,
      error: 'Validation failed',
      errors: result.errors
    }, { status: 400 });
  }
  
  // Использование очищенных данных
  const sanitizedData = result.sanitizedValue;
  
  // Создание пользователя
  const user = await prisma.user.create({
    data: sanitizedData
  });
  
  return NextResponse.json({ success: true, user });
}
```

### Кастомные валидаторы

```typescript
// Добавление кастомного валидатора
validationService.addCustomValidator('wbApiKey', (value: any) => {
  if (typeof value !== 'string') return 'API key must be a string';
  if (!value.startsWith('wb_')) return 'API key must start with "wb_"';
  if (value.length < 20) return 'API key must be at least 20 characters';
  return true;
});

// Использование в правилах
const apiKeyRule = {
  type: 'custom' as const,
  customValidator: validationService.getCustomValidator('wbApiKey')
};
```

## 🛡️ Security Middleware

### Базовая настройка

```typescript
import { SecurityMiddleware } from '@/lib/security';

const securityMiddleware = SecurityMiddleware.getInstance();

// Конфигурация middleware
securityMiddleware.updateConfig({
  enableInputValidation: true,
  enableSecurityAudit: true,
  enableTwoFactorCheck: true,
  requireTwoFactor: ['/api/admin', '/api/settings', '/api/wb-auth'],
  validationRules: {
    '/api/users': {
      name: { type: 'string', required: true, maxLength: 100 },
      email: { type: 'email', required: true }
    }
  }
});
```

### Использование в API роутах

```typescript
// pages/api/admin/users.ts
import { SecurityMiddleware } from '@/lib/security';

const securityMiddleware = SecurityMiddleware.getInstance();

export default async function handler(req: NextRequest) {
  return securityMiddleware.processRequest(req, async (request) => {
    // Ваша логика API
    const users = await prisma.user.findMany();
    
    return NextResponse.json({
      success: true,
      users
    });
  });
}
```

### Настройка для разных маршрутов

```typescript
// Добавление правил валидации для конкретного маршрута
securityMiddleware.addValidationRule('/api/products', {
  name: { type: 'string', required: true, maxLength: 200 },
  price: { type: 'number', required: true },
  description: { type: 'string', required: false, maxLength: 1000, sanitize: true }
});

// Добавление требования 2FA для маршрута
securityMiddleware.addTwoFactorRoute('/api/financial');

// Удаление требования 2FA
securityMiddleware.removeTwoFactorRoute('/api/public');
```

## 🔧 Интеграция с существующим кодом

### Обновление API роутов

```typescript
// До
export default async function handler(req: NextRequest) {
  const body = await req.json();
  // Логика API
  return NextResponse.json({ success: true });
}

// После
import { SecurityMiddleware } from '@/lib/security';

const securityMiddleware = SecurityMiddleware.getInstance();

export default async function handler(req: NextRequest) {
  return securityMiddleware.processRequest(req, async (request) => {
    const body = await request.json();
    // Логика API
    return NextResponse.json({ success: true });
  });
}
```

### Обновление аутентификации

```typescript
// Добавление 2FA проверки в логин
export default async function handler(req: NextRequest) {
  const { email, password, twoFactorToken } = await req.json();
  
  // Проверка пароля
  const user = await authenticateUser(email, password);
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
  
  // Проверка 2FA если включена
  if (user.twoFactorEnabled) {
    const twoFactorService = TwoFactorAuthService.getInstance();
    const verification = await twoFactorService.verifyTwoFactor(
      user.id, 
      twoFactorToken
    );
    
    if (!verification.isValid) {
      return NextResponse.json(
        { error: 'Invalid 2FA token' },
        { status: 403 }
      );
    }
  }
  
  // Создание сессии
  const session = await createSession(user.id);
  
  return NextResponse.json({ success: true, session });
}
```

## 📊 Мониторинг и алерты

### Настройка алертов

```typescript
// Получение неразрешенных алертов
const unresolvedAlerts = auditService.getUnresolvedAlerts();

// Получение алертов по критичности
const criticalAlerts = auditService.getAlertsBySeverity('CRITICAL');

// Разрешение алерта
const alert = auditService.getAlertById('alert_123');
if (alert) {
  alert.resolved = true;
  alert.resolvedAt = new Date();
  alert.resolvedBy = 'admin_user';
}
```

### Дашборд безопасности

```typescript
// API для дашборда безопасности
export default async function handler(req: NextRequest) {
  const auditService = SecurityAuditService.getInstance();
  
  const dashboard = {
    metrics: auditService.getSecurityMetrics({
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 дней
      end: new Date()
    }),
    alerts: auditService.getUnresolvedAlerts(),
    blockedIPs: Array.from(auditService.getBlockedIPs()),
    lockedUsers: Array.from(auditService.getLockedUsers())
  };
  
  return NextResponse.json({ success: true, dashboard });
}
```

## 🚨 Обработка инцидентов

### Процедура реагирования

1. **Обнаружение инцидента**
   ```typescript
   // Автоматическое обнаружение через алерты
   const alerts = auditService.getAlertsBySeverity('CRITICAL');
   ```

2. **Блокировка угрозы**
   ```typescript
   // Блокировка IP
   auditService.blockIP('192.168.1.100', 'Suspicious activity detected');
   
   // Блокировка пользователя
   auditService.lockUser('user123', 'Multiple failed login attempts');
   ```

3. **Уведомление администраторов**
   ```typescript
   // Отправка уведомления
   await sendSecurityAlert({
     type: 'CRITICAL',
     message: 'Security incident detected',
     details: alert.details
   });
   ```

4. **Документирование**
   ```typescript
   // Логирование действий по инциденту
   await auditService.logEvent({
     type: 'ADMIN_ACTION',
     severity: 'HIGH',
     action: 'INCIDENT_RESPONSE',
     details: { incidentId: 'inc_123', actions: ['ip_blocked', 'user_locked'] }
   });
   ```

## 🔍 Тестирование

### Unit тесты

```typescript
// tests/security/encryption.test.ts
import { AdvancedEncryptionService } from '@/lib/security';

describe('AdvancedEncryptionService', () => {
  let encryptionService: AdvancedEncryptionService;
  
  beforeEach(() => {
    encryptionService = AdvancedEncryptionService.getInstance();
  });
  
  test('should encrypt and decrypt data correctly', async () => {
    const data = 'test data';
    const encrypted = await encryptionService.encrypt(data);
    const decrypted = await encryptionService.decrypt(encrypted);
    
    expect(decrypted).toBe(data);
  });
  
  test('should validate key strength', async () => {
    const weakKey = '123';
    const strongKey = 'MyVeryStrongPassword123!@#';
    
    const weakResult = await encryptionService.validateKeyStrength(weakKey);
    const strongResult = await encryptionService.validateKeyStrength(strongKey);
    
    expect(weakResult.isValid).toBe(false);
    expect(strongResult.isValid).toBe(true);
  });
});
```

### Integration тесты

```typescript
// tests/security/middleware.test.ts
import { SecurityMiddleware } from '@/lib/security';

describe('SecurityMiddleware', () => {
  test('should block malicious requests', async () => {
    const middleware = SecurityMiddleware.getInstance();
    
    const maliciousRequest = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({
        name: '<script>alert("xss")</script>',
        email: 'test@example.com'
      })
    });
    
    const response = await middleware.processRequest(
      maliciousRequest,
      async () => NextResponse.json({ success: true })
    );
    
    expect(response.status).toBe(400);
  });
});
```

## 📚 Дополнительные ресурсы

### Документация
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [ISO 27001](https://www.iso.org/isoiec-27001-information-security.html)

### Инструменты
- [Security Headers](https://securityheaders.com/) - проверка заголовков безопасности
- [OWASP ZAP](https://www.zaproxy.org/) - тестирование безопасности
- [Burp Suite](https://portswigger.net/burp) - анализ безопасности веб-приложений

### Мониторинг
- [Sentry](https://sentry.io/) - мониторинг ошибок
- [DataDog](https://www.datadoghq.com/) - мониторинг инфраструктуры
- [PagerDuty](https://www.pagerduty.com/) - управление инцидентами

## 🎯 Заключение

Комплексная система безопасности теперь полностью интегрирована в проект WB Slots. Все компоненты работают совместно для обеспечения максимального уровня защиты:

- ✅ **Шифрование:** Enterprise-уровень с ротацией ключей
- ✅ **2FA:** Полная поддержка TOTP и резервных кодов
- ✅ **Аудит:** Детальный мониторинг и автоматические алерты
- ✅ **Валидация:** Защита от XSS, SQL инъекций и других атак
- ✅ **Middleware:** Комплексная защита всех API эндпоинтов

Система готова к использованию в продакшене и соответствует международным стандартам безопасности.

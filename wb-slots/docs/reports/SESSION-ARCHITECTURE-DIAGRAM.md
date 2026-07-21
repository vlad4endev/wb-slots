# 🏗️ Диаграмма архитектуры системы сессий WB

## 📊 Общая архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Frontend UI  │  Auto-booking  │  Admin Panel  │  Mobile App   │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│ /api/wb-auth/popup    │ /api/wb-session/refresh │ /api/wb-session/status │
│ /api/wb-session/cleanup │ /api/wb-session/force-create │ /api/wb-session/diagnostics │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│ WBAuthPopupService │ UnifiedAutoBookingService │ SessionDiagnosticsService │
│ WBPhoneAuthService │ SessionSyncUtils │ SessionUtils │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      UTILITY LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│ wb-auth-helpers │ session-utils │ session-sync-utils │ encryption │
│ wb-auth-selectors │ session-diagnostics │ logging │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│        Prisma ORM        │        PostgreSQL        │        Redis Cache        │
│    WBSession Model    │    User Data    │    Session Cache    │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                           │
├─────────────────────────────────────────────────────────────────┤
│    Wildberries Portal    │    Playwright Browser    │    SMS Service    │
│    seller.wildberries.ru │    Chromium/Chrome    │    Phone Auth    │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Поток создания сессии

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│   User      │───▶│  Frontend    │───▶│  API        │───▶│  Service    │
│             │    │              │    │             │    │             │
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
                                                              │
                                                              ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│  Database   │◀───│  Encryption  │◀───│  Browser    │◀───│  WB Portal  │
│             │    │              │    │             │    │             │
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
```

## 🔄 Поток авто бронирования

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│ Auto-booking│───▶│  API Status  │───▶│  Database   │───▶│  Session    │
│ Service     │    │  Check       │    │  Query      │    │  Retrieved  │
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
       │                                                              │
       ▼                                                              ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│  Browser    │◀───│  Decryption  │◀───│  Cookies    │◀───│  Session    │
│  Launch     │    │              │    │  Restore    │    │  Data       │
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
       │
       ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│  WB Portal  │───▶│  Validation  │───▶│  Booking    │───▶│  Result     │
│  Access     │    │  Check       │    │  Execution  │    │  Return     │
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
```

## 🔄 Поток обновления сессии

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│  Refresh    │───▶│  Database    │───▶│  Decryption │───▶│  Browser    │
│  Request    │    │  Query       │    │             │    │  Launch     │
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
                                                              │
                                                              ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│  Database   │◀───│  Encryption  │◀───│  Data       │◀───│  WB Portal  │
│  Update     │    │              │    │  Collection │    │  Access     │
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
       │
       ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│  Success    │───▶│  Response    │───▶│  Client     │───▶│  Updated    │
│  Status     │    │  Return      │    │  Notification│    │  Session    │
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
```

## 🛡️ Компоненты безопасности

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  JWT Authentication  │  Role-based Access  │  Rate Limiting    │
│  Session Validation  │  Data Encryption    │  Audit Logging    │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ENCRYPTION LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  AES-256-GCM     │  Unique IVs     │  Key Management    │  Salt    │
│  Cookie Encryption │  Storage Encryption │  Transport Security │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Модель данных

```
┌─────────────────────────────────────────────────────────────────┐
│                        WBSession Model                         │
├─────────────────────────────────────────────────────────────────┤
│  id: String (Primary Key)                                      │
│  sessionId: String (Unique)                                    │
│  userId: String (Foreign Key)                                  │
│  cookiesEncrypted: String (AES-256-GCM)                        │
│  localStorageEncrypted: String? (AES-256-GCM)                  │
│  sessionStorageEncrypted: String? (AES-256-GCM)                │
│  userAgent: String?                                            │
│  isActive: Boolean (Default: true)                             │
│  expiresAt: DateTime?                                          │
│  createdAt: DateTime (Default: now())                          │
│  lastUsedAt: DateTime (Updated on use)                         │
│  updatedAt: DateTime (Updated on change)                       │
└─────────────────────────────────────────────────────────────────┘
```

## 🔍 Валидация авторизации

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│  1. Page Load Check                                            │
│     ├─ DOM Content Loaded?                                     │
│     ├─ WB Portal Loaded?                                       │
│     └─ Loading Page Detected?                                  │
│                                                                 │
│  2. Selector Validation                                        │
│     ├─ User Menu Present?                                      │
│     ├─ Profile Elements Found?                                 │
│     ├─ Supply Management Access?                               │
│     └─ Dashboard Elements Present?                             │
│                                                                 │
│  3. Storage Validation                                         │
│     ├─ localStorage Data Present?                              │
│     ├─ sessionStorage Data Present?                            │
│     └─ Authentication Tokens Found?                            │
│                                                                 │
│  4. URL Validation                                             │
│     ├─ On WB Domain?                                           │
│     ├─ Not on Login Page?                                      │
│     └─ Not Redirected to Auth?                                 │
│                                                                 │
│  5. Page Title Validation                                      │
│     ├─ Title Not Empty?                                        │
│     ├─ Title Contains WB Brand?                                │
│     └─ Title Indicates Authenticated State?                    │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Производительность и масштабирование

```
┌─────────────────────────────────────────────────────────────────┐
│                    PERFORMANCE LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  Connection Pooling  │  Query Optimization  │  Index Strategy   │
│  Caching Strategy    │  Async Processing    │  Load Balancing   │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MONITORING LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Health Checks      │  Performance Metrics  │  Error Tracking   │
│  Session Analytics  │  Usage Statistics     │  Alert System     │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 Конфигурация и настройки

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONFIGURATION LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  Environment Variables                                          │
│  ├─ ENCRYPTION_KEY (32-byte key)                               │
│  ├─ WB_AUTH_TIMEOUT (60000ms)                                  │
│  ├─ WB_PAGE_LOAD_TIMEOUT (30000ms)                             │
│  ├─ WB_RETRY_DELAY (5000ms)                                    │
│  └─ BROWSER_HEADLESS (true/false)                              │
│                                                                 │
│  Session Configuration                                          │
│  ├─ maxRetries: 3                                              │
│  ├─ retryDelay: 5000ms                                         │
│  ├─ sessionTimeout: 7 days                                     │
│  ├─ validationTimeout: 30000ms                                 │
│  └─ pageLoadTimeout: 60000ms                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 📈 Метрики и мониторинг

```
┌─────────────────────────────────────────────────────────────────┐
│                    METRICS COLLECTION                          │
├─────────────────────────────────────────────────────────────────┤
│  Session Metrics                                                │
│  ├─ Creation Success Rate                                      │
│  ├─ Validation Success Rate                                    │
│  ├─ Refresh Success Rate                                       │
│  └─ Average Session Lifetime                                   │
│                                                                 │
│  Performance Metrics                                            │
│  ├─ Authentication Time                                        │
│  ├─ Cookie Restoration Time                                    │
│  ├─ Page Load Time                                             │
│  └─ Booking Execution Time                                     │
│                                                                 │
│  Error Metrics                                                  │
│  ├─ Session Expiration Rate                                    │
│  ├─ Validation Failure Rate                                    │
│  ├─ Browser Launch Failures                                    │
│  └─ Network Timeout Rate                                       │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Ключевые принципы архитектуры

### **1. Разделение ответственности**
- API слой: Обработка HTTP запросов
- Сервисный слой: Бизнес-логика
- Утилитарный слой: Вспомогательные функции
- Слой данных: Хранение и доступ к данным

### **2. Безопасность**
- Шифрование всех чувствительных данных
- Валидация на каждом уровне
- Аудит всех операций
- Защита от атак

### **3. Надежность**
- Graceful error handling
- Retry механизмы
- Circuit breakers
- Health checks

### **4. Производительность**
- Асинхронная обработка
- Кэширование
- Оптимизация запросов
- Connection pooling

### **5. Масштабируемость**
- Stateless дизайн
- Горизонтальное масштабирование
- Load balancing
- Микросервисная архитектура

### **6. Мониторинг**
- Comprehensive logging
- Performance metrics
- Error tracking
- Health monitoring

Эта архитектура обеспечивает надежную, безопасную и масштабируемую систему управления сессиями для авто бронирования WB.

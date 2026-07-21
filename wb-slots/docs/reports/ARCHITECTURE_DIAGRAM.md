# 🏗️ Диаграммы архитектуры проекта WB Slots

## 📊 Общая архитектура системы

```mermaid
graph TB
    subgraph "Frontend Layer"
        A[Next.js App] --> B[React Components]
        A --> C[Pages & Routes]
        A --> D[API Routes]
    end
    
    subgraph "Backend Services"
        D --> E[Auth Service]
        D --> F[Task Service]
        D --> G[WB API Client]
        D --> H[Notification Service]
        D --> I[Session Manager]
    end
    
    subgraph "Worker Layer"
        J[Slot Search Worker] --> K[WB API]
        L[Auto Booking Worker] --> K
        M[Notification Worker] --> N[Telegram API]
        O[Monitor Worker] --> P[System Health]
    end
    
    subgraph "Data Layer"
        Q[(PostgreSQL)] --> R[Prisma ORM]
        S[(Redis)] --> T[BullMQ Queues]
        S --> U[Cache Service]
    end
    
    subgraph "External APIs"
        K[WB API]
        N[Telegram API]
        V[Email Service]
    end
    
    E --> Q
    F --> Q
    G --> K
    H --> N
    I --> Q
    J --> Q
    L --> Q
    M --> Q
    O --> Q
    
    J --> S
    L --> S
    M --> S
    O --> S
```

## 🔄 Поток данных и взаимодействие сервисов

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant W as Worker
    participant WB as WB API
    participant DB as Database
    participant R as Redis
    participant T as Telegram
    
    U->>F: Создает задачу
    F->>A: POST /api/tasks
    A->>DB: Сохраняет задачу
    A->>R: Добавляет в очередь
    A->>F: Возвращает результат
    
    R->>W: Запускает worker
    W->>WB: Ищет слоты
    WB->>W: Возвращает данные
    W->>DB: Сохраняет результаты
    W->>R: Обновляет статус
    
    alt Слот найден
        W->>T: Отправляет уведомление
        T->>U: Уведомление в Telegram
    end
    
    W->>A: Обновляет статус задачи
    A->>F: WebSocket уведомление
    F->>U: Обновляет UI
```

## 🏛️ Унифицированная архитектура сервисов

```mermaid
classDiagram
    class IService {
        <<interface>>
        +initialize()
        +start()
        +stop()
        +getStatus()
    }
    
    class IConfigurableService {
        <<interface>>
        +configure(config)
        +getConfiguration()
        +validateConfig()
    }
    
    class IMonitorableService {
        <<interface>>
        +getMetrics()
        +getHealthStatus()
        +getPerformanceData()
    }
    
    class IRetryableService {
        <<interface>>
        +retry(operation)
        +getRetryPolicy()
        +handleFailure()
    }
    
    class BaseServiceWithAllFeatures {
        -config: ServiceConfig
        -metrics: ServiceMetrics
        -retryPolicy: RetryPolicy
        +initialize()
        +start()
        +stop()
        +configure()
        +getMetrics()
        +retry()
    }
    
    class UnifiedAutoBookingService {
        -browserManager: RobustBrowserManager
        -sessionManager: WBSessionManager
        +bookSlot(slotData)
        +validateSession()
        +handleBookingResult()
    }
    
    class UnifiedSlotSearchService {
        -wbClient: WBClient
        -cacheService: CacheService
        +searchSlots(filters)
        +processResults()
        +updateCache()
    }
    
    class UnifiedNotificationService {
        -telegramService: TelegramService
        -emailService: EmailService
        +sendNotification(data)
        +formatMessage()
        +handleDelivery()
    }
    
    IService <|-- IConfigurableService
    IService <|-- IMonitorableService
    IService <|-- IRetryableService
    IConfigurableService <|-- BaseServiceWithAllFeatures
    IMonitorableService <|-- BaseServiceWithAllFeatures
    IRetryableService <|-- BaseServiceWithAllFeatures
    BaseServiceWithAllFeatures <|-- UnifiedAutoBookingService
    BaseServiceWithAllFeatures <|-- UnifiedSlotSearchService
    BaseServiceWithAllFeatures <|-- UnifiedNotificationService
```

## 🔒 Система безопасности

```mermaid
graph TB
    subgraph "Security Layer"
        A[Security Middleware] --> B[Input Validation]
        A --> C[Rate Limiting]
        A --> D[Authentication]
        A --> E[Authorization]
    end
    
    subgraph "Encryption"
        F[Encryption Service] --> G[AES-256-GCM]
        F --> H[PBKDF2 Key Derivation]
        F --> I[Key Rotation]
    end
    
    subgraph "Session Management"
        J[Session Manager] --> K[JWT Tokens]
        J --> L[Device Tracking]
        J --> M[Location Monitoring]
        J --> N[Security Events]
    end
    
    subgraph "Data Protection"
        O[API Keys Service] --> P[Encrypted Storage]
        Q[Audit Logger] --> R[Security Events]
        S[Row Level Security] --> T[Database Access]
    end
    
    A --> F
    A --> J
    A --> O
    A --> Q
    A --> S
```

## 📊 Система мониторинга и логирования

```mermaid
graph TB
    subgraph "Logging System"
        A[Logger] --> B[Run Logger]
        A --> C[Audit Logger]
        A --> D[Performance Logger]
        A --> E[Security Logger]
        A --> F[Business Logger]
    end
    
    subgraph "Monitoring"
        G[Performance Manager] --> H[Database Metrics]
        G --> I[Redis Metrics]
        G --> J[Cache Metrics]
        G --> K[API Metrics]
    end
    
    subgraph "Health Checks"
        L[Health Checker] --> M[Database Health]
        L --> N[Redis Health]
        L --> O[External API Health]
        L --> P[Service Health]
    end
    
    subgraph "Alerts"
        Q[Alert Manager] --> R[Performance Alerts]
        Q --> S[Error Alerts]
        Q --> T[Security Alerts]
        Q --> U[Resource Alerts]
    end
    
    A --> G
    G --> L
    L --> Q
```

## 🚀 Производительность и кэширование

```mermaid
graph TB
    subgraph "Cache Layer"
        A[Cache Service] --> B[Universal Cache]
        A --> C[WB API Cache]
        A --> D[Session Cache]
        A --> E[User Cache]
    end
    
    subgraph "Database Optimization"
        F[Optimized Prisma] --> G[Connection Pooling]
        F --> H[Query Optimization]
        F --> I[Bulk Operations]
        F --> J[Index Management]
    end
    
    subgraph "Retry Logic"
        K[Retry Service] --> L[Exponential Backoff]
        K --> M[Jitter]
        K --> N[Circuit Breaker]
        K --> O[Retryable Errors]
    end
    
    subgraph "Performance Monitoring"
        P[Performance Tracker] --> Q[Slow Query Detection]
        P --> R[Cache Hit Rate]
        P --> S[API Response Time]
        P --> T[Resource Usage]
    end
    
    A --> F
    F --> K
    K --> P
```

## 🤖 Браузерная автоматизация

```mermaid
graph TB
    subgraph "Browser Management"
        A[Robust Browser Manager] --> B[Playwright]
        A --> C[Puppeteer]
        A --> D[Anti-Detection]
        A --> E[Human Behavior]
    end
    
    subgraph "Selector Strategies"
        F[Selector Manager] --> G[Multiple Strategies]
        F --> H[Fallback Mechanisms]
        F --> I[Adaptive Timeouts]
        F --> J[Element Validation]
    end
    
    subgraph "Automation Monitor"
        K[Automation Monitor] --> L[Session Tracking]
        K --> M[Step Monitoring]
        K --> N[Error Detection]
        K --> O[Performance Metrics]
    end
    
    subgraph "Auto Booking"
        P[Auto Booking Service] --> Q[Slot Detection]
        P --> R[Form Filling]
        P --> S[Validation]
        P --> T[Result Processing]
    end
    
    A --> F
    F --> K
    K --> P
```

## 📈 Метрики и KPI

```mermaid
graph TB
    subgraph "Business Metrics"
        A[Slot Detection Rate] --> B[Success Rate: 99.5%+]
        C[Booking Success Rate] --> D[Success Rate: 95%+]
        E[User Satisfaction] --> F[Response Time: <200ms]
    end
    
    subgraph "Technical Metrics"
        G[API Response Time] --> H[Improvement: 90-95%]
        I[Cache Hit Rate] --> J[Rate: 85-95%]
        K[Database Performance] --> L[Query Time: 80-90% improvement]
    end
    
    subgraph "Reliability Metrics"
        M[System Uptime] --> N[Target: 99.9%]
        O[Error Rate] --> P[Target: <0.1%]
        Q[Recovery Time] --> R[Target: <5 minutes]
    end
    
    subgraph "Security Metrics"
        S[Security Events] --> T[Monitoring: 100%]
        U[Data Encryption] --> V[Coverage: 100%]
        W[Access Control] --> X[Compliance: 100%]
    end
```

## 🗺️ Roadmap и приоритеты

```mermaid
gantt
    title Roadmap проекта WB Slots
    dateFormat  YYYY-MM-DD
    section Критические задачи
    Устранение дублирования кода    :crit, critical1, 2024-12-20, 3w
    Исправление SOLID нарушений     :crit, critical2, after critical1, 2w
    
    section Важные задачи
    Расширение E2E тестов          :important1, after critical2, 1w
    Завершение документации        :important2, after important1, 1w
    
    section Дополнительные задачи
    Оптимизация производительности  :additional1, after important2, 5d
    Улучшения UI                   :additional2, after additional1, 1w
    
    section Долгосрочные цели
    Dashboard мониторинга          :longterm1, after additional2, 2w
    Мобильное приложение           :longterm2, after longterm1, 4w
    ML интеграция                  :longterm3, after longterm2, 6w
```

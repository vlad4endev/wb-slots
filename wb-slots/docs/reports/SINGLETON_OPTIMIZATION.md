# Оптимизация Синглтонов для Next.js

## Проблема

В Next.js dev-режиме модули могут перезагружаться при:
- Hot Module Replacement (HMR)
- Server-Side Rendering (SSR) 
- API routes
- Prerendering страниц

Это приводит к множественной инициализации синглтонов при каждой перезагрузке модуля.

## Симптомы

```
[INFO] ErrorRecoverySystem initialized 5 default recovery strategies
[INFO] ErrorTracker Alert added: critical-errors  
[INFO] ErrorRecoverySystem initialized 5 default recovery strategies  // <- Дубликат
[INFO] ErrorTracker Alert added: critical-errors  // <- Дубликат
```

## Решение

Использование `globalThis` (или `global` в Node.js) для хранения instance между перезагрузками модулей.

### До:

```typescript
export class ErrorRecoverySystem {
  private static instance: ErrorRecoverySystem;
  
  public static getInstance(): ErrorRecoverySystem {
    if (!ErrorRecoverySystem.instance) {
      ErrorRecoverySystem.instance = new ErrorRecoverySystem();
    }
    return ErrorRecoverySystem.instance;
  }
}

// ❌ Создается заново при каждом импорте модуля
export const errorRecoverySystem = ErrorRecoverySystem.getInstance();
```

### После:

```typescript
export class ErrorRecoverySystem {
  // ... класс остается тем же
}

// ✅ Использует globalThis для сохранения между hot-reloads
declare global {
  var __errorRecoverySystem: ErrorRecoverySystem | undefined;
}

if (!global.__errorRecoverySystem) {
  global.__errorRecoverySystem = ErrorRecoverySystem.getInstance();
}

export const errorRecoverySystem = global.__errorRecoverySystem;
```

## Исправленные Сервисы

1. ✅ **ErrorRecoverySystem** (`lib/errors/error-recovery.ts`)
2. ✅ **ErrorTracker** (`lib/errors/error-tracking.ts`)
3. ✅ **AdvancedErrorClassifier** (`lib/errors/advanced-error-classification.ts`)

## Результат

- **До**: 5-10+ инициализаций каждого сервиса при старте dev-сервера
- **После**: 1 инициализация, которая переиспользуется между hot-reloads

## Важно

### Development vs Production

В **production** сборке эта проблема не возникает, так как:
- Нет hot-reload
- Модули загружаются один раз
- SSR происходит в стабильном окружении

Но оптимизация с `globalThis` безопасна и для production.

### Тестирование

Для unit-тестов можно очистить глобальные синглтоны:

```typescript
// В beforeEach или afterEach
global.__errorRecoverySystem = undefined;
global.__errorTracker = undefined;
global.__advancedErrorClassifier = undefined;
```

## Дополнительно

Файл `lib/global-singletons.ts` содержит вспомогательные функции для работы с глобальными синглтонами:

```typescript
import { getGlobalErrorRecoverySystem } from '@/lib/global-singletons';

const recovery = getGlobalErrorRecoverySystem();
```

## Рекомендации

При создании новых сервисов-синглтонов:

1. **Используйте паттерн `globalThis`** для избежания множественных инициализаций
2. **Логируйте инициализацию** только один раз
3. **Тестируйте** с очисткой глобального состояния

## Performance Impact

- **Memory**: Минимальный (синглтоны и так должны быть в единственном экземпляре)
- **CPU**: Значительное улучшение (нет повторных инициализаций)
- **Logs**: Чистые логи без дубликатов ✨


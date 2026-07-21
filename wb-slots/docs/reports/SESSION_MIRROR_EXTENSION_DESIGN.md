# Session Mirror + Cookie Sync Extension Plan

### 1. Context & Goals

- Автобронирование уже унифицировано вокруг `UnifiedAutoBookingService`, `AutoBookingManager` и `AutoBookingEntryPoint`, см. `src/lib/services/unified-autobooking-service.ts` и `src/lib/services/autobooking-entry-point.ts`. Эти классы управляют стратегиями (`API_FIRST`, `BROWSER_FIRST`, `HYBRID`), очередями и логами.
- Сессии Wildberries для API и браузера ведёт `UnifiedWBSessionManager` (`src/lib/services/unified-wb-session-manager.ts`) и API `POST /api/wb-session/extract-cookies`, `GET /api/wb-session/check`, `POST /api/wb-session/refresh`.
- Проблема: браузерная часть автобронирования требует «живой» сессии. Сервер не должен входить в WB, поэтому нужен гибрид “Session Mirror + Cookie Sync”.

### 2. Целевое решение

1. **Session Mirror**: бекенд хранит только отражение состояния (валидность, seller_id, warehouse_id). Источник правды — браузер пользователя.
2. **Cookie Sync**: после ручного логина расширение ловит критичные cookie (`WBToken`, `WBTokenSig`, `x-supplier-token`, `x-supplier-id`, `__wblid`, при необходимости `wbx_session_id`) и синхронизирует их с сервером.
3. **Live Presence Guard**: расширение отслеживает истечение cookie, события `chrome.cookies.onChanged`, активность вкладки и уведомляет сервер (`USER_REAUTH_REQUIRED`, `SESSION_EXTENDED`, `KEEPALIVE_TICK`).
4. **Server-side Gatekeeper**: перед каждым действием автобронирования вызываем `SessionMirrorService.ensureAuthorized`. При невалидной сессии задачи переводятся в `WAITING_FOR_USER_LOGIN`.

### 3. Chrome Extension Architecture (Manifest V3)

| Component | Purpose |
|-----------|---------|
| `service_worker` (background) | Централизованное состояние, cookie watcher, WebSocket/SSE клиент, ретраи синхронизации |
| `content_script` | Лёгкий слой на страницах seller.wildberries.ru: детект логина, heartbeat, микроскролл |
| `options_page` / `popup` | UI статуса сессии, ввод pairing token, кнопки «Синхронизировать» |

**Ключевые функции background worker:**

```text
init() -> получить токен сервера -> открыть WebSocket/long poll
captureCookies() -> chrome.cookies.getAll({ domain: '.wildberries.ru' }) -> фильтр ключевых
syncCookies(payload) -> POST /api/session-mirror/sync
watchChanges() -> chrome.cookies.onChanged -> debounce -> syncCookies
checkAuth() -> fetch https://seller.wildberries.ru/suppliers/api/ping -> отправить статус
```

### 4. Backend Additions (Next.js API + Prisma)

1. **`POST /api/session-mirror/sync`**
   - Auth: bearer-токен, выданный после pairing.
   - Payload: `{ userId, tokens: {...}, timestamp, fingerprint }`.
   - Действия: вызвать `getUnifiedSessionManager()`, зашифровать cookie, обновить `wBSession` и `SessionMirrorState`.
2. **`POST /api/session-mirror/event`**
   - События: `USER_REAUTH_REQUIRED`, `SESSION_EXTENDED`, `HEARTBEAT`.
   - Обновляет статусы задач через `AutoBookingIntegration.updateTaskStatus`.
3. **`GET /api/session-mirror/status`**
   - Возвращает `isAuthorized`, `expiresAt`, `sellerId`, `warehouseAccess`, `lastHeartbeat`.
4. **`SessionMirrorService`**
   - Обёртка над `UnifiedWBSessionManager`.
   - Методы: `ingestCookies`, `ensureAuthorized`, `getSessionSnapshot`, `requireReauth`, `subscribe`.

### 5. Интеграция с автобронированием

1. **Валидация перед действиями**
   - В `UnifiedAutoBookingService.bookSlot` и `bookViaBrowser` вызываем `sessionMirror.ensureAuthorized`.
   - При ошибке пробрасываем `SessionExpiredError`, переводим задачу в ожидание.

```text
50:67:src/lib/services/unified-autobooking-service.ts
async bookSlot(config: AutoBookingConfig): Promise<BookingResult> {
  await this.sessionMirror.ensureAuthorized(config.userId, {
    requiredWarehouseId: config.slot.warehouseId,
    requiredSellerId: config.supply.id
  });
  ...
}
```

2. **AutoBookingEntryPoint health**: поле `sessionMirror` в ответе `getSystemStatus`.
3. **Queue manager hooks**: при `USER_REAUTH_REQUIRED` элементы очереди помечаются как `BLOCKED_BY_SESSION`.

### 6. Extension ↔ Backend Protocol

```jsonc
POST /api/session-mirror/sync
{
  "userId": "usr_123",
  "timestamp": "2025-11-15T10:05:02.123Z",
  "fingerprint": {
    "ua": "...",
    "platform": "win32",
    "webgl": "...",
    "screen": "1920x1080"
  },
  "tokens": {
    "WBToken": "...",
    "WBTokenSig": "...",
    "x-supplier-token": "...",
    "x-supplier-id": "...",
    "__wblid": "..."
  }
}
```

Ответ: `{ success: true, sessionId, status: "AUTHORIZED", expiresAt, commands: [...] }`. Команды ограничены действиями UI (показ уведомления, удержание вкладки), сервер не входит в WB.

### 7. Presence Simulation Strategies

- **Tab Pinning**: расширение держит активной вкладку WB и имитирует человеческую активность (микроскролл, blur/focus).
- **Keepalive**: `chrome.alarms.create('wb-keepalive', { periodInMinutes: 1 })` → `PATCH /api/session-mirror/heartbeat`.
- **Expiring Cookies Watcher**: при удалении/истечении ключевых cookie отправляется `USER_REAUTH_REQUIRED` + уведомление пользователю.

### 8. Security & Compliance

- Расширение не знает логин/пароль; сервер не совершает запросы к WB.
- Cookie шифруются AES-256-GCM в `UnifiedWBSessionManager`, в логах используются `maskToken`.
- Transport: HTTPS + короткоживущие bearer токены.
- Fingerprint опционален, хранится как хэш.
- Manifest V3 разрешения: `cookies`, `storage`, `activeTab`, `scripting`, `alarms`, `notifications`.

### 9. Rollout Plan

1. **Phase 1 — Backend groundwork**: `SessionMirrorService`, API, изменения в автобронировании.
2. **Phase 2 — Extension MVP**: сбор cookie через popup, ручная синхронизация, отображение статуса.
3. **Phase 3 — Presence automation**: watchers, heartbeat, уведомления.
4. **Phase 4 — Hardening**: логи, rate limiting, интеграционные тесты (`test-autobooking-integration.js`) с mock extension API.

### 10. Testing Strategy

- **Unit**: мок `SessionMirrorService`, проверки отказа `UnifiedAutoBookingService` без сессии.
- **Integration**: `test-autobooking-integration.js` — симулировать `/api/session-mirror/sync`, убедиться что задачи выходят из `WAITING_FOR_USER_LOGIN`.
- **Manual**: QA-инструкция — установить расширение, залогиниться в WB, запустить `npm run autobooking:test`, убедиться что `sessionMirror` = `healthy`.

### 11. Next Steps Checklist

1. Создать `SessionMirrorService`.
2. Обновить API `wb-session/extract-cookies`, направить трафик на `/api/session-mirror/sync`.
3. Добавить проверки `ensureAuthorized` в `UnifiedAutoBookingService` и `AutoBookingEntryPoint`.
4. Сконфигурировать Manifest V3 расширение (Vite + TS).
5. Подготовить инструкции и UI предупреждения.

Результат: сервер хранит только отражение состояния, реальная сессия живёт в браузере пользователя, что повышает надёжность и совместимость.

---

### 12. SessionMirrorService — детализация

```ts
// src/lib/services/session-mirror-service.ts
export class SessionMirrorService {
  constructor(
    private readonly sessionManager = getUnifiedSessionManager(),
    private readonly cache = new SessionMirrorCache(),
    private readonly notifier = new SessionEventBus()
  ) {}

  async ingestCookies(userId: string, payload: SessionSyncPayload) {
    const encryptedCookies = this.sessionManager.encryptCookies(payload.tokens);
    await prisma.wBSession.upsert({ ...encryptedCookies });
    await this.cache.set(userId, {
      isAuthorized: true,
      sellerId: payload.tokens['x-supplier-id'],
      expiresAt: payload.expiry ?? addDays(new Date(), 7),
      lastHeartbeat: payload.timestamp
    });
    this.notifier.emit('SESSION_UPDATED', { userId });
  }

  async ensureAuthorized(userId: string, ctx?: EnsureContext) {
    const snapshot = await this.getSessionSnapshot(userId);
    if (!snapshot?.isAuthorized) {
      throw new SessionExpiredError({ userId, reason: 'no_session' });
    }
    if (ctx?.requiredWarehouseId && !snapshot.allowedWarehouses?.includes(ctx.requiredWarehouseId)) {
      throw new SessionExpiredError({ userId, reason: 'warehouse_mismatch' });
    }
    if (snapshot.expiresAt < Date.now()) {
      throw new SessionExpiredError({ userId, reason: 'expired' });
    }
    return snapshot;
  }

  // Дополнительно: requireReauth, subscribe, heartbeat, pruneExpired, getDiagnostics.
}
```

**Таблица `SessionMirrorState`:**

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string (PK) | |
| `sessionId` | string | Ссылка на `wBSession.id` |
| `isAuthorized` | boolean | Флаг валидности |
| `sellerId` | string | Для сверки с задачами |
| `allowedWarehouses` | int[] | Фильтрация доступов |
| `lastHeartbeat` | Date | Обновляется расширением |
| `expiresAt` | Date | Быстрая проверка TTL |
| `status` | enum(`AUTHORIZED`,`REAUTH_REQUIRED`,`STALE`) | Для UI/очередей |

### 13. Chrome Extension Implementation Notes

- **Stack**: Vite + TypeScript + `@types/chrome`. Общение между service worker и content script через `chrome.runtime.sendMessage`.
- **Manifest excerpt:**

```json
{
  "manifest_version": 3,
  "name": "WB Session Mirror",
  "permissions": ["cookies", "storage", "alarms", "notifications", "scripting"],
  "host_permissions": ["https://seller.wildberries.ru/*", "https://*.wildberries.ru/*"],
  "background": { "service_worker": "background.js", "type": "module" },
  "content_scripts": [{
    "matches": ["https://seller.wildberries.ru/*"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }],
  "action": { "default_popup": "popup.html" }
}
```

- **State machine**:
  - `UNPAIRED` → пользователь устанавливает расширение и вводит pairing token.
  - `AWAITING_LOGIN` → расширение ждёт ручного входа в WB.
  - `AUTHORIZED` → cookie синхронизированы, heartbeat активен.
  - `STALE` → TTL < 1 часа, пользователю показывается уведомление.

### 14. Event Flow Scenarios

1. **Initial Pairing**
   1. Пользователь жмёт «Подключить расширение».
   2. Сервер генерирует pairing token (таблица `sessionMirrorTokens`).
   3. Пользователь вводит token в popup → `POST /api/session-mirror/pair`.
   4. Сервер выдаёт `extensionAccessToken` (30 мин) + `refreshToken`.
2. **Cookie Sync**
   1. Content script фиксирует успешный вход (`WB_LOGIN_SUCCESS`).
   2. Background берет cookie, фильтрует, вызывает `/sync`.
   3. Сервер сохраняет данные, возвращает `status: AUTHORIZED`.
3. **Session Expiry**
   1. `chrome.cookies.onChanged` сообщает об удалении `WBToken`.
   2. Background отправляет `/event` с `USER_REAUTH_REQUIRED`.
   3. Backend вызывает `requireReauth`, переводит задачи в `BLOCKED_BY_SESSION`, уведомляет пользователя (UI/Telegram).

### 15. Data Retention & Security

- Cookie тела не логируются; используем `maskToken`.
- `SessionMirrorState` очищается cron-скриптом (`node scripts/cleanup-sessions.js`) каждые 12 часов.
- Расширение хранит `extensionAccessToken` в `chrome.storage.local`, шифруя JSON через `crypto.subtle` (AES-GCM, ключ из pairing token + salt).
- CORS: `/api/session-mirror/*` принимает запросы только от `chrome-extension://<id>`, валидируем `Origin`.

### 16. Deployment Considerations

- **Staging**: отдельный Extension ID (unpacked) + staging backend URL.
- **Prod rollout**:
  - Подготовить store listing + privacy policy (описать сбор cookie только после явного действия).
  - Включить feature flag `SESSION_MIRROR_ENABLED`.
  - Канареечный запуск (5‑10% пользователей), мониторинг `session_mirror_*` метрик.
- **Monitoring**:
  - Prometheus: `session_mirror_heartbeats_total`, `session_mirror_reauth_requests_total`, `session_mirror_latency_ms`.
  - Логи помечаются тегом `session-mirror`.

### 17. Open Questions

- Нужно ли поддерживать Firefox? (WebExtensions API совместим, но есть отличия в cookies API).
- Нужен ли оффлайн-режим (кеширование команд при недоступном сервере)?
- Нужно ли синхронизировать `localStorage` WB для сценариев с несколькими seller_id?

Ответы определят приоритеты фазы Hardening.


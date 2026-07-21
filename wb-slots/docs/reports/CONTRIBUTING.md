# 🤝 Руководство по вкладу в проект

Спасибо за интерес к проекту WB Slots! Мы приветствуем любой вклад в развитие проекта.

## 📋 Содержание

- [Код поведения](#-код-поведения)
- [Как внести вклад](#-как-внести-вклад)
- [Процесс разработки](#-процесс-разработки)
- [Стиль кода](#-стиль-кода)
- [Тестирование](#-тестирование)
- [Документация](#-документация)
- [Сообщение об ошибках](#-сообщение-об-ошибках)
- [Предложение функций](#-предложение-функций)

## 📜 Код поведения

Этот проект следует [Кодексу поведения Contributor Covenant](CODE_OF_CONDUCT.md). Участвуя в проекте, вы соглашаетесь соблюдать его условия.

## 🚀 Как внести вклад

### 1. Fork репозитория

Нажмите кнопку "Fork" в правом верхнем углу страницы репозитория.

### 2. Клонируйте ваш fork

```bash
git clone https://github.com/your-username/wb-slots.git
cd wb-slots
```

### 3. Добавьте upstream remote

```bash
git remote add upstream https://github.com/original-username/wb-slots.git
```

### 4. Создайте feature branch

```bash
git checkout -b feature/amazing-feature
# или
git checkout -b fix/bug-description
```

### 5. Внесите изменения

Следуйте [стилю кода](#-стиль-кода) и [процессу разработки](#-процесс-разработки).

### 6. Commit изменения

```bash
git add .
git commit -m "feat: add amazing feature"
```

### 7. Push в ваш fork

```bash
git push origin feature/amazing-feature
```

### 8. Создайте Pull Request

Перейдите на GitHub и создайте Pull Request с описанием ваших изменений.

## 🔄 Процесс разработки

### 1. Планирование

- Обсудите крупные изменения в Issues перед началом работы
- Убедитесь, что ваша идея не дублирует существующие предложения
- Получите одобрение от maintainers для больших изменений

### 2. Разработка

- Создайте отдельную ветку для каждой функции/исправления
- Делайте небольшие, логически завершенные коммиты
- Пишите понятные сообщения коммитов
- Тестируйте свои изменения

### 3. Code Review

- Все изменения проходят через code review
- Отвечайте на комментарии ревьюеров
- Вносите исправления по мере необходимости

### 4. Слияние

- После одобрения изменения сливаются в main ветку
- Ветка feature удаляется после слияния

## 📝 Стиль кода

### TypeScript/JavaScript

- Используйте **TypeScript** для всех новых файлов
- Следуйте **ESLint** правилам проекта
- Используйте **Prettier** для форматирования
- Предпочитайте **const** и **let** вместо **var**

```typescript
// ✅ Хорошо
const fetchUserData = async (userId: string): Promise<User> => {
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
};

// ❌ Плохо
function fetchUserData(userId) {
  return fetch('/api/users/' + userId).then(r => r.json());
}
```

### React компоненты

- Используйте **функциональные компоненты** с хуками
- Применяйте **TypeScript** для пропсов и состояний
- Используйте **PascalCase** для имен компонентов

```typescript
// ✅ Хорошо
interface UserCardProps {
  user: User;
  onEdit: (user: User) => void;
}

export const UserCard: React.FC<UserCardProps> = ({ user, onEdit }) => {
  const [isLoading, setIsLoading] = useState(false);
  
  return (
    <div className="user-card">
      <h3>{user.name}</h3>
      <button onClick={() => onEdit(user)}>
        Редактировать
      </button>
    </div>
  );
};
```

### CSS/Styling

- Используйте **TailwindCSS** для стилизации
- Применяйте **shadcn/ui** компоненты когда возможно
- Следуйте **mobile-first** подходу

```tsx
// ✅ Хорошо
<div className="flex flex-col gap-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
    Заголовок
  </h2>
</div>
```

### Именование

- **Файлы**: kebab-case (`user-settings.tsx`)
- **Компоненты**: PascalCase (`UserSettings`)
- **Функции**: camelCase (`fetchUserData`)
- **Константы**: UPPER_SNAKE_CASE (`API_BASE_URL`)
- **Типы**: PascalCase (`UserProfile`)

## 🧪 Тестирование

### Unit тесты

```bash
# Запуск тестов
npm run test

# Тесты с покрытием
npm run test:coverage

# Тесты в watch режиме
npm run test:watch
```

### E2E тесты

```bash
# Запуск E2E тестов
npm run test:e2e

# Запуск в UI режиме
npm run test:e2e:ui
```

### Примеры тестов

```typescript
// Unit тест
describe('UserService', () => {
  it('should fetch user by id', async () => {
    const user = await userService.getUserById('123');
    expect(user).toBeDefined();
    expect(user.id).toBe('123');
  });
});

// E2E тест
test('user can login', async ({ page }) => {
  await page.goto('/auth/login');
  await page.fill('[data-testid="email"]', 'test@example.com');
  await page.fill('[data-testid="password"]', 'password123');
  await page.click('[data-testid="login-button"]');
  await expect(page).toHaveURL('/dashboard');
});
```

## 📚 Документация

### Обновление README

- Обновляйте README при добавлении новых функций
- Добавляйте примеры использования
- Обновляйте список зависимостей

### Комментарии в коде

```typescript
/**
 * Выполняет поиск доступных слотов для поставки
 * @param filters - Параметры фильтрации поиска
 * @param userId - ID пользователя для изоляции данных
 * @returns Promise с массивом найденных слотов
 */
export const searchSlots = async (
  filters: SlotSearchFilters,
  userId: string
): Promise<FoundSlot[]> => {
  // Реализация...
};
```

### API документация

- Документируйте все API эндпоинты
- Используйте JSDoc для описания параметров
- Добавляйте примеры запросов и ответов

## 🐛 Сообщение об ошибках

### Перед созданием Issue

1. Проверьте существующие Issues
2. Убедитесь, что используете последнюю версию
3. Попробуйте воспроизвести ошибку

### Шаблон для багов

```markdown
## Описание
Краткое описание проблемы

## Шаги для воспроизведения
1. Перейти на страницу '...'
2. Нажать на кнопку '...'
3. Увидеть ошибку

## Ожидаемое поведение
Что должно происходить

## Фактическое поведение
Что происходит на самом деле

## Скриншоты
Если применимо, добавьте скриншоты

## Окружение
- OS: [e.g. Windows 10]
- Browser: [e.g. Chrome 91]
- Version: [e.g. 1.0.0]

## Дополнительная информация
Любая другая информация об ошибке
```

## 💡 Предложение функций

### Шаблон для feature requests

```markdown
## Описание функции
Краткое описание предлагаемой функции

## Проблема
Какую проблему решает эта функция?

## Предлагаемое решение
Подробное описание того, как должна работать функция

## Альтернативы
Рассмотренные альтернативные решения

## Дополнительная информация
Любая другая информация о предложении
```

## 📞 Получение помощи

- 💬 **Discord**: [Сервер сообщества](https://discord.gg/wb-slots)
- 📧 **Email**: dev@wb-slots.com
- 💬 **Telegram**: [@wb_slots_dev](https://t.me/wb_slots_dev)

## 🏆 Признание контрибьюторов

Все контрибьюторы будут отмечены в файле [CONTRIBUTORS.md](CONTRIBUTORS.md).

## 📄 Лицензия

Внося вклад в проект, вы соглашаетесь, что ваш вклад будет лицензирован под лицензией MIT.

---

**Спасибо за ваш вклад в развитие WB Slots! 🚀**

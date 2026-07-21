@echo off
echo ========================================
echo    Исправление проблем с токенами
echo ========================================
echo.

echo [1/4] Проверка структуры проекта...
if not exist "wb-slots\src\app\api\tokens\route.ts" (
    echo ❌ API endpoint для токенов не найден
    echo 💡 Проверьте структуру проекта
    pause
    exit /b 1
) else (
    echo ✅ API endpoint найден
)

if not exist "wb-slots\src\lib\encryption.ts" (
    echo ❌ Модуль шифрования не найден
    echo 💡 Проверьте структуру проекта
    pause
    exit /b 1
) else (
    echo ✅ Модуль шифрования найден
)

echo.
echo [2/4] Запуск диагностики токенов...
cd wb-slots
if exist scripts\debug-token-save.js (
    echo Запускаем диагностику токенов...
    node scripts\debug-token-save.js
) else (
    echo ⚠️ Скрипт диагностики не найден
)

echo.
echo [3/4] Проверка переменных окружения...
if not exist ".env.local" (
    echo ⚠️ Файл .env.local не найден
    echo 💡 Создайте файл с переменными окружения
) else (
    echo ✅ Файл .env.local найден
)

echo.
echo [4/4] Рекомендации по исправлению:
echo.
echo 🔧 ВОЗМОЖНЫЕ ПРИЧИНЫ ПРОБЛЕМ:
echo.
echo 1. ПРОБЛЕМЫ С ВАЛИДАЦИЕЙ:
echo    - Проверьте, что токен не пустой
echo    - Убедитесь, что выбрана категория MARKETPLACE
echo    - Проверьте формат токена WB
echo.
echo 2. ПРОБЛЕМЫ С ШИФРОВАНИЕМ:
echo    - Проверьте переменную ENCRYPTION_KEY в .env.local
echo    - Убедитесь, что ключ имеет правильный формат (base64, 32 байта)
echo.
echo 3. ПРОБЛЕМЫ С БАЗОЙ ДАННЫХ:
echo    - Проверьте подключение к PostgreSQL
echo    - Убедитесь, что таблица user_tokens существует
echo    - Проверьте права доступа к базе данных
echo.
echo 4. ПРОБЛЕМЫ С АУТЕНТИФИКАЦИЕЙ:
echo    - Убедитесь, что пользователь авторизован
echo    - Проверьте JWT токен в cookies
echo    - Проверьте переменную JWT_SECRET
echo.
echo 📋 ДЕЙСТВИЯ ДЛЯ ИСПРАВЛЕНИЯ:
echo.
echo 1. Откройте консоль браузера (F12)
echo 2. Попробуйте добавить токен через интерфейс
echo 3. Проверьте логи в консоли браузера
echo 4. Проверьте логи сервера
echo 5. Запустите диагностику: node scripts\debug-token-save.js
echo.
echo 🔍 ПРОВЕРКА ТОКЕНА WB:
echo.
echo - Токен должен начинаться с букв/цифр
echo - Длина токена обычно 32-64 символа
echo - Не должен содержать пробелы в начале/конце
echo - Категория должна быть MARKETPLACE для API складов
echo.
echo ========================================
echo    Диагностика завершена
echo ========================================
pause

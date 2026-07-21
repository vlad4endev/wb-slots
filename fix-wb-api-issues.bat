@echo off
echo ========================================
echo    Исправление проблем с WB API
echo ========================================
echo.

echo [1/5] Проверка сетевого подключения...
ping -n 1 8.8.8.8 >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Нет интернет-соединения
    echo 💡 Проверьте подключение к интернету
    pause
    exit /b 1
) else (
    echo ✅ Интернет-соединение работает
)

echo.
echo [2/5] Проверка DNS серверов...
nslookup google.com >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Проблемы с DNS
    echo 💡 Попробуйте изменить DNS на 8.8.8.8 и 1.1.1.1
) else (
    echo ✅ DNS работает
)

echo.
echo [3/5] Проверка доступности WB доменов...
echo Проверяем suppliers-api.wildberries.ru...
nslookup suppliers-api.wildberries.ru >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ suppliers-api.wildberries.ru недоступен
    echo 💡 Возможна блокировка домена
) else (
    echo ✅ suppliers-api.wildberries.ru доступен
)

echo.
echo [4/5] Запуск диагностики сети...
cd wb-slots
if exist scripts\diagnose-network.js (
    echo Запускаем детальную диагностику...
    node scripts\diagnose-network.js
) else (
    echo ⚠️ Скрипт диагностики не найден
)

echo.
echo [5/5] Рекомендации по исправлению:
echo.
echo 🔧 ВОЗМОЖНЫЕ РЕШЕНИЯ:
echo.
echo 1. ИЗМЕНИТЬ DNS СЕРВЕРЫ:
echo    - Откройте настройки сети
echo    - Измените DNS на: 8.8.8.8 и 1.1.1.1
echo    - Перезапустите сетевой адаптер
echo.
echo 2. ИСПОЛЬЗОВАТЬ VPN:
echo    - Установите VPN для обхода блокировок
echo    - Попробуйте разные серверы
echo.
echo 3. ПРОВЕРИТЬ ФАЙРВОЛ:
echo    - Временно отключите файрвол
echo    - Проверьте настройки антивируса
echo.
echo 4. ДОБАВИТЬ API КЛЮЧ:
echo    - Войдите в личный кабинет WB
echo    - Создайте API ключ с категорией MARKETPLACE
echo    - Добавьте ключ в настройки приложения
echo.
echo 5. ПРОВЕРИТЬ ПРОКСИ:
echo    - Отключите прокси-серверы
echo    - Проверьте корпоративные настройки
echo.
echo 📋 СТАТУС: Fallback данные (100 складов) будут использованы
echo    если API недоступен
echo.
echo ========================================
echo    Диагностика завершена
echo ========================================
pause

@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    НАСТРОЙКА АВТОМАТИЧЕСКОГО РЕЗЕРВНОГО КОПИРОВАНИЯ
echo ========================================
echo.

:: Получаем текущий путь к скрипту
set "SCRIPT_DIR=%~dp0"
set "BACKUP_SCRIPT=%SCRIPT_DIR%backup-user-data.bat"

:: Проверяем существование скрипта резервного копирования
if not exist "%BACKUP_SCRIPT%" (
    echo [ERROR] Скрипт backup-user-data.bat не найден!
    echo [INFO] Убедитесь, что все скрипты находятся в одной папке
    pause
    exit /b 1
)

echo [INFO] Настройка автоматического резервного копирования
echo [INFO] Путь к скрипту: %BACKUP_SCRIPT%
echo.

:: Меню выбора
echo Выберите расписание резервного копирования:
echo.
echo 1. Ежедневно в 2:00 ночи
echo 2. Ежедневно в 3:00 ночи  
echo 3. Еженедельно (воскресенье в 2:00)
echo 4. Еженедельно (воскресенье в 3:00)
echo 5. Каждые 6 часов
echo 6. Каждые 12 часов
echo 7. Удалить существующее расписание
echo 8. Показать текущие задачи
echo 9. Выход
echo.

set /p choice="Введите номер (1-9): "

if "%choice%"=="1" goto daily_2am
if "%choice%"=="2" goto daily_3am
if "%choice%"=="3" goto weekly_sunday_2am
if "%choice%"=="4" goto weekly_sunday_3am
if "%choice%"=="5" goto every_6h
if "%choice%"=="6" goto every_12h
if "%choice%"=="7" goto remove_task
if "%choice%"=="8" goto show_tasks
if "%choice%"=="9" goto exit
goto invalid_choice

:daily_2am
echo [INFO] Создание задачи: ежедневно в 2:00 ночи
schtasks /create /tn "WB-Slots-Daily-Backup" /tr "\"%BACKUP_SCRIPT%\"" /sc daily /st 02:00 /f
goto check_result

:daily_3am
echo [INFO] Создание задачи: ежедневно в 3:00 ночи
schtasks /create /tn "WB-Slots-Daily-Backup" /tr "\"%BACKUP_SCRIPT%\"" /sc daily /st 03:00 /f
goto check_result

:weekly_sunday_2am
echo [INFO] Создание задачи: еженедельно в воскресенье в 2:00
schtasks /create /tn "WB-Slots-Weekly-Backup" /tr "\"%BACKUP_SCRIPT%\"" /sc weekly /d SUN /st 02:00 /f
goto check_result

:weekly_sunday_3am
echo [INFO] Создание задачи: еженедельно в воскресенье в 3:00
schtasks /create /tn "WB-Slots-Weekly-Backup" /tr "\"%BACKUP_SCRIPT%\"" /sc weekly /d SUN /st 03:00 /f
goto check_result

:every_6h
echo [INFO] Создание задачи: каждые 6 часов
schtasks /create /tn "WB-Slots-6h-Backup" /tr "\"%BACKUP_SCRIPT%\"" /sc hourly /mo 6 /f
goto check_result

:every_12h
echo [INFO] Создание задачи: каждые 12 часов
schtasks /create /tn "WB-Slots-12h-Backup" /tr "\"%BACKUP_SCRIPT%\"" /sc hourly /mo 12 /f
goto check_result

:remove_task
echo [INFO] Удаление существующих задач резервного копирования...
schtasks /delete /tn "WB-Slots-Daily-Backup" /f >nul 2>&1
schtasks /delete /tn "WB-Slots-Weekly-Backup" /f >nul 2>&1
schtasks /delete /tn "WB-Slots-6h-Backup" /f >nul 2>&1
schtasks /delete /tn "WB-Slots-12h-Backup" /f >nul 2>&1
echo [OK] Задачи удалены
goto show_tasks

:show_tasks
echo.
echo [INFO] Текущие задачи резервного копирования:
echo.
schtasks /query /tn "WB-Slots-Daily-Backup" 2>nul | findstr /C:"Task Name" /C:"Next Run Time" /C:"Status"
schtasks /query /tn "WB-Slots-Weekly-Backup" 2>nul | findstr /C:"Task Name" /C:"Next Run Time" /C:"Status"
schtasks /query /tn "WB-Slots-6h-Backup" 2>nul | findstr /C:"Task Name" /C:"Next Run Time" /C:"Status"
schtasks /query /tn "WB-Slots-12h-Backup" 2>nul | findstr /C:"Task Name" /C:"Next Run Time" /C:"Status"
goto continue

:check_result
if errorlevel 1 (
    echo [ERROR] Ошибка создания задачи!
    echo [INFO] Возможно, требуется запуск от имени администратора
    echo [INFO] Попробуйте запустить скрипт от имени администратора
) else (
    echo [OK] Задача создана успешно!
)
goto show_tasks

:continue
echo.
echo [INFO] Дополнительные команды:
echo.
echo - Для запуска резервного копирования вручную: backup-user-data.bat
echo - Для просмотра всех задач: schtasks /query /fo table
echo - Для удаления задачи: schtasks /delete /tn "имя_задачи"
echo.
echo [INFO] Рекомендации:
echo - Ежедневное резервное копирование рекомендуется для активного использования
echo - Еженедельное резервное копирование подходит для тестовых сред
echo - Регулярно проверяйте, что резервные копии создаются успешно
echo.
pause
goto exit

:invalid_choice
echo [ERROR] Неверный выбор! Введите число от 1 до 9.
echo.
pause
goto :eof

:exit
echo [INFO] Настройка завершена
exit /b 0

@echo off
echo Starting WB Slots development server...
echo.

REM Очищаем кэш
if exist .next rmdir /s /q .next
if exist node_modules\.cache rmdir /s /q node_modules\.cache

echo Cache cleared.
echo.

REM Запускаем сервер разработки
echo Starting Next.js development server...
npm run dev

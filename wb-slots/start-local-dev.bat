@echo off 
chcp 65001 >nul 
title WB Slots - Local Development 
 
echo [INFO] Запуск только базы данных и Redis... 
docker-compose -f docker-compose.dev.yml up -d 
 
echo [INFO] Ожидание готовности сервисов... 
timeout /t 10 /nobreak >nul 
 
echo [INFO] Применение миграций... 
npx prisma db push 
 
echo [INFO] Запуск frontend... 
start "WB Slots Frontend" cmd /k "npm run dev" 
 
echo [INFO] Запуск backend... 
cd backend 
start "WB Slots Backend" cmd /k "npm run start:dev" 
cd .. 
 
echo [INFO] Запуск worker... 
start "WB Slots Worker" cmd /k "npm run worker" 
 
echo [INFO] Все сервисы запущены локально! 
pause 

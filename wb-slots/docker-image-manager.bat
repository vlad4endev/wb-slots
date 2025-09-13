@echo off
echo ========================================
echo    WB Slots Docker Image Manager
echo ========================================
echo.

:menu
echo Choose an action:
echo 1. Build image
echo 2. Build development image
echo 3. Build production image
echo 4. Push image to registry
echo 5. Pull image from registry
echo 6. Run image
echo 7. Run development image
echo 8. Stop and remove container
echo 9. View logs
echo 10. Execute shell in container
echo 11. Clean up images
echo 12. Run tests
echo 13. Backup data
echo 14. Update image
echo 15. Exit
echo.
set /p choice="Enter your choice (1-15): "

if "%choice%"=="1" goto build
if "%choice%"=="2" goto build_dev
if "%choice%"=="3" goto build_prod
if "%choice%"=="4" goto push
if "%choice%"=="5" goto pull
if "%choice%"=="6" goto run
if "%choice%"=="7" goto run_dev
if "%choice%"=="8" goto stop
if "%choice%"=="9" goto logs
if "%choice%"=="10" goto exec
if "%choice%"=="11" goto clean
if "%choice%"=="12" goto test
if "%choice%"=="13" goto backup
if "%choice%"=="14" goto update
if "%choice%"=="15" goto exit
echo Invalid choice. Please try again.
goto menu

:build
echo.
echo 🔨 Building Docker image...
docker build -t wb-slots-app:latest .
if %ERRORLEVEL% EQU 0 (
    echo ✅ Image built successfully!
) else (
    echo ❌ Build failed!
)
echo.
pause
goto menu

:build_dev
echo.
echo 🔨 Building development image...
docker build -t wb-slots-app:dev --target builder .
if %ERRORLEVEL% EQU 0 (
    echo ✅ Development image built successfully!
) else (
    echo ❌ Build failed!
)
echo.
pause
goto menu

:build_prod
echo.
echo 🔨 Building production image...
docker build -t wb-slots-app:prod --target runner .
if %ERRORLEVEL% EQU 0 (
    echo ✅ Production image built successfully!
) else (
    echo ❌ Build failed!
)
echo.
pause
goto menu

:push
echo.
echo 📤 Pushing image to registry...
set /p registry="Enter registry URL (e.g., your-registry.com): "
if "%registry%"=="" (
    echo ❌ Registry URL is required!
    goto menu
)
docker tag wb-slots-app:latest %registry%/wb-slots:latest
docker push %registry%/wb-slots:latest
if %ERRORLEVEL% EQU 0 (
    echo ✅ Image pushed successfully!
) else (
    echo ❌ Push failed!
)
echo.
pause
goto menu

:pull
echo.
echo 📥 Pulling image from registry...
set /p registry="Enter registry URL (e.g., your-registry.com): "
if "%registry%"=="" (
    echo ❌ Registry URL is required!
    goto menu
)
docker pull %registry%/wb-slots:latest
if %ERRORLEVEL% EQU 0 (
    echo ✅ Image pulled successfully!
) else (
    echo ❌ Pull failed!
)
echo.
pause
goto menu

:run
echo.
echo 🚀 Running Docker container...
docker run -d --name wb-slots-app -p 3000:3000 wb-slots-app:latest
if %ERRORLEVEL% EQU 0 (
    echo ✅ Container started successfully!
    echo 🌐 Application available at: http://localhost:3000
) else (
    echo ❌ Failed to start container!
)
echo.
pause
goto menu

:run_dev
echo.
echo 🚀 Running development container...
docker run -d --name wb-slots-app-dev -p 3000:3000 -v %cd%:/app wb-slots-app:dev
if %ERRORLEVEL% EQU 0 (
    echo ✅ Development container started successfully!
    echo 🌐 Application available at: http://localhost:3000
) else (
    echo ❌ Failed to start development container!
)
echo.
pause
goto menu

:stop
echo.
echo 🛑 Stopping and removing container...
docker stop wb-slots-app wb-slots-app-dev 2>nul
docker rm wb-slots-app wb-slots-app-dev 2>nul
echo ✅ Containers stopped and removed!
echo.
pause
goto menu

:logs
echo.
echo 📋 Container logs:
echo Choose container:
echo 1. wb-slots-app
echo 2. wb-slots-app-dev
echo.
set /p container="Enter choice (1-2): "
if "%container%"=="1" (
    docker logs -f wb-slots-app
) else if "%container%"=="2" (
    docker logs -f wb-slots-app-dev
) else (
    echo Invalid choice!
)
echo.
pause
goto menu

:exec
echo.
echo 🐚 Executing shell in container...
echo Choose container:
echo 1. wb-slots-app
echo 2. wb-slots-app-dev
echo.
set /p container="Enter choice (1-2): "
if "%container%"=="1" (
    docker exec -it wb-slots-app sh
) else if "%container%"=="2" (
    docker exec -it wb-slots-app-dev sh
) else (
    echo Invalid choice!
)
echo.
pause
goto menu

:clean
echo.
echo 🧹 Cleaning up Docker images...
echo This will remove all wb-slots-app images. Continue? (y/N)
set /p confirm="Enter y to confirm: "
if /i "%confirm%"=="y" (
    docker rmi wb-slots-app:latest wb-slots-app:dev wb-slots-app:prod 2>nul
    docker system prune -f
    echo ✅ Cleanup completed!
) else (
    echo Cleanup cancelled.
)
echo.
pause
goto menu

:test
echo.
echo 🧪 Running tests...
echo Choose test type:
echo 1. Unit tests
echo 2. Integration tests
echo 3. E2E tests
echo.
set /p test_type="Enter choice (1-3): "
if "%test_type%"=="1" (
    docker run --rm wb-slots-app:latest npm test
) else if "%test_type%"=="2" (
    docker run --rm wb-slots-app:latest npm run test:integration
) else if "%test_type%"=="3" (
    docker run --rm wb-slots-app:latest npm run test:e2e
) else (
    echo Invalid choice!
)
echo.
pause
goto menu

:backup
echo.
echo 💾 Creating backup...
set backup_name=wb-slots-backup-%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set backup_name=%backup_name: =0%
echo Creating backup: %backup_name%

REM Backup database
docker exec wb-slots-postgres pg_dump -U postgres wb_slots > %backup_name%-database.sql 2>nul

REM Backup Redis
docker exec wb-slots-redis redis-cli BGSAVE >nul 2>&1
docker cp wb-slots-redis:/data/dump.rdb %backup_name%-redis.rdb 2>nul

echo ✅ Backup created: %backup_name%
echo.
pause
goto menu

:update
echo.
echo 🔄 Updating image...
echo This will pull the latest image and update the running container.
set /p registry="Enter registry URL (e.g., your-registry.com): "
if "%registry%"=="" (
    echo ❌ Registry URL is required!
    goto menu
)

echo Pulling latest image...
docker pull %registry%/wb-slots:latest
if %ERRORLEVEL% EQU 0 (
    echo Stopping current container...
    docker stop wb-slots-app 2>nul
    docker rm wb-slots-app 2>nul
    
    echo Starting updated container...
    docker run -d --name wb-slots-app -p 3000:3000 %registry%/wb-slots:latest
    
    echo ✅ Update completed!
) else (
    echo ❌ Update failed!
)
echo.
pause
goto menu

:exit
echo Goodbye!
exit /b 0

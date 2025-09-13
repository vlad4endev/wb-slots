@echo off
echo ========================================
echo    WB Slots Quick Deployment
echo ========================================
echo.

echo Choose deployment mode:
echo 1. Development (single replica, exposed ports)
echo 2. Production (multiple replicas, load balanced)
echo.
set /p mode="Enter your choice (1-2): "

if "%mode%"=="1" (
    echo.
    echo 🚀 Deploying in Development mode...
    echo.
    
    REM Build image
    echo Building application image...
    docker build -t wb-slots-app:latest .
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ Failed to build image
        pause
        exit /b 1
    )
    
    REM Initialize swarm if needed
    docker node ls >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo Initializing Docker Swarm...
        docker swarm init
    )
    
    REM Deploy development stack
    docker stack deploy -c docker-stack-dev.yml wb-slots-dev
    
    echo.
    echo ✅ Development stack deployed!
    echo.
    echo 🌐 Access points:
    echo    App: http://localhost:3000
    echo    DB:  localhost:5432
    echo    Redis: localhost:6379
    echo.
    echo 📋 Management commands:
    echo    docker stack services wb-slots-dev
    echo    docker stack rm wb-slots-dev
    echo.
    
) else if "%mode%"=="2" (
    echo.
    echo 🚀 Deploying in Production mode...
    echo.
    
    REM Check for production env file
    if not exist "env.production" (
        echo ❌ env.production file not found!
        echo Please create it from env.example and configure your settings.
        pause
        exit /b 1
    )
    
    REM Build image
    echo Building application image...
    docker build -t wb-slots-app:latest .
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ Failed to build image
        pause
        exit /b 1
    )
    
    REM Initialize swarm if needed
    docker node ls >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo Initializing Docker Swarm...
        docker swarm init
    )
    
    REM Deploy production stack
    docker stack deploy -c docker-stack.yml --with-registry-auth wb-slots
    
    echo.
    echo ✅ Production stack deployed!
    echo.
    echo 🌐 Access points:
    echo    App: http://localhost (via Nginx)
    echo    Direct: http://localhost:3000
    echo.
    echo 📋 Management commands:
    echo    docker stack services wb-slots
    echo    docker stack rm wb-slots
    echo.
    
) else (
    echo Invalid choice. Please run the script again.
    pause
    exit /b 1
)

echo Press any key to continue...
pause >nul

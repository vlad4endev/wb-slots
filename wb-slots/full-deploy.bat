@echo off
echo ========================================
echo    WB Slots Full Deployment
echo ========================================
echo.

REM Run system check first
echo Step 1: Running system check...
call check-system.bat
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ System check failed. Please fix the issues and try again.
    pause
    exit /b 1
)

echo.
echo Step 2: System check passed! Continuing with deployment...
echo.

REM Choose deployment mode
echo Choose deployment mode:
echo 1. Development (single replica, exposed ports)
echo 2. Production (multiple replicas, load balanced)
echo.
set /p mode="Enter your choice (1-2): "

if "%mode%"=="1" (
    echo.
    echo 🚀 Starting Development deployment...
    echo.
    
    REM Check if .env exists
    if not exist ".env" (
        if exist "env.example" (
            echo Creating .env from env.example...
            copy env.example .env
        ) else (
            echo ❌ No environment file found!
            pause
            exit /b 1
        )
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
    
    REM Deploy development stack
    echo Deploying development stack...
    docker stack deploy -c docker-stack-dev.yml wb-slots-dev
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ Failed to deploy development stack
        pause
        exit /b 1
    )
    
    echo.
    echo ✅ Development deployment completed!
    echo.
    echo 🌐 Access points:
    echo    App: http://localhost:3000
    echo    DB:  localhost:5432
    echo    Redis: localhost:6379
    echo.
    echo 📋 Management commands:
    echo    docker stack services wb-slots-dev
    echo    docker stack ps wb-slots-dev
    echo    docker service logs -f wb-slots-dev_app
    echo    docker stack rm wb-slots-dev
    echo.
    
) else if "%mode%"=="2" (
    echo.
    echo 🚀 Starting Production deployment...
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
    echo Deploying production stack...
    docker stack deploy -c docker-stack.yml --with-registry-auth wb-slots
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ Failed to deploy production stack
        pause
        exit /b 1
    )
    
    echo.
    echo ✅ Production deployment completed!
    echo.
    echo 🌐 Access points:
    echo    App: http://localhost (via Nginx)
    echo    Direct: http://localhost:3000
    echo.
    echo 📋 Management commands:
    echo    docker stack services wb-slots
    echo    docker stack ps wb-slots
    echo    docker service logs -f wb-slots_app
    echo    docker stack rm wb-slots
    echo.
    
) else (
    echo Invalid choice. Please run the script again.
    pause
    exit /b 1
)

echo.
echo 🎉 Deployment completed successfully!
echo.
echo Next steps:
echo 1. Wait a few minutes for all services to start
echo 2. Check the status with: docker stack services wb-slots%mode%
echo 3. View logs with: docker service logs -f wb-slots%mode%_app
echo 4. Access the application at the URLs shown above
echo.

REM Show final status
echo Current stack status:
if "%mode%"=="1" (
    docker stack services wb-slots-dev
) else (
    docker stack services wb-slots
)

echo.
echo Press any key to continue...
pause >nul

@echo off
echo ========================================
echo    WB Slots Docker Stack Deployment
echo ========================================
echo.

REM Check if Docker is running
docker version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker is not running. Please start Docker Desktop.
    pause
    exit /b 1
)

REM Check if Docker Swarm is initialized
docker node ls >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo 🔧 Initializing Docker Swarm...
    docker swarm init
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ Failed to initialize Docker Swarm
        pause
        exit /b 1
    )
    echo ✅ Docker Swarm initialized
)

REM Check if .env.production exists
if not exist "env.production" (
    echo ❌ env.production file not found!
    echo Please create env.production file with your production settings.
    pause
    exit /b 1
)

REM Build the application image
echo 🔨 Building application image...
docker build -t wb-slots-app:latest .
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to build application image
    pause
    exit /b 1
)
echo ✅ Application image built successfully

REM Deploy the stack
echo 🚀 Deploying Docker Stack...
docker stack deploy -c docker-stack.yml --with-registry-auth wb-slots
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to deploy Docker Stack
    pause
    exit /b 1
)

echo ✅ Docker Stack deployed successfully!
echo.
echo 📊 Stack Status:
docker stack services wb-slots

echo.
echo 🌐 Application will be available at:
echo    http://localhost (via Nginx)
echo    http://localhost:3000 (direct access)
echo.
echo 📋 Useful commands:
echo    docker stack services wb-slots
echo    docker stack ps wb-slots
echo    docker service logs wb-slots_app
echo    docker stack rm wb-slots
echo.
pause

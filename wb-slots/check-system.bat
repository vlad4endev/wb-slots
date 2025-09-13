@echo off
echo ========================================
echo    WB Slots System Check
echo ========================================
echo.

set ERRORS=0

echo Checking system requirements...
echo.

REM Check Docker
echo [1/6] Checking Docker...
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker is not installed or not running
    set /a ERRORS+=1
) else (
    echo ✅ Docker is installed and running
    docker --version
)

REM Check Docker Compose
echo.
echo [2/6] Checking Docker Compose...
docker compose version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker Compose is not available
    set /a ERRORS+=1
) else (
    echo ✅ Docker Compose is available
    docker compose version
)

REM Check available memory
echo.
echo [3/6] Checking available memory...
for /f "tokens=2 delims=:" %%a in ('wmic OS get TotalVisibleMemorySize /value ^| find "="') do set TOTAL_MEM=%%a
set /a TOTAL_MEM_GB=%TOTAL_MEM% / 1024 / 1024
if %TOTAL_MEM_GB% LSS 4 (
    echo ⚠️  Warning: Only %TOTAL_MEM_GB%GB RAM available (recommended: 4GB+)
) else (
    echo ✅ Available memory: %TOTAL_MEM_GB%GB
)

REM Check available disk space
echo.
echo [4/6] Checking available disk space...
for /f "tokens=3" %%a in ('dir /-c ^| find "bytes free"') do set FREE_SPACE=%%a
set /a FREE_SPACE_GB=%FREE_SPACE% / 1024 / 1024 / 1024
if %FREE_SPACE_GB% LSS 10 (
    echo ⚠️  Warning: Only %FREE_SPACE_GB%GB free space (recommended: 10GB+)
) else (
    echo ✅ Available disk space: %FREE_SPACE_GB%GB
)

REM Check required files
echo.
echo [5/6] Checking required files...
if not exist "Dockerfile" (
    echo ❌ Dockerfile not found
    set /a ERRORS+=1
) else (
    echo ✅ Dockerfile found
)

if not exist "docker-compose.yml" (
    echo ❌ docker-compose.yml not found
    set /a ERRORS+=1
) else (
    echo ✅ docker-compose.yml found
)

if not exist "package.json" (
    echo ❌ package.json not found
    set /a ERRORS+=1
) else (
    echo ✅ package.json found
)

REM Check environment files
echo.
echo [6/6] Checking environment configuration...
if not exist ".env" (
    if not exist "env.example" (
        echo ❌ No environment file found
        set /a ERRORS+=1
    ) else (
        echo ⚠️  .env file not found, but env.example exists
        echo    Run: copy env.example .env
    )
) else (
    echo ✅ .env file found
)

if not exist "env.production" (
    echo ⚠️  env.production not found (needed for production deployment)
) else (
    echo ✅ env.production found
)

echo.
echo ========================================
echo    System Check Results
echo ========================================

if %ERRORS% EQU 0 (
    echo ✅ All checks passed! System is ready for deployment.
    echo.
    echo Next steps:
    echo 1. Configure .env file if needed
    echo 2. Run quick-deploy.bat to start deployment
    echo 3. Or run deploy-stack.bat for manual deployment
) else (
    echo ❌ %ERRORS% error(s) found. Please fix them before deployment.
    echo.
    echo Common solutions:
    echo - Install Docker Desktop from https://www.docker.com/products/docker-desktop/
    echo - Start Docker Desktop
    echo - Copy env.example to .env and configure it
    echo - Ensure you have at least 4GB RAM and 10GB free disk space
)

echo.
pause

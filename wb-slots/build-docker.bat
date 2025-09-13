@echo off
echo Building Docker image for WB Slots...

REM Build the application image
docker build -t wb-slots-app .

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Docker image built successfully!
    echo.
    echo To run the application:
    echo   docker run -p 3000:3000 wb-slots-app
    echo.
    echo To run with docker-compose (includes database):
    echo   docker-compose up
) else (
    echo.
    echo ❌ Docker build failed!
    echo Check the error messages above.
)

pause

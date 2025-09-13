@echo off
echo ========================================
echo    WB Slots Docker Stack Management
echo ========================================
echo.

:menu
echo Choose an option:
echo 1. View stack status
echo 2. View service logs
echo 3. Scale services
echo 4. Update stack
echo 5. Remove stack
echo 6. View stack services
echo 7. View stack tasks
echo 8. Exit
echo.
set /p choice="Enter your choice (1-8): "

if "%choice%"=="1" goto status
if "%choice%"=="2" goto logs
if "%choice%"=="3" goto scale
if "%choice%"=="4" goto update
if "%choice%"=="5" goto remove
if "%choice%"=="6" goto services
if "%choice%"=="7" goto tasks
if "%choice%"=="8" goto exit
echo Invalid choice. Please try again.
goto menu

:status
echo.
echo 📊 Stack Status:
docker stack services wb-slots
echo.
pause
goto menu

:logs
echo.
echo Choose service to view logs:
echo 1. app
echo 2. worker
echo 3. postgres
echo 4. redis
echo 5. nginx
echo.
set /p service="Enter service (1-5): "

if "%service%"=="1" set service_name=wb-slots_app
if "%service%"=="2" set service_name=wb-slots_worker
if "%service%"=="3" set service_name=wb-slots_postgres
if "%service%"=="4" set service_name=wb-slots_redis
if "%service%"=="5" set service_name=wb-slots_nginx

echo.
echo 📋 Logs for %service_name%:
docker service logs -f %service_name%
echo.
pause
goto menu

:scale
echo.
echo Current service replicas:
docker stack services wb-slots --format "table {{.Name}}\t{{.Replicas}}"
echo.
set /p app_replicas="Enter app replicas (current: 2): "
set /p worker_replicas="Enter worker replicas (current: 2): "

if not "%app_replicas%"=="" (
    docker service scale wb-slots_app=%app_replicas%
)
if not "%worker_replicas%"=="" (
    docker service scale wb-slots_worker=%worker_replicas%
)

echo.
echo ✅ Services scaled successfully
pause
goto menu

:update
echo.
echo 🔄 Updating stack...
docker stack deploy -c docker-stack.yml --with-registry-auth wb-slots
echo.
echo ✅ Stack updated successfully
pause
goto menu

:remove
echo.
echo ⚠️  WARNING: This will remove the entire stack and all data!
set /p confirm="Are you sure? Type 'yes' to confirm: "
if "%confirm%"=="yes" (
    docker stack rm wb-slots
    echo.
    echo ✅ Stack removed successfully
) else (
    echo Operation cancelled
)
pause
goto menu

:services
echo.
echo 📋 Stack Services:
docker stack services wb-slots --format "table {{.Name}}\t{{.Mode}}\t{{.Replicas}}\t{{.Image}}\t{{.Ports}}"
echo.
pause
goto menu

:tasks
echo.
echo 📋 Stack Tasks:
docker stack ps wb-slots --format "table {{.Name}}\t{{.Node}}\t{{.DesiredState}}\t{{.CurrentState}}\t{{.Error}}"
echo.
pause
goto menu

:exit
echo Goodbye!
exit /b 0

@echo off
cd /d "C:\Users\vladi\Desktop\wb\wb-slots"
powershell -Command "(Get-Content 'src/lib/services/auto-booking-service.ts') -replace '      }\);', '      });' | Set-Content 'src/lib/services/auto-booking-service.ts'"
echo Fixed semicolon issue

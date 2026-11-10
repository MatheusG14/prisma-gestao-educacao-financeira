@echo off
setlocal
cd /d "%~dp0"
echo ========================================
echo Prisma - Backend com SQLite Persistente
echo ========================================
echo.
echo Iniciando servidor...
node server.js
if errorlevel 1 (
  echo.
  echo O backend foi encerrado com erro.
  pause
)
endlocal

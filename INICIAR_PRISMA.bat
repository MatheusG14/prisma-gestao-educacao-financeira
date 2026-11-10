@echo off
setlocal
cd /d "%~dp0"
echo ========================================================
echo  Prisma T13 - Gestao Financeira Inteligente
echo  Autenticacao Segura e Banco de Dados SQLite Real
echo ========================================================
echo.
echo Iniciando servidor em http://localhost:3000 ...
node server.js
if errorlevel 1 (
  echo.
  echo O servidor foi encerrado com erro.
  pause
)
endlocal

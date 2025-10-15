@echo off
title Autonomia Dev - Quick Start
color 0B

echo.
echo 🚀 QUICK START - AUTONOMIA DEV
echo ===============================

:: Iniciar PostgreSQL
echo 🐘 PostgreSQL...
docker start autonomia-postgres >nul 2>&1 || docker run -d --name autonomia-postgres -e POSTGRES_DB=autonomia_db -e POSTGRES_USER=autonomia_admin -e POSTGRES_PASSWORD=autonomia123 -p 5432:5432 postgres:14 >nul 2>&1

:: Setup banco (silencioso)
echo 🗄️ Setup banco...
node setup-local-completo.js >nul 2>&1

:: Iniciar serviços em paralelo
echo 🔐 Backend Auth...
cd api\auth && start /min cmd /c "npx serverless offline start --config serverless.local.yml" && cd ..\..

echo 🚀 Backend SaaS...  
cd api\saas && start /min cmd /c "npx serverless offline start --config serverless.local.yml" && cd ..\..

echo ⚛️ Frontend...
if exist frontend-saas (
    cd frontend-saas
    set BROWSER=none
    start "Frontend React" cmd /k "npm start"
    cd ..
) else (
    echo ⚠️ Pasta frontend-saas não encontrada!
)

echo.
echo ⏳ Aguardando serviços (20s)...
ping 127.0.0.1 -n 21 > nul

echo.
echo ✅ PRONTO! URLs:
echo    Frontend: http://localhost:3000
echo    SaaS API: http://localhost:3001  
echo    Auth API: http://localhost:3003
echo.

start http://localhost:3000

echo Pressione ENTER para validar APIs...
pause >nul
npm run validate

echo.
echo Pressione ENTER para finalizar...
pause >nul

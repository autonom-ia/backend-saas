@echo off
title Autonomia - Kill All Services
color 0C

echo.
echo 🛑 PARANDO TODOS OS SERVIÇOS AUTONOMIA
echo =====================================
echo.

echo 🔍 Verificando serviços rodando...
netstat -ano | findstr ":3000 :3001 :3003 :5432"

echo.
echo 🔥 Matando processos Node.js...
taskkill /F /IM node.exe >nul 2>&1
if errorlevel 1 (
    echo ⚠️ Nenhum processo Node.js encontrado
) else (
    echo ✅ Processos Node.js finalizados
)

echo.
echo 🔥 Matando processos NPX/Serverless...
taskkill /F /IM npx.exe >nul 2>&1
taskkill /F /IM serverless.exe >nul 2>&1

echo.
echo 🐘 Parando container PostgreSQL...
docker stop autonomia-postgres >nul 2>&1
if errorlevel 1 (
    echo ⚠️ Container PostgreSQL não estava rodando
) else (
    echo ✅ Container PostgreSQL parado
)

echo.
echo 🔍 Verificando portas após limpeza...
netstat -ano | findstr ":3000 :3001 :3003 :5432"
if errorlevel 1 (
    echo ✅ Todas as portas estão livres!
) else (
    echo ⚠️ Algumas portas ainda estão em uso
)

echo.
echo ✅ Limpeza concluída!
echo.
pause

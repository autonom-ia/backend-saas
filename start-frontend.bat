@echo off
title Frontend React - Autonomia
color 0A

echo.
echo ⚛️ INICIANDO FRONTEND REACT
echo ===========================

cd frontend-saas

echo 📦 Verificando dependências...
if not exist node_modules (
    echo 📦 Instalando dependências...
    npm install
    if errorlevel 1 (
        echo ❌ Erro ao instalar dependências
        pause
        exit /b 1
    )
) else (
    echo ✅ Dependências já instaladas
)

echo.
echo 🚀 Iniciando servidor de desenvolvimento...
echo 🌐 URL: http://localhost:3000
echo.

set BROWSER=none
npm run dev

pause

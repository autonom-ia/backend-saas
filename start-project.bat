@echo off
title Autonomia - Projeto Completo
color 0A

echo.
echo ========================================
echo 🚀 INICIANDO PROJETO AUTONOMIA COMPLETO
echo ========================================
echo.

echo 📋 Verificando pre-requisitos...

:: Verificar se Docker está rodando
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker não encontrado! Instale o Docker Desktop.
    pause
    exit /b 1
)
echo ✅ Docker encontrado

:: Verificar se Node.js está instalado
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js não encontrado! Instale o Node.js.
    pause
    exit /b 1
)
echo ✅ Node.js encontrado

echo.
echo 🐘 Iniciando PostgreSQL...
:: Tentar iniciar container existente
docker start autonomia-postgres >nul 2>&1
if errorlevel 1 (
    echo 📦 Criando novo container PostgreSQL...
    docker run -d --name autonomia-postgres -e POSTGRES_DB=autonomia_db -e POSTGRES_USER=autonomia_admin -e POSTGRES_PASSWORD=autonomia123 -p 5432:5432 postgres:14
    if errorlevel 1 (
        echo ❌ Erro ao criar container PostgreSQL
        pause
        exit /b 1
    )
) else (
    echo ✅ Container PostgreSQL iniciado
)

echo.
echo ⏳ Aguardando PostgreSQL ficar pronto...
timeout /t 8 /nobreak >nul

echo.
echo 🗄️ Configurando banco de dados...
node setup-local-completo.js
if errorlevel 1 (
    echo ⚠️ Aviso: Erro ao configurar banco, mas continuando...
)

echo.
echo 🔐 Iniciando Backend Auth (porta 3003)...
cd api\auth
if not exist node_modules (
    echo 📦 Instalando dependências Auth...
    call npm install
)
start "Backend Auth" cmd /k "npx serverless offline start --config serverless.local.yml"
cd ..\..

echo ⏳ Aguardando Backend Auth iniciar...
timeout /t 5 /nobreak >nul

echo.
echo 🚀 Iniciando Backend SaaS (porta 3001)...
cd api\saas
if not exist node_modules (
    echo 📦 Instalando dependências SaaS...
    call npm install
)
start "Backend SaaS" cmd /k "npx serverless offline start --config serverless.local.yml"
cd ..\..

echo ⏳ Aguardando Backend SaaS iniciar...
timeout /t 8 /nobreak >nul

echo.
echo ⚛️ Iniciando Frontend React (porta 3000)...
if exist frontend-saas (
    cd frontend-saas
    if not exist node_modules (
        echo 📦 Instalando dependências Frontend...
        call npm install
    )
    set BROWSER=none
    start "Frontend React" cmd /k "npm start"
    cd ..
) else (
    echo ⚠️ Diretório frontend-saas não encontrado!
    echo 💡 Certifique-se que o frontend está na pasta frontend-saas/
)

echo.
echo ⏳ Aguardando todos os serviços ficarem prontos...
timeout /t 15 /nobreak >nul

echo.
echo ========================================
echo 🎉 PROJETO INICIADO COM SUCESSO!
echo ========================================
echo.
echo 🌐 URLs disponíveis:
echo    • Frontend:     http://localhost:3000
echo    • Backend SaaS: http://localhost:3001  
echo    • Backend Auth: http://localhost:3003
echo    • PostgreSQL:   localhost:5432
echo.
echo 💡 Para testar as APIs: npm run validate
echo 💡 Para parar tudo: Feche todas as janelas abertas
echo.
echo ✅ Ambiente completo rodando!
echo.

:: Abrir URLs no navegador
echo 🌐 Abrindo aplicação no navegador...
timeout /t 3 /nobreak >nul
start http://localhost:3000

echo.
echo Pressione qualquer tecla para finalizar...
pause >nul

:: Cleanup - parar containers
echo.
echo 🧹 Finalizando serviços...
docker stop autonomia-postgres >nul 2>&1

echo ✅ Projeto finalizado!
pause

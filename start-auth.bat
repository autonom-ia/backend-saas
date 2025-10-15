@echo off
echo 🔐 Iniciando API de Autenticacao...
echo 📍 Porta: 3003
echo 🌐 Base URL: http://localhost:3003
echo.
echo 📝 Endpoints disponíveis:
echo    POST http://localhost:3003/login
echo    POST http://localhost:3003/register
echo    POST http://localhost:3003/confirm
echo.
echo 💡 Para parar: Ctrl+C
echo.

cd api\auth
npx serverless offline start --config serverless.local.yml

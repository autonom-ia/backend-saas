@echo off
echo 🚀 Iniciando API SaaS...
echo 📍 Porta: 3001
echo 🌐 Base URL: http://localhost:3001
echo.
echo 📝 Endpoints disponíveis:
echo    GET  http://localhost:3001/Autonomia/Saas/Products
echo    POST http://localhost:3001/Autonomia/Saas/Products
echo.
echo 💡 Para parar: Ctrl+C
echo.

cd api\saas
npx serverless offline start --config serverless.local.yml

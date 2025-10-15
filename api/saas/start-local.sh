#!/bin/bash
# start-local.sh - Subir servidor HTTP local
# Uso: ./start-local.sh

echo "🚀 Iniciando servidor local da API..."
echo "📍 Porta: 3001"
echo "🌐 Base URL: http://localhost:3001"
echo ""
echo "📝 Endpoints disponíveis:"
echo "   GET  http://localhost:3001/Autonomia/Saas/Products"
echo "   GET  http://localhost:3001/Autonomia/Saas/Products/{id}"
echo "   POST http://localhost:3001/Autonomia/Saas/Products"
echo ""
echo "💡 Para parar: Ctrl+C"
echo ""

npx serverless offline start --config serverless.local.yml
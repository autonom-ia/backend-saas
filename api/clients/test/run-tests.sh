#!/bin/bash

# Script para executar os testes de API do módulo clients
# Uso: ./run-tests.sh [API_URL]

# Definir cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm não está instalado. Por favor, instale o Node.js e o npm.${NC}"
    exit 1
fi

# Verificar se os pacotes estão instalados
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️ Instalando dependências...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Falha ao instalar dependências.${NC}"
        exit 1
    fi
fi

# Definir URL da API (padrão ou passada como argumento)
API_URL=""
if [ -n "$1" ]; then
    API_URL=$1
    echo -e "${YELLOW}🌐 Usando API URL fornecida: ${API_URL}${NC}"
    export API_URL
fi

# Executar testes
echo -e "${GREEN}🚀 Iniciando testes de API para o módulo clients...${NC}"
node run-api-tests.js

# Verificar resultado
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Todos os testes foram executados com sucesso!${NC}"
    exit 0
else
    echo -e "${RED}❌ Alguns testes falharam. Verifique os logs acima para mais detalhes.${NC}"
    exit 1
fi

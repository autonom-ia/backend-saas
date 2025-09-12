#!/bin/bash

# Script para executar os testes utilizando as configurações do arquivo config.json

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=======================================${NC}"
echo -e "${GREEN}Iniciando testes da API Funnel${NC}"
echo -e "${BLUE}=======================================${NC}"

# Verificar se jq está instalado (necessário para parsear o JSON)
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}jq não encontrado. Instalando...${NC}"
    brew install jq || npm install -g jq
fi

# Carregar configurações do arquivo
CONFIG_FILE="./mocks/config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}Arquivo de configuração não encontrado. Usando valores padrão.${NC}"
else
    echo -e "${GREEN}Carregando configurações do arquivo $CONFIG_FILE${NC}"
    
    # Extrair valores do JSON usando jq
    ACCOUNT_ID=$(jq -r '.ACCOUNT_ID' "$CONFIG_FILE")
    API_URL=$(jq -r '.API_URL' "$CONFIG_FILE")
    
    echo -e "${BLUE}Configurações carregadas:${NC}"
    echo -e "  API URL: ${GREEN}$API_URL${NC}"
    echo -e "  Account ID: ${GREEN}$ACCOUNT_ID${NC}"
    
    # Executar o teste com as variáveis de ambiente configuradas
    ACCOUNT_ID="$ACCOUNT_ID" API_URL="$API_URL" node run-api-tests.js
fi

#!/bin/bash

# Cores para saída
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Diretório atual
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Verificar se jq está instalado
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Erro: jq não está instalado. Por favor, instale com 'brew install jq' ou 'apt-get install jq'${NC}"
    exit 1
fi

echo -e "${BLUE}=== Testes de API para o módulo settings ===${NC}"

# Carregar configuração
CONFIG_FILE="${DIR}/mocks/config.json"
if [ -f "$CONFIG_FILE" ]; then
    export ACCOUNT_ID=$(jq -r '.ACCOUNT_ID' "$CONFIG_FILE")
    export API_URL=$(jq -r '.API_URL' "$CONFIG_FILE")
    export USER_SESSION_ID=$(jq -r '.USER_SESSION_ID' "$CONFIG_FILE")
    
    echo -e "${YELLOW}Usando configuração do arquivo:${NC} $CONFIG_FILE"
    echo -e "${YELLOW}API URL:${NC} $API_URL"
    echo -e "${YELLOW}ACCOUNT ID:${NC} $ACCOUNT_ID"
    echo -e "${YELLOW}USER_SESSION_ID:${NC} $USER_SESSION_ID"
else
    echo -e "${RED}Arquivo de configuração não encontrado: $CONFIG_FILE${NC}"
    exit 1
fi

# Executar script de testes
echo -e "${GREEN}Iniciando testes...${NC}"
node "$DIR/run-api-tests.js"

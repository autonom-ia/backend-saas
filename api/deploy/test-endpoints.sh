#!/bin/bash

# Script para testar se os endpoints do API Gateway estão funcionando corretamente
# Uso: ./test-endpoints.sh [module] [stage]
# Exemplo: ./test-endpoints.sh auth staging
# Exemplo: ./test-endpoints.sh (testa todos os módulos)

# Configurar perfil AWS
export AWS_PROFILE=autonomia

# Definindo cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

MODULE="${1:-all}"
STAGE="${2:-staging}"

echo -e "${BLUE}=== Testando Endpoints do API Gateway (Stage: $STAGE) ===${NC}\n"

# Função para obter a URL base do API Gateway de um módulo
get_api_url() {
  local module=$1
  local stage=$2
  
  # Obter o stack name
  local stack_name="autonomia-api-$module-$stage"
  
  # Tentar obter a URL do API Gateway do stack
  local api_url=$(aws cloudformation describe-stacks \
    --stack-name "$stack_name" \
    --region us-east-1 \
    --profile autonomia \
    --query "Stacks[0].Outputs[?OutputKey=='ServiceEndpoint'].OutputValue" \
    --output text 2>/dev/null)
  
  if [ -z "$api_url" ] || [ "$api_url" = "None" ]; then
    # Tentar obter do Serverless Framework
    local rest_api_id=$(aws apigateway get-rest-apis \
      --region us-east-1 \
      --profile autonomia \
      --query "items[?name=='$stack_name'].id" \
      --output text 2>/dev/null | head -n1)
    
    if [ -n "$rest_api_id" ]; then
      api_url="https://${rest_api_id}.execute-api.us-east-1.amazonaws.com/$stage"
    fi
  fi
  
  echo "$api_url"
}

# Função para testar um endpoint
test_endpoint() {
  local method=$1
  local url=$2
  local expected_status=${3:-200}
  
  local response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" \
    -H "Content-Type: application/json" \
    --max-time 10 2>/dev/null)
  
  if [ "$response" = "$expected_status" ] || [ "$response" = "401" ] || [ "$response" = "403" ] || [ "$response" = "400" ]; then
    # 401/403/400 indicam que o endpoint existe e está respondendo (só precisa de autenticação/dados válidos)
    echo -e "${GREEN}✓${NC} $method $url -> $response"
    return 0
  elif [ "$response" = "000" ]; then
    echo -e "${RED}✗${NC} $method $url -> Timeout/Erro de conexão"
    return 1
  elif [ "$response" = "404" ]; then
    echo -e "${YELLOW}⚠${NC} $method $url -> 404 (Endpoint não encontrado)"
    return 1
  else
    echo -e "${YELLOW}?${NC} $method $url -> $response"
    return 0
  fi
}

# Função para testar um módulo
test_module() {
  local module=$1
  local stage=$2
  
  echo -e "${BLUE}--- Testando módulo: $module ---${NC}"
  
  local api_url=$(get_api_url "$module" "$stage")
  
  if [ -z "$api_url" ]; then
    echo -e "${RED}✗ Não foi possível obter a URL do API Gateway para $module${NC}\n"
    return 1
  fi
  
  echo -e "${YELLOW}API URL: $api_url${NC}\n"
  
  # Obter lista de funções Lambda do módulo
  local functions=$(aws lambda list-functions \
    --region us-east-1 \
    --profile autonomia \
    --query "Functions[?starts_with(FunctionName, 'autonomia-api-$module-$stage-')].FunctionName" \
    --output text 2>/dev/null)
  
  if [ -z "$functions" ]; then
    echo -e "${YELLOW}⚠ Nenhuma função Lambda encontrada para $module${NC}\n"
    return 1
  fi
  
  # Contar funções
  local count=$(echo "$functions" | wc -w | xargs)
  echo -e "${GREEN}✓ Encontradas $count funções Lambda${NC}\n"
  
  # Testar alguns endpoints comuns baseados no módulo
  case $module in
    auth)
      test_endpoint "POST" "$api_url/login"
      test_endpoint "POST" "$api_url/register"
      test_endpoint "GET" "$api_url/health" 2>/dev/null || true
      ;;
    clients)
      test_endpoint "GET" "$api_url/conversations"
      test_endpoint "GET" "$api_url/staging/Autonomia/Clients/LoggedUsers"
      ;;
    saas)
      test_endpoint "GET" "$api_url/staging/Autonomia/SaaS/Accounts"
      test_endpoint "GET" "$api_url/staging/Autonomia/SaaS/Users"
      ;;
    *)
      # Para outros módulos, testar um endpoint genérico
      test_endpoint "GET" "$api_url/staging"
      ;;
  esac
  
  echo ""
  
  # Verificar se há integrações do API Gateway
  local rest_api_id=$(echo "$api_url" | sed 's|https://||; s|\.execute-api\.us-east-1\.amazonaws\.com.*||')
  
  if [ -n "$rest_api_id" ]; then
    local resources=$(aws apigateway get-resources \
      --rest-api-id "$rest_api_id" \
      --region us-east-1 \
      --profile autonomia \
      --query "items[?resourceMethods].id" \
      --output text 2>/dev/null)
    
    if [ -n "$resources" ]; then
      local resource_count=$(echo "$resources" | wc -w | xargs)
      echo -e "${GREEN}✓ API Gateway tem $resource_count recursos configurados${NC}"
    fi
  fi
  
  echo ""
}

# Testar módulo específico ou todos
if [ "$MODULE" = "all" ]; then
  modules=("auth" "saas" "clients" "evolution" "funnel" "profile" "project" "settings" "leadshot")
  
  for module in "${modules[@]}"; do
    test_module "$module" "$STAGE"
  done
  
  echo -e "${GREEN}=== Teste completo ===${NC}"
else
  test_module "$MODULE" "$STAGE"
fi


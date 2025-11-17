#!/bin/bash

# Script para verificar configurações de uma Lambda (variáveis de ambiente, recursos, etc)
# Uso: ./check-lambda-config.sh <module> <function-name> [stage]
# Exemplo: ./check-lambda-config.sh auth login staging

# Configurar perfil AWS
export AWS_PROFILE=autonomia

# Definindo cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

MODULE="${1}"
FUNCTION_NAME="${2}"
STAGE="${3:-staging}"

if [ -z "$MODULE" ] || [ -z "$FUNCTION_NAME" ]; then
  echo -e "${RED}Erro: Módulo e nome da função são obrigatórios.${NC}"
  echo -e "Uso: ./check-lambda-config.sh <module> <function-name> [stage]"
  echo -e "Exemplo: ./check-lambda-config.sh auth login staging"
  exit 1
fi

FULL_FUNCTION_NAME="autonomia-api-$MODULE-$STAGE-$FUNCTION_NAME"

echo -e "${BLUE}=== Configuração da Lambda: $FULL_FUNCTION_NAME ===${NC}\n"

# Obter configuração da função
CONFIG=$(aws lambda get-function-configuration \
  --function-name "$FULL_FUNCTION_NAME" \
  --region us-east-1 \
  --profile autonomia 2>/dev/null)

if [ $? -ne 0 ]; then
  echo -e "${RED}Erro: Função não encontrada${NC}"
  exit 1
fi

# Variáveis de ambiente
echo -e "${YELLOW}📋 Variáveis de Ambiente:${NC}"
echo "$CONFIG" | jq -r '.Environment.Variables | to_entries[] | "  \(.key): \(.value)"' 2>/dev/null || echo "  Nenhuma variável de ambiente"

# Runtime e memória
echo -e "\n${YELLOW}⚙️ Configurações:${NC}"
RUNTIME=$(echo "$CONFIG" | jq -r '.Runtime')
MEMORY=$(echo "$CONFIG" | jq -r '.MemorySize')
TIMEOUT=$(echo "$CONFIG" | jq -r '.Timeout')
echo "  Runtime: $RUNTIME"
echo "  Memória: ${MEMORY}MB"
echo "  Timeout: ${TIMEOUT}s"

# VPC (se configurado)
VPC_CONFIG=$(echo "$CONFIG" | jq -r '.VpcConfig')
if [ "$VPC_CONFIG" != "null" ] && [ "$VPC_CONFIG" != "{}" ]; then
  echo -e "\n${YELLOW}🌐 VPC:${NC}"
  echo "$CONFIG" | jq -r '.VpcConfig | "  Subnets: \(.SubnetIds | length)\n  Security Groups: \(.SecurityGroupIds | length)"'
fi

# Layers
echo -e "\n${YELLOW}📦 Layers:${NC}"
echo "$CONFIG" | jq -r '.Layers[]?.Arn // empty' | while read layer; do
  if [ -n "$layer" ]; then
    echo "  - $layer"
  fi
done

# IAM Role
echo -e "\n${YELLOW}🔐 IAM Role:${NC}"
ROLE_ARN=$(echo "$CONFIG" | jq -r '.Role')
echo "  $ROLE_ARN"

# Obter políticas do role
ROLE_NAME=$(echo "$ROLE_ARN" | sed 's|.*role/||')
POLICIES=$(aws iam list-role-policies --role-name "$ROLE_NAME" --profile autonomia --query "PolicyNames[]" --output text 2>/dev/null)
if [ -n "$POLICIES" ]; then
  echo -e "\n${YELLOW}📜 Políticas Inline:${NC}"
  echo "$POLICIES" | tr '\t' '\n' | sed 's/^/  - /'
fi

# Verificar recursos relacionados (Cognito, RDS, etc)
if echo "$CONFIG" | jq -r '.Environment.Variables' | grep -q "COGNITO"; then
  echo -e "\n${YELLOW}🔑 Recursos Cognito:${NC}"
  USER_POOL_ID=$(echo "$CONFIG" | jq -r '.Environment.Variables.COGNITO_USER_POOL_ID // empty')
  CLIENT_ID=$(echo "$CONFIG" | jq -r '.Environment.Variables.COGNITO_USER_POOL_CLIENT_ID // empty')
  
  if [ -n "$USER_POOL_ID" ]; then
    echo "  User Pool ID: $USER_POOL_ID"
    USER_POOL_INFO=$(aws cognito-idp describe-user-pool --user-pool-id "$USER_POOL_ID" --region us-east-1 --profile autonomia 2>/dev/null)
    if [ $? -eq 0 ]; then
      POOL_NAME=$(echo "$USER_POOL_INFO" | jq -r '.UserPool.Name')
      USER_COUNT=$(aws cognito-idp list-users --user-pool-id "$USER_POOL_ID" --region us-east-1 --profile autonomia --query "length(Users)" --output text 2>/dev/null)
      echo "  User Pool Name: $POOL_NAME"
      echo "  Total de Usuários: $USER_COUNT"
    fi
  fi
  
  if [ -n "$CLIENT_ID" ]; then
    echo "  Client ID: $CLIENT_ID"
  fi
fi

# Verificar conexão com banco de dados (se houver variáveis DB)
if echo "$CONFIG" | jq -r '.Environment.Variables' | grep -qi "DB\|DATABASE\|RDS"; then
  echo -e "\n${YELLOW}🗄️ Configuração de Banco de Dados:${NC}"
  echo "$CONFIG" | jq -r '.Environment.Variables | to_entries[] | select(.key | test("DB|DATABASE|RDS"; "i")) | "  \(.key): \(.value)"'
fi

echo -e "\n${GREEN}✅ Verificação concluída!${NC}\n"


#!/bin/bash

# Script para gerenciar usuários no Cognito User Pool
# Uso: ./manage-cognito-users.sh <action> [options]
# Ações: list, create, delete, get-pool-id

# Configurar perfil AWS
export AWS_PROFILE=autonomia

# Definindo cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ACTION="${1}"
STAGE="${2:-staging}"

# Função para obter o User Pool ID de um stage
get_user_pool_id() {
  local stage=$1
  local stack_name="autonomia-api-auth-$stage"
  
  aws cloudformation describe-stacks \
    --stack-name "$stack_name" \
    --region us-east-1 \
    --profile autonomia \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
    --output text 2>/dev/null
}

# Função para listar usuários
list_users() {
  local stage=$1
  local pool_id=$(get_user_pool_id "$stage")
  
  if [ -z "$pool_id" ]; then
    echo -e "${RED}Erro: User Pool não encontrado para stage '$stage'${NC}"
    exit 1
  fi
  
  echo -e "${BLUE}=== Usuários no Cognito ($stage) ===${NC}"
  echo -e "${YELLOW}User Pool ID: $pool_id${NC}\n"
  
  aws cognito-idp list-users \
    --user-pool-id "$pool_id" \
    --region us-east-1 \
    --profile autonomia \
    --query "Users[].{Username:Username, Email:Attributes[?Name=='email'].Value|[0], Status:UserStatus, Created:CreationDate}" \
    --output table 2>/dev/null
}

# Função para criar usuário
create_user() {
  local stage=$1
  local email=$2
  local password=$3
  local pool_id=$(get_user_pool_id "$stage")
  
  if [ -z "$pool_id" ]; then
    echo -e "${RED}Erro: User Pool não encontrado para stage '$stage'${NC}"
    exit 1
  fi
  
  if [ -z "$email" ] || [ -z "$password" ]; then
    echo -e "${RED}Erro: Email e senha são obrigatórios${NC}"
    echo -e "Uso: ./manage-cognito-users.sh create <stage> <email> <password>"
    exit 1
  fi
  
  echo -e "${BLUE}Criando usuário no Cognito ($stage)...${NC}"
  echo -e "${YELLOW}Email: $email${NC}"
  echo -e "${YELLOW}User Pool ID: $pool_id${NC}\n"
  
  # Criar usuário
  aws cognito-idp admin-create-user \
    --user-pool-id "$pool_id" \
    --username "$email" \
    --user-attributes Name=email,Value="$email" Name=email_verified,Value=true \
    --message-action SUPPRESS \
    --region us-east-1 \
    --profile autonomia 2>/dev/null
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Usuário criado com sucesso${NC}"
    
    # Definir senha permanente
    aws cognito-idp admin-set-user-password \
      --user-pool-id "$pool_id" \
      --username "$email" \
      --password "$password" \
      --permanent \
      --region us-east-1 \
      --profile autonomia 2>/dev/null
    
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}✓ Senha definida com sucesso${NC}"
    else
      echo -e "${YELLOW}⚠ Usuário criado, mas houve erro ao definir senha${NC}"
    fi
  else
    echo -e "${RED}✗ Erro ao criar usuário${NC}"
    exit 1
  fi
}

# Função para deletar usuário
delete_user() {
  local stage=$1
  local email=$2
  local pool_id=$(get_user_pool_id "$stage")
  
  if [ -z "$pool_id" ]; then
    echo -e "${RED}Erro: User Pool não encontrado para stage '$stage'${NC}"
    exit 1
  fi
  
  if [ -z "$email" ]; then
    echo -e "${RED}Erro: Email é obrigatório${NC}"
    echo -e "Uso: ./manage-cognito-users.sh delete <stage> <email>"
    exit 1
  fi
  
  echo -e "${YELLOW}Deletando usuário: $email${NC}"
  
  aws cognito-idp admin-delete-user \
    --user-pool-id "$pool_id" \
    --username "$email" \
    --region us-east-1 \
    --profile autonomia 2>/dev/null
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Usuário deletado com sucesso${NC}"
  else
    echo -e "${RED}✗ Erro ao deletar usuário${NC}"
    exit 1
  fi
}

# Função para mostrar informações do User Pool
show_pool_info() {
  local stage=$1
  local pool_id=$(get_user_pool_id "$stage")
  
  if [ -z "$pool_id" ]; then
    echo -e "${RED}Erro: User Pool não encontrado para stage '$stage'${NC}"
    exit 1
  fi
  
  echo -e "${BLUE}=== Informações do Cognito User Pool ($stage) ===${NC}\n"
  
  local pool_info=$(aws cognito-idp describe-user-pool \
    --user-pool-id "$pool_id" \
    --region us-east-1 \
    --profile autonomia 2>/dev/null)
  
  if [ $? -eq 0 ]; then
    echo -e "${YELLOW}User Pool ID:${NC} $pool_id"
    echo -e "${YELLOW}Nome:${NC} $(echo "$pool_info" | jq -r '.UserPool.Name')"
    echo -e "${YELLOW}Status:${NC} $(echo "$pool_info" | jq -r '.UserPool.Status')"
    
    local user_count=$(aws cognito-idp list-users \
      --user-pool-id "$pool_id" \
      --region us-east-1 \
      --profile autonomia \
      --query "length(Users)" \
      --output text 2>/dev/null)
    
    echo -e "${YELLOW}Total de Usuários:${NC} $user_count"
    
    # Obter Client ID
    local stack_name="autonomia-api-auth-$stage"
    local client_id=$(aws cloudformation describe-stacks \
      --stack-name "$stack_name" \
      --region us-east-1 \
      --profile autonomia \
      --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
      --output text 2>/dev/null)
    
    echo -e "${YELLOW}Client ID:${NC} $client_id"
  else
    echo -e "${RED}Erro ao obter informações do User Pool${NC}"
    exit 1
  fi
}

# Menu principal
case "$ACTION" in
  list)
    list_users "$STAGE"
    ;;
  create)
    if [ -z "$3" ] || [ -z "$4" ]; then
      echo -e "${RED}Erro: Email e senha são obrigatórios${NC}"
      echo -e "Uso: ./manage-cognito-users.sh create <stage> <email> <password>"
      exit 1
    fi
    create_user "$STAGE" "$3" "$4"
    ;;
  delete)
    if [ -z "$3" ]; then
      echo -e "${RED}Erro: Email é obrigatório${NC}"
      echo -e "Uso: ./manage-cognito-users.sh delete <stage> <email>"
      exit 1
    fi
    delete_user "$STAGE" "$3"
    ;;
  info|show)
    show_pool_info "$STAGE"
    ;;
  get-pool-id)
    local pool_id=$(get_user_pool_id "$STAGE")
    if [ -n "$pool_id" ]; then
      echo "$pool_id"
    else
      echo -e "${RED}User Pool não encontrado${NC}" >&2
      exit 1
    fi
    ;;
  *)
    echo -e "${RED}Erro: Ação desconhecida '$ACTION'${NC}"
    echo ""
    echo -e "Uso: ./manage-cognito-users.sh <action> [options]"
    echo ""
    echo -e "Ações disponíveis:"
    echo -e "  list <stage>              - Lista todos os usuários"
    echo -e "  create <stage> <email> <password>  - Cria um novo usuário"
    echo -e "  delete <stage> <email>   - Deleta um usuário"
    echo -e "  info <stage>              - Mostra informações do User Pool"
    echo -e "  get-pool-id <stage>       - Retorna apenas o User Pool ID"
    echo ""
    echo -e "Exemplos:"
    echo -e "  ./manage-cognito-users.sh list staging"
    echo -e "  ./manage-cognito-users.sh create staging user@example.com Senha123!"
    echo -e "  ./manage-cognito-users.sh info staging"
    exit 1
    ;;
esac


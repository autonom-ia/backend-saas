#!/bin/bash

# Script para build e deploy de módulos da API com código minificado e ofuscado
# Uso: ./deploy.sh <module> [--stage staging|prod]
# Exemplo: ./deploy.sh saas --stage staging
# Exemplo: ./deploy.sh saas --stage prod
# Exemplo: ./deploy.sh saas  (padrão: staging)

# Configurar perfil AWS para este projeto
# Se AWS_PROFILE já estiver definido no ambiente, respeitar esse valor.
# Caso contrário, usar 'autonomia' como padrão para compatibilidade.
: "${AWS_PROFILE:=autonomia}"

# Definindo cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variáveis padrão
MODULE=""
STAGE="staging"  # Padrão é staging para evitar deploys acidentais em produção

# Processar argumentos
while [[ $# -gt 0 ]]; do
  case $1 in
    --stage)
      if [ -z "$2" ]; then
        echo -e "${RED}Erro: --stage requer um valor (staging ou prod).${NC}"
        exit 1
      fi
      STAGE="$2"
      shift 2
      ;;
    *)
      if [ -z "$MODULE" ]; then
        MODULE="$1"
      else
        echo -e "${RED}Erro: Parâmetro desconhecido '$1'${NC}"
        exit 1
      fi
      shift
      ;;
  esac
done

# Verificando se o nome do módulo foi fornecido
if [ -z "$MODULE" ]; then
  echo -e "${RED}Erro: Nome do módulo não fornecido.${NC}"
  echo -e "Uso: ./deploy.sh <module> [--stage staging|prod]"
  echo -e "Exemplo: ./deploy.sh saas --stage staging"
  echo -e "Exemplo: ./deploy.sh saas --stage prod"
  exit 1
fi

# Validar que o stage é válido
if [ "$STAGE" != "prod" ] && [ "$STAGE" != "staging" ]; then
  echo -e "${RED}Erro: Stage inválido '$STAGE'.${NC}"
  echo -e "Stage deve ser 'prod' ou 'staging'"
  exit 1
fi

# Obter o caminho absoluto do diretório do script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Diretório pai do script (api)
API_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
WORKSPACE_ROOT="$( cd "$API_DIR/.." && pwd )"
MODULE_DIR="$API_DIR/$MODULE"
DIST_DIR="$MODULE_DIR/dist"

# Carregar .env da raiz do backend (WORKSPACE_ROOT/backend/.env) se existir,
# exportando as variáveis para o ambiente do shell antes de qualquer uso
BACKEND_ENV_FILE="$WORKSPACE_ROOT/.env"
if [ -f "$BACKEND_ENV_FILE" ]; then
  echo -e "${YELLOW}Carregando variáveis do .env da raiz do backend...${NC}"
  set -a
  # shellcheck disable=SC1090
  source "$BACKEND_ENV_FILE"
  set +a
fi

# Aviso especial para produção
if [ "$STAGE" = "prod" ]; then
  echo -e "${RED}⚠️  ATENÇÃO: Você está fazendo deploy em PRODUÇÃO! ⚠️${NC}"
  echo -e "${YELLOW}Confirme que você realmente quer fazer deploy em produção.${NC}"
  echo -e "${YELLOW}Pressione Ctrl+C para cancelar ou aguarde 5 segundos para continuar...${NC}"
  sleep 5
fi

echo -e "${BLUE}=== Iniciando processo de build e deploy para o módulo $MODULE no ambiente $STAGE ===${NC}"

# Verificar se o diretório do módulo existe
if [ ! -d "$MODULE_DIR" ]; then
  echo -e "${RED}Erro: Diretório do módulo '$MODULE' não encontrado em $API_DIR${NC}"
  exit 1
fi

# Verificar se o serverless.yml existe no diretório do módulo
if [ ! -f "$MODULE_DIR/serverless.yml" ]; then
  echo -e "${RED}Erro: Arquivo serverless.yml não encontrado em $MODULE_DIR${NC}"
  exit 1
fi

# Instalar dependências necessárias para build se não existirem
echo -e "${YELLOW}Verificando dependências de build...${NC}"
cd $MODULE_DIR

# Verificar e instalar terser globalmente se necessário
if ! npm list -g terser > /dev/null 2>&1; then
  echo -e "${YELLOW}Instalando terser globalmente para minificação...${NC}"
  npm install -g terser
fi

echo -e "${YELLOW}Instalando dependências do projeto...${NC}"
npm install --no-audit

# Criar diretório dist ou limpar se já existir
if [ -d "$DIST_DIR" ]; then
  echo -e "${YELLOW}Limpando diretório dist...${NC}"
  rm -rf $DIST_DIR/*
else
  echo -e "${YELLOW}Criando diretório dist...${NC}"
  mkdir -p $DIST_DIR
fi

# Copiar serverless.yml para dist
echo -e "${YELLOW}Copiando configuração serverless.yml...${NC}"
cp $MODULE_DIR/serverless.yml $DIST_DIR/

# Ajustar serverless.yml do dist para staging/prod
echo -e "${YELLOW}Ajustando serverless.yml para o diretório dist...${NC}"

# Usar Python para processar o serverless.yml de forma mais simples e direta
STAGE_VALUE="$STAGE"
echo -e "${YELLOW}Processando serverless.yml (STAGE=$STAGE_VALUE)...${NC}"

# Verificar se o arquivo existe antes de processar
if [ ! -f "$DIST_DIR/serverless.yml" ]; then
  echo -e "${RED}Erro: Arquivo serverless.yml não encontrado em $DIST_DIR${NC}"
  exit 1
fi

python3 <<EOF
import re
import sys

STAGE = "$STAGE_VALUE"
file_path = "$DIST_DIR/serverless.yml"

try:
    with open(file_path, "r") as f:
        content = f.read()
    
    original_content = content
    original_has_plugin = "serverless-domain-manager" in content
    
    # Remover seção package (sempre removemos)
    content = re.sub(r'^package:.*?\n(?:  .*\n)*', '', content, flags=re.MULTILINE)
    
    if STAGE == "staging":
        # Remover plugins se só tiver serverless-domain-manager
        if "plugins:" in content:
            # Verificar se há outros plugins
            plugins_match = re.search(r'^plugins:\s*\n((?:  - .*\n)*)', content, re.MULTILINE)
            if plugins_match:
                plugins_list = plugins_match.group(1)
                # Verificar se há outros plugins além de serverless-domain-manager
                other_plugins = [p for p in plugins_list.split('\n') if p.strip() and 'serverless-domain-manager' not in p and p.strip().startswith('-')]
                if not other_plugins:
                    # Só tem serverless-domain-manager, remover toda a seção plugins
                    # Usar abordagem mais direta: remover linha por linha
                    content_lines = content.split('\n')
                    new_content_lines = []
                    skip_plugins_section = False
                    for line in content_lines:
                        if line.strip() == 'plugins:':
                            skip_plugins_section = True
                            continue
                        if skip_plugins_section:
                            # Continuar pulando enquanto for parte da lista de plugins (indentado com 2 espaços e começa com -)
                            if line.startswith('  -') or (line.startswith('  ') and not line.strip()):
                                continue
                            else:
                                # Não é mais parte dos plugins
                                skip_plugins_section = False
                        if not skip_plugins_section:
                            new_content_lines.append(line)
                    content = '\n'.join(new_content_lines)
                else:
                    # Tem outros plugins, remover apenas serverless-domain-manager
                    content = re.sub(r'  - serverless-domain-manager\n', '', content)
        
        # Remover seção customDomain completa (pode estar dentro de custom:)
        lines = content.split('\n')
        new_lines = []
        skip_custom_domain = False
        for line in lines:
            if line.strip().startswith('customDomain:'):
                skip_custom_domain = True
                continue
            if skip_custom_domain:
                # Continuar pulando enquanto a linha estiver indentada com 4 espaços (faz parte do customDomain)
                if line.startswith('    '):
                    continue
                else:
                    # Não está mais indentada, parar de pular
                    skip_custom_domain = False
            if not skip_custom_domain:
                new_lines.append(line)
        content = '\n'.join(new_lines)
        
        # Remover cors: true das rotas HTTP em staging (CORS gerenciado na Lambda)
        # Remove linhas que contenham "cors: true" com qualquer indentação
        lines = content.split('\n')
        new_lines = []
        for line in lines:
            # Pular linhas que são apenas "cors: true" (com qualquer indentação)
            if re.match(r'^\s*cors:\s*true\s*$', line):
                continue
            new_lines.append(line)
        content = '\n'.join(new_lines)
    
    # Verificar se realmente removeu
    if STAGE == "staging":
        if "serverless-domain-manager" in content:
            print("ERRO: Plugin serverless-domain-manager ainda presente após processamento", file=sys.stderr)
            # Mostrar onde está
            lines = content.split('\n')
            for i, line in enumerate(lines[:20], 1):
                if "serverless-domain-manager" in line:
                    print(f"Linha {i}: {line}", file=sys.stderr)
            # Tentar remoção mais agressiva
            content = re.sub(r'^plugins:.*?\n', '', content, flags=re.MULTILINE)
            content = re.sub(r'.*serverless-domain-manager.*\n', '', content)
            if "serverless-domain-manager" in content:
                sys.exit(1)
        if "customDomain:" in content:
            print("ERRO: CustomDomain ainda presente após processamento", file=sys.stderr)
            # Mostrar onde está
            lines = content.split('\n')
            for i, line in enumerate(lines[:20], 1):
                if "customDomain:" in line:
                    print(f"Linha {i}: {line}", file=sys.stderr)
            # Tentar remoção mais agressiva
            lines = content.split('\n')
            new_lines = []
            skip = False
            for line in lines:
                if 'customDomain:' in line:
                    skip = True
                    continue
                if skip and (line.startswith('    ') or line.startswith('  ')):
                    continue
                if skip:
                    skip = False
                if not skip:
                    new_lines.append(line)
            content = '\n'.join(new_lines)
            if "customDomain:" in content:
                sys.exit(1)
    
    # Salvar arquivo
    with open(file_path, "w") as f:
        f.write(content)
    
    # Verificar novamente após salvar
    if STAGE == "staging":
        with open(file_path, "r") as f:
            saved_content = f.read()
        if "serverless-domain-manager" in saved_content:
            print("ERRO: Plugin serverless-domain-manager ainda presente após salvar arquivo", file=sys.stderr)
            # Mostrar onde está
            lines = saved_content.split('\n')
            for i, line in enumerate(lines[:30], 1):
                if "serverless-domain-manager" in line or (i > 1 and "plugins:" in lines[i-2]):
                    print(f"Linha {i}: {line}", file=sys.stderr)
            # Tentar remoção final mais agressiva
            lines = saved_content.split('\n')
            final_lines = []
            skip = False
            for line in lines:
                if line.strip() == 'plugins:':
                    skip = True
                    continue
                if skip and (line.startswith('  -') or line.startswith('  ') and not line.strip()):
                    continue
                if skip:
                    skip = False
                if 'serverless-domain-manager' not in line:
                    final_lines.append(line)
            final_content = '\n'.join(final_lines)
            with open(file_path, "w") as f:
                f.write(final_content)
            # Verificar uma última vez
            with open(file_path, "r") as f:
                final_check = f.read()
            if "serverless-domain-manager" in final_check:
                print("ERRO CRÍTICO: Não foi possível remover o plugin", file=sys.stderr)
                sys.exit(1)
        if "customDomain:" in saved_content:
            print("ERRO: CustomDomain ainda presente após salvar arquivo", file=sys.stderr)
            sys.exit(1)
    
    print("Arquivo processado com sucesso")
    
except Exception as e:
    print(f"ERRO ao processar arquivo: {e}", file=sys.stderr)
    sys.exit(1)
EOF
PYTHON_EXIT_CODE=$?

# Verificar se o Python funcionou
if [ $PYTHON_EXIT_CODE -ne 0 ]; then
  echo -e "${RED}Erro: Falha ao processar serverless.yml com Python (exit code: $PYTHON_EXIT_CODE)${NC}"
  exit 1
fi

# Debug: mostrar o que foi processado e forçar remoção se necessário
if [ "$STAGE" = "staging" ]; then
  echo -e "${YELLOW}Verificando processamento...${NC}"
  if grep -q "serverless-domain-manager" "$DIST_DIR/serverless.yml" 2>/dev/null; then
    echo -e "${RED}⚠️ ERRO: Plugin ainda encontrado após processamento Python${NC}"
    echo -e "${YELLOW}Forçando remoção manual com Python...${NC}"
    # Forçar remoção com Python de forma mais agressiva
    python3 <<PYEOF
with open("$DIST_DIR/serverless.yml", "r") as f:
    lines = f.readlines()

new_lines = []
skip_plugins = False
skip_custom_domain = False

for line in lines:
    # Remover seção plugins
    if line.strip() == 'plugins:':
        skip_plugins = True
        continue
    if skip_plugins:
        if line.startswith('  -') or (line.startswith('  ') and not line.strip()):
            continue
        else:
            skip_plugins = False
    
    # Remover customDomain
    if 'customDomain:' in line:
        skip_custom_domain = True
        continue
    if skip_custom_domain:
        if line.startswith('    ') or line.startswith('  '):
            continue
        else:
            skip_custom_domain = False
    
    # Adicionar linha se não for parte das seções a remover
    if not skip_plugins and not skip_custom_domain and 'serverless-domain-manager' not in line:
        new_lines.append(line)

with open("$DIST_DIR/serverless.yml", "w") as f:
    f.writelines(new_lines)
    
# Verificar novamente
with open("$DIST_DIR/serverless.yml", "r") as f:
    final = f.read()
    if "serverless-domain-manager" in final or "customDomain:" in final:
        print("ERRO: Ainda presente após remoção forçada", file=__import__('sys').stderr)
        exit(1)
    else:
        print("Remoção forçada bem-sucedida")
PYEOF
    if [ $? -ne 0 ]; then
      echo -e "${RED}Erro: Não foi possível remover plugin/customDomain${NC}"
      exit 1
    fi
    echo -e "${GREEN}✓ Plugin removido com sucesso após remoção forçada${NC}"
  fi
  if grep -q "customDomain:" "$DIST_DIR/serverless.yml" 2>/dev/null; then
    echo -e "${RED}⚠️ ERRO: CustomDomain ainda encontrado${NC}"
  fi
fi

# Verificar se a seção package foi removida
if grep -q "^package:" "$DIST_DIR/serverless.yml"; then
  echo -e "${RED}Erro: Não foi possível remover seção package do serverless.yml${NC}"
  exit 1
fi

# Para staging, verificar se customDomain foi removido e forçar remoção se necessário
if [ "$STAGE" = "staging" ]; then
  # Verificar múltiplas vezes com diferentes padrões
  if grep -q "serverless-domain-manager" "$DIST_DIR/serverless.yml" 2>/dev/null || \
     grep -q "customDomain:" "$DIST_DIR/serverless.yml" 2>/dev/null; then
    echo -e "${YELLOW}⚠️ Plugin/customDomain ainda encontrado, forçando remoção...${NC}"
    echo -e "${YELLOW}Conteúdo problemático encontrado:${NC}"
    grep -n "serverless-domain-manager\|customDomain" "$DIST_DIR/serverless.yml" | head -5
    
    # Forçar remoção com Python novamente
    python3 <<PYEOF
import re

with open("$DIST_DIR/serverless.yml", "r") as f:
    content = f.read()

# Remover plugins se só tiver serverless-domain-manager
if "plugins:" in content:
    plugins_match = re.search(r'^plugins:\s*\n((?:  - .*\n)*)', content, re.MULTILINE)
    if plugins_match:
        plugins_list = plugins_match.group(1)
        other_plugins = [p for p in plugins_list.split('\n') if p.strip() and 'serverless-domain-manager' not in p]
        if not other_plugins:
            content = re.sub(r'^plugins:.*?\n((?:  - .*\n)*)', '', content, flags=re.MULTILINE)
        else:
            content = re.sub(r'  - serverless-domain-manager\n', '', content)

# Remover customDomain
lines = content.split('\n')
new_lines = []
skip_custom_domain = False
for line in lines:
    if line.strip().startswith('customDomain:'):
        skip_custom_domain = True
        continue
    if skip_custom_domain:
        if line.startswith('    '):
            continue
        else:
            skip_custom_domain = False
    if not skip_custom_domain:
        new_lines.append(line)
content = '\n'.join(new_lines)

with open("$DIST_DIR/serverless.yml", "w") as f:
    f.write(content)
    
print("Remoção forçada concluída")
PYEOF
    
    # Verificar novamente
    if grep -q "serverless-domain-manager" "$DIST_DIR/serverless.yml" 2>/dev/null || grep -q "customDomain:" "$DIST_DIR/serverless.yml" 2>/dev/null; then
      echo -e "${RED}Erro persistente: Não foi possível remover customDomain/plugin${NC}"
      echo -e "${YELLOW}Conteúdo atual do serverless.yml:${NC}"
      cat "$DIST_DIR/serverless.yml" | head -20
      exit 1
    fi
  fi
  echo -e "${GREEN}✓ Seção package removida e customDomain desabilitado para staging${NC}"
else
  echo -e "${GREEN}✓ Seção package removida com sucesso${NC}"
fi

# Processar todos os arquivos JS
echo -e "${YELLOW}Iniciando processamento e minificação dos arquivos...${NC}"

# Criar a estrutura de diretórios em dist
mkdir -p $DIST_DIR/handlers
mkdir -p $DIST_DIR/services
mkdir -p $DIST_DIR/utils

# Copiar Lambda Layers (se existirem) e instalar suas dependências
if [ -d "$MODULE_DIR/layers" ]; then
  echo -e "${YELLOW}Copiando Lambda Layers...${NC}"
  rsync -a --exclude "node_modules" "$MODULE_DIR/layers/" "$DIST_DIR/layers/"

  # Instalar dependências da layer common (se existir package.json)
  if [ -f "$MODULE_DIR/layers/common/nodejs/package.json" ]; then
    echo -e "${YELLOW}Instalando dependências da Layer common...${NC}"
    mkdir -p "$DIST_DIR/layers/common/nodejs"
    cp "$MODULE_DIR/layers/common/nodejs/package.json" "$DIST_DIR/layers/common/nodejs/"
    pushd "$DIST_DIR/layers/common/nodejs" >/dev/null
    echo -e "${BLUE}[Layer common] npm install (omit dev/optional)...${NC}"
    npm install --omit=dev --omit=optional --no-audit --no-fund || {
      echo -e "${YELLOW}[Layer common] Falha no npm install, tentando novamente limpando cache...${NC}"
      npm cache verify || true
      npm install --omit=dev --omit=optional --no-audit --no-fund
    }
    # Não incluir lockfile no pacote final da layer para evitar inconsistências
    rm -f package-lock.json 2>/dev/null || true
    popd >/dev/null
  fi
fi

# Copiar arquivos de configuração e non-js (excluindo arquivos desnecessários)
# No macOS não há a opção --parents, então precisamos usar um método alternativo
find $MODULE_DIR -type f \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" \
  -not -path "*/test/*" \
  -not -path "*/tests/*" \
  -not -name "*.js" \
  -not -name "*.md" \
  -not -name "*.map" \
  -not -name "package-lock.json" \
  -not -name ".npmrc" \
  -not -name ".env*" \
  | while read file; do
  # Obter caminho relativo ao MODULE_DIR
  rel_path=$(echo "$file" | sed "s|^$MODULE_DIR/||")
  # Criar o diretório de destino
  mkdir -p "$DIST_DIR/$(dirname "$rel_path")"
  # Copiar o arquivo
  cp "$file" "$DIST_DIR/$rel_path"
done

# Função para processar arquivos JS
process_js_files() {
  local dir=$1
  local target_dir=$2
  
  mkdir -p $target_dir
  
  for file in $(find $dir -maxdepth 1 -name "*.js"); do
    filename=$(basename $file)
    echo -e "${GREEN}Minificando: ${filename}${NC}"
    terser $file \
      --compress passes=2,drop_console=false \
      --mangle toplevel=true,reserved=['handler','exports','require','module'] \
      --output $target_dir/$filename
  done
}

# Processar handlers
echo -e "${YELLOW}Processando handlers...${NC}"
process_js_files "$MODULE_DIR/handlers" "$DIST_DIR/handlers"

# Processar services
echo -e "${YELLOW}Processando services...${NC}"
process_js_files "$MODULE_DIR/services" "$DIST_DIR/services"

# Processar utils
# Copiar utils apenas se o diretório existir no módulo
if [ -d "$MODULE_DIR/utils" ]; then
  echo -e "${YELLOW}Processando utils locais...${NC}"
  process_js_files "$MODULE_DIR/utils" "$DIST_DIR/utils"
fi

# Copiar utils compartilhados 
echo -e "${YELLOW}Copiando utils compartilhados...${NC}"
mkdir -p $DIST_DIR/utils
for file in $(find $API_DIR/utils -name "*.js"); do
  filename=$(basename $file)
  echo -e "${GREEN}Copiando util compartilhado: ${filename}${NC}"
  terser $file \
    --compress passes=2 \
    --mangle toplevel=true,reserved=['exports','require','module'] \
    --output $DIST_DIR/utils/$filename
done

# Copiar package.json e instalar dependências no dist
echo -e "${YELLOW}Configurando package.json...${NC}"
cp $MODULE_DIR/package.json $DIST_DIR/
if [ -f "$MODULE_DIR/package-lock.json" ]; then
  echo -e "${YELLOW}Copiando package-lock.json para build reprodutível...${NC}"
  cp $MODULE_DIR/package-lock.json $DIST_DIR/
fi

# Instalar apenas dependências de produção no dist
cd $DIST_DIR
# Preferir instalação reprodutível e enxuta
if [ -f "package-lock.json" ]; then
  echo -e "${YELLOW}Instalando dependências (ci, omit dev/optional)...${NC}"
  npm ci --omit=dev --omit=optional --no-audit --no-fund
else
  echo -e "${YELLOW}Instalando dependências (production, omit optional)...${NC}"
  npm install --production --omit=optional --no-audit --no-fund
fi

# Remover package-lock.json para não ser incluído no pacote final
if [ -f "package-lock.json" ]; then
  rm -f package-lock.json
fi

echo -e "${BLUE}Build completado com sucesso.${NC}"

# Verificar migrações pendentes antes de perguntar
echo -e "${BLUE}Verificando migrações pendentes...${NC}"
cd $API_DIR/..

# Buscar parâmetros SSM e injetar como variáveis de ambiente (somente se não houver .env/variáveis locais)
if [ "$STAGE" = "staging" ] || [ "$STAGE" = "prod" ]; then
  # Apenas carrega do SSM se DB_HOST/POSTGRES_HOST ainda não estiverem definidos
  if [ -z "$DB_HOST" ] && [ -z "$POSTGRES_HOST" ]; then
    echo -e "${YELLOW}Carregando parâmetros SSM para banco principal...${NC}"
    # Banco principal
    DB_HOST=$(aws ssm get-parameter --name "/autonomia/${STAGE}/db/host" --region us-east-1 --profile "$AWS_PROFILE" --query "Parameter.Value" --output text --with-decryption 2>/dev/null)
    DB_PORT=$(aws ssm get-parameter --name "/autonomia/${STAGE}/db/port" --region us-east-1 --profile "$AWS_PROFILE" --query "Parameter.Value" --output text 2>/dev/null || echo "5432")
    DB_NAME=$(aws ssm get-parameter --name "/autonomia/${STAGE}/db/name" --region us-east-1 --profile "$AWS_PROFILE" --query "Parameter.Value" --output text 2>/dev/null || echo "autonomia_db")
    DB_USER=$(aws ssm get-parameter --name "/autonomia/${STAGE}/db/user" --region us-east-1 --profile "$AWS_PROFILE" --query "Parameter.Value" --output text --with-decryption 2>/dev/null)
    DB_PASSWORD=$(aws ssm get-parameter --name "/autonomia/${STAGE}/db/password" --region us-east-1 --profile "$AWS_PROFILE" --query "Parameter.Value" --output text --with-decryption 2>/dev/null)
    DB_SSL_ENABLED=$(aws ssm get-parameter --name "/autonomia/${STAGE}/db/ssl-enabled" --region us-east-1 --profile "$AWS_PROFILE" --query "Parameter.Value" --output text 2>/dev/null || echo "false")

    export DB_HOST
    export DB_PORT
    export DB_NAME
    export DB_USER
    export DB_PASSWORD
    export DB_SSL_ENABLED
  else
    echo -e "${YELLOW}Variáveis de banco principal já definidas no ambiente (.env ou externo); ignorando SSM.${NC}"
  fi

  # Banco clients: só carrega se CLIENTS_DB_HOST ainda não estiver definido
  if [ -z "$CLIENTS_DB_HOST" ]; then
    echo -e "${YELLOW}Carregando parâmetros SSM para banco clients...${NC}"
    # Usar sempre /autonomia/${STAGE}/clients/db/* pois ambos os databases existem em staging e prod
    CLIENTS_DB_HOST=$(aws ssm get-parameter --name "/autonomia/${STAGE}/clients/db/host" --region us-east-1 --profile "$AWS_PROFILE" --query "Parameter.Value" --output text --with-decryption 2>/dev/null)
    CLIENTS_DB_PORT=$(aws ssm get-parameter --name "/autonomia/${STAGE}/clients/db/port" --region us-east-1 --profile "$AWS_PROFILE" --query "Parameter.Value" --output text 2>/dev/null || echo "5432")
    CLIENTS_DB_NAME=$(aws ssm get-parameter --name "/autonomia/${STAGE}/clients/db/name" --region us-east-1 --profile "$AWS_PROFILE" --query "Parameter.Value" --output text 2>/dev/null || echo "autonomia_clients")
    CLIENTS_DB_USER=$(aws ssm get-parameter --name "/autonomia/${STAGE}/clients/db/user" --region us-east-1 --profile "$AWS_PROFILE" --query "Parameter.Value" --output text --with-decryption 2>/dev/null)
    CLIENTS_DB_PASSWORD=$(aws ssm get-parameter --name "/autonomia/${STAGE}/clients/db/password" --region us-east-1 --profile "$AWS_PROFILE" --query "Parameter.Value" --output text --with-decryption 2>/dev/null)

    export CLIENTS_DB_HOST
    export CLIENTS_DB_PORT
    export CLIENTS_DB_NAME
    export CLIENTS_DB_USER
    export CLIENTS_DB_PASSWORD
  else
    echo -e "${YELLOW}Variáveis de banco clients já definidas no ambiente (.env ou externo); ignorando SSM.${NC}"
  fi
fi

# Verificar migrações pendentes
# Mapear STAGE para NODE_ENV do Knex
if [ "$STAGE" = "prod" ]; then
  export NODE_ENV="production"
else
  export NODE_ENV="$STAGE"
fi
echo -e "${BLUE}Verificando migrações pendentes em ambos os bancos... (NODE_ENV=$NODE_ENV)${NC}"

# Capturar apenas a última linha (JSON) e erros separadamente
MIGRATION_OUTPUT=$(node shared/migrations/check-pending-migrations.js 2>&1)
MIGRATION_CHECK_EXIT=$?

# Extrair JSON da última linha (o script imprime o JSON na última linha)
MIGRATION_STATUS=$(echo "$MIGRATION_OUTPUT" | tail -1)

# Parse do JSON (usando jq se disponível, senão grep/sed)
if command -v jq &> /dev/null; then
  DEFAULT_PENDING=$(echo "$MIGRATION_STATUS" | jq -r '.default.pendingCount // 0' 2>/dev/null || echo "0")
  CLIENTS_PENDING=$(echo "$MIGRATION_STATUS" | jq -r '.clients.pendingCount // 0' 2>/dev/null || echo "0")
  DEFAULT_ERROR=$(echo "$MIGRATION_STATUS" | jq -r '.default.error // ""' 2>/dev/null || echo "")
  CLIENTS_ERROR=$(echo "$MIGRATION_STATUS" | jq -r '.clients.error // ""' 2>/dev/null || echo "")
else
  # Fallback: extrair números usando grep
  DEFAULT_PENDING=$(echo "$MIGRATION_STATUS" | grep -o '"default".*"pendingCount":[0-9]*' | grep -o '[0-9]*' | head -1 || echo "0")
  CLIENTS_PENDING=$(echo "$MIGRATION_STATUS" | grep -o '"clients".*"pendingCount":[0-9]*' | grep -o '[0-9]*' | head -1 || echo "0")
  DEFAULT_ERROR=""
  CLIENTS_ERROR=""
fi

# Converter para números (garantir que são inteiros)
DEFAULT_PENDING=${DEFAULT_PENDING:-0}
CLIENTS_PENDING=${CLIENTS_PENDING:-0}
TOTAL_PENDING=$((DEFAULT_PENDING + CLIENTS_PENDING))

# Só perguntar se houver migrações pendentes
if [ "$TOTAL_PENDING" -gt 0 ]; then
  echo -e "${YELLOW}Migrações pendentes encontradas:${NC}"
  if [ "$DEFAULT_PENDING" -gt 0 ]; then
    echo -e "  ${YELLOW}Banco principal (autonomia_db): ${DEFAULT_PENDING} migração(ões)${NC}"
  fi
  if [ "$CLIENTS_PENDING" -gt 0 ]; then
    echo -e "  ${YELLOW}Banco clients (autonomia_clients): ${CLIENTS_PENDING} migração(ões)${NC}"
  fi
  if [ -n "$DEFAULT_ERROR" ]; then
    echo -e "  ${RED}Erro ao verificar banco principal: $DEFAULT_ERROR${NC}"
  fi
  if [ -n "$CLIENTS_ERROR" ]; then
    echo -e "  ${RED}Erro ao verificar banco clients: $CLIENTS_ERROR${NC}"
  fi
  
  echo -e "${YELLOW}Deseja executar migrações de banco de dados? (s/N)${NC}"
  read -t 30 -r RUN_MIGRATIONS
  RUN_MIGRATIONS=${RUN_MIGRATIONS:-N}  # Padrão é 'N' se não responder em 30 segundos
else
  echo -e "${GREEN}✓ Nenhuma migração pendente encontrada${NC}"
  RUN_MIGRATIONS="N"
fi

if [[ "$RUN_MIGRATIONS" =~ ^[Ss]$ ]]; then
  echo -e "${BLUE}Executando migrações de banco de dados...${NC}"
  
  # Se não carregou SSM antes (development), carregar agora
  if [ "$STAGE" != "staging" ] && [ "$STAGE" != "prod" ]; then
    # Desenvolvimento local: variáveis já devem estar no .env
    echo -e "${YELLOW}Usando variáveis de ambiente do .env (desenvolvimento local)${NC}"
  fi
  
  # Executar migrações do banco principal se houver pendentes ou se não houver erro
  if [ "$DEFAULT_PENDING" -gt 0 ]; then
    echo -e "${BLUE}Executando migrações do banco principal (autonomia_db)...${NC}"
    node shared/migrations/migrate-knex.js
    
    if [ $? -ne 0 ]; then
      echo -e "${RED}Erro ao executar migrações do banco principal.${NC}"
      exit 1
    fi
    echo -e "${GREEN}✓ Migrações do banco principal concluídas${NC}"
  elif [ -n "$DEFAULT_ERROR" ]; then
    echo -e "${YELLOW}⚠ Aviso: Não foi possível verificar migrações do banco principal: $DEFAULT_ERROR${NC}"
    echo -e "${YELLOW}  Pulando execução de migrações do banco principal${NC}"
  else
    echo -e "${GREEN}✓ Banco principal (autonomia_db): Nenhuma migração pendente${NC}"
  fi
  
  # Executar migrações do banco clients se houver pendentes
  if [ "$CLIENTS_PENDING" -gt 0 ]; then
    echo -e "${BLUE}Executando migrações do banco clients (autonomia_clients)...${NC}"
    node shared/migrations/migrate-knex.js --clients
    
    if [ $? -ne 0 ]; then
      echo -e "${RED}Erro ao executar migrações do banco clients.${NC}"
      exit 1
    fi
    echo -e "${GREEN}✓ Migrações do banco clients concluídas${NC}"
  elif [ -n "$CLIENTS_ERROR" ]; then
    echo -e "${YELLOW}⚠ Aviso: Não foi possível verificar migrações do banco clients: $CLIENTS_ERROR${NC}"
    echo -e "${YELLOW}  Pulando execução de migrações do banco clients${NC}"
  else
    echo -e "${GREEN}✓ Banco clients (autonomia_clients): Nenhuma migração pendente${NC}"
  fi
  
  echo -e "${GREEN}Migrações de banco de dados aplicadas com sucesso!${NC}"
else
  echo -e "${YELLOW}Migrações de banco de dados puladas. Continuando com o deploy...${NC}"
fi

# Voltar para o diretório de deploy
cd $API_DIR

# Retornar ao diretório dist para continuar o deploy
cd $DIST_DIR

# Para staging, verificar UMA ÚLTIMA VEZ se o plugin foi removido do serverless.yml
# e forçar remoção se necessário ANTES do deploy
if [ "$STAGE" = "staging" ]; then
  if grep -q "serverless-domain-manager" "$DIST_DIR/serverless.yml" 2>/dev/null || grep -q "^plugins:" "$DIST_DIR/serverless.yml" 2>/dev/null; then
    echo -e "${RED}⚠️ ERRO CRÍTICO: Plugin ainda presente no serverless.yml antes do deploy!${NC}"
    echo -e "${YELLOW}Forçando remoção final...${NC}"
    python3 <<FINALFIX
with open("$DIST_DIR/serverless.yml", "r") as f:
    lines = f.readlines()

new_lines = []
skip_plugins = False

for line in lines:
    if line.strip() == 'plugins:':
        skip_plugins = True
        continue
    if skip_plugins:
        if line.startswith('  -') or (line.startswith('  ') and not line.strip()):
            continue
        else:
            skip_plugins = False
    if not skip_plugins and 'serverless-domain-manager' not in line:
        new_lines.append(line)

with open("$DIST_DIR/serverless.yml", "w") as f:
    f.writelines(new_lines)

# Verificar
with open("$DIST_DIR/serverless.yml", "r") as f:
    final = f.read()
    if "serverless-domain-manager" in final:
        print("ERRO: Ainda presente", file=__import__('sys').stderr)
        exit(1)
FINALFIX
    if [ $? -ne 0 ]; then
      echo -e "${RED}Erro: Não foi possível remover plugin antes do deploy${NC}"
      exit 1
    fi
    echo -e "${GREEN}✓ Plugin removido com sucesso antes do deploy${NC}"
  fi
fi

# Para staging, remover temporariamente o plugin do node_modules ANTES do deploy
# Isso evita que o Serverless Framework tente carregar o plugin
if [ "$STAGE" = "staging" ]; then
  echo -e "${YELLOW}Removendo temporariamente plugin serverless-domain-manager do node_modules...${NC}"
  
  # Remover do node_modules do dist (se existir)
  if [ -d "node_modules/serverless-domain-manager" ]; then
    mv "node_modules/serverless-domain-manager" "node_modules/serverless-domain-manager.disabled" 2>/dev/null || true
    echo -e "${GREEN}✓ Plugin removido do node_modules do dist${NC}"
  fi
  
  # Remover do node_modules do módulo original também
  if [ -d "$MODULE_DIR/node_modules/serverless-domain-manager" ]; then
    mv "$MODULE_DIR/node_modules/serverless-domain-manager" "$MODULE_DIR/node_modules/serverless-domain-manager.disabled" 2>/dev/null || true
    echo -e "${GREEN}✓ Plugin removido do node_modules do módulo${NC}"
  fi
  
  # Remover do node_modules raiz (pnpm) - mais importante!
  if [ -d "$WORKSPACE_ROOT/node_modules/.pnpm" ]; then
    echo -e "${YELLOW}Removendo plugin do node_modules raiz (pnpm)...${NC}"
    DISABLED_COUNT=$(find "$WORKSPACE_ROOT/node_modules/.pnpm" -type d -name "serverless-domain-manager@*" -exec mv {} {}.disabled \; 2>/dev/null | wc -l | tr -d ' ')
    if [ "$DISABLED_COUNT" -gt 0 ]; then
      echo -e "${GREEN}✓ $DISABLED_COUNT instância(s) do plugin removida(s) do pnpm${NC}"
    fi
  fi
  
  # Remover do node_modules raiz direto (npm/yarn)
  if [ -d "$WORKSPACE_ROOT/node_modules/serverless-domain-manager" ]; then
    echo -e "${YELLOW}Removendo plugin do node_modules raiz direto...${NC}"
    mv "$WORKSPACE_ROOT/node_modules/serverless-domain-manager" "$WORKSPACE_ROOT/node_modules/serverless-domain-manager.disabled" 2>/dev/null || true
    echo -e "${GREEN}✓ Plugin removido do node_modules raiz${NC}"
  fi
  
  # Limpar cache do Serverless Framework
  if [ -d ".serverless" ]; then
    echo -e "${YELLOW}Limpando cache do Serverless Framework...${NC}"
    rm -rf .serverless/plugins 2>/dev/null || true
  fi
fi

# Deploy para AWS usando o Serverless Framework
echo -e "${BLUE}Iniciando deploy para AWS no ambiente $STAGE...${NC}"
npx serverless deploy --force --stage $STAGE
DEPLOY_EXIT_CODE=$?

# Restaurar plugin se foi desabilitado para staging
if [ "$STAGE" = "staging" ]; then
  echo -e "${YELLOW}Restaurando plugin serverless-domain-manager...${NC}"
  
  # Restaurar do dist
  if [ -d "node_modules/serverless-domain-manager.disabled" ]; then
    mv "node_modules/serverless-domain-manager.disabled" "node_modules/serverless-domain-manager" 2>/dev/null || true
  fi
  
  # Restaurar do módulo original
  if [ -d "$MODULE_DIR/node_modules/serverless-domain-manager.disabled" ]; then
    mv "$MODULE_DIR/node_modules/serverless-domain-manager.disabled" "$MODULE_DIR/node_modules/serverless-domain-manager" 2>/dev/null || true
  fi
  
  # Restaurar do node_modules raiz (pnpm)
  if [ -d "$WORKSPACE_ROOT/node_modules/.pnpm" ]; then
    find "$WORKSPACE_ROOT/node_modules/.pnpm" -type d -name "serverless-domain-manager@*.disabled" -exec sh -c 'mv "$1" "${1%.disabled}"' _ {} \; 2>/dev/null || true
  fi
  
  # Restaurar do node_modules raiz direto (npm/yarn)
  if [ -d "$WORKSPACE_ROOT/node_modules/serverless-domain-manager.disabled" ]; then
    mv "$WORKSPACE_ROOT/node_modules/serverless-domain-manager.disabled" "$WORKSPACE_ROOT/node_modules/serverless-domain-manager" 2>/dev/null || true
  fi
fi

# Verificar resultado do deploy
if [ $DEPLOY_EXIT_CODE -ne 0 ]; then
  echo -e "${RED}Erro durante o deploy do módulo $MODULE.${NC}"
  exit 1
fi

if [ $? -eq 0 ]; then
  echo -e "${GREEN}Deploy concluído com sucesso para o módulo $MODULE no ambiente $STAGE!${NC}"
  
  # Executar testes de API se existirem
  if [ -d "$MODULE_DIR/test" ] && [ -f "$MODULE_DIR/test/run-tests.sh" ]; then
    echo -e "${BLUE}Executando testes de API para o módulo $MODULE...${NC}"
    cd $MODULE_DIR/test
    chmod +x run-tests.sh
    ./run-tests.sh
    
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}Testes de API executados com sucesso!${NC}"
    else
      echo -e "${YELLOW}⚠️ Alguns testes de API falharam. Verifique os resultados acima.${NC}"
    fi
  else
    echo -e "${YELLOW}Nenhum teste automatizado encontrado para este módulo.${NC}"
  fi
else
  echo -e "${RED}Erro durante o deploy do módulo $MODULE.${NC}"
  exit 1
fi

echo -e "${GREEN}Processo finalizado com sucesso!${NC}"
exit 0

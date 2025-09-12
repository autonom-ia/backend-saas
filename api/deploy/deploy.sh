#!/bin/bash

# Script para build e deploy de módulos da API com código minificado e ofuscado
# Uso: ./deploy.sh <module> (onde module pode ser "settings" ou "funnel")

# Definindo cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verificando se o nome do módulo foi fornecido
if [ -z "$1" ]; then
  echo -e "${RED}Erro: Nome do módulo não fornecido.${NC}"
  echo -e "Uso: ./deploy.sh <module> (onde module pode ser \"settings\" ou \"funnel\")"
  exit 1
fi

MODULE=$1
STAGE="prod"

# Obter o caminho absoluto do diretório do script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Diretório pai do script (api)
API_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
MODULE_DIR="$API_DIR/$MODULE"
DIST_DIR="$MODULE_DIR/dist"

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

# Processar todos os arquivos JS
echo -e "${YELLOW}Iniciando processamento e minificação dos arquivos...${NC}"

# Criar a estrutura de diretórios em dist
mkdir -p $DIST_DIR/handlers
mkdir -p $DIST_DIR/services
mkdir -p $DIST_DIR/utils

# Copiar arquivos de configuração e non-js
# No macOS não há a opção --parents, então precisamos usar um método alternativo
find $MODULE_DIR -type f -not -path "*/node_modules/*" -not -path "*/dist/*" -not -name "*.js" | while read file; do
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
      --output $target_dir/$filename \
      --source-map "root='src',url='$filename.map'"
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
    --output $DIST_DIR/utils/$filename \
    --source-map "root='src',url='$filename.map'"
done

# Copiar package.json e instalar dependências no dist
echo -e "${YELLOW}Configurando package.json...${NC}"
cp $MODULE_DIR/package.json $DIST_DIR/

# Instalar apenas dependências de produção no dist
cd $DIST_DIR
npm install --production --no-audit

echo -e "${BLUE}Build completado com sucesso.${NC}"

# Executar migrações de banco de dados
echo -e "${BLUE}Executando migrações de banco de dados...${NC}"
cd $API_DIR/..
node shared/migrations/migrate-knex.js

# Verificar se as migrações foram concluídas com sucesso
if [ $? -ne 0 ]; then
  echo -e "${RED}Erro ao executar migrações de banco de dados. Deploy cancelado.${NC}"
  exit 1
fi
echo -e "${GREEN}Migrações de banco de dados aplicadas com sucesso!${NC}"

# Retornar ao diretório dist para continuar o deploy
cd $DIST_DIR

# Deploy para AWS usando o Serverless Framework
echo -e "${BLUE}Iniciando deploy para AWS no ambiente $STAGE...${NC}"
npx serverless deploy --force --stage $STAGE

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

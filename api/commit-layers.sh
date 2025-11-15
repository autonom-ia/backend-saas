#!/bin/bash

# Script para commitar todos os package.json das layers no Git

echo "=== Adicionando package.json das layers ao Git ==="

cd "$(dirname "$0")"

# Lista de todos os módulos
MODULES="auth clients evolution funnel leadshot profile project saas settings"

# Adicionar .gitignore atualizado
echo "Adicionando .gitignore..."
git add .gitignore

# Adicionar documentação
echo "Adicionando documentação..."
git add LAYER_DEPLOY_FIX.md

# Adicionar package.json de cada módulo usando -f para forçar (pois estava no gitignore)
for module in $MODULES; do
  LAYER_PACKAGE="$module/layers/common/nodejs/package.json"
  if [ -f "$LAYER_PACKAGE" ]; then
    echo "✓ Adicionando $LAYER_PACKAGE"
    git add -f "$LAYER_PACKAGE"
  else
    echo "✗ Não encontrado: $LAYER_PACKAGE"
  fi
done

echo ""
echo "=== Arquivos adicionados ==="
git status --short | grep layers

echo ""
echo "=== Pronto para commit ==="
echo "Execute:"
echo '  git commit -m "fix: incluir package.json das layers no Git para todos os módulos"'
echo "  git push"

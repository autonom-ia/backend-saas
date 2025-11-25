#!/bin/bash

# Script para verificar o status das Lambdas em staging
# Uso: ./check-lambdas.sh [module] [stage]

MODULE=${1:-auth}
STAGE=${2:-staging}

echo "=== Verificando Lambdas do módulo $MODULE no ambiente $STAGE ==="
echo ""

# Listar todas as funções Lambda do módulo
FUNCTIONS=$(aws lambda list-functions --region us-east-1 --profile autonomia \
  --query "Functions[?starts_with(FunctionName, 'autonomia-api-$MODULE-$STAGE')].FunctionName" \
  --output text 2>/dev/null)

if [ -z "$FUNCTIONS" ]; then
  echo "❌ Nenhuma função Lambda encontrada para autonomia-api-$MODULE-$STAGE"
  exit 1
fi

echo "📋 Funções encontradas:"
echo "$FUNCTIONS" | tr '\t' '\n' | while read func; do
  echo "  - $func"
done
echo ""

# Verificar status de cada função
echo "🔍 Status detalhado:"
echo ""

for func in $FUNCTIONS; do
  echo "=== $func ==="
  
  # Estado da função
  STATE=$(aws lambda get-function --function-name "$func" --region us-east-1 --profile autonomia \
    --query 'Configuration.State' --output text 2>/dev/null)
  
  # Tamanho do código
  CODE_SIZE=$(aws lambda get-function --function-name "$func" --region us-east-1 --profile autonomia \
    --query 'Configuration.CodeSize' --output text 2>/dev/null)
  
  # Última modificação
  LAST_MODIFIED=$(aws lambda get-function --function-name "$func" --region us-east-1 --profile autonomia \
    --query 'Configuration.LastModified' --output text 2>/dev/null)
  
  # Verificar se há erros recentes
  RECENT_ERRORS=$(aws logs filter-log-events \
    --log-group-name "/aws/lambda/$func" \
    --start-time $(($(date +%s) - 3600))000 \
    --filter-pattern "ERROR" \
    --region us-east-1 \
    --profile autonomia \
    --query 'events[*].message' \
    --output text 2>/dev/null | head -3)
  
  if [ "$STATE" = "Active" ]; then
    echo "  ✅ Estado: $STATE"
  else
    echo "  ⚠️  Estado: $STATE"
  fi
  
  echo "  📦 Tamanho do código: $CODE_SIZE bytes"
  echo "  🕐 Última modificação: $LAST_MODIFIED"
  
  if [ -n "$RECENT_ERRORS" ]; then
    echo "  ⚠️  Erros recentes encontrados:"
    echo "$RECENT_ERRORS" | sed 's/^/    /'
  else
    echo "  ✅ Nenhum erro recente"
  fi
  
  echo ""
done

# Verificar stack do CloudFormation
echo "=== Status do Stack CloudFormation ==="
STACK_NAME="autonomia-api-$MODULE-$STAGE"
STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region us-east-1 \
  --profile autonomia \
  --query 'Stacks[0].StackStatus' \
  --output text 2>/dev/null)

if [ -n "$STACK_STATUS" ]; then
  if [[ "$STACK_STATUS" == *"COMPLETE"* ]] && [[ "$STACK_STATUS" != *"ROLLBACK"* ]]; then
    echo "✅ Stack: $STACK_STATUS"
  else
    echo "⚠️  Stack: $STACK_STATUS"
    
    # Mostrar recursos com problemas
    echo ""
    echo "Recursos com problemas:"
    aws cloudformation describe-stack-resources \
      --stack-name "$STACK_NAME" \
      --region us-east-1 \
      --profile autonomia \
      --query 'StackResources[?ResourceStatus!=`CREATE_COMPLETE` && ResourceStatus!=`UPDATE_COMPLETE`].[LogicalResourceId,ResourceType,ResourceStatus]' \
      --output table 2>/dev/null
  fi
else
  echo "❌ Stack não encontrado"
fi

echo ""
echo "✅ Verificação concluída!"


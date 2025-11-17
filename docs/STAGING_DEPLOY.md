# Guia de Deploy - Ambiente de Staging

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Como Fazer Deploy em Staging](#como-fazer-deploy-em-staging)
3. [Como Fazer Deploy em Produção](#como-fazer-deploy-em-produção)
4. [Diferenças Entre os Ambientes](#diferenças-entre-os-ambientes)
5. [Verificação de Deploy](#verificação-de-deploy)
6. [Testando Endpoints](#testando-endpoints)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

Este projeto suporta dois ambientes de deploy:

- **Staging** (Homologação): Ambiente para testes antes de publicar em produção
- **Produção**: Ambiente final usado pelos clientes

O ambiente padrão é **staging** para evitar deploys acidentais em produção.

---

## 🚀 Como Fazer Deploy em Staging

### Deploy de um Módulo Específico

```bash
cd api/deploy
./deploy.sh <nome-do-modulo>
```

**Exemplo:**
```bash
./deploy.sh auth
./deploy.sh saas
./deploy.sh clients
```

### Deploy Específico para Staging (explícito)

```bash
./deploy.sh <nome-do-modulo> --stage staging
```

### Módulos Disponíveis

- `auth` - Autenticação
- `saas` - SaaS
- `clients` - Clientes
- `evolution` - Evolution
- `funnel` - Funnel
- `profile` - Perfil
- `project` - Projeto
- `settings` - Configurações
- `leadshot` - Leadshot

---

## 🏭 Como Fazer Deploy em Produção

⚠️ **ATENÇÃO**: Deploy em produção requer atenção especial!

### Deploy em Produção

```bash
cd api/deploy
./deploy.sh <nome-do-modulo> --stage prod
```

**Exemplo:**
```bash
./deploy.sh auth --stage prod
./deploy.sh saas --stage prod
```

### ⚠️ Avisos Importantes

1. **Confirmação**: O script mostra um aviso de 5 segundos antes de fazer deploy em produção
2. **Domínio Customizado**: Apenas produção usa domínio customizado (`api-*.autonomia.site`)
3. **Migrações**: Você será perguntado se deseja executar migrações de banco de dados

---

## 🔄 Diferenças Entre os Ambientes

### Staging

- ✅ **Domínio**: Usa domínio aleatório do API Gateway (`*.execute-api.us-east-1.amazonaws.com/staging`)
- ✅ **Plugin de Domínio**: Não utiliza `serverless-domain-manager`
- ✅ **Nomes das Funções**: Sufixo `-staging` (ex: `autonomia-api-auth-staging-login`)
- ✅ **Stack CloudFormation**: Nome com sufixo `-staging` (ex: `autonomia-api-auth-staging`)
- ✅ **Variável de Ambiente**: `NODE_ENV=staging`

### Produção

- ✅ **Domínio**: Usa domínio customizado (`api-auth.autonomia.site`, etc.)
- ✅ **Plugin de Domínio**: Utiliza `serverless-domain-manager`
- ✅ **Nomes das Funções**: Sufixo `-prod` (ex: `autonomia-api-auth-prod-login`)
- ✅ **Stack CloudFormation**: Nome com sufixo `-prod` (ex: `autonomia-api-auth-prod`)
- ✅ **Variável de Ambiente**: `NODE_ENV=prod`

---

## ✅ Verificação de Deploy

### Verificar Status das Lambdas de um Módulo

```bash
cd api/deploy
./check-lambdas.sh <modulo> <stage>
```

**Exemplo:**
```bash
./check-lambdas.sh auth staging
./check-lambdas.sh saas prod
```

### Verificar Todos os Módulos

```bash
cd api/deploy
for module in auth saas clients evolution funnel profile project settings leadshot; do
  echo "=== $module ==="
  ./check-lambdas.sh $module staging
  echo ""
done
```

### Verificar via AWS CLI

```bash
# Listar todas as funções Lambda em staging
aws lambda list-functions \
  --region us-east-1 \
  --profile autonomia \
  --query "Functions[?contains(FunctionName, 'staging')].FunctionName" \
  --output table

# Verificar status de um stack
aws cloudformation describe-stacks \
  --stack-name autonomia-api-auth-staging \
  --region us-east-1 \
  --profile autonomia \
  --query "Stacks[0].StackStatus" \
  --output text
```

---

## 🧪 Testando Endpoints

### Testar Endpoints de um Módulo

```bash
cd api/deploy
./test-endpoints.sh <modulo> <stage>
```

**Exemplo:**
```bash
./test-endpoints.sh auth staging
./test-endpoints.sh clients staging
```

### Testar Todos os Módulos

```bash
./test-endpoints.sh all staging
```

### Testar Manualmente

**Staging:**
```bash
# Exemplo: Auth module
curl -X POST https://yxpern1d27.execute-api.us-east-1.amazonaws.com/staging/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

**Produção:**
```bash
# Exemplo: Auth module
curl -X POST https://api-auth.autonomia.site/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

### URLs dos API Gateways em Staging

| Módulo | API Gateway ID | URL Base |
|--------|---------------|----------|
| auth | yxpern1d27 | `https://yxpern1d27.execute-api.us-east-1.amazonaws.com/staging` |
| saas | zbvj3gefx0 | `https://zbvj3gefx0.execute-api.us-east-1.amazonaws.com/staging` |
| clients | r42nuv3qv1 | `https://r42nuv3qv1.execute-api.us-east-1.amazonaws.com/staging` |
| evolution | cyqzibp0sf | `https://cyqzibp0sf.execute-api.us-east-1.amazonaws.com/staging` |
| funnel | epfx6q64gb | `https://epfx6q64gb.execute-api.us-east-1.amazonaws.com/staging` |
| profile | m2ylviufj0 | `https://m2ylviufj0.execute-api.us-east-1.amazonaws.com/staging` |
| project | 6imo47mifk | `https://6imo47mifk.execute-api.us-east-1.amazonaws.com/staging` |
| settings | dxip6h50if | `https://dxip6h50if.execute-api.us-east-1.amazonaws.com/staging` |
| leadshot | uhoaurbrdg | `https://uhoaurbrdg.execute-api.us-east-1.amazonaws.com/staging` |

---

## 🔑 Gerenciando Usuários do Cognito

### ⚠️ Importante: Cognito Separado por Ambiente

Cada ambiente (staging, prod, dev) tem seu **próprio Cognito User Pool**. Isso significa que:

- ✅ **Staging** tem seu próprio User Pool: `autonomia-api-auth-staging-user-pool`
- ✅ **Produção** tem seu próprio User Pool: `autonomia-api-auth-prod-user-pool`
- ✅ Usuários criados em um ambiente **não existem** no outro

### Verificar Usuários em um Ambiente

```bash
cd api/deploy
./manage-cognito-users.sh list staging
./manage-cognito-users.sh list prod
```

### Criar Usuário em Staging

**Opção 1: Via API (Recomendado - Fluxo completo com verificação de email)**

```bash
# 1. Registrar novo usuário
curl -X POST https://yxpern1d27.execute-api.us-east-1.amazonaws.com/staging/register \
  -H "Content-Type: application/json" \
  -d '{"email":"email@example.com","password":"Senha123!"}'

# 2. Confirmar email (código recebido por email)
curl -X POST https://yxpern1d27.execute-api.us-east-1.amazonaws.com/staging/confirm \
  -H "Content-Type: application/json" \
  -d '{"email":"email@example.com","code":"123456"}'

# 3. Fazer login
curl -X POST https://yxpern1d27.execute-api.us-east-1.amazonaws.com/staging/login \
  -H "Content-Type: application/json" \
  -d '{"email":"email@example.com","password":"Senha123!"}'
```

**Opção 2: Via Script (Criação direta, sem verificação de email)**

```bash
cd api/deploy
./manage-cognito-users.sh create staging email@example.com Senha123!
```

### Ver Informações do Cognito

```bash
cd api/deploy
./manage-cognito-users.sh info staging
```

### Erro 500 ao Fazer Login

Se você receber erro 500 ao tentar fazer login, verifique:

1. **O usuário existe no User Pool correto?**
   ```bash
   ./manage-cognito-users.sh list staging
   ```

2. **Se não existir, crie o usuário:**
   ```bash
   ./manage-cognito-users.sh create staging seu-email@example.com SuaSenha123!
   ```

3. **Verifique os logs da Lambda:**
   ```bash
   aws logs tail /aws/lambda/autonomia-api-auth-staging-login --follow --profile autonomia
   ```

---

## 🔧 Troubleshooting

### Erro: "Plugin serverless-domain-manager not found"

**Causa**: O plugin foi removido temporariamente para staging, mas ainda está referenciado.

**Solução**: O script já remove automaticamente. Se persistir, verifique se o `serverless.yml` no diretório `dist` não contém referências ao plugin.

### Erro: "Custom domain not found"

**Causa**: Tentando usar domínio customizado em staging.

**Solução**: O script remove automaticamente a configuração de domínio customizado para staging. Se persistir, verifique o `serverless.yml` processado.

### Erro: "No file matches include / exclude patterns"

**Causa**: A seção `package.patterns` está excluindo arquivos necessários.

**Solução**: O script remove automaticamente a seção `package` para staging. Se persistir, verifique o `serverless.yml` processado.

### Erro: "Stack is in UPDATE_ROLLBACK_COMPLETE state"

**Causa**: Um deploy anterior falhou e o CloudFormation está fazendo rollback.

**Solução**: Aguarde alguns minutos e tente novamente. Se persistir, verifique os eventos do stack no console AWS.

### Erro: "EventBridge Rule already exists"

**Causa**: Nome de regra duplicado entre ambientes.

**Solução**: Já corrigido - os nomes das regras agora incluem o stage. Se persistir, verifique o `serverless.yml`.

### Verificar Logs de Erro

```bash
# Ver logs de uma função Lambda
aws logs tail /aws/lambda/autonomia-api-auth-staging-login \
  --follow \
  --region us-east-1 \
  --profile autonomia

# Ver eventos de um stack
aws cloudformation describe-stack-events \
  --stack-name autonomia-api-auth-staging \
  --region us-east-1 \
  --profile autonomia \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED' || ResourceStatus=='UPDATE_FAILED']" \
  --output table
```

---

## 📝 Migrações de Banco de Dados

Durante o deploy, você será perguntado se deseja executar migrações:

```
Deseja executar migrações de banco de dados? (s/N)
```

- **N** (padrão): Pula as migrações
- **s**: Executa as migrações

⚠️ **Atenção**: Migrações em produção devem ser executadas com cuidado!

### Executar Migrações Manualmente

```bash
cd /path/to/backend-saas
node shared/migrations/migrate-knex.js
```

---

## 🔐 Configuração AWS

### Perfis AWS

O projeto usa o perfil `autonomia` por padrão. Para alternar:

```bash
# Usar perfil autonomia
export AWS_PROFILE=autonomia

# Verificar perfil atual
aws sts get-caller-identity

# Listar perfis disponíveis
cat ~/.aws/credentials | grep "^\["
```

### Aliases Úteis (adicionar ao ~/.zshrc)

```bash
alias aws-autonomia='export AWS_PROFILE=autonomia && echo "✅ AWS Profile: autonomia"'
alias aws-profile='echo "Current AWS Profile: $AWS_PROFILE"'
alias aws-whoami='aws sts get-caller-identity'
```

---

## 📊 Resumo de Comandos

### Deploy
```bash
# Staging (padrão)
./deploy.sh <modulo>

# Produção
./deploy.sh <modulo> --stage prod
```

### Verificação
```bash
# Verificar Lambdas
./check-lambdas.sh <modulo> <stage>

# Testar Endpoints
./test-endpoints.sh <modulo> <stage>
```

### AWS CLI
```bash
# Listar funções
aws lambda list-functions --profile autonomia --query "Functions[?contains(FunctionName, 'staging')].FunctionName"

# Status do stack
aws cloudformation describe-stacks --stack-name autonomia-api-<modulo>-<stage> --profile autonomia
```

---

## ✅ Checklist de Deploy

Antes de fazer deploy em produção:

- [ ] Testou em staging primeiro
- [ ] Verificou que todas as funções estão funcionando
- [ ] Testou os endpoints principais
- [ ] Revisou as mudanças no código
- [ ] Confirmou que as migrações (se houver) foram testadas
- [ ] Verificou os logs de erro em staging
- [ ] Notificou a equipe sobre o deploy

---

## 📞 Suporte

Em caso de problemas:

1. Verifique os logs do CloudWatch
2. Verifique os eventos do CloudFormation
3. Execute os scripts de verificação
4. Consulte a seção de Troubleshooting

---

**Última atualização**: Novembro 2024


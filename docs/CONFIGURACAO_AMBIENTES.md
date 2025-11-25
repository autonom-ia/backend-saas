# 🔧 Configuração de Ambientes - Staging vs Produção

## 📋 Visão Geral

Este documento explica como os recursos são configurados em cada ambiente e como verificar/ajustar essas configurações.

---

## 🔑 Cognito User Pool

### ⚠️ Importante: Cognito Separado por Ambiente

Cada ambiente tem seu **próprio Cognito User Pool** criado automaticamente pelo CloudFormation:

- **Staging**: `autonomia-api-auth-staging-user-pool` (ID: `us-east-1_bTs1p0STv`)
- **Produção**: `autonomia-api-auth-prod-user-pool` (ID: `us-east-1_KF7xoq6kf`)
- **Dev**: `autonomia-api-auth-dev-user-pool` (ID: `us-east-1_eGn3sojMu`)

### ✅ O Que Isso Significa

- ✅ Usuários criados em **staging** não existem em **produção**
- ✅ Usuários criados em **produção** não existem em **staging**
- ✅ Você precisa criar usuários separadamente em cada ambiente

### 🛠️ Gerenciar Usuários

**Opção 1: Usar a rota de registro (Recomendado)**

A forma mais simples é usar a própria API de registro:

```bash
# 1. Registrar novo usuário
curl -X POST https://yxpern1d27.execute-api.us-east-1.amazonaws.com/staging/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seu-email@example.com",
    "password": "SuaSenha123!"
  }'

# 2. Verificar email (você receberá um código por email)
curl -X POST https://yxpern1d27.execute-api.us-east-1.amazonaws.com/staging/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seu-email@example.com",
    "code": "123456"
  }'

# 3. Fazer login
curl -X POST https://yxpern1d27.execute-api.us-east-1.amazonaws.com/staging/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seu-email@example.com",
    "password": "SuaSenha123!"
  }'
```

**Opção 2: Criar manualmente via script (Para testes rápidos)**

```bash
cd api/deploy

# Listar usuários em staging
./manage-cognito-users.sh list staging

# Criar usuário em staging (sem precisar verificar email)
./manage-cognito-users.sh create staging email@example.com Senha123!

# Ver informações do Cognito
./manage-cognito-users.sh info staging
```

### ❌ Erro 500 ao Fazer Login

**Causa**: O usuário não existe no User Pool do ambiente.

**Solução**:

**Opção 1: Registrar via API (Recomendado)**
```bash
# 1. Registrar
curl -X POST https://yxpern1d27.execute-api.us-east-1.amazonaws.com/staging/register \
  -H "Content-Type: application/json" \
  -d '{"email":"seu-email@example.com","password":"SuaSenha123!"}'

# 2. Confirmar email (código recebido por email)
curl -X POST https://yxpern1d27.execute-api.us-east-1.amazonaws.com/staging/confirm \
  -H "Content-Type: application/json" \
  -d '{"email":"seu-email@example.com","code":"123456"}'

# 3. Fazer login
curl -X POST https://yxpern1d27.execute-api.us-east-1.amazonaws.com/staging/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seu-email@example.com","password":"SuaSenha123!"}'
```

**Opção 2: Criar manualmente (Para testes rápidos)**
1. Verifique se o usuário existe:
   ```bash
   ./manage-cognito-users.sh list staging
   ```

2. Se não existir, crie (sem precisar verificar email):
   ```bash
   ./manage-cognito-users.sh create staging seu-email@example.com SuaSenha123!
   ```

---

## 🗄️ Banco de Dados (RDS)

### Como Funciona

As configurações de banco de dados usam **AWS Systems Manager Parameter Store (SSM)** com o padrão:

```
/autonomia/${stage}/db/host
/autonomia/${stage}/db/port
/autonomia/${stage}/db/name
/autonomia/${stage}/db/user
/autonomia/${stage}/db/password
```

### ⚠️ Valores Padrão

Se os parâmetros SSM **não existirem**, o sistema usa valores padrão que apontam para **produção**:

```yaml
DB_HOST: ${ssm:/autonomia/${self:provider.stage}/db/host, 'autonomia-prod-db.cde6ocsqc6dk.us-east-1.rds.amazonaws.com'}
```

### ✅ Verificar Configuração Atual

```bash
# Ver variáveis de ambiente de uma Lambda
cd api/deploy
./check-lambda-config.sh <modulo> <funcao> <stage>

# Exemplo: ver configuração do módulo saas
./check-lambda-config.sh saas listAccounts staging
```

### 🔍 Verificar Parâmetros SSM

```bash
# Listar parâmetros de staging
aws ssm get-parameters-by-path \
  --path "/autonomia/staging" \
  --region us-east-1 \
  --profile autonomia \
  --recursive \
  --query "Parameters[].Name" \
  --output table

# Ver valor de um parâmetro específico
aws ssm get-parameter \
  --name "/autonomia/staging/db/host" \
  --region us-east-1 \
  --profile autonomia \
  --query "Parameter.Value" \
  --output text
```

### 📝 Configurar Banco de Dados para Staging

**Opção 1: Usar o mesmo banco de produção** (não recomendado para testes)

Não precisa fazer nada - os valores padrão já apontam para produção.

**Opção 2: Criar banco separado para staging** (recomendado)

1. Criar instância RDS separada para staging
2. Criar parâmetros SSM:

```bash
# Criar parâmetros SSM para staging
aws ssm put-parameter \
  --name "/autonomia/staging/db/host" \
  --value "staging-db.example.com" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia

aws ssm put-parameter \
  --name "/autonomia/staging/db/port" \
  --value "5432" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia

aws ssm put-parameter \
  --name "/autonomia/staging/db/name" \
  --value "autonomia_staging_db" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia

aws ssm put-parameter \
  --name "/autonomia/staging/db/user" \
  --value "staging_user" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia

aws ssm put-parameter \
  --name "/autonomia/staging/db/password" \
  --value "senha_segura" \
  --type "SecureString" \
  --region us-east-1 \
  --profile autonomia
```

3. Fazer redeploy do módulo para aplicar as novas configurações:
   ```bash
   cd api/deploy
   ./deploy.sh <modulo> --stage staging
   ```

---

## 🔍 Como Verificar Onde a Lambda Está Apontando

### 1. Ver Variáveis de Ambiente

```bash
cd api/deploy
./check-lambda-config.sh <modulo> <funcao> <stage>
```

**Exemplo:**
```bash
./check-lambda-config.sh saas listAccounts staging
./check-lambda-config.sh clients getConversations staging
```

### 2. Ver Logs da Lambda

```bash
# Ver logs em tempo real
aws logs tail /aws/lambda/autonomia-api-<modulo>-<stage>-<funcao> \
  --follow \
  --region us-east-1 \
  --profile autonomia

# Ver últimas 50 linhas
aws logs tail /aws/lambda/autonomia-api-<modulo>-<stage>-<funcao> \
  --since 1h \
  --region us-east-1 \
  --profile autonomia
```

### 3. Ver Configuração Completa do Stack

```bash
# Ver todos os outputs do stack
aws cloudformation describe-stacks \
  --stack-name autonomia-api-<modulo>-<stage> \
  --region us-east-1 \
  --profile autonomia \
  --query "Stacks[0].Outputs" \
  --output json | jq .
```

---

## 📊 Resumo: O Que Precisa Ser Configurado

### ✅ Já Configurado Automaticamente

- ✅ Cognito User Pool (criado automaticamente pelo CloudFormation)
- ✅ Variáveis de ambiente `COGNITO_USER_POOL_ID` e `COGNITO_USER_POOL_CLIENT_ID`
- ✅ IAM Roles e permissões
- ✅ API Gateway endpoints

### ⚠️ Precisa Configurar Manualmente

1. **Usuários do Cognito**
   - Criar usuários em cada ambiente separadamente
   - Usar: `./manage-cognito-users.sh create staging email@example.com Senha123!`

2. **Banco de Dados (Opcional)**
   - Se quiser banco separado para staging, criar parâmetros SSM
   - Se não criar, staging usará o banco de produção (valores padrão)

3. **Outros Recursos (Redis, S3, etc.)**
   - Verificar se existem parâmetros SSM para staging
   - Se não existirem, usarão valores padrão (geralmente de produção)

---

## 🎯 Checklist de Configuração

### Para Começar a Usar Staging

- [ ] Criar usuários no Cognito de staging
  - **Opção 1 (Recomendado)**: Usar a rota `/register` da API
  - **Opção 2**: Criar manualmente via script:
    ```bash
    ./manage-cognito-users.sh create staging seu-email@example.com Senha123!
    ```

- [ ] (Opcional) Configurar banco de dados separado para staging
  - Criar instância RDS
  - Criar parâmetros SSM
  - Fazer redeploy dos módulos

- [ ] (Opcional) Configurar outros recursos (Redis, S3, etc.)
  - Criar recursos na AWS
  - Criar parâmetros SSM
  - Fazer redeploy dos módulos

- [ ] Testar login em staging
  ```bash
  curl -X POST https://yxpern1d27.execute-api.us-east-1.amazonaws.com/staging/login \
    -H "Content-Type: application/json" \
    -d '{"email":"seu-email@example.com","password":"SuaSenha123!"}'
  ```

---

## 🔗 Recursos Relacionados

- [Guia de Deploy](./STAGING_DEPLOY.md) - Como fazer deploy
- [Status do Projeto](./RESUMO_STATUS.md) - Status atual do projeto

---

**Última atualização**: Novembro 2024


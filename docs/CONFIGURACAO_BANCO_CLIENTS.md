# 🗄️ Configuração de Banco de Dados - Módulo Clients

## 📋 Visão Geral

O módulo **clients** utiliza **2 bancos de dados PostgreSQL** e **1 Redis**:

1. **Banco Principal (autonomia)** - Usado para buscar configurações e parâmetros
2. **Banco Clients (autonomia_clients)** - Usado especificamente para dados do módulo clients
3. **Redis** - Para cache

---

## 🎯 Estrutura dos Bancos

### Opção 1: Mesmo RDS, Databases Diferentes (Recomendado)

Você pode usar **1 instância RDS** com **2 databases diferentes**:

```
RDS: autonomia-staging-db.cde6ocsqc6dk.us-east-1.rds.amazonaws.com
├── Database: autonomia_db (banco principal)
└── Database: autonomia_clients (banco clients)
```

**Vantagens:**
- Mais econômico (1 instância RDS)
- Mais fácil de gerenciar
- Mesma segurança e backup

### Opção 2: RDS Separados

Você pode usar **2 instâncias RDS separadas**:

```
RDS 1: autonomia-staging-db.cde6ocsqc6dk.us-east-1.rds.amazonaws.com
└── Database: autonomia_db

RDS 2: autonomia-clients-staging-db.cde6ocsqc6dk.us-east-1.rds.amazonaws.com
└── Database: autonomia_clients
```

**Vantagens:**
- Isolamento completo
- Escalabilidade independente
- Mais custoso

---

## 📝 Parâmetros SSM Necessários

### Banco Principal (autonomia)

```bash
# Host do RDS
aws ssm put-parameter \
  --name "/autonomia/staging/db/host" \
  --value "autonomia-staging-db.cde6ocsqc6dk.us-east-1.rds.amazonaws.com" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia

# Porta
aws ssm put-parameter \
  --name "/autonomia/staging/db/port" \
  --value "5432" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia

# Nome do database
aws ssm put-parameter \
  --name "/autonomia/staging/db/name" \
  --value "autonomia_db" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia

# Usuário
aws ssm put-parameter \
  --name "/autonomia/staging/db/user" \
  --value "autonomia_admin" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia

# Senha (SecureString)
aws ssm put-parameter \
  --name "/autonomia/staging/db/password" \
  --value "sua-senha-segura" \
  --type "SecureString" \
  --region us-east-1 \
  --profile autonomia
```

### Banco Clients

```bash
# Host do RDS (pode ser o mesmo do banco principal)
aws ssm put-parameter \
  --name "/autonomia/clients/db/host" \
  --value "autonomia-staging-db.cde6ocsqc6dk.us-east-1.rds.amazonaws.com" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia

# Porta
aws ssm put-parameter \
  --name "/autonomia/clients/db/port" \
  --value "5432" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia

# Nome do database
aws ssm put-parameter \
  --name "/autonomia/clients/db/name" \
  --value "autonomia_clients" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia

# Usuário
aws ssm put-parameter \
  --name "/autonomia/clients/db/user" \
  --value "autonomia_clients_admin" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia

# Senha (SecureString)
aws ssm put-parameter \
  --name "/autonomia/clients/db/password" \
  --value "sua-senha-segura" \
  --type "SecureString" \
  --region us-east-1 \
  --profile autonomia
```

### Redis

```bash
# Host do Redis (ElastiCache)
aws ssm put-parameter \
  --name "/autonomia/staging/redis/host" \
  --value "autonomia-redis-staging.lfxcgb.ng.0001.use1.cache.amazonaws.com" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia

# Porta
aws ssm put-parameter \
  --name "/autonomia/staging/redis/port" \
  --value "6379" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia

# TTL do cache (opcional)
aws ssm put-parameter \
  --name "/autonomia/staging/cache/ttl" \
  --value "300" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia
```

---

## 🛠️ Script de Configuração Completo

Crie um script para facilitar:

```bash
#!/bin/bash
# configure-clients-db.sh

STAGE="${1:-staging}"
DB_HOST="${2:-autonomia-staging-db.cde6ocsqc6dk.us-east-1.rds.amazonaws.com}"
REDIS_HOST="${3:-autonomia-redis-staging.lfxcgb.ng.0001.use1.cache.amazonaws.com}"

echo "Configurando parâmetros SSM para módulo clients (stage: $STAGE)"

# Banco Principal
aws ssm put-parameter \
  --name "/autonomia/$STAGE/db/host" \
  --value "$DB_HOST" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia \
  --overwrite

aws ssm put-parameter \
  --name "/autonomia/$STAGE/db/port" \
  --value "5432" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia \
  --overwrite

aws ssm put-parameter \
  --name "/autonomia/$STAGE/db/name" \
  --value "autonomia_db" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia \
  --overwrite

# Banco Clients
aws ssm put-parameter \
  --name "/autonomia/clients/db/host" \
  --value "$DB_HOST" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia \
  --overwrite

aws ssm put-parameter \
  --name "/autonomia/clients/db/port" \
  --value "5432" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia \
  --overwrite

aws ssm put-parameter \
  --name "/autonomia/clients/db/name" \
  --value "autonomia_clients" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia \
  --overwrite

# Redis
aws ssm put-parameter \
  --name "/autonomia/$STAGE/redis/host" \
  --value "$REDIS_HOST" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia \
  --overwrite

aws ssm put-parameter \
  --name "/autonomia/$STAGE/redis/port" \
  --value "6379" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia \
  --overwrite

echo "✅ Parâmetros configurados!"
```

---

## 🔍 Verificar Parâmetros Configurados

```bash
# Listar todos os parâmetros de staging
aws ssm get-parameters-by-path \
  --path "/autonomia/staging" \
  --region us-east-1 \
  --profile autonomia \
  --recursive \
  --query "Parameters[].Name" \
  --output table

# Listar parâmetros do banco clients
aws ssm get-parameters-by-path \
  --path "/autonomia/clients" \
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

---

## 📊 Resumo: O Que Precisa Ser Criado

### ✅ Opção 1: Mesmo RDS (Recomendado)

1. **1 Instância RDS PostgreSQL**
   - Criar 2 databases: `autonomia_db` e `autonomia_clients`
   - Criar 2 usuários: `autonomia_admin` e `autonomia_clients_admin`
   - Configurar permissões para cada usuário acessar seu database

2. **1 Instância Redis (ElastiCache)** (opcional, mas recomendado)

3. **Configurar parâmetros SSM** (usando os scripts acima)

### ✅ Opção 2: RDS Separados

1. **2 Instâncias RDS PostgreSQL**
   - RDS 1: database `autonomia_db`
   - RDS 2: database `autonomia_clients`

2. **1 Instância Redis (ElastiCache)** (opcional, mas recomendado)

3. **Configurar parâmetros SSM** (usando os scripts acima)

---

## ⚠️ Observações Importantes

### Bancos Chatwoot (Externos)

O módulo clients também se conecta a **bancos Chatwoot externos**, mas esses:
- ✅ **NÃO** são configurados via SSM
- ✅ São configurados dinamicamente via tabela `account_parameter`
- ✅ Cada conta pode ter seu próprio banco Chatwoot
- ✅ O host é armazenado em `account_parameter.name = 'chatwoot_db_host'`

**Não precisa criar esses bancos agora** - eles são gerenciados separadamente.

---

## 🧪 Testar Conexão

Após configurar os parâmetros SSM, faça redeploy do módulo:

```bash
cd api/deploy
./deploy.sh clients --stage staging
```

Depois, verifique se as variáveis de ambiente estão corretas:

```bash
cd api/deploy
./check-lambda-config.sh clients getConversations staging
```

---

## 📚 Próximos Passos

1. ✅ Criar instância RDS (ou usar existente)
2. ✅ Criar databases e usuários
3. ✅ Configurar parâmetros SSM
4. ✅ (Opcional) Criar instância Redis
5. ✅ Fazer redeploy do módulo clients
6. ✅ Testar conexão

---

**Última atualização**: Novembro 2024


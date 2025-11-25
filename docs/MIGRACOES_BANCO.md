# 🗄️ Executar Migrações de Banco de Dados

## 📋 Visão Geral

**Arquitetura Simplificada**: Um único arquivo (`migrate-knex.js`) funciona em qualquer contexto!

- **Durante DEPLOY**: O `deploy.sh` busca parâmetros SSM e injeta como variáveis de ambiente → `migrate-knex.js` usa
- **Desenvolvimento LOCAL**: `migrate-knex.js` carrega do arquivo `.env`

As **Lambdas na AWS** recebem variáveis do SSM durante o deploy (configurado no `serverless.yml`).

**Como funciona:**
1. **Deploy**: `deploy.sh` busca SSM → injeta `DB_*` e `CLIENTS_DB_*` → `migrate-knex.js` usa essas variáveis
2. **Local**: `migrate-knex.js` detecta que não há variáveis → carrega `.env` → usa `POSTGRES_*`

**Vantagens:**
- ✅ Um único arquivo para todos os contextos
- ✅ Mesmas credenciais das Lambdas durante deploy
- ✅ Simples e direto

---

## 🔧 Configuração

### Para Desenvolvimento Local (.env)

Crie um arquivo `.env` na raiz do projeto:

```bash
# Banco principal
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=autonomia_db
POSTGRES_USER=autonomia_admin
POSTGRES_PASSWORD=sua-senha-local
POSTGRES_SSL=false

# Banco clients (opcional)
CLIENTS_POSTGRES_HOST=localhost
CLIENTS_POSTGRES_PORT=5432
CLIENTS_POSTGRES_DATABASE=autonomia_clients
CLIENTS_POSTGRES_USER=autonomia_clients_admin
CLIENTS_POSTGRES_PASSWORD=sua-senha-local

# Ambiente
NODE_ENV=development
```

### Para Staging/Prod

Adicione as credenciais de staging/prod no seu `.env`:

```bash
# Banco principal (staging)
POSTGRES_HOST=autonomia-staging-db.cde6ocsqc6dk.us-east-1.rds.amazonaws.com
POSTGRES_PORT=5432
POSTGRES_DATABASE=autonomia_db
POSTGRES_USER=autonomia_admin
POSTGRES_PASSWORD=sua-senha-staging
POSTGRES_SSL=true

# Banco clients (staging)
CLIENTS_POSTGRES_HOST=autonomia-staging-db.cde6ocsqc6dk.us-east-1.rds.amazonaws.com
CLIENTS_POSTGRES_PORT=5432
CLIENTS_POSTGRES_DATABASE=autonomia_clients
CLIENTS_POSTGRES_USER=autonomia_clients_admin
CLIENTS_POSTGRES_PASSWORD=sua-senha-staging

# Ambiente
NODE_ENV=staging
```

**Nota**: 
- **Durante deploy**: Script busca SSM automaticamente (baseado no `STAGE`)
- **Desenvolvimento local**: Use o `.env` (quando `NODE_ENV=development`)

---

## 🚀 Como Executar

### Durante o Deploy (Automático)

```bash
cd api/deploy
./deploy.sh <modulo> --stage staging
# Quando perguntar sobre migrações, digite 's'
```

**Como funciona:**
1. O `deploy.sh` busca parâmetros SSM do stage selecionado
2. Injeta como variáveis de ambiente (`DB_*`, `CLIENTS_DB_*`)
3. Chama `migrate-knex.js` que usa essas variáveis
4. O `knexfile.js` lê as variáveis e conecta ao banco correto

**Importante**: Não precisa configurar `.env` para deploy - o `deploy.sh` busca SSM automaticamente.

### Manualmente

#### Banco Principal

```bash
cd shared/migrations

# Desenvolvimento local (usa .env)
NODE_ENV=development node migrate-knex.js

# Staging (usa .env com credenciais de staging)
NODE_ENV=staging node migrate-knex.js

# Produção (usa .env com credenciais de produção)
NODE_ENV=prod node migrate-knex.js
```

#### Banco Clients

```bash
cd shared/migrations

# Desenvolvimento local
NODE_ENV=development node migrate-knex.js --clients

# Staging
NODE_ENV=staging node migrate-knex.js --clients
```

### Outros Comandos

```bash
# Ver status das migrações
NODE_ENV=staging node migrate-knex.js --status

# Rollback última migração
NODE_ENV=staging node migrate-knex.js --rollback

# Status do banco clients
NODE_ENV=staging node migrate-knex.js --status --clients
```

---

## 🔍 Como Funciona

### Arquitetura

1. **Script de Migração (`migrate-knex.js`)**:
   - **Durante deploy**: `deploy.sh` busca SSM e injeta variáveis → script usa
   - **Desenvolvimento local**: Script detecta ausência de variáveis → carrega `.env`
   - **Um único arquivo** funciona em qualquer contexto

2. **Lambdas (AWS)**:
   - Serverless Framework busca parâmetros SSM durante o deploy
   - Injeta como variáveis de ambiente nas Lambdas (`DB_*`, `CLIENTS_DB_*`)
   - Lambdas usam essas variáveis em runtime

3. **Knexfile**:
   - Lê de `process.env.POSTGRES_*` (do .env) ou
   - `migrate-knex-api.js` mapeia `DB_*` (do SSM) para `POSTGRES_*`

### Por que essa abordagem?

- ✅ **Simplicidade**: Um único arquivo de migração
- ✅ **Consistência**: Migrações e Lambdas usam as mesmas credenciais (do SSM)
- ✅ **Flexibilidade**: .env funciona para desenvolvimento local
- ✅ **Sem redundância**: SSM usado apenas uma vez (no deploy.sh)

### Variáveis de Ambiente

O script configura automaticamente:

```javascript
process.env.POSTGRES_HOST
process.env.POSTGRES_PORT
process.env.POSTGRES_DATABASE
process.env.POSTGRES_USER
process.env.POSTGRES_PASSWORD
process.env.POSTGRES_SSL
process.env.NODE_ENV
```

---

## ⚠️ Troubleshooting

### Erro: "Parâmetros obrigatórios não encontrados"

**Causa**: Variáveis de ambiente não configuradas

**Solução**:
- **Local**: Verifique se o arquivo `.env` existe e tem as variáveis
- **Staging/Prod**: Verifique se os parâmetros SSM estão configurados

### Erro: "Erro ao conectar ao banco"

**Causa**: Credenciais incorretas ou banco inacessível

**Solução**:
1. Verifique as credenciais no `.env` ou SSM
2. Verifique se o banco está acessível (firewall, security groups)
3. Teste a conexão manualmente:
   ```bash
   psql -h <host> -U <user> -d <database>
   ```

### Erro: "Parâmetro SSM não encontrado"

**Causa**: Parâmetro SSM não foi criado

**Solução**: Crie o parâmetro SSM:
```bash
aws ssm put-parameter \
  --name "/autonomia/staging/db/host" \
  --value "seu-host" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia
```

---

## 📝 Exemplo Completo

### 1. Configurar .env (local)

```bash
# .env
POSTGRES_HOST=localhost
POSTGRES_DATABASE=autonomia_db
POSTGRES_USER=autonomia_admin
POSTGRES_PASSWORD=senha123
NODE_ENV=development
```

### 2. Executar migrações localmente

```bash
cd shared/migrations
NODE_ENV=development node migrate-knex-staging.js
```

### 3. Configurar SSM (staging)

```bash
aws ssm put-parameter \
  --name "/autonomia/staging/db/host" \
  --value "autonomia-staging-db.cde6ocsqc6dk.us-east-1.rds.amazonaws.com" \
  --type "String" \
  --region us-east-1 \
  --profile autonomia
```

### 4. Executar migrações em staging

```bash
cd shared/migrations
NODE_ENV=staging node migrate-knex-staging.js
```

---

## ✅ Vantagens Desta Abordagem

1. **Automático**: Detecta ambiente e usa configuração apropriada
2. **Flexível**: Funciona localmente e em staging/prod
3. **Centralizado**: Staging/prod usa SSM (uma única fonte de verdade)
4. **Seguro**: Senhas não ficam no código
5. **Simples**: Mesmo comando funciona em qualquer ambiente

---

**Última atualização**: Novembro 2024


# 🔍 Verificar Configuração SSM e Variáveis de Ambiente

## 📋 Como Funciona

Quando você faz deploy, o Serverless Framework:

1. **Lê os parâmetros SSM** no momento do deploy
2. **Injeta os valores** como variáveis de ambiente nas Lambdas
3. **As Lambdas usam** essas variáveis para conectar ao banco

**⚠️ Importante**: Se você alterar parâmetros SSM, precisa fazer **redeploy** para que as mudanças sejam aplicadas!

---

## ✅ Verificar Parâmetros SSM Antes do Deploy

```bash
# Verificar parâmetros do banco principal
aws ssm get-parameter \
  --name "/autonomia/staging/db/host" \
  --region us-east-1 \
  --profile autonomia \
  --query "Parameter.Value" \
  --output text

# Verificar parâmetros do banco clients
aws ssm get-parameter \
  --name "/autonomia/clients/db/host" \
  --region us-east-1 \
  --profile autonomia \
  --query "Parameter.Value" \
  --output text

# Listar todos os parâmetros de staging
aws ssm get-parameters-by-path \
  --path "/autonomia/staging" \
  --region us-east-1 \
  --profile autonomia \
  --recursive \
  --query "Parameters[].{Name:Name,Value:Value}" \
  --output table
```

---

## 🚀 Fazer Redeploy

```bash
cd api/deploy
./deploy.sh clients --stage staging
```

Isso vai:
- ✅ Ler os parâmetros SSM atualizados
- ✅ Atualizar as variáveis de ambiente das 7 Lambdas
- ✅ Fazer deploy das funções

---

## 🔍 Verificar Variáveis de Ambiente Após Deploy

```bash
cd api/deploy

# Verificar configuração de uma Lambda específica
./check-lambda-config.sh clients getConversations staging

# Ver todas as variáveis de ambiente
aws lambda get-function-configuration \
  --function-name autonomia-api-clients-staging-getConversations \
  --region us-east-1 \
  --profile autonomia \
  --query "Environment.Variables" \
  --output json | jq .
```

---

## 📊 Exemplo: Verificar Conexão com Banco

Após o deploy, você pode verificar se as variáveis estão corretas:

```bash
# Ver variáveis de ambiente da Lambda
aws lambda get-function-configuration \
  --function-name autonomia-api-clients-staging-getConversations \
  --region us-east-1 \
  --profile autonomia \
  --query "Environment.Variables" \
  --output json | jq '{
    DB_HOST: .DB_HOST,
    DB_NAME: .DB_NAME,
    CLIENTS_DB_HOST: .CLIENTS_DB_HOST,
    CLIENTS_DB_NAME: .CLIENTS_DB_NAME,
    REDIS_HOST: .REDIS_HOST
  }'
```

**Resultado esperado:**
```json
{
  "DB_HOST": "autonomia-staging-db.cde6ocsqc6dk.us-east-1.rds.amazonaws.com",
  "DB_NAME": "autonomia_db",
  "CLIENTS_DB_HOST": "autonomia-staging-db.cde6ocsqc6dk.us-east-1.rds.amazonaws.com",
  "CLIENTS_DB_NAME": "autonomia_clients",
  "REDIS_HOST": "autonomia-redis-staging.lfxcgb.ng.0001.use1.cache.amazonaws.com"
}
```

---

## ⚠️ Troubleshooting

### Problema: Variáveis ainda apontam para produção

**Causa**: Não fez redeploy após configurar SSM

**Solução**:
```bash
cd api/deploy
./deploy.sh clients --stage staging
```

### Problema: Parâmetro SSM não encontrado

**Causa**: Parâmetro não foi criado ou nome está errado

**Solução**: Verificar se o parâmetro existe:
```bash
aws ssm get-parameter \
  --name "/autonomia/staging/db/host" \
  --region us-east-1 \
  --profile autonomia
```

### Problema: Lambda não consegue conectar ao banco

**Causa**: Pode ser:
1. Variáveis de ambiente incorretas (fazer redeploy)
2. Security Group do RDS não permite acesso da Lambda
3. RDS não está acessível (VPC, subnets, etc.)

**Solução**:
1. Verificar variáveis de ambiente (comando acima)
2. Verificar Security Groups do RDS
3. Verificar logs da Lambda:
```bash
aws logs tail /aws/lambda/autonomia-api-clients-staging-getConversations \
  --follow \
  --region us-east-1 \
  --profile autonomia
```

---

## 📝 Checklist

Antes de testar:

- [ ] Parâmetros SSM configurados para staging
- [ ] Redeploy do módulo clients feito
- [ ] Variáveis de ambiente verificadas
- [ ] Security Groups do RDS configurados
- [ ] Testar endpoint

---

**Última atualização**: Novembro 2024


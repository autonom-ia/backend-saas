# Deploy - Leadshot API

## Arquitetura de Dependências

Este serviço **NÃO** usa Lambda Layers para as dependências de upload de contatos.  
As dependências são empacotadas **diretamente nas funções** que precisam delas.

### Dependências Incluídas

**Banco de dados (todas as funções):**
- `knex` - Query builder SQL
- `pg` - PostgreSQL client
- `ioredis` - Redis client para cache

**Processamento de arquivos (funções de campanha):**
- `csv-parser` - Para processar arquivos CSV
- `libphonenumber-js` - Para normalizar números de telefone
- `xlsx` - Para processar arquivos Excel (XLSX/XLS)

### Funções que usam dependências de upload

- `uploadCampaignContacts`
- `listCampaignContacts` 
- `updateContactStatus`
- `sendCampaignMessages`

### Todas as funções usam

- `knex`, `pg`, `ioredis` para acesso ao banco e cache

## Como fazer Deploy

```bash
# 1. Navegar para o diretório
cd /Users/robertomartins/Workspace/autonom.ia/backend/api/leadshot

# 2. Instalar dependências
npm install --production

# 3. Deploy
npm run deploy
```

## O que acontece no deploy

1. O Serverless Framework empacota **individualmente** cada função
2. As funções listadas acima incluem os módulos:
   - `node_modules/csv-parser/**`
   - `node_modules/libphonenumber-js/**`
   - `node_modules/xlsx/**`
   - E suas dependências transitivas
3. Outras funções **não** incluem essas dependências (pacote menor)

## Por que não usar Layer?

- **Padrão do projeto**: Outros serviços (SAAS, Evolution) não usam layers populadas
- **Tamanho**: Apenas 4 funções precisam dessas dependências
- **Simplicidade**: Deployment direto, sem configuração de layer compartilhada
- **Manutenibilidade**: Dependências versionadas junto com o código

## Troubleshooting

### Erro: "Cannot find module 'libphonenumber-js'"

**Causa**: Dependências não foram empacotadas no deploy

**Solução**:
```bash
# Limpar e reinstalar
rm -rf node_modules package-lock.json
npm install --production
npm run deploy
```

### Pacote muito grande

**Sintoma**: Deploy falha por tamanho do pacote

**Solução**: As dependências já estão otimizadas. Se o erro persistir:
1. Verificar se `node_modules` tem pacotes desnecessários
2. Garantir que está usando `npm install --production`

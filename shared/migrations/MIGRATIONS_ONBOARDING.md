# Migrations - Evolution Onboarding Flow

## Resumo
Migrations criadas para suportar o fluxo de onboarding da Evolution API.

## Estrutura Criada

### 1. Tabela `account_parameters_standard`
Define parâmetros padrão para configuração de contas durante o onboarding.

**Campos:**
- `id` - UUID (PK)
- `name` - varchar(255) - Nome do parâmetro
- `visible_onboarding` - boolean - Se aparece no onboarding
- `short_description` - varchar(50) - Descrição curta
- `help_text` - varchar(255) - Texto de ajuda/placeholder *(substituiu "helper")*
- `default_value` - varchar(255) - Valor padrão
- `created_at` - timestamp
- `updated_at` - timestamp

### 2. Tabela `product_parameters_standard`
Define parâmetros padrão para configuração de produtos durante o onboarding.

**Campos:** (mesma estrutura de `account_parameters_standard`)

### 3. Alterações nas Tabelas Existentes

#### `product_parameter`
Campos adicionados:
- `short_description` - varchar(50)
- `help_text` - varchar(255)
- `default_value` - varchar(255)

#### `account_parameter`
Campos adicionados:
- `short_description` - varchar(50)
- `help_text` - varchar(255)
- `default_value` - varchar(255)

### 4. Seed Data
Parâmetros padrão inseridos em `account_parameters_standard`:
- `account_name` - Nome da Conta
- `phone_number` - Número de Telefone
- `agent_name` - Nome do Agente
- `company_description` - Descrição da Empresa
- `welcome_message` - Mensagem de Boas-vindas

## Arquivos Criados

1. `20251114113000_create_account_parameters_standard.js`
2. `20251114113100_create_product_parameters_standard.js`
3. `20251114113200_add_metadata_to_parameter_tables.js`
4. `20251114113300_seed_account_parameters_standard.js`

## Como Executar

### Aplicar Migrations
```bash
cd /Users/robertomartins/Workspace/autonom.ia/backend/shared/migrations
node migrate-knex.js
```

### Verificar Status
```bash
node migrate-knex.js --status
```

### Rollback (se necessário)
```bash
node migrate-knex.js --rollback
```

## Observações

- ✅ Nome sugerido: `help_text` (ao invés de "helper") - mais descritivo e padrão no mercado
- ✅ Seguiu o padrão de naming das migrations existentes
- ✅ Incluiu índices para otimização de consultas
- ✅ Migrations reversíveis (com `down()`)
- ✅ Seed data para popular parâmetros padrão do onboarding
- ✅ Branch criada: `feature/evolution-onboarding-flow` (mesmo nome do frontend)

## Próximos Passos

1. Executar as migrations no ambiente de desenvolvimento
2. Criar endpoints da API para:
   - GET `/account-parameters-standard` - Listar parâmetros padrão
   - GET `/product-parameters-standard` - Listar parâmetros padrão
3. Integrar com o fluxo de onboarding do frontend

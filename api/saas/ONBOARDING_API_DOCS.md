# API Endpoints - Evolution Onboarding

## Resumo
Endpoints criados para suportar o fluxo de onboarding da Evolution API.

---

## Novos Endpoints

### 1. **GET** `/Autonomia/Saas/AccountParametersStandard`
Lista parâmetros padrão de conta para uso no onboarding.

**Query Parameters:**
- `visibleOnboarding` (opcional): `true` | `false` - Filtra apenas os visíveis no onboarding

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "account_name",
      "visible_onboarding": true,
      "short_description": "Nome da Conta",
      "help_text": "Escolha um nome descritivo para identificar esta conta",
      "default_value": null,
      "created_at": "2025-11-14T...",
      "updated_at": "2025-11-14T..."
    }
  ]
}
```

**Exemplo de Uso:**
```bash
# Listar todos
GET https://api-saas.autonomia.site/Autonomia/Saas/AccountParametersStandard

# Listar apenas visíveis no onboarding
GET https://api-saas.autonomia.site/Autonomia/Saas/AccountParametersStandard?visibleOnboarding=true
```

---

### 2. **GET** `/Autonomia/Saas/ProductParametersStandard`
Lista parâmetros padrão de produto para uso no onboarding.

**Query Parameters:**
- `visibleOnboarding` (opcional): `true` | `false` - Filtra apenas os visíveis no onboarding

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "parameter_name",
      "visible_onboarding": true,
      "short_description": "Descrição curta",
      "help_text": "Texto de ajuda/placeholder",
      "default_value": "valor padrão",
      "created_at": "2025-11-14T...",
      "updated_at": "2025-11-14T..."
    }
  ]
}
```

---

## Endpoints Atualizados

### 3. **POST** `/Autonomia/Saas/AccountParameters`
Criar parâmetro de conta (agora com novos campos).

**Request Body:**
```json
{
  "name": "agent_name",
  "value": "Maria Assistente",
  "account_id": "uuid",
  "short_description": "Nome do Agente",
  "help_text": "Nome usado pelo assistente nas conversas",
  "default_value": null
}
```

**Campos Novos (opcionais):**
- `short_description` - varchar(50)
- `help_text` - varchar(255)
- `default_value` - varchar(255)

---

### 4. **PUT** `/Autonomia/Saas/AccountParameters/{parameterId}`
Atualizar parâmetro de conta (agora suporta novos campos).

**Request Body:**
```json
{
  "name": "agent_name",
  "value": "João Assistente",
  "short_description": "Nome do Agente Virtual",
  "help_text": "Nome que será exibido nas conversas",
  "default_value": "Assistente"
}
```

---

### 5. **POST** `/Autonomia/Saas/ProductParameters`
Criar parâmetro de produto (agora com novos campos).

**Request Body:**
```json
{
  "name": "timeout",
  "value": "30",
  "product_id": "uuid",
  "short_description": "Timeout",
  "help_text": "Tempo limite em segundos",
  "default_value": "30"
}
```

---

### 6. **PUT** `/Autonomia/Saas/ProductParameters/{parameterId}`
Atualizar parâmetro de produto (agora suporta novos campos).

---

## Estrutura de Dados

### account_parameters_standard
```sql
CREATE TABLE account_parameters_standard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  visible_onboarding BOOLEAN DEFAULT true,
  short_description VARCHAR(50),
  help_text VARCHAR(255),
  default_value VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### product_parameters_standard
```sql
CREATE TABLE product_parameters_standard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  visible_onboarding BOOLEAN DEFAULT true,
  short_description VARCHAR(50),
  help_text VARCHAR(255),
  default_value VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

---

## Parâmetros Padrão Populados

### account_parameters_standard (seed data)
1. **account_name** - Nome da Conta
2. **phone_number** - Número de Telefone
3. **agent_name** - Nome do Agente
4. **company_description** - Descrição da Empresa
5. **welcome_message** - Mensagem de Boas-vindas

---

## Autorização

Todos os endpoints requerem autenticação via **AWS Cognito**.

**Header obrigatório:**
```
Authorization: Bearer <cognito-id-token>
```

---

## Códigos de Status

- **200** - Sucesso
- **201** - Criado com sucesso
- **400** - Requisição inválida
- **401** - Não autorizado
- **404** - Não encontrado
- **500** - Erro interno do servidor

---

## Arquivos Criados/Modificados

### Services
- ✅ `services/account-parameter-standard-service.js` (novo)
- ✅ `services/product-parameter-standard-service.js` (novo)
- ✅ `services/account-parameter-service.js` (atualizado)
- ✅ `services/product-parameter-service.js` (atualizado)

### Handlers
- ✅ `handlers/list-account-parameters-standard.js` (novo)
- ✅ `handlers/list-product-parameters-standard.js` (novo)
- ✅ `handlers/create-account-parameter.js` (atualizado)
- ✅ `handlers/update-account-parameter.js` (atualizado)
- ✅ `handlers/create-product-parameter.js` (atualizado)
- ✅ `handlers/update-product-parameter.js` (atualizado)

### Configuração
- ✅ `serverless.yml` (atualizado com novas rotas)

---

## Deploy

```bash
cd /Users/robertomartins/Workspace/autonom.ia/backend/api/deploy
./deploy.sh saas
```

---

## Próximos Passos

1. ✅ Migrations aplicadas no banco de dados
2. ✅ Services e handlers criados
3. ✅ Rotas configuradas no serverless.yml
4. ⏳ Deploy da API SaaS
5. ⏳ Integração com frontend (onboarding)
6. ⏳ Testes E2E

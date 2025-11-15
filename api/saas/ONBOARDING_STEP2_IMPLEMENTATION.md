# Step 2 - Configure Account (Onboarding Dinâmico)

## Resumo
Implementação do Step 2 do onboarding com formulário dinâmico baseado nos parâmetros do produto.

---

## Backend

### **1. Novos Handlers**

#### `get-product-parameters-for-onboarding.js`
**Endpoint:** `GET /Autonomia/Saas/Products/{productId}/ParametersOnboarding`

**Função:**
- Busca parâmetros de um produto específico
- Faz JOIN entre `product_parameter` e `product_parameters_standard`
- Retorna apenas parâmetros onde `visible_onboarding = true`
- Ordenação: `short_description` → `name` (alfabética)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "account_name",
      "value": "",
      "short_description": "Nome da Conta",
      "help_text": "Escolha um nome descritivo",
      "default_value": null,
      "visible_onboarding": true
    }
  ]
}
```

#### `get-account-parameters-for-onboarding.js`
**Endpoint:** `GET /Autonomia/Saas/Accounts/{accountId}/ParametersOnboarding`

**Função:** Similar ao produto, mas para parâmetros de conta

---

### **2. Rotas Adicionadas (serverless.yml)**

```yaml
getProductParametersForOnboarding:
  handler: handlers/get-product-parameters-for-onboarding.handler
  path: Autonomia/Saas/Products/{productId}/ParametersOnboarding
  method: GET

getAccountParametersForOnboarding:
  handler: handlers/get-account-parameters-for-onboarding.handler
  path: Autonomia/Saas/Accounts/{accountId}/ParametersOnboarding
  method: GET
```

---

## Frontend

### **1. Novo Componente: StepConfigureAccount.tsx**

**Localização:** `/frontend/src/components/onboarding/StepConfigureAccount.tsx`

#### **Features Principais:**

##### ✅ **Carregamento Dinâmico**
- Busca parâmetros do produto via API
- Renderiza campos baseados em metadata

##### ✅ **Suporte a JSON**
- Detecta automaticamente valores JSON
- Renderiza múltiplos campos para cada chave do JSON
- Exemplo:
  ```json
  {
    "apiKey": "abc123",
    "apiUrl": "https://api.example.com"
  }
  ```
  Renderiza 2 campos: "apiKey" e "apiUrl"

##### ✅ **Tipos de Campo**
- **Texto curto** → `<Input>`
- **Texto longo** (message, description) → `<Textarea>`
- **Valores JSON** → Múltiplos `<Input>` agrupados

##### ✅ **Helpers Visuais**
- `short_description` → Label do campo
- `help_text` → Tooltip/descrição abaixo do campo
- Ícone de informação para explicações

##### ✅ **Estados**
- **Loading:** Spinner enquanto carrega parâmetros
- **Error:** Mensagem de erro com botão "Tentar Novamente"
- **Empty:** Mensagem quando não há parâmetros
- **Form:** Renderização dinâmica dos campos

---

### **2. Integração com Onboarding**

#### **Atualização em `/frontend/src/app/onboarding/page.tsx`**

**Mudanças:**
```typescript
// Antes
import StepAddAccount from "@/components/onboarding/StepAddAccount";
const [accountData, setAccountData] = useState<AccountData | null>(null);

// Depois
import StepConfigureAccount from "@/components/onboarding/StepConfigureAccount";
const [accountData, setAccountData] = useState<Record<string, any> | null>(null);
```

**Renderização:**
```tsx
{currentStep === 2 && selectedProduct && (
  <StepConfigureAccount 
    productId={selectedProduct} 
    onNext={handleAccountAdd}
    onBack={handlePreviousStep}
  />
)}
```

---

### **3. API Service (api.ts)**

#### **Novos Métodos:**

```typescript
async getProductParametersForOnboarding(productId: string): Promise<Parameter[]>

async getAccountParametersForOnboarding(accountId: string): Promise<Parameter[]>
```

**Type Parameter:**
```typescript
{
  id: string;
  name: string;
  value: string;
  short_description?: string;
  help_text?: string;
  default_value?: string;
  visible_onboarding: boolean;
}
```

---

## Fluxo de Dados

### **1. Produto → Parâmetros**
```
1. Usuário seleciona produto (Step 1)
   ↓
2. productId é passado para StepConfigureAccount
   ↓
3. API GET /Products/{productId}/ParametersOnboarding
   ↓
4. JOIN: product_parameter ⟕ product_parameters_standard ON name
   ↓
5. WHERE visible_onboarding = true
   ↓
6. Frontend renderiza formulário dinâmico
```

### **2. JSON Detection**
```javascript
const isJsonString = (str: string): boolean => {
  const trimmed = str.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
         (trimmed.startsWith('[') && trimmed.endsWith(']'));
};
```

**Se JSON:**
- Parseia o objeto
- Cria array de campos: `[{ key: 'apiKey', value: 'abc' }]`
- Renderiza cada campo separadamente
- Agrupa em um Card

**Se não JSON:**
- Renderiza campo único (Input ou Textarea)

---

## Exemplo de Uso

### **Parâmetros Configurados no Produto:**

```sql
-- product_parameters_standard
INSERT INTO product_parameters_standard (name, short_description, help_text, visible_onboarding) VALUES
  ('account_name', 'Nome da Conta', 'Escolha um nome descritivo', true),
  ('phone_number', 'Telefone', 'Formato: +5511999999999', true),
  ('api_config', 'Configuração da API', 'Credenciais de acesso', true);
```

### **Produto criado herda:**

```sql
-- product_parameter (criado automaticamente)
{
  "name": "api_config",
  "value": '{"apiKey": "", "apiUrl": ""}',  -- JSON!
  "short_description": "Configuração da API",
  "help_text": "Credenciais de acesso"
}
```

### **Renderização no Frontend:**

```
┌─────────────────────────────────────┐
│ Configuração da API                 │
│ ℹ️ Credenciais de acesso            │
├─────────────────────────────────────┤
│ apiKey: [___________________]       │
│ apiUrl: [___________________]       │
└─────────────────────────────────────┘
```

---

## Benefícios

### ✅ **100% Dinâmico**
- Sem hardcode de campos
- Adicionar novo campo = inserir em `*_parameters_standard`

### ✅ **Suporte a JSON**
- Permite configurações complexas
- Ex: múltiplas API keys, configurações aninhadas

### ✅ **UX Consistente**
- Tooltips automáticos via `help_text`
- Labels via `short_description`
- Placeholders via `help_text`

### ✅ **Validação Futura**
- Pode adicionar campo `required` em standard
- Pode adicionar `validation_regex` em standard
- Pode adicionar `field_type` (email, url, etc.)

---

## Próximos Passos

1. ✅ Backend implementado
2. ✅ Frontend implementado
3. ⏳ Deploy da API SaaS
4. ⏳ Popular `account_parameters_standard` com seed data
5. ⏳ Criar endpoint POST para salvar conta com parâmetros
6. ⏳ Integrar Step 3 (WhatsApp) com dados da conta
7. ⏳ Testes E2E

---

## Arquivos Criados/Modificados

### Backend
- ✅ `handlers/get-product-parameters-for-onboarding.js` (novo)
- ✅ `handlers/get-account-parameters-for-onboarding.js` (novo)
- ✅ `serverless.yml` (2 rotas adicionadas)

### Frontend
- ✅ `components/onboarding/StepConfigureAccount.tsx` (novo)
- ✅ `lib/api.ts` (2 métodos adicionados)
- ✅ `app/onboarding/page.tsx` (integração atualizada)

### Documentação
- ✅ `ONBOARDING_STEP2_IMPLEMENTATION.md` (este arquivo)

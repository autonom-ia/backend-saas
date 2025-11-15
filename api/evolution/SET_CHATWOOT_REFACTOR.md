# Refatoração do set-chatwoot.js

## 🎯 Objetivo

Implementar sistema de fallback de parâmetros e deixar claro quando cada tipo de ID é usado:
- **`accountId`** = UUID da conta no banco SAAS
- **`chatwootAccountId`** = ID numérico da conta no Chatwoot (ex: "5")

---

## 🔄 Mudanças Principais

### **1. Sistema de Fallback Implementado**

Agora usa `getParameterValue` para buscar parâmetros em:
1. **Body da requisição** (prioridade máxima)
2. **account_parameter** 
3. **product_parameter** (fallback)

```javascript
// Antes
const cwAccountId = body.account_id;
const cwUrl = body.url;
const cwToken = body.token;

// Depois
let chatwootAccountId = body.account_id || await getParameterValue(accountId, 'chatwoot-account', {
  required: false,
  aliases: ['CHATWOOT_ACCOUNT']
});

let chatwootUrl = body.url || await getParameterValue(accountId, 'chatwoot-url', {
  required: false,
  aliases: ['CHATWOOT_URL']
});

let chatwootToken = body.token || await getParameterValue(accountId, 'chatwoot-token', {
  required: false,
  aliases: ['CHATWOOT_TOKEN']
});
```

---

### **2. Nomenclatura Clara de Variáveis**

#### **Antes (confuso):**
```javascript
const accountId = body.account_id || qs.account_id;  // Qual account_id??
// ...
const path = `/api/v1/accounts/${encodeURIComponent(accountId)}`;  // Qual??
```

#### **Depois (claro):**
```javascript
// accountId = UUID da conta no banco SAAS
const accountId = body.account_id || qs.account_id;

// chatwootAccountId = ID numérico da conta no Chatwoot
let chatwootAccountId = await getParameterValue(accountId, 'chatwoot-account', ...);

// Validação usa chatwootAccountId (ID do Chatwoot)
const apiPath = `/api/v1/accounts/${encodeURIComponent(chatwootAccountId)}`;
console.log('[set-chatwoot] Validando chatwootAccountId na API', { 
  chatwootAccountId,  // ← Explícito
  url: `${chatwootUrl}${apiPath}` 
});
```

---

### **3. Logs Detalhados**

Todos os logs agora deixam claro qual ID está sendo usado:

```javascript
console.log('[set-chatwoot] Parâmetros carregados', {
  accountId,              // UUID da conta SAAS
  chatwootAccountId,      // ID da conta no Chatwoot
  chatwootUrl,
  chatwootTokenPreview: chatwootToken ? chatwootToken.slice(0, 4) + '****' : null
});

console.log('[set-chatwoot] Preparando chamada para Evolution API', {
  accountId,              // UUID da conta SAAS
  instance,
  chatwootAccountId,      // ID da conta no Chatwoot
  chatwootUrl,
  chatwootTokenPreview: payload.token ? payload.token.slice(0, 4) + '****' : null
});
```

---

## 📋 Fluxo Completo Atualizado

### **1. Receber Requisição**
```javascript
// Query ou body
const accountId = body.account_id || qs.account_id;  // UUID SAAS
const instance = path.instance || body.instanceName;
```

---

### **2. Buscar Parâmetros com Fallback**
```javascript
// Prioridade: body → account_parameter → product_parameter
let chatwootAccountId = body.account_id || await getParameterValue(...);
let chatwootUrl = body.url || await getParameterValue(...);
let chatwootToken = body.token || await getParameterValue(...);
```

---

### **3. Validar chatwootAccountId na API do Chatwoot**
```javascript
if (chatwootAccountId && chatwootUrl && chatwootToken) {
  // Usa chatwootAccountId (ID numérico do Chatwoot)
  const apiPath = `/api/v1/accounts/${encodeURIComponent(chatwootAccountId)}`;
  const resp = await axios.get(`${chatwootUrl}${apiPath}`, {
    headers: { api_access_token: chatwootToken }
  });
}
```

---

### **4. Provisionar se Necessário**
```javascript
if (!chatwootAccountId) {
  const prov = await provisionChatwoot(accountId);  // Usa UUID SAAS
  chatwootAccountId = prov.chatwootAccountId;
  chatwootUrl = prov.chatwootUrl;
  chatwootToken = prov.chatwootToken;
}
```

---

### **5. Persistir Parâmetros**
```javascript
await upsert('chatwoot-account', chatwootAccountId);
await upsert('chatwoot-url', chatwootUrl);
await upsert('chatwoot-token', chatwootToken);
```

---

### **6. Chamar Evolution API**
```javascript
// accountId = UUID SAAS (para buscar config da Evolution)
// evoPayload contém chatwootAccountId, chatwootUrl, chatwootToken
result = await setChatwoot(accountId, instance, evoPayload);
```

---

### **7. Configurar Agent Bot/Inbox**
```javascript
// accountId = UUID SAAS
cfg = await configureChatwootInbox(accountId, instance);
```

---

## 🔍 Comparação de Variáveis

| Variável | Tipo | Exemplo | Usado em |
|----------|------|---------|----------|
| **`accountId`** | UUID (string) | `"39a0c369-ed20-4ef0-9601-cf118e22fdb4"` | Query string, busca de config, Evolution API |
| **`chatwootAccountId`** | String numérico | `"5"` | API Chatwoot (`/api/v1/accounts/5`), payload Evolution |
| **`chatwootUrl`** | URL (string) | `"https://chatwoot.autonomia.site"` | Validação API, payload Evolution |
| **`chatwootToken`** | String | `"xyz123abc..."` | Header `api_access_token`, payload Evolution |
| **`instance`** | String | `"5531982813234"` | Nome da instância WhatsApp |

---

## 📊 Exemplo de Requisição

### **Request:**
```http
POST /Autonomia/Evolution/SetChatwoot/5531982813234?account_id=39a0c369-ed20-4ef0-9601-cf118e22fdb4
Content-Type: application/json
Authorization: Bearer <token>

{
  "enabled": true
}
```

### **Parâmetros Buscados (fallback):**
```javascript
// account_parameter (ou product_parameter se não tiver)
chatwoot-account: "5"
chatwoot-url: "https://chatwoot.autonomia.site"
chatwoot-token: "xyz123abc..."
```

### **Validação:**
```http
GET https://chatwoot.autonomia.site/api/v1/accounts/5
Headers:
  api_access_token: xyz123abc...
```

### **Payload para Evolution:**
```json
{
  "enabled": true,
  "account_id": "5",
  "accountId": "5",
  "url": "https://chatwoot.autonomia.site",
  "token": "xyz123abc...",
  "sign_msg": false,
  "reopen_conversation": false,
  "conversation_pending": false,
  "import_contacts": true,
  "import_messages": false,
  "days_limit_import_messages": 30,
  "auto_create": true
}
```

### **Response:**
```json
{
  "success": true,
  "chatwootAgentBotId": "123",
  "chatwootInboxId": "456",
  "chatwootAccountId": "5"
}
```

---

## ✅ Checklist de Melhorias

- [x] Implementar fallback com `getParameterValue`
- [x] Renomear variáveis para clareza (`chatwootAccountId` vs `accountId`)
- [x] Atualizar validação da API do Chatwoot
- [x] Adicionar logs detalhados em cada etapa
- [x] Comentar claramente cada seção do código
- [x] Usar `chatwootAccountId` na URL `/api/v1/accounts/:id`
- [x] Persistir parâmetros em `account_parameter`
- [x] Retornar `chatwootAccountId` na response

---

## 🎯 Benefícios

### **1. Clareza**
- Não há mais confusão sobre qual ID está sendo usado
- Logs explícitos facilitam debug
- Comentários marcam cada seção

### **2. Flexibilidade**
- Body pode sobrescrever parâmetros
- Fallback automático para product_parameter
- Provisionamento automático se necessário

### **3. Manutenibilidade**
- Código estruturado em seções claras
- Variáveis com nomes descritivos
- Fácil adicionar novos parâmetros

### **4. Compatibilidade**
- Mantém suporte a todas as formas de enviar parâmetros
- Aceita aliases (nomes alternativos)
- Não quebra integrações existentes

---

## 📁 Arquivo Modificado

- ✅ `/backend/api/evolution/handlers/set-chatwoot.js`
  - Importado `getParameterValue`
  - Renomeadas variáveis para clareza
  - Implementado fallback de parâmetros
  - Adicionados logs detalhados
  - Comentários claros em cada seção

---

## 🧪 Como Testar

### **1. Teste com Parâmetros no Body:**
```bash
curl -X POST 'https://api-evolution.autonomia.site/Autonomia/Evolution/SetChatwoot/5531982813234?account_id=uuid-123' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{
    "enabled": true,
    "account_id": "5",
    "url": "https://chatwoot.autonomia.site",
    "token": "xyz123"
  }'
```

### **2. Teste com Fallback (account_parameter):**
```bash
# Cadastrar parâmetros na conta
INSERT INTO account_parameter (account_id, name, value) VALUES
  ('uuid-123', 'chatwoot-account', '5'),
  ('uuid-123', 'chatwoot-url', 'https://chatwoot.autonomia.site'),
  ('uuid-123', 'chatwoot-token', 'xyz123');

# Chamar sem body
curl -X POST 'https://api-evolution.autonomia.site/Autonomia/Evolution/SetChatwoot/5531982813234?account_id=uuid-123' \
  -H 'Authorization: Bearer <token>' \
  -d '{"enabled": true}'
```

### **3. Teste com Fallback (product_parameter):**
```bash
# Cadastrar parâmetros no produto
INSERT INTO product_parameter (product_id, name, value) VALUES
  ('prod-uuid', 'chatwoot-account', '5'),
  ('prod-uuid', 'chatwoot-url', 'https://chatwoot.autonomia.site'),
  ('prod-uuid', 'chatwoot-token', 'xyz123');

# Conta sem parâmetros próprios
curl -X POST 'https://api-evolution.autonomia.site/Autonomia/Evolution/SetChatwoot/5531982813234?account_id=uuid-123' \
  -H 'Authorization: Bearer <token>' \
  -d '{"enabled": true}'
```

### **4. Verificar Logs:**
```
[set-chatwoot] Parâmetros carregados { accountId: 'uuid-123', chatwootAccountId: '5', ... }
[set-chatwoot] Validando chatwootAccountId na API { chatwootAccountId: '5', ... }
[set-chatwoot] chatwootAccountId validado com sucesso
[set-chatwoot] Preparando chamada para Evolution API { accountId: 'uuid-123', chatwootAccountId: '5', ... }
[set-chatwoot] Evolution API respondeu com sucesso
[set-chatwoot] Agent Bot/Inbox configurados { botId: '123', inboxId: '456' }
```

---

## 🔗 Documentos Relacionados

- `PARAMETER_FALLBACK_SYSTEM.md` - Sistema geral de fallback
- `PARAMETER_FALLBACK_SUMMARY.md` - Resumo executivo
- `CHATWOOT_CONFIGURATION_FLOW.md` - Fluxo no frontend

---

## ⚠️ Breaking Changes

**Nenhum!** A refatoração é 100% retrocompatível:
- ✅ Aceita parâmetros no body (como antes)
- ✅ Aceita parâmetros em account_parameter (como antes)
- ✅ **Novo:** Fallback para product_parameter
- ✅ **Novo:** Nomenclatura clara nos logs

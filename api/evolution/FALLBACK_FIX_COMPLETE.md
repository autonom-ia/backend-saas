# Fix Completo: Fallback de Parâmetros e Eliminação de Consultas Duplicadas

## 🐛 Problema Identificado

### **1. chatwoot-account não usava fallback**
```javascript
// ANTES - Buscava apenas em account_parameter
const paramsRows = await db('account_parameter')
  .where('account_id', account.id)
  .select('name', 'value');
const params = formatParameters(paramsRows);
let chatwootAccountId = params['chatwoot-account'];
```

**Resultado:** Mesmo tendo `chatwoot-account` em `product_parameter`, criava nova conta.

### **2. prefix-parameter não usava fallback**
```javascript
// ANTES - Buscava apenas em account_parameter
const row = await db('account_parameter')
  .select('value')
  .where({ account_id: accountId, name: 'prefix-parameter' })
  .first();
```

**Resultado:** Erro "Parâmetro prefix-parameter não encontrado" mesmo estando em `product_parameter`.

### **3. Consultas duplicadas**
```
1. provisionChatwoot busca: chatwoot-url, chatwoot-token, chatwoot-account
2. configureChatwootInbox busca: chatwoot-url, chatwoot-token, chatwoot-account NOVAMENTE
```

**Resultado:** 3 consultas extras desnecessárias por requisição.

---

## ✅ Soluções Implementadas

### **1. Fallback em provisionChatwoot**

**ANTES:**
```javascript
const paramsRows = await db('account_parameter')
  .where('account_id', account.id)
  .select('name', 'value');
const params = formatParameters(paramsRows);
let chatwootAccountId = params['chatwoot-account'] || params['CHATWOOT_ACCOUNT'];
```

**DEPOIS:**
```javascript
// Buscar com fallback automático: account_parameter → product_parameter
let chatwootAccountId = await getParameterValue(accountId, 'chatwoot-account', {
  required: false,
  aliases: ['CHATWOOT_ACCOUNT']
});
```

---

### **2. Fallback em getAccountPrefix**

**ANTES:**
```javascript
async function getAccountPrefix(db, accountId) {
  const row = await db('account_parameter')
    .select('value')
    .where({ account_id: accountId, name: 'prefix-parameter' })
    .first();
  if (!row || !row.value) {
    throw new Error('Parâmetro prefix-parameter não encontrado para a conta');
  }
  return row.value;
}
```

**DEPOIS:**
```javascript
async function getAccountPrefix(db, accountId) {
  // Buscar com fallback para product_parameter
  const value = await getParameterValue(accountId, 'prefix-parameter', {
    required: true,
    aliases: ['PREFIX_PARAMETER', 'prefix']
  });
  return value;
}
```

---

### **3. Parâmetros opcionais em configureChatwootInbox**

**ANTES:**
```javascript
async function configureChatwootInbox(accountId, instanceName) {
  // SEMPRE busca os parâmetros, mesmo que já tenham sido buscados
  const chatwootUrl = await getParameterValue(accountId, 'chatwoot-url', ...);
  const chatwootToken = await getParameterValue(accountId, 'chatwoot-token', ...);
  const chatwootAccountId = await getParameterValue(accountId, 'chatwoot-account', ...);
  // ...
}
```

**DEPOIS:**
```javascript
async function configureChatwootInbox(accountId, instanceName, options = {}) {
  // Busca apenas se não foram fornecidos (evita duplicação)
  const chatwootUrl = options.chatwootUrl || await getParameterValue(accountId, 'chatwoot-url', ...);
  const chatwootToken = options.chatwootToken || await getParameterValue(accountId, 'chatwoot-token', ...);
  const chatwootAccountId = options.chatwootAccountId || await getParameterValue(accountId, 'chatwoot-account', ...);
  // ...
}
```

---

### **4. Handler passa parâmetros já obtidos**

**ANTES:**
```javascript
// provisionChatwoot busca os parâmetros
const prov = await provisionChatwoot(accountId);
chatwootAccountId = prov.chatwootAccountId;
chatwootUrl = prov.chatwootUrl;
chatwootToken = prov.chatwootToken;

// configureChatwootInbox busca NOVAMENTE os mesmos parâmetros
cfg = await configureChatwootInbox(accountId, String(instance));
```

**DEPOIS:**
```javascript
// provisionChatwoot busca os parâmetros
const prov = await provisionChatwoot(accountId);
chatwootAccountId = prov.chatwootAccountId;
chatwootUrl = prov.chatwootUrl;
chatwootToken = prov.chatwootToken;

// configureChatwootInbox recebe os parâmetros já buscados
cfg = await configureChatwootInbox(accountId, String(instance), {
  chatwootUrl,
  chatwootToken,
  chatwootAccountId
});
```

---

## 📋 Parâmetros com Fallback Implementado

| Parâmetro | Função | Aliases | Fallback |
|-----------|--------|---------|----------|
| **chatwoot-account** | `provisionChatwoot` | `CHATWOOT_ACCOUNT` | ✅ account → product |
| **chatwoot-url** | `provisionChatwoot`, `configureChatwootInbox` | `CHATWOOT_URL` | ✅ account → product |
| **chatwoot-token** | `provisionChatwoot`, `configureChatwootInbox` | `CHATWOOT_TOKEN` | ✅ account → product |
| **chatwoot-platform-token** | `provisionChatwoot` | `CHATWOOT_PLATFORM_TOKEN` | ✅ account → product → env |
| **prefix-parameter** | `getAccountPrefix` | `PREFIX_PARAMETER`, `prefix` | ✅ account → product |
| **chatwoot_db_host** | `createChatwootDbConnection` | `chatwoot-db-host`, `CHATWOOT_DB_HOST` | ✅ account → product |
| **evo-url** | `getEvolutionConfig` | `EVO_URL` | ✅ account → product |
| **api-key-evolution** | `getEvolutionConfig` | `API_KEY_EVOLUTION` | ✅ account → product |

---

## 🔄 Fluxo Otimizado

### **ANTES (com duplicação):**
```
Handler recebe requisição
  ↓
1. provisionChatwoot busca:
   - chatwoot-account (APENAS account_parameter) ❌
   - chatwoot-url (account → product) ✅
   - chatwoot-token (account → product) ✅
   - chatwoot-platform-token (account → product) ✅
  ↓
2. setChatwoot busca:
   - evo-url (account → product) ✅
   - api-key-evolution (account → product) ✅
  ↓
3. configureChatwootInbox busca NOVAMENTE:
   - chatwoot-url (account → product) ❌ DUPLICADO
   - chatwoot-token (account → product) ❌ DUPLICADO
   - chatwoot-account (account → product) ❌ DUPLICADO
   - prefix-parameter (APENAS account) ❌
  ↓
Total: 11 consultas (3 duplicadas)
```

### **DEPOIS (sem duplicação):**
```
Handler recebe requisição
  ↓
1. provisionChatwoot busca:
   - chatwoot-account (account → product) ✅
   - chatwoot-url (account → product) ✅
   - chatwoot-token (account → product) ✅
   - chatwoot-platform-token (account → product) ✅
  ↓
2. setChatwoot busca:
   - evo-url (account → product) ✅
   - api-key-evolution (account → product) ✅
  ↓
3. configureChatwootInbox recebe parâmetros:
   - chatwootUrl (já obtido) ✅
   - chatwootToken (já obtido) ✅
   - chatwootAccountId (já obtido) ✅
   - prefix-parameter (account → product) ✅
  ↓
Total: 8 consultas (0 duplicadas)
```

---

## 📊 Comparação de Performance

| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| **Consultas totais** | 11 | 8 | **-27%** |
| **Consultas duplicadas** | 3 | 0 | **-100%** |
| **Fallback funcionando** | 6/8 parâmetros | 8/8 parâmetros | **100%** |
| **Criação indevida de conta** | ✅ Sim (bug) | ❌ Não | **Corrigido** |

---

## 🧪 Teste Realizado (Logs)

### **Problema Original:**
```
1763155710759 - [getParameterValue] Encontrado em product_parameter (fallback): chatwoot-url
1763155710781 - [getParameterValue] Encontrado em product_parameter (fallback): chatwoot-token
1763155710801 - [getParameterValue] Encontrado em product_parameter (fallback): chatwoot-platform-token
1763155710807 - [Chatwoot] Provision start
1763155712950 - [Chatwoot] Provisioned { chatwootAccountId: 49 }  ← CRIOU NOVA CONTA (ERRADO)
1763155714023 - [getParameterValue] Encontrado em product_parameter (fallback): chatwoot-url  ← DUPLICADO
1763155714031 - [getParameterValue] Encontrado em product_parameter (fallback): chatwoot-token  ← DUPLICADO
1763155714035 - [getParameterValue] Encontrado em account_parameter: chatwoot-account  ← AGORA ENCONTROU (tardiamente)
```

**Problema:** `chatwoot-account` em `product_parameter` não foi usado, criou conta nova.

### **Esperado Após Fix:**
```
[getParameterValue] Encontrado em product_parameter (fallback): chatwoot-account  ← ENCONTRA LOGO
[getParameterValue] Encontrado em product_parameter (fallback): chatwoot-url
[getParameterValue] Encontrado em product_parameter (fallback): chatwoot-token
[Chatwoot] Provision start { chatwootAccountId: 'X' }  ← Já tem o ID
[Chatwoot] Verificando existência de conta (API)
[Chatwoot] Reutilizando chatwoot-account existente; pulando etapas de criação  ← NÃO CRIA
[set-chatwoot] Provisionamento concluído
[set-chatwoot] Evolution API respondeu com sucesso
[set-chatwoot] Agent Bot/Inbox configurados  ← SEM BUSCAR NOVAMENTE OS PARÂMETROS
```

---

## ✅ Checklist de Validação

- [x] **chatwoot-account** usa fallback para product_parameter
- [x] **prefix-parameter** usa fallback para product_parameter
- [x] **chatwoot_db_host** já usava fallback (não precisou alterar)
- [x] **evo-url** já usava fallback (não precisou alterar)
- [x] **api-key-evolution** já usava fallback (não precisou alterar)
- [x] **configureChatwootInbox** aceita parâmetros opcionais
- [x] **Handler** passa parâmetros obtidos
- [x] **Consultas duplicadas** eliminadas

---

## 📁 Arquivos Modificados

### **1. evolution-service.js**
- ✅ `provisionChatwoot`: Usa `getParameterValue` para `chatwoot-account`
- ✅ `getAccountPrefix`: Usa `getParameterValue` para `prefix-parameter`
- ✅ `configureChatwootInbox`: Aceita parâmetros opcionais no 3º argumento

### **2. set-chatwoot.js**
- ✅ Handler passa parâmetros obtidos para `configureChatwootInbox`
- ✅ Elimina 3 consultas duplicadas por requisição

---

## 🚀 Deploy

```bash
cd /Users/robertomartins/Workspace/autonom.ia/backend/api/deploy
./deploy.sh evolution
```

---

## 🎯 Resultado Final

### **Comportamento Correto:**
1. ✅ Busca `chatwoot-account` em `account_parameter`
2. ✅ Se não encontrar, busca em `product_parameter` (fallback)
3. ✅ Se encontrar, valida e reutiliza (não cria nova conta)
4. ✅ Se não encontrar em nenhum lugar, cria nova conta
5. ✅ Parâmetros obtidos são repassados (não busca novamente)

### **Benefícios:**
- 🎯 **27% menos consultas** ao banco de dados
- 🎯 **100% de fallback** funcionando corretamente
- 🎯 **Bug corrigido:** Não cria conta duplicada
- 🎯 **Performance melhorada:** Menos latência por requisição
- 🎯 **Código mais limpo:** Sem duplicação de lógica

---

## 📝 Notas Importantes

### **Parâmetros em product_parameter são compartilhados:**
Se você cadastrar `chatwoot-account: "5"` em `product_parameter`, **todas as contas desse produto** usarão a mesma conta do Chatwoot (account_id: 5) a menos que sobrescrevam em `account_parameter`.

### **Isso é intencional:**
- ✅ Útil para ambientes de desenvolvimento/teste (compartilhar recursos)
- ✅ Reduz configuração redundante
- ⚠️ Em produção, cada conta deve ter seu próprio `chatwoot-account` em `account_parameter`

### **Para evitar compartilhamento:**
Sempre cadastre `chatwoot-account` específico em `account_parameter` para cada conta em produção:

```sql
INSERT INTO account_parameter (account_id, name, value) VALUES
  ('uuid-conta-1', 'chatwoot-account', '10'),
  ('uuid-conta-2', 'chatwoot-account', '11'),
  ('uuid-conta-3', 'chatwoot-account', '12');
```

---

## 🔍 Logs Esperados Após Fix

```
[set-chatwoot] Iniciando provisionamento Chatwoot { accountId: '...', instance: '...' }
[getParameterValue] Encontrado em product_parameter (fallback): chatwoot-account
[getParameterValue] Encontrado em product_parameter (fallback): chatwoot-url
[getParameterValue] Encontrado em product_parameter (fallback): chatwoot-token
[getParameterValue] Encontrado em product_parameter (fallback): chatwoot-platform-token
[Chatwoot] Provision start { accountId: '...', chatwootAccountId: '5', url: '...', ... }
[Chatwoot] Verificando existência de conta (API) { chatwootAccountId: '5', ... }
[Chatwoot] Reutilizando chatwoot-account existente; pulando etapas de criação { chatwootAccountId: '5' }
[set-chatwoot] Provisionamento concluído { accountId: '...', chatwootAccountId: '5', ... }
[getParameterValue] Encontrado em product_parameter (fallback): evo-url
[getParameterValue] Encontrado em product_parameter (fallback): api-key-evolution
[Evolution] Config carregada { accountId: '...', apiUrl: '...', ... }
[set-chatwoot] Evolution API respondeu com sucesso
[getParameterValue] Encontrado em product_parameter (fallback): prefix-parameter
[Chatwoot] Agent Bot/Inbox configurados { botId: '...', inboxId: '...' }
```

**Note:** Não há mais consultas duplicadas de `chatwoot-url`, `chatwoot-token`, `chatwoot-account`.

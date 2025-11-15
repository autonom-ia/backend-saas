# Sistema de Fallback de Parâmetros - Evolution API

## 📋 Resumo

Implementado sistema de fallback para busca de parâmetros de configuração:
1. **Primeiro:** Busca em `account_parameter` (específico da conta)
2. **Fallback:** Busca em `product_parameter` (padrão do produto)

Isso permite configurar valores padrão no produto e sobrescrevê-los por conta quando necessário.

---

## 🎯 Parâmetros Afetados

### **Evolution API**
- `evo-url` (aliases: `evolution-url`, `EVOLUTION_URL`)
- `api-key-evolution` (aliases: `evolution-apikey`, `EVOLUTION_API_KEY`)

### **Chatwoot**
- `chatwoot-url` (aliases: `CHATWOOT_URL`)
- `chatwoot-token` (aliases: `CHATWOOT_TOKEN`)
- `chatwoot-platform-token` (aliases: `CHATWOOT_PLATFORM_TOKEN`)
- `chatwoot_db_host` (aliases: `chatwoot-db-host`, `CHATWOOT_DB_HOST`)

---

## 🔧 Função Helper: `getParameterValue`

### **Assinatura:**
```javascript
async function getParameterValue(accountId, paramName, options = {})
```

### **Parâmetros:**
- `accountId` (string): ID da conta
- `paramName` (string): Nome do parâmetro a buscar
- `options` (object):
  - `required` (boolean): Se true, lança erro quando não encontrado
  - `aliases` (array): Nomes alternativos do parâmetro

### **Retorno:**
- String com o valor do parâmetro (trimmed)
- `null` se não encontrado e `required=false`
- Throws Error se não encontrado e `required=true`

### **Fluxo:**
```
1. Busca account pelo accountId
   ↓
2. Tenta account_parameter com todas as variações de nome
   ↓ (se encontrou e tem valor)
   └→ Retorna valor
   ↓ (se não encontrou)
3. Se account tem product_id, busca em product_parameter
   ↓ (se encontrou e tem valor)
   └→ Retorna valor
   ↓ (se não encontrou)
4. Se required=true → Throws Error
   Se required=false → Retorna null
```

---

## 📝 Exemplos de Uso

### **1. Evolution URL (obrigatório)**
```javascript
const apiUrl = await getParameterValue(accountId, 'evo-url', {
  required: true,
  aliases: ['evolution-url', 'EVOLUTION_URL']
});
```

### **2. Chatwoot Platform Token (opcional com fallback para env)**
```javascript
let platformToken = await getParameterValue(accountId, 'chatwoot-platform-token', {
  required: false,
  aliases: ['CHATWOOT_PLATFORM_TOKEN']
});

if (!platformToken) {
  platformToken = process.env.CHATWOOT_PLATFORM_TOKEN || 'default-value';
}
```

### **3. Chatwoot DB Host (obrigatório)**
```javascript
const host = await getParameterValue(accountId, 'chatwoot_db_host', { 
  required: true,
  aliases: ['chatwoot-db-host', 'CHATWOOT_DB_HOST']
});
```

---

## 🔄 Funções Modificadas

### **1. `getEvolutionConfig(accountId)`**
**Antes:**
```javascript
const paramsRows = await db('account_parameter')
  .where('account_id', account.id)
  .select('name', 'value');
const params = formatParameters(paramsRows);
const apiUrl = params['evo-url'] || params['evolution-url'];
const apiKey = params['api-key-evolution'] || params['evolution-apikey'];
```

**Depois:**
```javascript
const apiUrl = await getParameterValue(accountId, 'evo-url', {
  required: true,
  aliases: ['evolution-url', 'EVOLUTION_URL']
});

const apiKey = await getParameterValue(accountId, 'api-key-evolution', {
  required: true,
  aliases: ['evolution-apikey', 'EVOLUTION_API_KEY']
});
```

---

### **2. `createChatwootDbConnection(identifier)`**
**Antes:**
```javascript
const hostRow = await db('account_parameter')
  .select('value')
  .where({ account_id: accountId, name: 'chatwoot_db_host' })
  .first();
if (!hostRow || !hostRow.value) throw new Error('...');
const host = hostRow.value;
```

**Depois:**
```javascript
const host = await getParameterValue(accountId, 'chatwoot_db_host', { 
  required: true,
  aliases: ['chatwoot-db-host', 'CHATWOOT_DB_HOST']
});
```

---

### **3. `provisionChatwoot(accountId)`**
**Antes:**
```javascript
const paramsRows = await db('account_parameter')
  .where('account_id', account.id)
  .select('name', 'value');
const params = formatParameters(paramsRows);
const chatwootUrl = params['chatwoot-url'] || params['CHATWOOT_URL'];
const chatwootToken = params['chatwoot-token'] || params['CHATWOOT_TOKEN'];
const platformToken = params['chatwoot-platform-token'] || ...
```

**Depois:**
```javascript
const chatwootUrl = await getParameterValue(accountId, 'chatwoot-url', {
  required: true,
  aliases: ['CHATWOOT_URL']
});

const chatwootToken = await getParameterValue(accountId, 'chatwoot-token', {
  required: true,
  aliases: ['CHATWOOT_TOKEN']
});

let platformToken = await getParameterValue(accountId, 'chatwoot-platform-token', {
  required: false,
  aliases: ['CHATWOOT_PLATFORM_TOKEN']
});

if (!platformToken) {
  platformToken = process.env.CHATWOOT_PLATFORM_TOKEN || 'h5Gj43DZYb5HnY75gpGwUE3T';
}
```

---

### **4. `configureChatwootInbox(accountId, instanceName)`**
**Antes:**
```javascript
const paramsRows = await db('account_parameter')
  .where('account_id', account.id)
  .select('name', 'value');
const aparams = formatParameters(paramsRows);
const chatwootUrl = aparams['chatwoot-url'] || aparams['CHATWOOT_URL'];
const chatwootToken = aparams['chatwoot-token'] || aparams['CHATWOOT_TOKEN'];
const chatwootAccountId = aparams['chatwoot-account'] || aparams['CHATWOOT_ACCOUNT'];
```

**Depois:**
```javascript
const chatwootUrl = await getParameterValue(accountId, 'chatwoot-url', {
  required: true,
  aliases: ['CHATWOOT_URL']
});

const chatwootToken = await getParameterValue(accountId, 'chatwoot-token', {
  required: true,
  aliases: ['CHATWOOT_TOKEN']
});

const chatwootAccountId = await getParameterValue(accountId, 'chatwoot-account', {
  required: true,
  aliases: ['CHATWOOT_ACCOUNT']
});
```

---

## 💡 Casos de Uso

### **Caso 1: Valor Padrão no Produto**
```sql
-- product_parameter
product_id: 'uuid-produto-1'
name: 'evo-url'
value: 'https://evolution.autonomia.site'

-- account não tem o parâmetro
-- Resultado: Usa o valor do produto
```

### **Caso 2: Override por Conta**
```sql
-- product_parameter
product_id: 'uuid-produto-1'
name: 'evo-url'
value: 'https://evolution.autonomia.site'

-- account_parameter (override)
account_id: 'uuid-conta-123'
name: 'evo-url'
value: 'https://evolution-custom.cliente.com'

-- Resultado: Usa o valor da conta (override)
```

### **Caso 3: Variação de Nome**
```sql
-- product_parameter
name: 'EVOLUTION_URL'  -- variação em uppercase
value: 'https://evolution.autonomia.site'

-- Código busca: 'evo-url' com aliases ['evolution-url', 'EVOLUTION_URL']
-- Resultado: Encontra pelo alias 'EVOLUTION_URL'
```

---

## 🎯 Benefícios

### **1. Configuração Hierárquica**
- Padrões no produto
- Overrides específicos por conta
- Reduz duplicação de configuração

### **2. Flexibilidade**
- Contas podem usar infraestrutura própria
- Contas podem compartilhar recursos do produto
- Fácil migração entre ambientes

### **3. Manutenibilidade**
- Atualizar produto atualiza todas as contas (que não têm override)
- Logs claros indicam de onde veio cada valor
- Suporte a múltiplos nomes de parâmetro (aliases)

### **4. Compatibilidade**
- Mantém compatibilidade com nomes antigos
- Suporta variações (kebab-case, snake_case, UPPERCASE)
- Fallback graceful para valores padrão

---

## 📊 Logs de Debug

### **Parâmetro Encontrado em Account:**
```
[getParameterValue] Encontrado em account_parameter: evo-url (alias: evo-url)
```

### **Parâmetro Encontrado em Product (Fallback):**
```
[getParameterValue] Encontrado em product_parameter (fallback): evo-url (alias: EVOLUTION_URL)
```

### **Parâmetro Não Encontrado:**
```
[getParameterValue] Parâmetro não encontrado: optional-param
```

### **Erro - Parâmetro Obrigatório Ausente:**
```
Error: Parâmetro obrigatório não encontrado: evo-url (aliases: evolution-url, EVOLUTION_URL)
```

---

## 🚀 Migração de Dados

### **Passo 1: Cadastrar Parâmetros Padrão no Produto**
```sql
INSERT INTO product_parameter (product_id, name, value, short_description) VALUES
  ('uuid-produto', 'evo-url', 'https://evolution.autonomia.site', 'URL da Evolution API'),
  ('uuid-produto', 'api-key-evolution', 'default-key', 'Chave da Evolution API'),
  ('uuid-produto', 'chatwoot-url', 'https://chatwoot.autonomia.site', 'URL do Chatwoot'),
  ('uuid-produto', 'chatwoot-platform-token', 'platform-token', 'Token de Plataforma Chatwoot'),
  ('uuid-produto', 'chatwoot_db_host', '10.0.1.100', 'Host do BD Chatwoot');
```

### **Passo 2: (Opcional) Remover Duplicatas de Account**
```sql
-- Remover account_parameter que têm valor idêntico ao product_parameter
DELETE FROM account_parameter ap
USING account a, product_parameter pp
WHERE ap.account_id = a.id
  AND a.product_id = pp.product_id
  AND ap.name = pp.name
  AND ap.value = pp.value;
```

### **Passo 3: Manter Apenas Overrides**
```sql
-- Manter apenas account_parameter com valores diferentes do produto
-- (query acima já faz isso automaticamente)
```

---

## ⚠️ Notas Importantes

### **1. Ordem de Prioridade**
```
account_parameter > product_parameter > env variable > hard-coded default
```

### **2. Valores Vazios**
Valores vazios ou com apenas espaços são **ignorados** no fallback:
```javascript
if (accountParam && accountParam.value && String(accountParam.value).trim()) {
  // Valor válido
}
```

### **3. Performance**
- Cada chamada faz 2 queries no máximo (account + product)
- Considerar cache em memória para ambientes de alta carga
- Logs detalhados ajudam no debug

### **4. Compatibilidade**
- ✅ Mantém suporte a nomes antigos via aliases
- ✅ Não quebra código existente
- ✅ Adiciona funcionalidade sem remover nada

---

## 📁 Arquivos Modificados

- ✅ `/backend/api/evolution/services/evolution-service.js`
  - Adicionada função `getParameterValue`
  - Modificadas 4 funções para usar o helper
  - Exportada função `getParameterValue` para uso externo

- ✅ `/backend/api/evolution/services/resend-service.js`
  - Modificada função `getChatwootParamsFromAccount`
  - Usa `getParameterValue` importado do evolution-service

---

## ✅ Checklist de Implementação

- [x] Criar função `getParameterValue` com fallback
- [x] Exportar função para uso em outros módulos
- [x] Modificar `getEvolutionConfig` (evo-url, api-key-evolution)
- [x] Modificar `createChatwootDbConnection` (chatwoot_db_host)
- [x] Modificar `provisionChatwoot` (chatwoot-url, chatwoot-token, chatwoot-platform-token)
- [x] Modificar `configureChatwootInbox` (chatwoot-url, chatwoot-token, chatwoot-account)
- [x] Modificar `getChatwootParamsFromAccount` em resend-service
- [x] Adicionar logs de debug
- [x] Documentar mudanças
- [ ] Testar em ambiente de desenvolvimento
- [ ] Migrar dados de produção (se necessário)
- [ ] Deploy em produção

---

## 🔍 Testes Recomendados

### **1. Teste: Usar Valor do Produto**
```javascript
// Cenário: account não tem evo-url, produto tem
// Resultado esperado: Usa valor do produto
```

### **2. Teste: Override por Conta**
```javascript
// Cenário: account tem evo-url, produto também tem
// Resultado esperado: Usa valor da conta (override)
```

### **3. Teste: Parâmetro Ausente (obrigatório)**
```javascript
// Cenário: nem account nem produto têm o parâmetro
// Resultado esperado: Error lançado
```

### **4. Teste: Parâmetro Ausente (opcional)**
```javascript
// Cenário: nem account nem produto têm o parâmetro opcional
// Resultado esperado: Retorna null, não lança erro
```

### **5. Teste: Alias Funciona**
```javascript
// Cenário: Produto tem 'EVOLUTION_URL', busca por 'evo-url'
// Resultado esperado: Encontra via alias
```

---

## 📞 Suporte

Em caso de dúvidas ou problemas:
1. Verificar logs no CloudWatch
2. Confirmar que product_id está populado na tabela account
3. Verificar se parâmetros existem em product_parameter
4. Revisar aliases na chamada de getParameterValue

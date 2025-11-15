# Mapeamento Metadata → KnowledgeBase

## Comportamento Especial

### **Parâmetro "metadata" → "knowledgeBase"**

Quando o parâmetro `metadata` é enviado no onboarding, ele é **automaticamente mapeado** para `knowledgeBase` na tabela `account_parameter`.

---

## Fluxo Completo

### **1. Configuração do Produto**

**product_parameter:**
```sql
name: 'metadata'
value: '{"nameAgente": "Nome da assistente virtual", "nomeCorretora": "Nome do cliente..."}'
short_description: 'Base de Conhecimento'
visible_onboarding: true
```

**product_parameters_standard:**
```sql
name: 'metadata'
visible_onboarding: true
```

---

### **2. Frontend - Formulário Dinâmico**

**Renderização:**
```
┌─────────────────────────────────────┐
│ Base de Conhecimento                │
├─────────────────────────────────────┤
│ Nome da assistente virtual          │
│ [Maria_____________________]        │
│                                     │
│ Nome do cliente ou organização...   │
│ [Empresa XYZ_______________]        │
└─────────────────────────────────────┘
```

**Payload Enviado:**
```json
{
  "accountName": "Atendimento Principal",
  "accountEmail": "contato@empresa.com",
  "accountPhone": "5511999999999",
  "productId": "uuid",
  "parameters": {
    "metadata": "{\"nameAgente\":\"Maria\",\"nomeCorretora\":\"Empresa XYZ\"}"
  }
}
```

---

### **3. Backend - Mapeamento Automático**

**Handler: `create-account-onboarding.js`**

```javascript
if (param.name === 'metadata' && parameters['metadata']) {
  paramName = 'knowledgeBase';  // ← Mapeamento
  
  const metadataValue = parameters['metadata'];
  // Valida e garante que é JSON string válido
  finalValue = metadataValue;
}
```

**Resultado em `account_parameter`:**
```sql
INSERT INTO account_parameter (name, value, account_id, ...) VALUES
  ('knowledgeBase', '{"nameAgente":"Maria","nomeCorretora":"Empresa XYZ"}', 'uuid', ...);
```

---

## Estrutura do JSON

### **Formato no Banco (product_parameter):**
```json
{
  "key1": "Descrição do Campo 1",
  "key2": "Descrição do Campo 2"
}
```

**Exemplo:**
```json
{
  "nameAgente": "Nome da assistente virtual",
  "nomeCorretora": "Nome do cliente ou organização atendida",
  "corretora_info": "Informações adicionais da corretora"
}
```

### **Formato Preenchido pelo Usuário:**
```json
{
  "nameAgente": "Maria",
  "nomeCorretora": "Empresa XYZ",
  "corretora_info": "Localizada em São Paulo, atua desde 2010"
}
```

---

## Validações Implementadas

### **1. Tipo String JSON**
```javascript
if (typeof metadataValue === 'string' && metadataValue.trim().startsWith('{')) {
  try {
    JSON.parse(metadataValue);  // Valida
    finalValue = metadataValue;
  } catch {
    finalValue = param.default_value || '';
  }
}
```

### **2. Tipo Object**
```javascript
else if (typeof metadataValue === 'object') {
  finalValue = JSON.stringify(metadataValue);
}
```

### **3. Fallback**
```javascript
else {
  finalValue = param.default_value || '';
}
```

---

## Uso no Sistema

### **Onde é Usado?**

O campo `knowledgeBase` em `account_parameter` é utilizado por:

1. **Agentes de IA** - Para personalizar respostas
2. **Instruções do Sistema** - Prompt engineering
3. **Contexto do Atendimento** - Informações da empresa

### **Exemplo de Uso:**

```javascript
// Buscar knowledgeBase da conta
const kb = await knex('account_parameter')
  .where({ account_id, name: 'knowledgeBase' })
  .first();

const knowledge = JSON.parse(kb.value);
// knowledge = { nameAgente: "Maria", nomeCorretora: "Empresa XYZ" }

// Usar no prompt do agente
const prompt = `Você é ${knowledge.nameAgente}, assistente da ${knowledge.nomeCorretora}...`;
```

---

## Configuração Recomendada

### **account_parameters_standard**

```sql
INSERT INTO account_parameters_standard (name, visible_onboarding, short_description, help_text) VALUES
  ('metadata', true, 'Base de Conhecimento', 'Conjunto de informações utilizadas pela empresa para serem utilizadas na instrução do agente.');
```

### **product_parameter (valor inicial)**

```json
{
  "nameAgente": "Nome da assistente virtual",
  "nomeCorretora": "Nome do cliente ou organização atendida",
  "descricao_servicos": "Descrição dos serviços oferecidos",
  "horario_atendimento": "Horário de funcionamento",
  "contato_suporte": "Email ou telefone de suporte"
}
```

---

## Benefícios

### ✅ **Flexibilidade**
- Adicionar novos campos sem alterar código
- Cada produto pode ter estrutura diferente

### ✅ **Centralização**
- Toda base de conhecimento em um único JSON
- Fácil de atualizar e versionar

### ✅ **UX Dinâmico**
- Frontend renderiza automaticamente
- Descrições claras para cada campo

### ✅ **Integração Simples**
- Basta parsear o JSON
- Usar valores nas instruções do agente

---

## Exemplo Completo

### **Configuração Inicial (Produto):**
```json
{
  "metadata": "{\"nameAgente\":\"Nome da assistente virtual\",\"nomeCorretora\":\"Nome do cliente\"}"
}
```

### **Onboarding (Usuário preenche):**
```json
{
  "metadata": "{\"nameAgente\":\"Ana Silva\",\"nomeCorretora\":\"Seguradora ABC Ltda\"}"
}
```

### **Salvo no Banco:**
```sql
-- account_parameter
name: 'knowledgeBase'
value: '{"nameAgente":"Ana Silva","nomeCorretora":"Seguradora ABC Ltda"}'
account_id: 'uuid'
```

### **Usado pelo Agente:**
```javascript
const kb = JSON.parse(accountParam.value);
const systemPrompt = `
Você é ${kb.nameAgente}, assistente virtual da ${kb.nomeCorretora}.
Seu objetivo é ajudar clientes com dúvidas sobre seguros...
`;
```

---

## Troubleshooting

### **Problema: JSON inválido**
```javascript
// Solução: Validação automática
try {
  JSON.parse(metadataValue);
  finalValue = metadataValue;
} catch {
  console.error('JSON inválido, usando default');
  finalValue = param.default_value || '';
}
```

### **Problema: Campo não aparece no formulário**
- ✅ Verificar `visible_onboarding = true` em `product_parameters_standard`
- ✅ Verificar se `metadata` existe em `product_parameter`

### **Problema: Valor não salvo**
- ✅ Verificar payload enviado (deve ser JSON string)
- ✅ Checar logs do handler para erros de parsing

---

## Resumo

| Campo | Descrição |
|-------|-----------|
| **Nome no produto** | `metadata` |
| **Nome salvo** | `knowledgeBase` |
| **Formato** | JSON string |
| **Estrutura** | `{ "key": "label", ... }` → `{ "key": "valor", ... }` |
| **Uso** | Base de conhecimento para agentes IA |

# Sistema de Fallback de Parâmetros - Resumo Executivo

## 🎯 O Que Foi Implementado

Sistema de busca hierárquica de parâmetros de configuração:
1. **Primeira tentativa:** `account_parameter` (específico da conta)
2. **Fallback:** `product_parameter` (padrão do produto)

---

## 📋 Parâmetros Afetados

### Evolution API
- `evo-url`
- `api-key-evolution`

### Chatwoot
- `chatwoot-url`
- `chatwoot-token`
- `chatwoot-platform-token`
- `chatwoot_db_host`

---

## 💡 Benefícios

### 1. **Configuração Centralizada**
Defina valores padrão no produto → Todas as contas herdam automaticamente

### 2. **Override Flexível**
Contas específicas podem sobrescrever qualquer parâmetro quando necessário

### 3. **Redução de Duplicação**
Não é mais necessário replicar os mesmos valores em todas as contas

### 4. **Manutenibilidade**
Atualize o produto → Todas as contas sem override recebem a mudança

---

## 📊 Exemplo Prático

### **Antes (Duplicado em Cada Conta):**
```sql
-- Conta 1
INSERT INTO account_parameter VALUES ('uuid-1', 'evo-url', 'https://evolution.site');
INSERT INTO account_parameter VALUES ('uuid-1', 'api-key-evolution', 'key123');

-- Conta 2
INSERT INTO account_parameter VALUES ('uuid-2', 'evo-url', 'https://evolution.site');
INSERT INTO account_parameter VALUES ('uuid-2', 'api-key-evolution', 'key123');

-- Conta 3
INSERT INTO account_parameter VALUES ('uuid-3', 'evo-url', 'https://evolution.site');
INSERT INTO account_parameter VALUES ('uuid-3', 'api-key-evolution', 'key123');
```

### **Depois (Centralizado no Produto):**
```sql
-- Produto (configuração padrão)
INSERT INTO product_parameter VALUES ('prod-uuid', 'evo-url', 'https://evolution.site');
INSERT INTO product_parameter VALUES ('prod-uuid', 'api-key-evolution', 'key123');

-- Contas herdam automaticamente do produto
-- Nenhum account_parameter necessário

-- Apenas override quando necessário
INSERT INTO account_parameter VALUES ('uuid-3', 'evo-url', 'https://custom.evolution.com');
```

---

## 🔄 Fluxo de Busca

```
┌─────────────────────────────────────────┐
│  Buscar parâmetro "evo-url"             │
└─────────────────┬───────────────────────┘
                  │
                  ▼
    ┌─────────────────────────────┐
    │  Existe em account_parameter │  ──── SIM ──→ Retorna valor
    │  com valor não vazio?        │
    └────────────┬────────────────┘
                 │
                NÃO
                 │
                 ▼
    ┌─────────────────────────────┐
    │  Conta tem product_id?       │  ──── NÃO ──→ Erro (se required)
    └────────────┬────────────────┘              ou null
                 │
                SIM
                 │
                 ▼
    ┌─────────────────────────────┐
    │  Existe em product_parameter │  ──── SIM ──→ Retorna valor
    │  com valor não vazio?        │
    └────────────┬────────────────┘
                 │
                NÃO
                 │
                 ▼
         Erro (se required) ou null
```

---

## 🔧 Implementação Técnica

### **Nova Função Helper:**
```javascript
async function getParameterValue(accountId, paramName, options = {})
```

### **Exemplo de Uso:**
```javascript
// Obrigatório com aliases
const apiUrl = await getParameterValue(accountId, 'evo-url', {
  required: true,
  aliases: ['evolution-url', 'EVOLUTION_URL']
});

// Opcional
const platformToken = await getParameterValue(accountId, 'chatwoot-platform-token', {
  required: false,
  aliases: ['CHATWOOT_PLATFORM_TOKEN']
});
```

---

## 📁 Arquivos Modificados

1. **`evolution-service.js`**
   - Adicionada função `getParameterValue`
   - Modificadas 4 funções principais
   - Exportada função para uso externo

2. **`resend-service.js`**
   - Modificada função `getChatwootParamsFromAccount`

---

## 🚀 Próximos Passos

### **1. Migração de Dados (Opcional)**
```sql
-- Cadastrar valores padrão no produto
INSERT INTO product_parameter (product_id, name, value) VALUES
  ('uuid', 'evo-url', 'https://evolution.autonomia.site'),
  ('uuid', 'api-key-evolution', 'default-key'),
  ('uuid', 'chatwoot-url', 'https://chatwoot.autonomia.site');

-- Remover duplicatas de contas (valores idênticos ao produto)
DELETE FROM account_parameter ap
USING account a, product_parameter pp
WHERE ap.account_id = a.id
  AND a.product_id = pp.product_id
  AND ap.name = pp.name
  AND ap.value = pp.value;
```

### **2. Deploy**
```bash
cd /Users/robertomartins/Workspace/autonom.ia/backend/api/deploy
./deploy.sh evolution
```

### **3. Testes**
- Verificar logs para confirmar fallback funcionando
- Testar criação de instância com conta sem parâmetros
- Testar override por conta

---

## 📊 Logs de Monitoramento

### **Sucesso - Valor do Account:**
```
[getParameterValue] Encontrado em account_parameter: evo-url (alias: evo-url)
```

### **Sucesso - Fallback para Product:**
```
[getParameterValue] Encontrado em product_parameter (fallback): evo-url (alias: EVOLUTION_URL)
```

### **Erro - Parâmetro Ausente:**
```
Error: Parâmetro obrigatório não encontrado: evo-url (aliases: evolution-url, EVOLUTION_URL)
```

---

## ⚠️ Pontos de Atenção

### **1. product_id Obrigatório**
A tabela `account` deve ter `product_id` populado para o fallback funcionar.

### **2. Valores Vazios Ignorados**
Valores vazios ou com apenas espaços são ignorados no fallback.

### **3. Ordem de Prioridade**
```
account_parameter > product_parameter > env variable > hard-coded default
```

### **4. Compatibilidade Total**
- ✅ Nenhum código existente foi quebrado
- ✅ Mantém suporte a nomes antigos via aliases
- ✅ Adiciona funcionalidade sem remover nada

---

## ✅ Status Atual

- ✅ **Implementação:** Completa
- ✅ **Documentação:** Completa
- ⏳ **Testes:** Pendente
- ⏳ **Deploy:** Pendente

---

## 📞 Suporte

Em caso de dúvidas:
1. Verificar logs no CloudWatch
2. Confirmar `product_id` em `account`
3. Verificar parâmetros em `product_parameter`
4. Consultar documentação completa: `PARAMETER_FALLBACK_SYSTEM.md`

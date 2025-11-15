# Changelog - Evolution Onboarding

## Modificações Implementadas

### 1. **Ordenação de Parâmetros**

#### `account-parameter-service.js`
- ✅ `getAllAccountParameters()` agora ordena alfabeticamente por:
  1. `short_description` (ASC, nulls last)
  2. `name` (ASC)

#### `product-parameter-service.js`
- ✅ `getAllProductParameters()` agora ordena alfabeticamente por:
  1. `short_description` (ASC, nulls last)
  2. `name` (ASC)

**Antes:**
```javascript
.orderBy('created_at', 'desc')
```

**Depois:**
```javascript
.orderBy([
  { column: 'short_description', order: 'asc', nulls: 'last' },
  { column: 'name', order: 'asc' }
])
```

---

### 2. **Criação de Parâmetros via Tabelas Standard**

#### `create-product.js`
Mudança na lógica de seed de parâmetros:

**Antes:**
- Buscava `DISTINCT name` da tabela `product_parameter`
- Criava com `value = ''` e apenas o campo `name`

**Depois:**
- Busca de `product_parameters_standard`
- Cria com todos os campos: `name`, `value`, `short_description`, `help_text`, `default_value`
- Usa `default_value` da tabela standard como valor inicial

```javascript
const standardParams = await knex('product_parameters_standard')
  .select('name', 'short_description', 'help_text', 'default_value')
  .orderBy('name', 'asc');

const seedRows = standardParams.map(param => ({
  name: param.name,
  value: param.default_value || '',
  product_id: newProduct.id,
  short_description: param.short_description,
  help_text: param.help_text,
  default_value: param.default_value
}));
```

#### `create-account.js`
Mudança na lógica de seed de parâmetros:

**Antes:**
- Buscava `DISTINCT name` da tabela `account_parameter`
- Criava com `value = ''` e apenas o campo `name`

**Depois:**
- Busca de `account_parameters_standard`
- Cria com todos os campos: `name`, `value`, `short_description`, `help_text`, `default_value`
- Usa `default_value` da tabela standard como valor inicial

```javascript
const standardParams = await knex('account_parameters_standard')
  .select('name', 'short_description', 'help_text', 'default_value')
  .orderBy('name', 'asc');

const seedRows = standardParams.map(param => ({
  name: param.name,
  value: param.default_value || '',
  account_id: created.id,
  short_description: param.short_description,
  help_text: param.help_text,
  default_value: param.default_value
}));
```

---

## Benefícios

### ✅ Ordenação Consistente
- Parâmetros agora aparecem em ordem alfabética por descrição
- Melhora UX para usuários que precisam encontrar parâmetros rapidamente
- Parâmetros sem descrição aparecem no final

### ✅ Centralização de Padrões
- Parâmetros agora são definidos centralmente nas tabelas `*_standard`
- Facilita manutenção: adicionar novo parâmetro = inserir na tabela standard
- Novos produtos/contas herdam automaticamente os padrões atualizados

### ✅ Metadados Completos
- Cada parâmetro agora tem `short_description`, `help_text` e `default_value`
- Frontend pode exibir tooltips e placeholders úteis
- Valores padrão podem ser pré-populados no onboarding

---

## Impacto em Produtos/Contas Existentes

### ⚠️ Produtos/Contas Criados ANTES desta mudança
- Terão apenas os campos `name` e `value` nos parâmetros
- Não terão `short_description`, `help_text`, `default_value`

### ✅ Produtos/Contas Criados DEPOIS desta mudança
- Terão todos os campos dos parâmetros preenchidos
- Herdarão automaticamente novos parâmetros quando forem adicionados à tabela standard

---

## Próximos Passos

1. ✅ Aplicar migration de seed (`20251114113300_seed_account_parameters_standard.js`)
2. ✅ Deploy da API SaaS
3. ⏳ Considerar script de migração para atualizar parâmetros existentes (opcional)
4. ⏳ Testes E2E do fluxo de onboarding

---

## Script de Migração de Dados (Opcional)

Se quiser atualizar produtos/contas existentes com os novos campos:

```sql
-- Atualizar account_parameter com dados de account_parameters_standard
UPDATE account_parameter ap
SET 
  short_description = aps.short_description,
  help_text = aps.help_text,
  default_value = aps.default_value
FROM account_parameters_standard aps
WHERE ap.name = aps.name
  AND (ap.short_description IS NULL OR ap.help_text IS NULL);

-- Atualizar product_parameter com dados de product_parameters_standard
UPDATE product_parameter pp
SET 
  short_description = pps.short_description,
  help_text = pps.help_text,
  default_value = pps.default_value
FROM product_parameters_standard pps
WHERE pp.name = pps.name
  AND (pp.short_description IS NULL OR pp.help_text IS NULL);
```

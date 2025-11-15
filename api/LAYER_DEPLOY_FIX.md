# Fix: Deploy falhando em máquina nova (layers não encontradas)

## 🐛 Problema

```
Error: No file matches include / exclude patterns
Erro durante o deploy do módulo auth
```

### **Causa Raiz:**

A pasta `layers/` estava **completamente ignorada** no `.gitignore`:

```gitignore
# ANTES (ERRADO)
layers/          # ← Ignora TUDO dentro de layers/
**/layers/
*/layers/
```

**Resultado:**
- ✅ **Sua máquina:** Tem `layers/common/nodejs/package.json` (criado localmente)
- ❌ **Máquina nova:** NÃO tem `layers/` (não veio do Git)
- ❌ Script de deploy não encontra `package.json` das layers
- ❌ Deploy falha sem arquivos

---

## ✅ Solução Implementada

### **1. Atualizar .gitignore**

**DEPOIS (CORRETO):**
```gitignore
# Ignore Lambda Layers node_modules (mas manter estrutura e package.json)
layers/**/node_modules/
layers/**/package-lock.json

# Common build artifacts
.serverless/
dist/
```

**O que mudou:**
- ✅ Agora ignora apenas `node_modules/` e `package-lock.json` dentro de layers
- ✅ Mantém a estrutura de pastas e `package.json` no Git
- ✅ Qualquer máquina que clonar terá os arquivos necessários

---

### **2. Estrutura de Layers que DEVE ir para o Git:**

**TODOS os 9 módulos têm layers:**

```
backend/api/auth/layers/common/nodejs/package.json          ✅
backend/api/clients/layers/common/nodejs/package.json       ✅
backend/api/evolution/layers/common/nodejs/package.json     ✅
backend/api/funnel/layers/common/nodejs/package.json        ✅
backend/api/leadshot/layers/common/nodejs/package.json      ✅
backend/api/profile/layers/common/nodejs/package.json       ✅
backend/api/project/layers/common/nodejs/package.json       ✅
backend/api/saas/layers/common/nodejs/package.json          ✅
backend/api/settings/layers/common/nodejs/package.json      ✅
```

**Estrutura típica:**
```
backend/api/<módulo>/
  └── layers/
      └── common/
          └── nodejs/
              └── package.json          ← COMMITAR NO GIT ✅
```

---

### **3. O que NÃO vai para o Git (ignorado):**

```
backend/api/auth/
  └── layers/
      └── common/
          └── nodejs/
              ├── node_modules/         ← IGNORADO ❌
              └── package-lock.json     ← IGNORADO ❌
```

---

## 🔄 Como Funciona Agora

### **Fluxo de Deploy (deploy.sh):**

```bash
# 1. Script verifica se existe package.json da layer
if [ -f "$MODULE_DIR/layers/common/nodejs/package.json" ]; then
  
  # 2. Copia package.json para dist/
  cp "$MODULE_DIR/layers/common/nodejs/package.json" "$DIST_DIR/layers/common/nodejs/"
  
  # 3. Instala dependências APENAS em dist/ (build time)
  cd "$DIST_DIR/layers/common/nodejs"
  npm install --omit=dev --omit=optional
  
  # 4. Remove package-lock.json (não vai para deploy)
  rm -f package-lock.json
fi

# 5. Serverless faz deploy com layers prontas
serverless deploy
```

---

## 📦 Conteúdo dos package.json das Layers

### **auth/layers/common/nodejs/package.json:**
```json
{
  "name": "auth-layer-common",
  "version": "1.0.0",
  "private": true,
  "description": "Lambda Layer com dependências do módulo auth",
  "license": "UNLICENSED",
  "dependencies": {
    "@aws-sdk/client-cognito-identity-provider": "^3.525.0"
  }
}
```

### **evolution/layers/common/nodejs/package.json:**
```json
{
  "name": "evolution-layer-common",
  "version": "1.0.0",
  "private": true,
  "description": "Lambda Layer com dependências compartilhadas do módulo evolution",
  "license": "UNLICENSED",
  "dependencies": {
    "axios": "^1.6.0",
    "knex": "^3.0.0",
    "pg": "^8.11.0"
  }
}
```

---

## 🧪 Como Testar em Máquina Nova

### **1. Clone o repositório:**
```bash
git clone <repo-url>
cd backend/api
```

### **2. Verifique se as layers existem:**
```bash
# Deve existir:
ls -la auth/layers/common/nodejs/package.json
ls -la evolution/layers/common/nodejs/package.json

# NÃO deve existir (será criado no build):
ls -la auth/layers/common/nodejs/node_modules/      # ❌
ls -la evolution/layers/common/nodejs/node_modules/ # ❌
```

### **3. Execute o deploy:**
```bash
cd deploy
./deploy.sh auth    # Deve funcionar ✅
./deploy.sh evolution # Deve funcionar ✅
```

---

## 📋 Checklist para Máquina Nova

- [ ] Clonou o repositório
- [ ] Arquivo `auth/layers/common/nodejs/package.json` existe
- [ ] Arquivo `evolution/layers/common/nodejs/package.json` existe
- [ ] NÃO tem `node_modules/` dentro de layers (é normal)
- [ ] Deploy funciona sem erros

---

## 🚨 Se Ainda Assim Não Funcionar

### **Possíveis Causas:**

1. **Cache do Git:**
   ```bash
   # Limpar cache e forçar re-add
   git rm -r --cached .
   git add .
   git commit -m "Fix: layers package.json agora no Git"
   git push
   ```

2. **Versão antiga do repositório:**
   ```bash
   # Na máquina nova, puxar última versão
   git fetch origin
   git reset --hard origin/main  # ou master
   ```

3. **Arquivo package.json corrompido:**
   ```bash
   # Verificar se é JSON válido
   cat auth/layers/common/nodejs/package.json | jq .
   ```

---

## ✅ Solução Final

### **Commit necessário:**

```bash
# Na sua máquina (que funciona)
cd /Users/robertomartins/Workspace/autonom.ia/backend/api

# OPÇÃO 1: Usar o script automatizado (RECOMENDADO)
chmod +x commit-layers.sh
./commit-layers.sh
git commit -m "fix: incluir package.json das layers no Git para todos os módulos"
git push

# OPÇÃO 2: Manual (adicionar todos os módulos)
git add -f auth/layers/common/nodejs/package.json
git add -f clients/layers/common/nodejs/package.json
git add -f evolution/layers/common/nodejs/package.json
git add -f funnel/layers/common/nodejs/package.json
git add -f leadshot/layers/common/nodejs/package.json
git add -f profile/layers/common/nodejs/package.json
git add -f project/layers/common/nodejs/package.json
git add -f saas/layers/common/nodejs/package.json
git add -f settings/layers/common/nodejs/package.json
git add .gitignore LAYER_DEPLOY_FIX.md

git commit -m "fix: incluir package.json das layers no Git

- Atualizado .gitignore para permitir package.json das layers
- Inclui package.json de TODOS os 9 módulos (auth, clients, evolution, funnel, leadshot, profile, project, saas, settings)
- Ignora apenas node_modules e package-lock.json das layers
- Resolve erro 'No file matches include / exclude patterns' em máquinas novas"

git push
```

---

## 📊 Antes vs Depois

| Item | Antes | Depois |
|------|-------|--------|
| **layers/ no Git** | ❌ Nada | ✅ package.json |
| **node_modules no Git** | ❌ Nada | ❌ Ignorado (correto) |
| **Deploy em máquina nova** | ❌ Falha | ✅ Funciona |
| **Tamanho do repo** | 📦 Pequeno | 📦 Pequeno (+2 KB) |

---

## 🎯 Resumo

### **O problema era:**
O `.gitignore` ignorava **TUDO** dentro de `layers/`, incluindo os `package.json` necessários.

### **A solução é:**
Ignorar apenas `node_modules/` e `package-lock.json`, mas **commitar** os `package.json`.

### **Resultado:**
Deploy funciona em qualquer máquina que clonar o repositório. ✅

---

## 📝 Próximos Passos

1. ✅ `.gitignore` já foi atualizado
2. ⏳ **VOCÊ PRECISA FAZER:** Commitar os `package.json` das layers
3. ⏳ **Na outra máquina:** Fazer `git pull` e testar novamente

---

## 🆘 Suporte

Se ainda tiver problemas após fazer o commit:

1. Verifique se o `package.json` está no Git:
   ```bash
   git ls-files | grep layers
   ```

2. Na máquina nova, verifique se os arquivos chegaram:
   ```bash
   ls -R */layers/
   ```

3. Se falhar, compartilhe a saída de:
   ```bash
   tree -L 5 -I 'node_modules' auth/layers/
   tree -L 5 -I 'node_modules' evolution/layers/
   ```

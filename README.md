# 🚀 Projeto Autonomia - Backend SaaS

Sistema completo de backend para a plataforma Autonomia, incluindo APIs de autenticação, campanhas, templates e importação de contatos.

## ⚡ Quick Start

```bash
# Iniciar projeto completo (1 comando)
npm run quick-start
```

Isso irá iniciar:
- 🐘 PostgreSQL (Docker)
- 🔐 Backend Auth (porta 3003)
- 🚀 Backend SaaS (porta 3001)
- ⚛️ Frontend React (porta 3000)

## 🌐 URLs Disponíveis

- **Frontend**: http://localhost:3000
- **API SaaS**: http://localhost:3001
- **API Auth**: http://localhost:3003
- **PostgreSQL**: localhost:5432

## 📋 Comandos Principais

### **Iniciar Projeto**
```bash
npm run quick-start     # ⚡ Início rápido (~20s)
npm run start-all       # 🔍 Início completo com logs
npm run start-project   # 🖥️ Multiplataforma (Node.js)
```

### **Testar APIs**
```bash
npm run validate        # ✅ Validar ambiente completo
npm run test-auth       # 🔐 Testar login
npm run test-accounts   # 👥 Testar contas
npm run test-campaigns  # 🎯 Testar campanhas
```

### **Desenvolvimento**
```bash
npm run start-saas      # 🚀 Apenas Backend SaaS
npm run start-auth      # 🔐 Apenas Backend Auth
npm run populate-accounts # 📊 Popular contas de teste
npm run monitor         # 🔍 Monitor de requisições
```

## 🏗️ Estrutura do Projeto

```
backend-saas/
├── api/
│   ├── auth/                    # Backend de autenticação
│   └── saas/                    # Backend principal
├── frontend-saas/               # Frontend React
├── shared/
│   └── migrations/              # Migrações do banco
├── start-project.js             # Script completo (Node.js)
├── dev.bat                      # Script rápido (Windows)
├── start-project.bat            # Script completo (Windows)
└── package.json
```

## 🌟 Funcionalidades

### **Backend SaaS (Porta 3001)**
- ✅ **Produtos**: CRUD completo
- ✅ **Contas**: 5 contas de teste disponíveis
- ✅ **Campanhas**: Criar e listar campanhas
- ✅ **Templates**: Templates de mensagem
- ✅ **Contatos**: Sistema completo de importação CSV/XLSX
- ✅ **Integração N8N**: Disparo automatizado de mensagens

### **Backend Auth (Porta 3003)**
- ✅ **Login**: Mock auth para desenvolvimento
- ✅ **Registro**: Criação de usuários
- ✅ **CORS**: Configurado para localhost:3000

### **Banco PostgreSQL**
- ✅ **Docker**: Container automatizado
- ✅ **Migrações**: Executadas automaticamente
- ✅ **Dados**: Usuário admin e contas de teste

## 🧪 Dados de Teste

### **Login (qualquer senha funciona)**
```javascript
{
  "email": "adfelipevs@gmail.com",
  "password": "qualquer-senha"
}
```

### **Contas Disponíveis**
1. **Digital Marketing Pro** - `1998cdb1-7f76-4d1e-a819-de760868baa7`
2. **Empresa ABC Ltda** - `115b8d62-4ebb-49e1-a8fc-331f25d0d496`
3. **Tech Solutions EIRELI** - `7e1d4c7b-a2de-444d-b5d2-caedea1f18d9`
4. **Consultoria XYZ S/A** - `dd558d05-72f3-4130-a108-f4609ea91cad`
5. **E-commerce Plus Ltda** - `be685b8e-fa25-450b-b86e-a548109e85ab`

## 📝 Endpoints Principais

### **Autenticação**
```bash
POST http://localhost:3003/login
POST http://localhost:3003/register
```

### **SaaS**
```bash
GET  http://localhost:3001/Autonomia/Saas/Products
GET  http://localhost:3001/Autonomia/Saas/Accounts?productId={id}
POST http://localhost:3001/Autonomia/Saas/Campaigns
POST http://localhost:3001/Autonomia/Saas/TemplateMessages
```

### **Headers Obrigatórios (Desenvolvimento)**
```javascript
{
  'X-Dev-Email': 'adfelipevs@gmail.com',
  'Content-Type': 'application/json',
  'Origin': 'http://localhost:3000'
}
```

## 🔧 Pré-requisitos

- **Docker Desktop** (para PostgreSQL)
- **Node.js** 18+
- **npm**

## 🚨 Troubleshooting

### **Porta em uso**
```bash
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### **Docker não rodando**
```bash
docker --version
# Iniciar Docker Desktop
```

### **Dependências**
```bash
cd api/auth && npm install
cd ../saas && npm install
cd ../../frontend-saas && npm install
```

## 📚 Documentação Adicional

- **[INICIAR-PROJETO-COMPLETO.md](INICIAR-PROJETO-COMPLETO.md)** - Guia detalhado
- **[QUICK-START.md](QUICK-START.md)** - Guia rápido
- **[TROUBLESHOOT-ACCOUNTS.md](TROUBLESHOOT-ACCOUNTS.md)** - Debug de contas
- **[CONFIGURAR-FRONTEND-URLS.md](CONFIGURAR-FRONTEND-URLS.md)** - URLs do frontend

## 🎯 Fluxo de Desenvolvimento

1. **Iniciar**: `npm run quick-start`
2. **Desenvolver**: Código no frontend/backend
3. **Testar**: `npm run validate`
4. **Debug**: `npm run monitor`

## 🏆 Status do Projeto

```
✅ PostgreSQL: Funcionando
✅ Backend Auth: Funcionando  
✅ Backend SaaS: Funcionando
✅ Frontend: Pronto para conectar
✅ CORS: Configurado
✅ Dados: Populados
✅ Testes: Automatizados
```

---

## 🚀 **Para Começar Agora**

```bash
# Clone o projeto
git clone <repo-url>
cd backend-saas

# Instale dependências
npm install

# Inicie tudo
npm run quick-start

# Abra http://localhost:3000
```

**🎉 Pronto! Todo o ambiente estará rodando em ~20 segundos!**

---

*Projeto Autonomia - Backend SaaS v1.0*

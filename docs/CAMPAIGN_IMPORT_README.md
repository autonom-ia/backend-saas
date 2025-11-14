# Sistema de Importação de Contatos para Campanhas

Este sistema permite importar contatos de arquivos CSV/XLSX para campanhas existentes, com validação, normalização e disparo automático de mensagens via n8n.

## Estrutura Implementada

### Tabelas
- **contact**: Armazena contatos das campanhas
- **campaign**: Campanhas existentes
- **template_message**: Templates de mensagem
- **message_logs**: Logs de envio de mensagens

### Arquivos Criados

#### Migrations
- `20251003000001_create_contact_table.js`: Criação da tabela contact

#### Utils
- `phone-normalizer.js`: Normalização de telefones para formato E.164
- `cpf-validator.js`: Validação de CPF brasileiro
- `file-parser.js`: Parser de arquivos CSV/XLSX

#### Services
- `campaign-import-service.js`: Lógica de negócio para importação

#### Handlers
- `upload-campaign-contacts.js`: Upload de arquivos de contatos
- `list-campaign-contacts.js`: Listagem de contatos
- `update-contact-status.js`: Atualização de status
- `send-campaign-messages.js`: Envio de mensagens
- `n8n-webhook.js`: Webhook para callbacks do n8n

## Endpoints Disponíveis

### 1. Upload de Contatos
**POST** `/Autonomia/Saas/Campaigns/{campaignId}/contacts/upload`

**Headers:**
- `Content-Type: multipart/form-data`
- `Authorization: Bearer {token}`

**Form Data:**
- `file`: Arquivo CSV ou XLSX
- `accountId`: ID da conta
- `sendMessages`: true/false (opcional)

### 2. Listar Contatos
**GET** `/Autonomia/Saas/Campaigns/{campaignId}/contacts`

**Query Parameters:**
- `status`: pending, sent, delivered, failed (opcional)
- `limit`: Limite de resultados (opcional)
- `offset`: Offset para paginação (opcional)

### 3. Atualizar Status
**PUT** `/Autonomia/Saas/Contacts/{contactId}/status`

**Body:**
```json
{
  "status": "delivered",
  "external_code": "msg_123456"
}
```

### 4. Enviar Mensagens
**POST** `/Autonomia/Saas/Campaigns/{campaignId}/send`

**Query Parameters:**
- `status`: Filtrar por status (opcional, padrão: pending)
- `limit`: Limite de contatos (opcional)

### 5. Webhook N8N
**POST** `/Autonomia/Saas/Webhooks/n8n`

**Body:**
```json
{
  "action": "status_update",
  "contact_id": "uuid",
  "status": "delivered",
  "external_code": "msg_123456",
  "phone": "+5511999999999",
  "campaign_id": "uuid"
}
```

## Formato dos Arquivos

### CSV
```csv
nome,telefone,cpf,email,empresa
João Silva,11999999999,12345678901,joao@email.com,Empresa XYZ
```

### XLSX
Colunas suportadas:
- **nome** ou **name**: Nome do contato (obrigatório)
- **telefone**, **phone**, **celular** ou **whatsapp**: Telefone (obrigatório)
- **cpf**, **documento** ou **doc**: CPF (obrigatório)
- Outras colunas são salvas em `contact_data`

## Validações

1. **Nome**: Obrigatório, não pode estar vazio
2. **Telefone**: Obrigatório, normalizado para E.164
3. **CPF**: Obrigatório, validação de algoritmo brasileiro
4. **Duplicatas**: Não permite mesmo telefone na mesma campanha

## Status dos Contatos

- `pending`: Aguardando envio
- `processing`: Sendo processado pelo n8n
- `sent`: Mensagem enviada
- `delivered`: Mensagem entregue
- `failed`: Falha no envio
- `read`: Mensagem lida

## Configuração

### Variáveis de Ambiente
```bash
N8N_WEBHOOK_URL=https://auto.autonomia.site/workflow/AEuLu99AOhpofmhJ
```

### Dependências Adicionadas
- axios: Requisições HTTP para n8n
- csv-parser: Parse de arquivos CSV
- libphonenumber-js: Normalização de telefones
- multer: Upload de arquivos
- xlsx: Parse de arquivos Excel

## Instalação

1. Execute a migration:
```bash
npm run migrate
```

2. Instale as dependências:
```bash
npm install
```

3. Configure a variável de ambiente `N8N_WEBHOOK_URL`

## Uso

1. **Importar contatos**: Faça upload de um arquivo CSV/XLSX
2. **Listar contatos**: Visualize os contatos importados
3. **Enviar mensagens**: Dispare mensagens via n8n
4. **Acompanhar status**: Use o webhook para receber atualizações

## Limites

- Tamanho máximo do arquivo: 10MB
- Formatos suportados: CSV, XLSX, XLS
- Timeout para upload: 60 segundos

## Logs

Todos os envios são registrados na tabela `message_logs` com:
- Telefone
- Status de sucesso/falha
- Mensagem de erro (se houver)
- ID da campanha

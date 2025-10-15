# Importação de Contatos para Campanhas

## Visão Geral

Sistema completo de importação de planilhas (CSV/XLSX) para campanhas, com validação, normalização de dados e disparo automatizado de mensagens via workflow n8n.

## Funcionalidades Implementadas

### Frontend
- **Botão "Importar CSV"** na linha de cada campanha
- **Modal de upload** com interface intuitiva
- **Validação de arquivos** (CSV, XLSX, XLS)
- **Opção de envio automático** de mensagens após importação
- **Feedback detalhado** do resultado da importação
- **Exibição de erros** de validação por linha

### Backend
- **Endpoints REST** para upload e gerenciamento de contatos
- **Validação e normalização** de telefones (formato E.164)
- **Validação de CPF** brasileiro
- **Prevenção de duplicatas** na mesma campanha
- **Integração com n8n** para disparo de mensagens
- **Logs de mensagens** para auditoria

## Endpoints Disponíveis

### 1. Upload de Contatos
```
POST /Autonomia/Saas/Campaigns/{campaignId}/contacts/upload
```

**Headers:**
- `Authorization: Bearer {token}` (produção)
- `X-Dev-Email: adfelipevs@gmail.com` (desenvolvimento)

**Body (multipart/form-data):**
- `file`: Arquivo CSV/XLSX
- `accountId`: ID da conta
- `sendMessages`: "true" ou "false" (opcional)

**Resposta:**
```json
{
  "success": true,
  "message": "Importação concluída. 150 contatos salvos.",
  "totalProcessed": 152,
  "totalSaved": 150,
  "totalDuplicates": 2,
  "validationErrors": [],
  "duplicates": [...]
}
```

### 2. Listar Contatos da Campanha
```
GET /Autonomia/Saas/Campaigns/{campaignId}/contacts?status=pending&limit=50&offset=0
```

### 3. Atualizar Status do Contato
```
PUT /Autonomia/Saas/Contacts/{contactId}/status
```

## Formato do Arquivo

### Colunas Obrigatórias
- **nome**: Nome completo do contato
- **telefone**: Número com DDD (ex: 11999999999)
- **cpf**: CPF válido (com ou sem formatação)

### Colunas Opcionais
Qualquer coluna adicional será salva em `contact_data` como dados extras.

### Exemplo de CSV
```csv
nome,telefone,cpf,email,empresa,cidade
João Silva,11999999999,12345678901,joao@email.com,Empresa XYZ,São Paulo
Maria Santos,11888888888,98765432100,maria@email.com,Empresa ABC,Rio de Janeiro
```

## Validações Aplicadas

### Telefone
- Normalização para formato E.164 (+5511999999999)
- Validação de formato brasileiro
- Remoção de caracteres especiais

### CPF
- Validação do algoritmo de dígitos verificadores
- Aceita formato com ou sem pontuação
- Armazenamento apenas dos números

### Duplicatas
- Verificação por telefone dentro da mesma campanha
- Contatos duplicados são reportados mas não impedem a importação

## Integração com n8n

### Workflow de Disparo
- **URL**: `https://auto.autonomia.site/workflow/AEuLu99AOhpofmhJ`
- **Método**: POST
- **Payload**:
```json
{
  "action": "send",
  "campaign": {
    "id": "campaign_id",
    "name": "Nome da Campanha",
    "message_text": "Texto do template"
  },
  "contacts": [
    {
      "id": "contact_id",
      "name": "Nome do Contato",
      "phone": "+5511999999999",
      "contact_data": {...}
    }
  ],
  "account_id": "account_id"
}
```

### Status dos Contatos
- **pending**: Aguardando envio
- **processing**: Enviado para n8n
- **sent**: Mensagem enviada com sucesso
- **delivered**: Mensagem entregue
- **failed**: Falha no envio

## Configuração Local

### Backend (serverless.local.yml)
```yaml
uploadCampaignContacts:
  handler: handlers/upload-campaign-contacts.handler
  timeout: 60
  events:
    - http:
        path: Autonomia/Saas/Campaigns/{campaignId}/contacts/upload
        method: post
        cors: true
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_LEADSHOT_API_URL=http://localhost:3001
NEXT_PUBLIC_DEV_EMAIL=adfelipevs@gmail.com
```

## Dependências

### Backend
- `axios`: Requisições HTTP para n8n
- `csv-parser`: Parse de arquivos CSV
- `libphonenumber-js`: Normalização de telefones
- `xlsx`: Parse de arquivos Excel

### Frontend
- Componentes UI existentes (Button, Modal)
- Ícones Lucide React (Upload, Eye, etc.)

## Logs e Auditoria

### Tabela message_logs
Registra todas as tentativas de envio:
```sql
CREATE TABLE message_logs (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20),
  success BOOLEAN,
  error TEXT,
  campaign_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Tratamento de Erros

### Validação de Arquivo
- Tipos permitidos: CSV, XLSX, XLS
- Tamanho máximo: 10MB
- Encoding: UTF-8

### Erros de Validação
- Reportados por linha com detalhes específicos
- Não impedem o processamento de linhas válidas
- Exibidos no modal de resultado

### Falhas de Rede
- Timeout configurável (60s para upload)
- Retry automático para n8n (configurável)
- Logs detalhados para debugging

## Como Usar

1. **Acesse a página de Campanhas**
2. **Clique em "Importar CSV"** na campanha desejada
3. **Selecione o arquivo** CSV ou XLSX
4. **Marque a opção** "Enviar mensagens automaticamente" se desejar
5. **Clique em "Importar"** e aguarde o processamento
6. **Visualize o resultado** com estatísticas e erros (se houver)

## Troubleshooting

### Erro de CORS
Verifique se o CORS está configurado para localhost:3000 no backend.

### Erro de Autenticação
Certifique-se de que o header `X-Dev-Email` está configurado no ambiente local.

### Arquivo não aceito
Verifique se o arquivo está em formato CSV ou XLSX válido.

### Telefones inválidos
Certifique-se de que os telefones estão no formato brasileiro com DDD.

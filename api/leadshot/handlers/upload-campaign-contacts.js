const fs = require('fs');
const path = require('path');
const { 
  getCampaignById, 
  processContactFile, 
  validateAndNormalizeContact, 
  saveContacts,
  sendCampaignMessages
} = require('../services/campaign-import-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Valida se o arquivo é do tipo permitido
 * @param {string} filename - Nome do arquivo
 * @param {string} mimetype - Tipo MIME
 * @returns {boolean}
 */
const isValidFileType = (filename, mimetype) => {
  const allowedMimes = [
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  
  const allowedExtensions = ['.csv', '.xlsx', '.xls'];
  
  return allowedMimes.includes(mimetype) || 
         allowedExtensions.some(ext => filename.toLowerCase().endsWith(ext));
};

/**
 * Handler para upload de contatos de campanha
 */
const uploadContactsHandler = withCors(async (event, context) => {
  try {
    const campaignId = event.pathParameters?.campaignId;
    
    if (!campaignId) {
      return errorResponse({ 
        success: false, 
        message: 'ID da campanha é obrigatório' 
      }, 400, event);
    }

    // Parse do body multipart/form-data
    const body = event.body;
    const boundary = event.headers['content-type']?.split('boundary=')[1];
    
    if (!body || !boundary) {
      return errorResponse({ 
        success: false, 
        message: 'Arquivo não enviado' 
      }, 400, event);
    }

    // Extrair dados do form-data
    const formData = parseMultipartFormData(body, boundary);
    
    if (!formData.file) {
      return errorResponse({ 
        success: false, 
        message: 'Arquivo é obrigatório' 
      }, 400, event);
    }

    // Validar tipo de arquivo
    if (!isValidFileType(formData.file.filename, formData.file.mimetype)) {
      return errorResponse({ 
        success: false, 
        message: 'Formato de arquivo não suportado. Use CSV ou XLSX.' 
      }, 400, event);
    }

    const accountId = formData.accountId;
    const sendMessages = formData.sendMessages === 'true';

    if (!accountId) {
      return errorResponse({ 
        success: false, 
        message: 'ID da conta é obrigatório' 
      }, 400, event);
    }

    // Verificar se a campanha existe e pertence à conta
    const campaign = await getCampaignById(campaignId, accountId);

    // Salvar arquivo temporário
    const tempFilePath = `/tmp/${Date.now()}_${formData.file.filename}`;
    fs.writeFileSync(tempFilePath, formData.file.content);

    try {
      // Processar arquivo
      const parsed = await processContactFile(tempFilePath, formData.file.mimetype);
      
      // Validar e normalizar contatos
      const validatedContacts = [];
      const validationErrors = [];

      parsed.data.forEach((row, index) => {
        const lineNumber = index + 2; // +2 porque index começa em 0 e linha 1 é header
        const validation = validateAndNormalizeContact(row, parsed.mapping, lineNumber);
        
        if (validation.isValid) {
          validatedContacts.push(validation);
        } else {
          validationErrors.push({
            lineNumber,
            errors: validation.errors
          });
        }
      });

      if (validatedContacts.length === 0) {
        return errorResponse({ 
          success: false, 
          message: 'Nenhum contato válido encontrado',
          validationErrors
        }, 400, event);
      }

      // Salvar contatos no banco
      const saveResult = await saveContacts(validatedContacts, campaignId, accountId);
      
      // Combinar erros de validação
      const allErrors = [
        ...validationErrors,
        ...saveResult.validationErrors
      ];

      let response = {
        success: true,
        message: `Importação concluída. ${saveResult.totalSaved} contatos salvos.`,
        totalProcessed: saveResult.totalProcessed,
        totalSaved: saveResult.totalSaved,
        totalDuplicates: saveResult.totalDuplicates,
        validationErrors: allErrors,
        duplicates: saveResult.duplicates
      };

      // Se solicitado, enviar mensagens imediatamente
      if (sendMessages && saveResult.totalSaved > 0) {
        try {
          const sendResult = await sendCampaignMessages(campaignId, { status: 'pending' });
          response.messagesSent = sendResult.totalContacts;
          response.message += ` ${sendResult.totalContacts} mensagens enviadas para processamento.`;
        } catch (sendError) {
          console.error('Erro ao enviar mensagens:', sendError.message);
          response.message += ' Erro ao enviar mensagens automaticamente.';
          response.sendError = sendError.message;
        }
      }

      return success(response, 200, event);

    } finally {
      // Limpar arquivo temporário
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }

  } catch (error) {
    console.error('Erro no upload de contatos:', error);
    
    return errorResponse({
      success: false,
      message: 'Erro ao processar upload de contatos',
      error: error.message
    }, 500, event);
  }
});

/**
 * Parse simples de multipart/form-data
 * @param {string} body - Body da requisição
 * @param {string} boundary - Boundary do multipart
 * @returns {Object} Dados parseados
 */
function parseMultipartFormData(body, boundary) {
  const result = {};
  const parts = body.split(`--${boundary}`);
  
  for (const part of parts) {
    if (part.includes('Content-Disposition')) {
      const lines = part.split('\r\n');
      const dispositionLine = lines.find(line => line.includes('Content-Disposition'));
      
      if (dispositionLine) {
        const nameMatch = dispositionLine.match(/name="([^"]+)"/);
        const filenameMatch = dispositionLine.match(/filename="([^"]+)"/);
        
        if (nameMatch) {
          const fieldName = nameMatch[1];
          
          if (filenameMatch) {
            // É um arquivo
            const filename = filenameMatch[1];
            const contentTypeIndex = lines.findIndex(line => line.includes('Content-Type'));
            const mimetype = contentTypeIndex >= 0 ? 
              lines[contentTypeIndex].split(':')[1].trim() : 
              'application/octet-stream';
            
            const contentStartIndex = lines.findIndex(line => line === '') + 1;
            const content = Buffer.from(lines.slice(contentStartIndex).join('\r\n'), 'binary');
            
            result[fieldName] = {
              filename,
              mimetype,
              content
            };
          } else {
            // É um campo de texto
            const contentStartIndex = lines.findIndex(line => line === '') + 1;
            const value = lines.slice(contentStartIndex).join('\r\n').trim();
            result[fieldName] = value;
          }
        }
      }
    }
  }
  
  return result;
}

module.exports = {
  handler: uploadContactsHandler
};

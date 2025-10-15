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

    console.log('Headers recebidos:', event.headers);
    console.log('Content-Type:', event.headers['content-type'] || event.headers['Content-Type']);

    // Parse do body multipart/form-data
    const body = event.body;
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    const boundary = contentType.split('boundary=')[1];
    
    if (!body) {
      return errorResponse({ 
        success: false, 
        message: 'Corpo da requisição vazio' 
      }, 400, event);
    }

    if (!boundary) {
      return errorResponse({ 
        success: false, 
        message: 'Boundary não encontrado no Content-Type' 
      }, 400, event);
    }

    // Extrair dados do form-data
    const formData = parseMultipartFormData(body, boundary);
    
    console.log('FormData parseado:', Object.keys(formData));
    
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
 * Parse robusto de multipart/form-data
 * @param {string} body - Body da requisição
 * @param {string} boundary - Boundary do multipart
 * @returns {Object} Dados parseados
 */
function parseMultipartFormData(body, boundary) {
  const result = {};
  
  try {
    // Converter body para Buffer se for string
    const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body, 'binary');
    
    // Dividir por boundary
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const parts = [];
    let start = 0;
    
    while (true) {
      const boundaryIndex = bodyBuffer.indexOf(boundaryBuffer, start);
      if (boundaryIndex === -1) break;
      
      if (start > 0) {
        parts.push(bodyBuffer.slice(start, boundaryIndex));
      }
      
      start = boundaryIndex + boundaryBuffer.length;
    }
    
    for (const part of parts) {
      const partStr = part.toString('binary');
      
      if (partStr.includes('Content-Disposition')) {
        const lines = partStr.split('\r\n');
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
              let mimetype = 'application/octet-stream';
              
              if (contentTypeIndex >= 0) {
                mimetype = lines[contentTypeIndex].split(':')[1].trim();
              } else if (filename.toLowerCase().endsWith('.csv')) {
                mimetype = 'text/csv';
              } else if (filename.toLowerCase().endsWith('.xlsx')) {
                mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
              }
              
              const emptyLineIndex = lines.findIndex(line => line === '');
              if (emptyLineIndex >= 0) {
                const contentLines = lines.slice(emptyLineIndex + 1);
                // Remover última linha vazia se existir
                if (contentLines[contentLines.length - 1] === '') {
                  contentLines.pop();
                }
                const contentStr = contentLines.join('\r\n');
                const content = Buffer.from(contentStr, 'binary');
                
                result[fieldName] = {
                  filename,
                  mimetype,
                  content
                };
              }
            } else {
              // É um campo de texto
              const emptyLineIndex = lines.findIndex(line => line === '');
              if (emptyLineIndex >= 0) {
                const value = lines.slice(emptyLineIndex + 1).join('\r\n').trim();
                result[fieldName] = value;
              }
            }
          }
        }
      }
    }
    
    console.log('Parsing resultado:', Object.keys(result));
    if (result.file) {
      console.log('Arquivo encontrado:', result.file.filename, result.file.mimetype, 'Tamanho:', result.file.content.length);
    }
    
  } catch (error) {
    console.error('Erro no parsing multipart:', error);
  }
  
  return result;
}

module.exports = {
  handler: uploadContactsHandler
};

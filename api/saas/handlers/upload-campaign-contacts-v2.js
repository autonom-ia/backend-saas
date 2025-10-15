const fs = require('fs');
const path = require('path');
const Busboy = require('busboy');
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
 * Parse multipart usando Busboy
 * @param {Object} event - Evento do Lambda
 * @returns {Promise<Object>} Dados parseados
 */
const parseMultipartWithBusboy = (event) => {
  return new Promise((resolve, reject) => {
    const result = {};
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];
    
    if (!contentType || !contentType.includes('multipart/form-data')) {
      reject(new Error('Content-Type deve ser multipart/form-data'));
      return;
    }

    const busboy = Busboy({ 
      headers: { 'content-type': contentType },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 1
      }
    });

    busboy.on('file', (fieldname, file, info) => {
      const { filename, mimeType } = info;
      console.log(`Arquivo recebido: ${filename}, tipo: ${mimeType}`);
      
      const chunks = [];
      
      file.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      file.on('end', () => {
        const content = Buffer.concat(chunks);
        result[fieldname] = {
          filename,
          mimetype: mimeType,
          content
        };
      });
    });

    busboy.on('field', (fieldname, value) => {
      result[fieldname] = value;
    });

    busboy.on('finish', () => {
      resolve(result);
    });

    busboy.on('error', (error) => {
      reject(error);
    });

    // Converter body para Buffer se necessário
    const bodyBuffer = Buffer.isBuffer(event.body) ? event.body : Buffer.from(event.body, 'binary');
    busboy.write(bodyBuffer);
    busboy.end();
  });
};

/**
 * Handler para upload de contatos de campanha usando Busboy
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

    // Parse do body multipart/form-data usando Busboy
    let formData;
    try {
      formData = await parseMultipartWithBusboy(event);
      console.log('FormData parseado:', Object.keys(formData));
    } catch (parseError) {
      console.error('Erro no parsing:', parseError);
      return errorResponse({ 
        success: false, 
        message: `Erro ao processar dados: ${parseError.message}` 
      }, 400, event);
    }
    
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
      
      console.log('Arquivo processado:', {
        headers: parsed.headers,
        mapping: parsed.mapping,
        totalRows: parsed.data.length
      });
      
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

module.exports = {
  handler: uploadContactsHandler
};

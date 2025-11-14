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
 * @returns {boolean}
 */
const isValidFileType = (filename) => {
  const allowedExtensions = ['.csv', '.xlsx', '.xls'];
  return allowedExtensions.some(ext => filename.toLowerCase().endsWith(ext));
};

/**
 * Handler para upload de contatos de campanha
 * Recebe JSON com arquivo em base64 (padrão do projeto)
 */
const uploadContactsHandler = withCors(async (event, context) => {
  try {
    console.log('[UPLOAD] Iniciando processo de upload de contatos');
    const campaignId = event.pathParameters?.campaignId;
    console.log('[UPLOAD] Campaign ID:', campaignId);
    
    if (!campaignId) {
      return errorResponse({ 
        success: false, 
        message: 'ID da campanha é obrigatório' 
      }, 400, event);
    }

    // Parse JSON body
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    console.log('[UPLOAD] Body recebido:', {
      hasFile: !!body?.file,
      filename: body?.filename,
      fileSize: body?.file?.length || 0,
      accountId: body?.accountId,
      sendMessages: body?.sendMessages
    });
    
    if (!body || !body.file || !body.filename) {
      return errorResponse({ 
        success: false, 
        message: 'Arquivo e nome do arquivo são obrigatórios' 
      }, 400, event);
    }

    const { file: base64Content, filename, accountId, sendMessages = false } = body;

    // Validar tipo de arquivo
    if (!isValidFileType(filename)) {
      return errorResponse({ 
        success: false, 
        message: 'Formato de arquivo não suportado. Use CSV, XLSX ou XLS.' 
      }, 400, event);
    }

    if (!accountId) {
      return errorResponse({ 
        success: false, 
        message: 'ID da conta é obrigatório' 
      }, 400, event);
    }

    // Verificar se a campanha existe e pertence à conta
    console.log('[UPLOAD] Verificando campanha:', { campaignId, accountId });
    const campaign = await getCampaignById(campaignId, accountId);
    console.log('[UPLOAD] Campanha encontrada:', campaign.name);

    // Decodificar base64 e salvar arquivo temporário
    console.log('[UPLOAD] Decodificando arquivo base64...');
    const fileBuffer = Buffer.from(base64Content, 'base64');
    console.log('[UPLOAD] Arquivo decodificado:', fileBuffer.length, 'bytes');
    const tempFilePath = `/tmp/${Date.now()}_${filename}`;
    fs.writeFileSync(tempFilePath, fileBuffer);
    console.log('[UPLOAD] Arquivo salvo em:', tempFilePath);

    try {
      // Determinar mimetype pelo filename
      const ext = filename.toLowerCase().split('.').pop();
      const mimetypeMap = {
        'csv': 'text/csv',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'xls': 'application/vnd.ms-excel'
      };
      const mimetype = mimetypeMap[ext] || 'application/octet-stream';
      
      // Processar arquivo
      console.log('[UPLOAD] Processando arquivo:', { mimetype, ext });
      const parsed = await processContactFile(tempFilePath, mimetype);
      console.log('[UPLOAD] Arquivo processado:', {
        totalRows: parsed.data.length,
        mapping: parsed.mapping,
        firstRow: parsed.data[0]
      });
      
      // Validar e normalizar contatos
      const validatedContacts = [];
      const validationErrors = [];

      console.log('[UPLOAD] Iniciando validação de', parsed.data.length, 'linhas');
      parsed.data.forEach((row, index) => {
        const lineNumber = index + 2; // +2 porque index começa em 0 e linha 1 é header
        const validation = validateAndNormalizeContact(row, parsed.mapping, lineNumber);
        
        if (index < 3) { // Log das primeiras 3 linhas
          console.log(`[UPLOAD] Linha ${lineNumber}:`, {
            raw: row,
            validation: {
              isValid: validation.isValid,
              errors: validation.errors,
              normalizedPhone: validation.normalizedPhone
            }
          });
        }
        
        if (validation.isValid) {
          validatedContacts.push(validation);
        } else {
          validationErrors.push({
            lineNumber,
            errors: validation.errors
          });
        }
      });
      console.log('[UPLOAD] Validação concluída:', {
        valid: validatedContacts.length,
        invalid: validationErrors.length
      });

      if (validatedContacts.length === 0) {
        return errorResponse({ 
          success: false, 
          message: 'Nenhum contato válido encontrado',
          validationErrors
        }, 400, event);
      }

      // Salvar contatos no banco
      console.log('[UPLOAD] Salvando', validatedContacts.length, 'contatos no banco...');
      const saveResult = await saveContacts(validatedContacts, campaignId, accountId);
      console.log('[UPLOAD] Resultado do salvamento:', saveResult);
      
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

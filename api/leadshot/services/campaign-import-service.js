const { getDbConnection } = require('../utils/database');
const { normalizePhone } = require('../utils/phone-normalizer');
const { validateCpf } = require('../utils/cpf-validator');
const { parseFile, validateRequiredColumns } = require('../utils/file-parser');
const axios = require('axios');

/**
 * Busca uma campanha pelo ID e verifica se pertence à conta
 * @param {string} campaignId - ID da campanha
 * @param {string} accountId - ID da conta
 * @returns {Promise<Object>} Campanha encontrada
 */
const getCampaignById = async (campaignId, accountId) => {
  const knex = getDbConnection();
  const campaign = await knex('campaign')
    .where({ id: campaignId, account_id: accountId })
    .first();
  
  if (!campaign) {
    throw new Error('Campanha não encontrada ou não pertence à conta');
  }
  
  return campaign;
};

/**
 * Busca template de mensagem da campanha
 * @param {string} templateMessageId - ID do template
 * @returns {Promise<Object>} Template encontrado
 */
const getTemplateMessage = async (templateMessageId) => {
  const knex = getDbConnection();
  const template = await knex('template_message')
    .where({ id: templateMessageId })
    .first();
  
  if (!template) {
    throw new Error('Template de mensagem não encontrado');
  }
  
  return template;
};

/**
 * Processa arquivo de contatos
 * @param {string} filePath - Caminho do arquivo
 * @param {string} mimeType - Tipo MIME do arquivo
 * @returns {Promise<Object>} Dados processados
 */
const processContactFile = async (filePath, mimeType) => {
  try {
    const parsed = await parseFile(filePath, mimeType);
    const validation = validateRequiredColumns(parsed.mapping);
    
    if (!validation.isValid) {
      throw new Error(`Colunas obrigatórias não encontradas: ${validation.errors.join(', ')}`);
    }

    return parsed;
  } catch (error) {
    throw new Error(`Erro ao processar arquivo: ${error.message}`);
  }
};

/**
 * Valida e normaliza dados de um contato
 * @param {Object} row - Linha de dados do arquivo
 * @param {Object} mapping - Mapeamento de colunas
 * @param {number} lineNumber - Número da linha (para logs)
 * @returns {Object} Dados validados e normalizados
 */
const validateAndNormalizeContact = (row, mapping, lineNumber) => {
  console.log(`[VALIDATE] Linha ${lineNumber} - Dados recebidos:`, {
    mappedColumns: Object.keys(mapping),
    rowColumns: Object.keys(row),
    rawData: row
  });

  const errors = [];
  const contact = {
    name: null,
    phone: null,
    cpf: null,
    contact_data: {}
  };

  // Validar nome
  const name = row[mapping.name]?.toString().trim();
  console.log(`[VALIDATE] Linha ${lineNumber} - Nome:`, { column: mapping.name, rawValue: row[mapping.name], trimmed: name });
  if (!name) {
    errors.push(`Nome é obrigatório`);
  } else {
    contact.name = name;
  }

  // Validar e normalizar telefone
  const phoneValue = row[mapping.phone]?.toString().trim();
  console.log(`[VALIDATE] Linha ${lineNumber} - Telefone:`, { column: mapping.phone, rawValue: row[mapping.phone], trimmed: phoneValue });
  if (!phoneValue) {
    errors.push(`Telefone é obrigatório`);
  } else {
    const phoneValidation = normalizePhone(phoneValue);
    console.log(`[VALIDATE] Linha ${lineNumber} - Validação telefone:`, phoneValidation);
    // Sempre manter o telefone informado no contato, independente do formato
    contact.phone = phoneValue;
    if (!phoneValidation.isValid) {
      errors.push(`Telefone inválido: ${phoneValidation.error}`);
    }
  }

  // Validar CPF (opcional: só se informado)
  const cpfValue = row[mapping.cpf]?.toString().trim();
  console.log(`[VALIDATE] Linha ${lineNumber} - CPF:`, { column: mapping.cpf, rawValue: row[mapping.cpf], trimmed: cpfValue });
  if (cpfValue) {
    const cpfValidation = validateCpf(cpfValue);
    console.log(`[VALIDATE] Linha ${lineNumber} - Validação CPF:`, cpfValidation);
    if (!cpfValidation.isValid) {
      errors.push(`CPF inválido: ${cpfValidation.error}`);
    } else {
      contact.cpf = cpfValidation.cleanCpf;
      contact.contact_data.cpf = cpfValidation.cleanCpf;
    }
  }

  // Adicionar outras colunas ao contact_data
  console.log(`[VALIDATE] Linha ${lineNumber} - Outras colunas:`, mapping.others);
  mapping.others.forEach(column => {
    const value = row[column]?.toString().trim();
    if (value) {
      contact.contact_data[column] = value;
    }
  });

  const canSave = !!(contact.name && contact.phone);

  console.log(`[VALIDATE] Linha ${lineNumber} - Resultado:`, {
    isValid: errors.length === 0,
    canSave,
    errors,
    contact
  });

  return {
    isValid: errors.length === 0,
    canSave,
    contact,
    errors,
    lineNumber,
    normalizedPhone: contact.phone
  };
};

/**
 * Salva contatos no banco de dados
 * @param {Array} contacts - Array de contatos validados
 * @param {string} campaignId - ID da campanha
 * @param {string} accountId - ID da conta
 * @returns {Promise<Object>} Resultado da operação
 */
const saveContacts = async (contacts, campaignId, accountId) => {
  const knex = getDbConnection();
  const results = {
    totalProcessed: contacts.length,
    totalSaved: 0,
    totalDuplicates: 0,
    validationErrors: [],
    duplicates: []
  };

  for (const contactData of contacts) {
    try {
      // Verificar se já existe contato com mesmo telefone na campanha
      const existingContact = await knex('contact')
        .where({ campaign_id: campaignId, phone: contactData.contact.phone })
        .first();

      if (existingContact) {
        results.totalDuplicates++;
        results.duplicates.push({
          phone: contactData.contact.phone,
          name: contactData.contact.name,
          lineNumber: contactData.lineNumber
        });
        continue;
      }

      // Definir status externo com base em erros de validação
      const hasValidationErrors = Array.isArray(contactData.errors) && contactData.errors.length > 0;

      // Inserir contato
      await knex('contact').insert({
        name: contactData.contact.name,
        phone: contactData.contact.phone,
        contact_data: JSON.stringify(contactData.contact.contact_data),
        campaign_id: campaignId,
        account_id: accountId,
        external_status: hasValidationErrors ? 'validation_failed' : 'pending'
      });

      results.totalSaved++;
    } catch (error) {
      results.validationErrors.push({
        lineNumber: contactData.lineNumber,
        error: error.message
      });
    }
  }

  return results;
};

/**
 * Lista contatos de uma campanha
 * @param {string} campaignId - ID da campanha
 * @param {Object} filters - Filtros opcionais
 * @returns {Promise<Object>} Lista de contatos
 */
const listCampaignContacts = async (campaignId, filters = {}) => {
  const knex = getDbConnection();
  
  let query = knex('contact')
    .where({ campaign_id: campaignId })
    .orderBy('created_at', 'desc');

  // Aplicar filtros
  if (filters.status) {
    query = query.where({ external_status: filters.status });
  }

  if (filters.limit) {
    query = query.limit(parseInt(filters.limit));
  }

  if (filters.offset) {
    query = query.offset(parseInt(filters.offset));
  }

  const contacts = await query;
  const total = await knex('contact')
    .where({ campaign_id: campaignId })
    .count('* as count')
    .first();

  return {
    data: contacts,
    total: parseInt(total.count)
  };
};

/**
 * Atualiza status de um contato
 * @param {string} contactId - ID do contato
 * @param {string} status - Novo status
 * @param {string} externalCode - Código externo opcional
 * @returns {Promise<Object>} Contato atualizado
 */
const updateContactStatus = async (contactId, status, externalCode = null) => {
  const knex = getDbConnection();
  
  const updateData = {
    external_status: status,
    updated_at: knex.fn.now()
  };

  if (externalCode) {
    updateData.external_code = externalCode;
  }

  const [updatedContact] = await knex('contact')
    .where({ id: contactId })
    .update(updateData)
    .returning('*');

  if (!updatedContact) {
    throw new Error('Contato não encontrado');
  }

  return updatedContact;
};

/**
 * Envia mensagens para contatos via n8n
 * @param {string} campaignId - ID da campanha
 * @param {Object} filters - Filtros para contatos
 * @returns {Promise<Object>} Resultado do envio
 */
const sendCampaignMessages = async (campaignId, filters = {}) => {
  const knex = getDbConnection();
  
  // Buscar campanha com template
  const campaign = await knex('campaign')
    .leftJoin('template_message', 'campaign.template_message_id', 'template_message.id')
    .where('campaign.id', campaignId)
    .select(
      'campaign.*',
      'template_message.message_text'
    )
    .first();

  if (!campaign) {
    throw new Error('Campanha não encontrada');
  }

  // Buscar contatos para envio
  let query = knex('contact')
    .where({ campaign_id: campaignId });

  if (filters.status) {
    query = query.where({ external_status: filters.status });
  } else {
    query = query.where({ external_status: 'pending' });
  }

  if (filters.limit) {
    query = query.limit(parseInt(filters.limit));
  }

  const contacts = await query;

  if (contacts.length === 0) {
    return {
      success: true,
      message: 'Nenhum contato encontrado para envio',
      totalContacts: 0,
      campaign: {
        id: campaign.id,
        name: campaign.name
      }
    };
  }

  // Preparar payload para n8n
  const payload = {
    action: 'send',
    campaign: {
      id: campaign.id,
      name: campaign.name,
      message_text: campaign.message_text
    },
    contacts: contacts.map(contact => ({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      contact_data: typeof contact.contact_data === 'string' 
        ? JSON.parse(contact.contact_data) 
        : contact.contact_data
    })),
    account_id: campaign.account_id
  };

  // Enviar para n8n
  const n8nUrl = process.env.N8N_WEBHOOK_URL || 'https://auto.autonomia.site/workflow/AEuLu99AOhpofmhJ';
  
  try {
    await axios.post(n8nUrl, payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Atualizar status dos contatos para 'processing'
    await knex('contact')
      .whereIn('id', contacts.map(c => c.id))
      .update({
        external_status: 'processing',
        updated_at: knex.fn.now()
      });

    return {
      success: true,
      message: 'Mensagens enviadas para processamento',
      totalContacts: contacts.length,
      campaign: {
        id: campaign.id,
        name: campaign.name
      }
    };
  } catch (error) {
    // Log do erro
    console.error('Erro ao enviar para n8n:', error.message);
    
    // Registrar erro nos logs
    await knex('message_logs').insert(
      contacts.map(contact => ({
        phone_number: contact.phone,
        success: false,
        error: `Erro ao enviar para n8n: ${error.message}`,
        campaign_id: campaignId
      }))
    );

    throw new Error(`Erro ao enviar mensagens: ${error.message}`);
  }
};

/**
 * Processa webhook do n8n
 * @param {Object} webhookData - Dados do webhook
 * @returns {Promise<Object>} Resultado do processamento
 */
const processN8nWebhook = async (webhookData) => {
  const knex = getDbConnection();
  
  try {
    const { action, contact_id, status, external_code, phone, campaign_id } = webhookData;

    if (action === 'status_update' && contact_id) {
      // Atualizar status do contato
      await updateContactStatus(contact_id, status, external_code);

      // Registrar log
      await knex('message_logs').insert({
        phone_number: phone,
        success: status === 'delivered' || status === 'sent',
        error: status === 'failed' ? 'Falha no envio' : null,
        campaign_id: campaign_id
      });

      return {
        success: true,
        message: 'Status atualizado com sucesso'
      };
    }

    return {
      success: false,
      message: 'Ação não reconhecida'
    };
  } catch (error) {
    console.error('Erro ao processar webhook n8n:', error.message);
    throw new Error(`Erro ao processar webhook: ${error.message}`);
  }
};

module.exports = {
  getCampaignById,
  getTemplateMessage,
  processContactFile,
  validateAndNormalizeContact,
  saveContacts,
  listCampaignContacts,
  updateContactStatus,
  sendCampaignMessages,
  processN8nWebhook
};

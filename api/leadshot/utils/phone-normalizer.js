const { parsePhoneNumber, isValidPhoneNumber } = require('libphonenumber-js');

/**
 * Normaliza um número de telefone para o formato E.164
 * @param {string} phone - Número de telefone
 * @param {string} defaultCountry - País padrão (default: BR)
 * @returns {Object} { isValid: boolean, normalizedPhone: string, error?: string }
 */
const normalizePhone = (phone, defaultCountry = 'BR') => {
  console.log('[PHONE-NORMALIZER] Input:', { phone, defaultCountry, type: typeof phone });
  
  try {
    if (!phone || typeof phone !== 'string') {
      console.log('[PHONE-NORMALIZER] Telefone inválido ou não string');
      return {
        isValid: false,
        normalizedPhone: null,
        error: 'Telefone é obrigatório'
      };
    }

    // Remove caracteres não numéricos exceto +
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    console.log('[PHONE-NORMALIZER] Telefone limpo:', cleanPhone);
    
    if (!cleanPhone) {
      console.log('[PHONE-NORMALIZER] Telefone vazio após limpeza');
      return {
        isValid: false,
        normalizedPhone: null,
        error: 'Telefone inválido'
      };
    }

    // Verifica se é um número válido
    const isValid = isValidPhoneNumber(cleanPhone, defaultCountry);
    console.log('[PHONE-NORMALIZER] Validação libphonenumber:', { cleanPhone, isValid });
    
    if (!isValid) {
      return {
        isValid: false,
        normalizedPhone: null,
        error: 'Número de telefone inválido'
      };
    }

    // Parse e normaliza
    const phoneNumber = parsePhoneNumber(cleanPhone, defaultCountry);
    const normalized = phoneNumber.format('E.164');
    console.log('[PHONE-NORMALIZER] Normalizado com sucesso:', normalized);
    
    return {
      isValid: true,
      normalizedPhone: normalized,
      error: null
    };
  } catch (error) {
    console.error('[PHONE-NORMALIZER] Erro:', error.message);
    return {
      isValid: false,
      normalizedPhone: null,
      error: `Erro ao normalizar telefone: ${error.message}`
    };
  }
};

/**
 * Valida se um telefone já está no formato E.164
 * @param {string} phone - Número de telefone
 * @returns {boolean}
 */
const isE164Format = (phone) => {
  return /^\+[1-9]\d{1,14}$/.test(phone);
};

module.exports = {
  normalizePhone,
  isE164Format
};

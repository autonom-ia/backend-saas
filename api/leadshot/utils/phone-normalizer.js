const { parsePhoneNumber, isValidPhoneNumber } = require('libphonenumber-js');

/**
 * Normaliza um número de telefone para o formato E.164
 * @param {string} phone - Número de telefone
 * @param {string} defaultCountry - País padrão (default: BR)
 * @returns {Object} { isValid: boolean, normalizedPhone: string, error?: string }
 */
const normalizePhone = (phone, defaultCountry = 'BR') => {
  try {
    if (!phone || typeof phone !== 'string') {
      return {
        isValid: false,
        normalizedPhone: null,
        error: 'Telefone é obrigatório'
      };
    }

    // Remove caracteres não numéricos exceto +
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    
    if (!cleanPhone) {
      return {
        isValid: false,
        normalizedPhone: null,
        error: 'Telefone inválido'
      };
    }

    // Verifica se é um número válido
    if (!isValidPhoneNumber(cleanPhone, defaultCountry)) {
      return {
        isValid: false,
        normalizedPhone: null,
        error: 'Número de telefone inválido'
      };
    }

    // Parse e normaliza
    const phoneNumber = parsePhoneNumber(cleanPhone, defaultCountry);
    
    return {
      isValid: true,
      normalizedPhone: phoneNumber.format('E.164'),
      error: null
    };
  } catch (error) {
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

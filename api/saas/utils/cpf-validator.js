/**
 * Valida um CPF brasileiro
 * @param {string} cpf - CPF a ser validado
 * @returns {Object} { isValid: boolean, cleanCpf: string, error?: string }
 */
const validateCpf = (cpf) => {
  try {
    if (!cpf || typeof cpf !== 'string') {
      return {
        isValid: false,
        cleanCpf: null,
        error: 'CPF é obrigatório'
      };
    }

    // Remove caracteres não numéricos
    const cleanCpf = cpf.replace(/\D/g, '');

    // Verifica se tem 11 dígitos
    if (cleanCpf.length !== 11) {
      return {
        isValid: false,
        cleanCpf: null,
        error: 'CPF deve ter 11 dígitos'
      };
    }

    // Verifica se não são todos os dígitos iguais
    if (/^(\d)\1{10}$/.test(cleanCpf)) {
      return {
        isValid: false,
        cleanCpf: null,
        error: 'CPF inválido'
      };
    }

    // Validação do algoritmo do CPF
    let sum = 0;
    let remainder;

    // Primeiro dígito verificador
    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cleanCpf.substring(i - 1, i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCpf.substring(9, 10))) {
      return {
        isValid: false,
        cleanCpf: null,
        error: 'CPF inválido'
      };
    }

    // Segundo dígito verificador
    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cleanCpf.substring(i - 1, i)) * (12 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCpf.substring(10, 11))) {
      return {
        isValid: false,
        cleanCpf: null,
        error: 'CPF inválido'
      };
    }

    return {
      isValid: true,
      cleanCpf,
      error: null
    };
  } catch (error) {
    return {
      isValid: false,
      cleanCpf: null,
      error: `Erro ao validar CPF: ${error.message}`
    };
  }
};

/**
 * Formata um CPF para exibição (xxx.xxx.xxx-xx)
 * @param {string} cpf - CPF limpo (apenas números)
 * @returns {string} CPF formatado
 */
const formatCpf = (cpf) => {
  if (!cpf || cpf.length !== 11) return cpf;
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

module.exports = {
  validateCpf,
  formatCpf
};

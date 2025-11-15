const { getAllProductParametersStandard } = require('../services/product-parameter-standard-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para listar parâmetros padrão de produto
 * Query params opcionais:
 * - visibleOnboarding: 'true' | 'false' - Filtra apenas os visíveis no onboarding
 */
exports.handler = async (event) => {
  try {
    const visibleOnboardingParam = event?.queryStringParameters?.visibleOnboarding;
    const visibleOnboardingOnly = visibleOnboardingParam === 'true';
    
    const items = await getAllProductParametersStandard(visibleOnboardingOnly);
    return success({ success: true, data: items }, 200);
  } catch (error) {
    console.error('Erro ao listar parâmetros padrão de produto:', error);
    return errorResponse({ success: false, message: 'Erro ao listar parâmetros padrão de produto', error: error.message }, 500);
  }
};

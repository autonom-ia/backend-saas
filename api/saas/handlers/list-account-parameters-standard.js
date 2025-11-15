const { getAllAccountParametersStandard } = require('../services/account-parameter-standard-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para listar parâmetros padrão de conta
 * Query params opcionais:
 * - visibleOnboarding: 'true' | 'false' - Filtra apenas os visíveis no onboarding
 */
exports.handler = async (event) => {
  try {
    const visibleOnboardingParam = event?.queryStringParameters?.visibleOnboarding;
    const visibleOnboardingOnly = visibleOnboardingParam === 'true';
    
    const items = await getAllAccountParametersStandard(visibleOnboardingOnly);
    return success({ success: true, data: items }, 200);
  } catch (error) {
    console.error('Erro ao listar parâmetros padrão de conta:', error);
    return errorResponse({ success: false, message: 'Erro ao listar parâmetros padrão de conta', error: error.message }, 500);
  }
};

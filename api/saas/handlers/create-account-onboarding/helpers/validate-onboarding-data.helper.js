const { error: errorResponse } = require('../../utils/response');

class ValidateOnboardingDataHelper {
  static execute(body) {
    if (!body.productId) {
      return {
        isValid: false,
        response: errorResponse({ success: false, message: 'productId é obrigatório' }, 400),
      };
    }

    if (!body.accountName || !body.accountName.trim()) {
      return {
        isValid: false,
        response: errorResponse({ success: false, message: 'accountName é obrigatório' }, 400),
      };
    }

    if (!body.accountEmail || !body.accountEmail.trim()) {
      return {
        isValid: false,
        response: errorResponse({ success: false, message: 'accountEmail é obrigatório' }, 400),
      };
    }

    if (!body.accountPhone || !body.accountPhone.trim()) {
      return {
        isValid: false,
        response: errorResponse({ success: false, message: 'accountPhone é obrigatório' }, 400),
      };
    }

    return { isValid: true };
  }
}

module.exports = { ValidateOnboardingDataHelper };

const { createResponse } = require('../../utils/cors');

class ValidateRequestParamsHelper {
  static execute(body, accountId, origin) {
    if (!body.instanceName) {
      return {
        isValid: false,
        response: createResponse(400, { message: 'instanceName é obrigatório' }, origin),
      };
    }

    if (!accountId) {
      return {
        isValid: false,
        response: createResponse(400, { message: 'account_id é obrigatório' }, origin),
      };
    }

    return { isValid: true };
  }
}

module.exports = { ValidateRequestParamsHelper };

const { error: errorResponse } = require('../../utils/response');

class ParseRequestBodyHelper {
  static execute(event) {
    try {
      const body = JSON.parse(event.body || '{}');
      return {
        isValid: true,
        body,
      };
    } catch (e) {
      return {
        isValid: false,
        response: errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400),
      };
    }
  }
}

module.exports = { ParseRequestBodyHelper };

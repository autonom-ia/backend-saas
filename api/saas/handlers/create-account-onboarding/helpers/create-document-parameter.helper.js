const { getDbConnection } = require('../../../utils/database');

class CreateDocumentParameterHelper {
  static async execute(accountId, document) {
    if (!document || !document.toString().trim()) {
      return;
    }

    try {
      const knex = getDbConnection();
      await knex('account_parameter').insert({
        name: 'document',
        value: document.toString(),
        account_id: accountId,
        short_description: 'Documento',
        help_text: 'Documento (CPF/CNPJ) associado à conta.',
        default_value: null,
      });
    } catch (docErr) {
      console.error('[create-account-onboarding] Falha ao criar parâmetro document:', docErr?.message || docErr);
    }
  }
}

module.exports = { CreateDocumentParameterHelper };

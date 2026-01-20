const { getDbConnection } = require('../../../utils/database');
const { FormatKnowledgeBaseValueHelper } = require('./');

class CreateKnowledgeBaseParameterHelper {
  static async execute(accountId, parameters) {
    if (!parameters['metadata']) {
      return;
    }

    try {
      const metadataValue = parameters['metadata'];
      const knowledgeBaseValue = FormatKnowledgeBaseValueHelper.execute(metadataValue);

      if (!knowledgeBaseValue) {
        return;
      }

      const knex = getDbConnection();
      await knex('account_parameter').insert({
        name: 'knowledgeBase',
        value: knowledgeBaseValue,
        account_id: accountId,
        short_description: 'Base de Conhecimento',
        help_text: 'Conjunto de informações utilizadas pela empresa para serem utilizadas na instrução do agente.',
        default_value: null,
      });
    } catch (kbErr) {
      console.error('[create-account-onboarding] Falha ao criar knowledgeBase:', kbErr?.message || kbErr);
    }
  }
}

module.exports = { CreateKnowledgeBaseParameterHelper };

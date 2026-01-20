const { getDbConnection } = require('../../../utils/database');
const { BuildStandardParametersHelper } = require('./');

class CreateStandardParametersHelper {
  static async execute(accountId, parameters) {
    try {
      const knex = getDbConnection();
      const standardParams = await knex('account_parameters_standard')
        .select('name', 'short_description', 'help_text', 'default_value')
        .whereNotIn('name', ['metadata', 'knowledgeBase', 'document'])
        .orderBy('name', 'asc');

      if (standardParams.length === 0) {
        return;
      }

      const paramRows = BuildStandardParametersHelper.execute(standardParams, parameters);
      paramRows.forEach((param) => {
        param.account_id = accountId;
      });

      await knex('account_parameter').insert(paramRows);
    } catch (seedErr) {
      console.error('[create-account-onboarding] Falha ao criar parâmetros:', seedErr?.message || seedErr);
    }
  }
}

module.exports = { CreateStandardParametersHelper };

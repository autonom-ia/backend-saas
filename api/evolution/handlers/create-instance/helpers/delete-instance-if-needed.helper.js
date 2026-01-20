const { connectionState, deleteInstance } = require('../../services/evolution-service');
const { CheckShouldDeleteInstanceHelper } = require('./');

class DeleteInstanceIfNeededHelper {
  static async execute(accountId, instanceName) {
    try {
      const stateResp = await connectionState(accountId, instanceName);
      const state = stateResp?.instance?.state;

      const shouldDelete = CheckShouldDeleteInstanceHelper.execute(state);
      if (!shouldDelete) {
        return;
      }

      try {
        await deleteInstance(accountId, instanceName);
      } catch (delErr) {
        console.warn('[CreateInstance] Falha ao deletar instância antes da recriação', {
          instance: instanceName,
          error: delErr?.message || delErr,
        });
      }
    } catch (stErr) {
      console.warn('[CreateInstance] Não foi possível obter estado da instância, prosseguindo com criação', {
        instance: instanceName,
        error: stErr?.message || stErr,
      });
    }
  }
}

module.exports = { DeleteInstanceIfNeededHelper };

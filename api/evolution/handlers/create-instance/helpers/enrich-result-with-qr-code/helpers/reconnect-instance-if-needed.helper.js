const { connect } = require('../../../../services/evolution-service');
const { CheckShouldReconnectInstanceHelper } = require('../../../');

class ReconnectInstanceIfNeededHelper {
  static async execute(accountId, instanceName, number, instanceState) {
    const shouldReconnect = CheckShouldReconnectInstanceHelper.execute(instanceState);
    if (!shouldReconnect) {
      return instanceState;
    }

    try {
      await connect(accountId, instanceName, number);
      return 'connecting';
    } catch (reconnectErr) {
      console.warn('[CreateInstance] Erro ao reconectar', {
        instance: instanceName,
        error: reconnectErr?.message || reconnectErr,
      });
      return instanceState;
    }
  }
}

module.exports = { ReconnectInstanceIfNeededHelper };

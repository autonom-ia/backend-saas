const { connectionState, connect } = require('../../services/evolution-service');
const { CheckShouldTryGetQrCodeHelper } = require('./');
const {
  GetInstanceStateHelper,
  ReconnectInstanceIfNeededHelper,
  CheckHasQrCodeInResponseHelper,
  BuildEnrichedResultWithQrCodeHelper,
  BuildEnrichedResultWithErrorHelper,
  WaitForQrCodeProcessingHelper,
} = require('./enrich-result-with-qr-code/helpers');

class EnrichResultWithQrCodeHelper {
  static async execute(accountId, instanceName, number, result) {
    try {
      const stateResp = await connectionState(accountId, instanceName);
      const initialState = GetInstanceStateHelper.execute(stateResp);

      const instanceState = await ReconnectInstanceIfNeededHelper.execute(
        accountId,
        instanceName,
        number,
        initialState
      );

      const shouldTryGetQrCode = CheckShouldTryGetQrCodeHelper.execute(instanceState);
      if (!shouldTryGetQrCode) {
        return { enriched: result, instanceState };
      }

      await WaitForQrCodeProcessingHelper.execute();

      const qrCodeResp = await connect(accountId, instanceName, number);

      const hasQrCode = CheckHasQrCodeInResponseHelper.execute(qrCodeResp);

      if (hasQrCode) {
        const enriched = BuildEnrichedResultWithQrCodeHelper.execute(result, qrCodeResp);
        return { enriched, instanceState };
      }

      const enriched = BuildEnrichedResultWithErrorHelper.execute(result, instanceState, qrCodeResp);
      return { enriched, instanceState };
    } catch (stateErr) {
      console.warn('[CreateInstance] Erro ao verificar estado ou obter QR code', {
        instance: instanceName,
        error: stateErr?.message || stateErr,
      });
      return { enriched: result, instanceState: null };
    }
  }
}

module.exports = { EnrichResultWithQrCodeHelper };

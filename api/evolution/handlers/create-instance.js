const { createInstance } = require('../services/evolution-service');
const { createResponse, preflight, getOrigin } = require('../utils/cors');
const {
  ValidateRequestParamsHelper,
  BuildPayloadHelper,
  DeleteInstanceIfNeededHelper,
  CheckHasQrCodeInResultHelper,
  EnrichResultWithQrCodeHelper,
} = require('./create-instance/helpers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }

  try {
    const origin = getOrigin(event);
    const body = JSON.parse(event.body || '{}');
    const qs = event.queryStringParameters || {};
    const accountId = body.account_id || qs.account_id;

    const validation = ValidateRequestParamsHelper.execute(body, accountId, origin);
    if (!validation.isValid) {
      return validation.response;
    }

    const payload = BuildPayloadHelper.execute(body);

    await DeleteInstanceIfNeededHelper.execute(accountId, payload.instanceName);

    const result = await createInstance(accountId, payload);

    const hasQrCodeInResult = CheckHasQrCodeInResultHelper.execute(result);
    if (hasQrCodeInResult) {
      return createResponse(201, result, origin);
    }

    const { enriched, instanceState } = await EnrichResultWithQrCodeHelper.execute(
      accountId,
      payload.instanceName,
      payload.number,
      result
    );

    const finalResult = instanceState ? { ...enriched, instanceState } : enriched;

    return createResponse(201, finalResult, origin);
  } catch (err) {
    console.error('Erro em CreateInstance:', err);
    return createResponse(500, { message: 'Erro ao criar instância', details: err.message }, getOrigin(event));
  }
};

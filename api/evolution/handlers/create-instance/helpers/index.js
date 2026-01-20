module.exports = {
  ValidateRequestParamsHelper: require('./validate-request-params.helper').ValidateRequestParamsHelper,
  BuildPayloadHelper: require('./build-payload.helper').BuildPayloadHelper,
  CheckShouldDeleteInstanceHelper: require('./check-should-delete-instance.helper').CheckShouldDeleteInstanceHelper,
  DeleteInstanceIfNeededHelper: require('./delete-instance-if-needed.helper').DeleteInstanceIfNeededHelper,
  CheckHasQrCodeInResultHelper: require('./check-has-qr-code-in-result.helper').CheckHasQrCodeInResultHelper,
  CheckShouldReconnectInstanceHelper: require('./check-should-reconnect-instance.helper').CheckShouldReconnectInstanceHelper,
  CheckShouldTryGetQrCodeHelper: require('./check-should-try-get-qr-code.helper').CheckShouldTryGetQrCodeHelper,
  EnrichResultWithQrCodeHelper: require('./enrich-result-with-qr-code.helper').EnrichResultWithQrCodeHelper,
};

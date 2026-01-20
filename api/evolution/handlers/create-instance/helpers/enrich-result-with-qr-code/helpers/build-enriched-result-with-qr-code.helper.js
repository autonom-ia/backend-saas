class BuildEnrichedResultWithQrCodeHelper {
  static execute(result, qrCodeResp) {
    return {
      ...result,
      ...qrCodeResp,
      qrcode: qrCodeResp.qrcode || {
        base64: qrCodeResp.base64,
        code: qrCodeResp.code || qrCodeResp.pairingCode,
        count: qrCodeResp.count || 1,
      },
    };
  }
}

module.exports = { BuildEnrichedResultWithQrCodeHelper };

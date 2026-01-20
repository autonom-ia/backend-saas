class CheckHasQrcodeObjectHelper {
  static execute(qrCodeResp) {
    return !!(qrCodeResp?.qrcode?.base64 || qrCodeResp?.qrcode?.code);
  }
}

module.exports = { CheckHasQrcodeObjectHelper };

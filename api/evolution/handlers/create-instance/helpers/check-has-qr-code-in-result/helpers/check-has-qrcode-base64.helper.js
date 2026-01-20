class CheckHasQrcodeBase64Helper {
  static execute(result) {
    return !!(result?.qrcode?.base64 || result?.data?.qrcode?.base64);
  }
}

module.exports = { CheckHasQrcodeBase64Helper };

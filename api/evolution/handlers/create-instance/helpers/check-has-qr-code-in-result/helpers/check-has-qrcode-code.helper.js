class CheckHasQrcodeCodeHelper {
  static execute(result) {
    return !!(result?.qrcode?.code || result?.data?.qrcode?.code);
  }
}

module.exports = { CheckHasQrcodeCodeHelper };

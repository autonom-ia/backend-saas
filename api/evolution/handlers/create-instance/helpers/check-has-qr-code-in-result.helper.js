const {
  CheckHasQrcodeBase64Helper,
  CheckHasQrcodeCodeHelper,
  CheckHasPairingOrCodeHelper,
} = require('./check-has-qr-code-in-result/helpers');

class CheckHasQrCodeInResultHelper {
  static execute(result) {
    const hasBase64 = CheckHasQrcodeBase64Helper.execute(result);
    if (hasBase64) {
      return true;
    }

    const hasCode = CheckHasQrcodeCodeHelper.execute(result);
    if (hasCode) {
      return true;
    }

    return CheckHasPairingOrCodeHelper.execute(result);
  }
}

module.exports = { CheckHasQrCodeInResultHelper };

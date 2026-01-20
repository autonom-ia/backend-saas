const {
  CheckHasQrcodeObjectHelper,
  CheckHasPairingOrCodeDirectHelper,
} = require('./check-has-qr-code-in-response/helpers');

class CheckHasQrCodeInResponseHelper {
  static execute(qrCodeResp) {
    const hasQrcodeObject = CheckHasQrcodeObjectHelper.execute(qrCodeResp);
    if (hasQrcodeObject) {
      return true;
    }

    return CheckHasPairingOrCodeDirectHelper.execute(qrCodeResp);
  }
}

module.exports = { CheckHasQrCodeInResponseHelper };

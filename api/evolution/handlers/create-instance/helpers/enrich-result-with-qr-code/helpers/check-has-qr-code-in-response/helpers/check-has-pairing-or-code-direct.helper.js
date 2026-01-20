class CheckHasPairingOrCodeDirectHelper {
  static execute(qrCodeResp) {
    return !!(qrCodeResp?.pairingCode || qrCodeResp?.code);
  }
}

module.exports = { CheckHasPairingOrCodeDirectHelper };

class CheckHasPairingOrCodeHelper {
  static execute(result) {
    return !!(result?.pairingCode || result?.code);
  }
}

module.exports = { CheckHasPairingOrCodeHelper };

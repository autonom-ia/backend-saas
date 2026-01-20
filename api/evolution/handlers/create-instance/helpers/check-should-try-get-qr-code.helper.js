class CheckShouldTryGetQrCodeHelper {
  static execute(instanceState) {
    return !instanceState || instanceState === 'connecting';
  }
}

module.exports = { CheckShouldTryGetQrCodeHelper };

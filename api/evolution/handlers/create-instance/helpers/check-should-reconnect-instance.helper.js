class CheckShouldReconnectInstanceHelper {
  static execute(instanceState) {
    return instanceState === 'close';
  }
}

module.exports = { CheckShouldReconnectInstanceHelper };

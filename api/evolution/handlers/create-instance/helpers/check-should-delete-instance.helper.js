class CheckShouldDeleteInstanceHelper {
  static execute(state) {
    return state === 'connecting' || state === 'close';
  }
}

module.exports = { CheckShouldDeleteInstanceHelper };

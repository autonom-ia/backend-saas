class CheckHasUserValueHelper {
  static execute(userValue) {
    return userValue !== undefined && userValue !== null;
  }
}

module.exports = { CheckHasUserValueHelper };

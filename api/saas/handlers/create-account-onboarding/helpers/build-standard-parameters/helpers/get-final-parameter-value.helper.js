const { CheckHasUserValueHelper } = require('./check-has-user-value.helper');
const { GetDefaultValueHelper } = require('./get-default-value.helper');

class GetFinalParameterValueHelper {
  static execute(userValue, defaultValue) {
    const hasUserValue = CheckHasUserValueHelper.execute(userValue);
    if (hasUserValue) {
      return String(userValue);
    }

    return GetDefaultValueHelper.execute(defaultValue);
  }
}

module.exports = { GetFinalParameterValueHelper };

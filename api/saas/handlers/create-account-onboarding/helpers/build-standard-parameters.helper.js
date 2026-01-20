const { GetFinalParameterValueHelper } = require('./build-standard-parameters/helpers');

class BuildStandardParametersHelper {
  static execute(standardParams, parameters) {
    return standardParams.map((param) => {
      const userValue = parameters[param.name];
      const finalValue = GetFinalParameterValueHelper.execute(userValue, param.default_value);

      return {
        name: param.name,
        value: finalValue,
        account_id: null,
        short_description: param.short_description,
        help_text: param.help_text,
        default_value: param.default_value,
      };
    });
  }
}

module.exports = { BuildStandardParametersHelper };

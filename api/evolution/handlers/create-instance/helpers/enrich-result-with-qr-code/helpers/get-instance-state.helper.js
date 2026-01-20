class GetInstanceStateHelper {
  static execute(stateResp) {
    return stateResp?.instance?.state || stateResp?.data?.instance?.state;
  }
}

module.exports = { GetInstanceStateHelper };

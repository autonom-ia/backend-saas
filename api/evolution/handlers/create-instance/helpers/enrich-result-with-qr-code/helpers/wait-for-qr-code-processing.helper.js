class WaitForQrCodeProcessingHelper {
  static async execute() {
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

module.exports = { WaitForQrCodeProcessingHelper };

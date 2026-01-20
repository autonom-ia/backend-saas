class BuildEnrichedResultWithErrorHelper {
  static execute(result, instanceState, qrCodeResp) {
    return {
      ...result,
      qrCodeIssue: {
        message:
          'QR code não foi gerado pelo Evolution API. A instância está em "connecting" mas o Evolution API retorna apenas {"count":0}',
        state: instanceState,
        evolutionApiResponse: qrCodeResp || { count: 0 },
        suggestions: [
          'Verifique os logs do Evolution API para erros específicos',
          'Verifique se CONFIG_SESSION_PHONE_VERSION está atualizado',
          'Tente usar o endpoint GetQrCode após alguns segundos',
          'Verifique se há problemas de rede/firewall bloqueando WebSocket',
          'Considere atualizar a versão do Evolution API',
        ],
      },
    };
  }
}

module.exports = { BuildEnrichedResultWithErrorHelper };

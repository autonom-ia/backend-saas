class FormatKnowledgeBaseValueHelper {
  static execute(metadataValue) {
    if (typeof metadataValue === 'string' && metadataValue.trim().startsWith('{')) {
      try {
        JSON.parse(metadataValue);
        return metadataValue;
      } catch (err) {
        console.error('[create-account-onboarding] JSON metadata inválido:', err.message);
        return '';
      }
    }

    if (typeof metadataValue === 'object') {
      return JSON.stringify(metadataValue);
    }

    return '';
  }
}

module.exports = { FormatKnowledgeBaseValueHelper };

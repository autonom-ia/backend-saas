class BuildPayloadHelper {
  static execute(body) {
    const instanceName = String(body.instanceName || '').trim();
    const token = body.token ? String(body.token) : undefined;
    const qrcode = typeof body.qrcode === 'boolean' ? body.qrcode : true;
    const integration = body.integration || 'WHATSAPP-BAILEYS';
    const groups_ignore = typeof body.groups_ignore === 'boolean' ? body.groups_ignore : true;
    const always_online = typeof body.always_online === 'boolean' ? body.always_online : true;

    const number = this.extractNumber(body, instanceName);

    const payload = { instanceName, qrcode, integration, groups_ignore, always_online };
    if (token) {
      payload.token = token;
    }
    if (number) {
      payload.number = String(number);
    }

    payload.groupsIgnore = typeof payload.groups_ignore === 'boolean' ? payload.groups_ignore : true;
    payload.alwaysOnline = typeof payload.always_online === 'boolean' ? payload.always_online : true;

    return payload;
  }

  static extractNumber(body, instanceName) {
    const number = body.number || body.phone || undefined;
    if (number) {
      return number;
    }

    const nameLooksLikeNumber = typeof instanceName === 'string' && /^(\+)?\d{6,}$/.test(instanceName.replace(/\D/g, ''));
    if (nameLooksLikeNumber) {
      return instanceName;
    }

    return undefined;
  }
}

module.exports = { BuildPayloadHelper };

const { randomUUID } = require('crypto');
const { success, error: errorResponse } = require('../utils/response');

const COPAR_ENDPOINT = 'https://api.coparenergia.com.br/api/onboarding/cadastro';
const COPAR_MEDIA_ENDPOINT = 'https://api.coparenergia.com.br/api/admin/data/media';
const COPAR_CONDICOES_ENDPOINT = 'https://api.coparenergia.com.br/api/onboardingcondicao/list';

const appendField = (formData, name, value) => {
  if (value === undefined || value === null) {
    formData.append(name, '');
    return;
  }
  formData.append(name, String(value));
};

const REQUIRED_FIELDS_BY_STEP = {
  '0': ['email', 'telefone', 'is_logged', 'step'],
  '1': ['email', 'telefone', 'is_logged', 'step', 'tipo'],
  '3': [
    'tipo',
    'email',
    'telefone',
    'metodo_pagamento',
    'step',
    'uuid_sessao',
    'pdf_conta_luz',
    'consumo_medio',
    'valor_fatura',
    'nome_razao_social_titular',
    'cpf_cnpj_titular',
    'cep_instalacao',
    'logradouro_instalacao',
    'numero_instalacao',
    'complemento_instalacao',
    'bairro_instalacao',
    'estado_instalacao',
    'cidade_instalacao',
    'unidade_consumidora',
    'tipo_fornecimento',
  ],
  '4': [
    'tipo',
    'email',
    'telefone',
    'is_logged',
    'uuid_sessao',
    'pdf_conta_luz',
    'consumo_medio',
    'valor_fatura',
    'nome_razao_social_titular',
    'cpf_cnpj_titular',
    'cep_instalacao',
    'logradouro_instalacao',
    'numero_instalacao',
    'complemento_instalacao',
    'bairro_instalacao',
    'estado_instalacao',
    'cidade_instalacao',
    'unidade_consumidora',
    'tipo_fornecimento',
    'step',
    'id_condicao',
    'cod_fidelidade_meses',
  ],
  '5': [
    'tipo',
    'email',
    'telefone',
    'is_logged',
    'uuid_sessao',
    'pdf_conta_luz',
    'consumo_medio',
    'valor_fatura',
    'nome_razao_social_titular',
    'cpf_cnpj_titular',
    'cep_instalacao',
    'logradouro_instalacao',
    'numero_instalacao',
    'complemento_instalacao',
    'bairro_instalacao',
    'estado_instalacao',
    'cidade_instalacao',
    'unidade_consumidora',
    'tipo_fornecimento',
    'id_condicao',
    'cod_fidelidade_meses',
    'step',
  ],
};

const validateRequiredFieldsByStep = (payload) => {
  const stepValue = payload && payload.step != null ? String(payload.step) : '';
  const baseRequired = REQUIRED_FIELDS_BY_STEP[stepValue] || [];

  // Campos adicionais obrigatórios apenas no step 5 para PJ
  const extraForPJStep5 = ['razao_social', 'nome_fantasia', 'cnpj', 'nome_responsavel', 'cpf_responsavel', 'data_nascimento_responsavel'];
  const isPJStep5 = stepValue === '5' && String(payload?.tipo || '').toUpperCase() === 'PJ';

  const required = isPJStep5 ? [...baseRequired, ...extraForPJStep5] : baseRequired;

  const missing = required.filter((field) => {
    const value = payload[field];
    if (value === undefined || value === null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    return false;
  });

  return {
    ok: missing.length === 0,
    missing,
    step: stepValue,
  };
};

const buildCoparCurlCommand = (payload) => {
  if (!payload) {
    return null;
  }

  const escapeValue = (value) => {
    if (value === undefined || value === null) {
      return '';
    }
    return String(value).replace(/"/g, '\\"');
  };

  const parts = [];
  const pushField = (name, value) => {
    // Sempre incluir o campo, mesmo se null/undefined, usando string vazia
    parts.push(`-F "${name}=${escapeValue(value)}"`);
  };

  pushField('tipo', payload.tipo);
  pushField('email', payload.email);
  pushField('telefone', payload.telefone);
  pushField('nome', payload.nome);
  pushField('cpf', payload.cpf);
  pushField('rg', payload.rg);
  pushField('nacionalidade', payload.nacionalidade);
  pushField('orgao_emissor', payload.orgao_emissor);
  pushField('data_nascimento', payload.data_nascimento);
  pushField('razao_social', payload.razao_social);
  pushField('nome_fantasia', payload.nome_fantasia);
  pushField('cnpj', payload.cnpj);
  pushField('nome_responsavel', payload.nome_responsavel);
  pushField('cpf_responsavel', payload.cpf_responsavel);
  pushField('data_nascimento_responsavel', payload.data_nascimento_responsavel);
  pushField('pdf_conta_luz', payload.pdf_conta_luz);
  pushField('consumo_medio', payload.consumo_medio);
  pushField('valor_fatura', payload.valor_fatura);
  pushField('nome_razao_social_titular', payload.nome_razao_social_titular);
  pushField('cpf_cnpj_titular', payload.cpf_cnpj_titular);
  pushField('cep_instalacao', payload.cep_instalacao);
  pushField('logradouro_instalacao', payload.logradouro_instalacao);
  pushField('numero_instalacao', payload.numero_instalacao);
  pushField('complemento_instalacao', payload.complemento_instalacao);
  pushField('bairro_instalacao', payload.bairro_instalacao);
  pushField('estado_instalacao', payload.estado_instalacao);
  pushField('cidade_instalacao', payload.cidade_instalacao);
  pushField('unidade_consumidora', payload.unidade_consumidora);
  pushField('tipo_fornecimento', payload.tipo_fornecimento);
  pushField('metodo_pagamento', payload.metodo_pagamento);
  pushField('numero_cartao', payload.numero_cartao);
  pushField('nome_titular_cartao', payload.nome_titular_cartao);
  pushField('cpf_titular_cartao', payload.cpf_titular_cartao);
  pushField('data_validade_cartao', payload.data_validade_cartao);
  pushField('cvv_cartao', payload.cvv_cartao);
  pushField('cep_titular_cartao', payload.cep_titular_cartao);
  pushField('logradouro_titular_cartao', payload.logradouro_titular_cartao);
  pushField('numero_titular_cartao', payload.numero_titular_cartao);
  pushField('bairro_titular_cartao', payload.bairro_titular_cartao);
  pushField('estado_titular_cartao', payload.estado_titular_cartao);
  pushField('cidade_titular_cartao', payload.cidade_titular_cartao);
  pushField('foto_documento_frente', payload.foto_documento_frente);
  pushField('foto_documento_verso', payload.foto_documento_verso);
  pushField('foto_selfie_documento', payload.foto_selfie_documento);
  pushField('senha', payload.senha);
  pushField('confirmacao_senha', payload.confirmacao_senha);
  pushField('password', payload.password);
  pushField('uuid_sessao', payload.uuid_sessao);
  pushField('vale_bonus', payload.vale_bonus);
  pushField('condicao', payload.condicao);
  pushField('id_condicao', payload.id_condicao);
  pushField('cod_fidelidade_meses', payload.cod_fidelidade_meses);
  pushField('documento_copel', payload.documento_copel);
  pushField('senha_copel', payload.senha_copel);
  pushField('cartao', payload.cartao);
  pushField('passar_dados_depois', payload.passar_dados_depois);
  pushField('cupom_codigo', payload.cupom_codigo);
  pushField('id_cupom', payload.id_cupom);
  pushField('is_logged', payload.is_logged);
  pushField('token_cartao', payload.token_cartao);
  pushField('step', payload.step);

  if (!parts.length) {
    return null;
  }

  const joined = parts.join(' \\\n  ');
  return `curl -X POST '${COPAR_ENDPOINT}' \\\n  ${joined}`;
};

const sanitizePayloadForCache = (payload) => {
  if (!payload) {
    return payload;
  }

  const sanitized = { ...payload };

  delete sanitized.numero_cartao;
  delete sanitized.nome_titular_cartao;
  delete sanitized.cpf_titular_cartao;
  delete sanitized.data_validade_cartao;
  delete sanitized.cvv_cartao;
  delete sanitized.cep_titular_cartao;
  delete sanitized.logradouro_titular_cartao;
  delete sanitized.numero_titular_cartao;
  delete sanitized.bairro_titular_cartao;
  delete sanitized.estado_titular_cartao;
  delete sanitized.cidade_titular_cartao;
  delete sanitized.token_cartao;

  return sanitized;
};

const buildCoparFormData = async (payload) => {
  const formData = new FormData();

  appendField(formData, 'tipo', payload.tipo);
  appendField(formData, 'email', payload.email);
  appendField(formData, 'telefone', payload.telefone);
  appendField(formData, 'nome', payload.nome);
  appendField(formData, 'cpf', payload.cpf);
  appendField(formData, 'rg', payload.rg);
  appendField(formData, 'nacionalidade', payload.nacionalidade);
  appendField(formData, 'orgao_emissor', payload.orgao_emissor);
  appendField(formData, 'data_nascimento', payload.data_nascimento);
  appendField(formData, 'razao_social', payload.razao_social);
  appendField(formData, 'nome_fantasia', payload.nome_fantasia);
  appendField(formData, 'cnpj', payload.cnpj);
  appendField(formData, 'nome_responsavel', payload.nome_responsavel);
  appendField(formData, 'cpf_responsavel', payload.cpf_responsavel);
  appendField(formData, 'data_nascimento_responsavel', payload.data_nascimento_responsavel);

  if (payload.pdf_conta_luz) {
    try {
      const resp = await fetch(payload.pdf_conta_luz);
      const arrayBuffer = await resp.arrayBuffer();
      const contentType = resp.headers.get('content-type') || 'application/pdf';
      const blob = new Blob([arrayBuffer], { type: contentType });
      const filename = payload.pdf_conta_luz.split('/').pop() || 'conta_luz.pdf';
      formData.append('pdf_conta_luz', blob, filename);
    } catch (e) {
      console.error('[Copar] Erro ao baixar pdf_conta_luz', e);
      const blob = new Blob([], { type: 'application/pdf' });
      formData.append('pdf_conta_luz', blob, 'vazio.pdf');
    }
  } else {
    const blob = new Blob([], { type: 'application/pdf' });
    formData.append('pdf_conta_luz', blob, 'vazio.pdf');
  }

  appendField(formData, 'consumo_medio', payload.consumo_medio);
  appendField(formData, 'valor_fatura', payload.valor_fatura);
  appendField(formData, 'nome_razao_social_titular', payload.nome_razao_social_titular);
  appendField(formData, 'cpf_cnpj_titular', payload.cpf_cnpj_titular);
  appendField(formData, 'cep_instalacao', payload.cep_instalacao);
  appendField(formData, 'logradouro_instalacao', payload.logradouro_instalacao);
  appendField(formData, 'numero_instalacao', payload.numero_instalacao);
  appendField(formData, 'complemento_instalacao', payload.complemento_instalacao);
  appendField(formData, 'bairro_instalacao', payload.bairro_instalacao);
  appendField(formData, 'estado_instalacao', payload.estado_instalacao);
  appendField(formData, 'cidade_instalacao', payload.cidade_instalacao);
  appendField(formData, 'unidade_consumidora', payload.unidade_consumidora);
  appendField(formData, 'tipo_fornecimento', payload.tipo_fornecimento);
  appendField(formData, 'metodo_pagamento', payload.metodo_pagamento);
  appendField(formData, 'numero_cartao', payload.numero_cartao);
  appendField(formData, 'nome_titular_cartao', payload.nome_titular_cartao);
  appendField(formData, 'cpf_titular_cartao', payload.cpf_titular_cartao);
  appendField(formData, 'data_validade_cartao', payload.data_validade_cartao);
  appendField(formData, 'cvv_cartao', payload.cvv_cartao);
  appendField(formData, 'cep_titular_cartao', payload.cep_titular_cartao);
  appendField(formData, 'logradouro_titular_cartao', payload.logradouro_titular_cartao);
  appendField(formData, 'numero_titular_cartao', payload.numero_titular_cartao);
  appendField(formData, 'bairro_titular_cartao', payload.bairro_titular_cartao);
  appendField(formData, 'estado_titular_cartao', payload.estado_titular_cartao);
  appendField(formData, 'cidade_titular_cartao', payload.cidade_titular_cartao);

  if (payload.foto_documento_frente) {
    try {
      const resp = await fetch(payload.foto_documento_frente);
      const arrayBuffer = await resp.arrayBuffer();
      const contentType = resp.headers.get('content-type') || 'image/jpeg';
      const blob = new Blob([arrayBuffer], { type: contentType });
      const filename = payload.foto_documento_frente.split('/').pop() || 'foto_documento_frente.jpg';
      formData.append('foto_documento_frente', blob, filename);
    } catch (e) {
      console.error('[Copar] Erro ao baixar foto_documento_frente', e);
      const blob = new Blob([], { type: 'application/octet-stream' });
      formData.append('foto_documento_frente', blob, 'vazio.bin');
    }
  } else {
    const blob = new Blob([], { type: 'application/octet-stream' });
    formData.append('foto_documento_frente', blob, 'vazio.bin');
  }

  if (payload.foto_documento_verso) {
    try {
      const resp = await fetch(payload.foto_documento_verso);
      const arrayBuffer = await resp.arrayBuffer();
      const contentType = resp.headers.get('content-type') || 'image/jpeg';
      const blob = new Blob([arrayBuffer], { type: contentType });
      const filename = payload.foto_documento_verso.split('/').pop() || 'foto_documento_verso.jpg';
      formData.append('foto_documento_verso', blob, filename);
    } catch (e) {
      console.error('[Copar] Erro ao baixar foto_documento_verso', e);
      const blob = new Blob([], { type: 'application/octet-stream' });
      formData.append('foto_documento_verso', blob, 'vazio.bin');
    }
  } else {
    const blob = new Blob([], { type: 'application/octet-stream' });
    formData.append('foto_documento_verso', blob, 'vazio.bin');
  }

  if (payload.foto_selfie_documento) {
    try {
      const resp = await fetch(payload.foto_selfie_documento);
      const arrayBuffer = await resp.arrayBuffer();
      const contentType = resp.headers.get('content-type') || 'image/jpeg';
      const blob = new Blob([arrayBuffer], { type: contentType });
      const filename = payload.foto_selfie_documento.split('/').pop() || 'foto_selfie_documento.jpg';
      formData.append('foto_selfie_documento', blob, filename);
    } catch (e) {
      console.error('[Copar] Erro ao baixar foto_selfie_documento', e);
      const blob = new Blob([], { type: 'application/octet-stream' });
      formData.append('foto_selfie_documento', blob, 'vazio.bin');
    }
  } else {
    const blob = new Blob([], { type: 'application/octet-stream' });
    formData.append('foto_selfie_documento', blob, 'vazio.bin');
  }
  appendField(formData, 'senha', payload.senha);
  appendField(formData, 'confirmacao_senha', payload.confirmacao_senha);
  appendField(formData, 'password', payload.password);
  appendField(formData, 'uuid_sessao', payload.uuid_sessao);
  appendField(formData, 'vale_bonus', payload.vale_bonus);
  appendField(formData, 'id_condicao', payload.id_condicao);
  appendField(formData, 'cod_fidelidade_meses', payload.cod_fidelidade_meses);
  appendField(formData, 'documento_copel', payload.documento_copel);
  appendField(formData, 'senha_copel', payload.senha_copel);
  appendField(formData, 'cartao', payload.cartao);
  appendField(formData, 'passar_dados_depois', payload.passar_dados_depois);
  appendField(formData, 'cupom_codigo', payload.cupom_codigo);
  appendField(formData, 'id_cupom', payload.id_cupom);
  appendField(formData, 'is_logged', payload.is_logged);
  appendField(formData, 'token_cartao', payload.token_cartao);
  appendField(formData, 'step', payload.step);

  return formData;
};

const callCoparOnboarding = async (payload) => {
  try {
    const sessaoUuid = payload.uuid_sessao || payload.sessao_uuid || randomUUID();
    payload.uuid_sessao = sessaoUuid;

    const validation = validateRequiredFieldsByStep(payload);
    if (!validation.ok) {
      return success({
        success: false,
        message: 'Campos obrigatórios ausentes para a etapa informada',
        step: validation.step,
        missing_fields: validation.missing,
      });
    }

    console.log('[Copar] Preparando envio para API', {
      hasPdf: !!payload.pdf_conta_luz,
      tipo: payload.tipo,
      email: payload.email,
      telefone: payload.telefone,
      uuid_sessao: payload.uuid_sessao,
      metodo_pagamento: payload.metodo_pagamento,
    });

    const payloadForLog = sanitizePayloadForCache({ ...payload });
    delete payloadForLog.senha;
    delete payloadForLog.confirmacao_senha;
    delete payloadForLog.password;
    delete payloadForLog.senha_copel;

    console.log('[Copar] Payload completo enviado para Copar (sanitizado)', payloadForLog);

    // CURL deve refletir exatamente o payload enviado (incluindo campos de cartão/senha),
    // para facilitar debug e reprodução no Postman
    const curlCommand = buildCoparCurlCommand(payload);
    if (curlCommand) {
      console.log('[Copar] CURL equivalente para teste (form-data, sanitizado)', curlCommand);
    }

    if (validation.step === '3') {
      try {
        const mediaForm = new FormData();
        const pdfUrl = payload.pdf_conta_luz;
        const mediaUuid = payload.uuid_sessao || payload.sessao_uuid;

        if (pdfUrl && mediaUuid) {
          try {
            const respPdf = await fetch(pdfUrl);
            const arrayBufferPdf = await respPdf.arrayBuffer();
            const contentTypePdf = respPdf.headers.get('content-type') || 'application/pdf';
            const blobPdf = new Blob([arrayBufferPdf], { type: contentTypePdf });
            mediaForm.append('file', blobPdf, pdfUrl.split('/').pop() || 'conta_luz.pdf');
          } catch (e) {
            console.error('[Copar] Erro ao baixar pdf_conta_luz para media', e);
            const emptyPdf = new Blob([], { type: 'application/pdf' });
            mediaForm.append('file', emptyPdf, 'vazio.pdf');
          }

          mediaForm.append('uuid_sessao', mediaUuid);

          const mediaResponse = await fetch(COPAR_MEDIA_ENDPOINT, {
            method: 'POST',
            body: mediaForm,
          });

          const mediaText = await mediaResponse.text();
          console.log('[Copar] Resposta media', {
            status: mediaResponse.status,
            ok: mediaResponse.ok,
            bodySnippet: mediaText.slice(0, 500),
          });
        }
      } catch (mediaErr) {
        console.error('[Copar] Erro ao chamar rota media da Copar', mediaErr);
      }
    }

    const formData = await buildCoparFormData(payload);

    const response = await fetch(COPAR_ENDPOINT, {
      method: 'POST',
      body: formData,
    });

    const text = await response.text();

    console.log('[Copar] Resposta recebida', {
      status: response.status,
      ok: response.ok,
      bodySnippet: text.slice(0, 500),
    });

    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { raw: text };
    }

    console.log('[Copar] Corpo completo resposta Copar', data);

    if (!response.ok) {
      // Erros de validação da Copar (por ex. 422) devem retornar HTTP 200
      // com success=false e detalhes dos campos inválidos/faltando
      if (response.status >= 400 && response.status < 500) {
        const errors = Array.isArray(data?.errors) ? data.errors : [];
        const missingFieldMessages = errors.filter((msg) =>
          typeof msg === 'string' && /obrigat[óo]rio/.test(msg)
        );

        return success({
          success: false,
          statusCode: response.status,
          message: 'Erro de validação na API da Copar: campos inválidos ou faltando',
          errors,
          missing_field_messages: missingFieldMessages,
          sessao_uuid: sessaoUuid,
          data,
        });
      }

      return errorResponse({
        success: false,
        statusCode: response.status,
        message: 'Erro ao chamar API da Copar',
        data,
        sessao_uuid: sessaoUuid,
      }, response.status);
    }

    let condicoes = null;
    if (validation.step === '3') {
      try {
        const tipoPessoa = payload.tipo || 'PF';
        const url = `${COPAR_CONDICOES_ENDPOINT}?tipo_pessoa=${encodeURIComponent(tipoPessoa)}`;
        const condResp = await fetch(url, { method: 'GET' });
        const condText = await condResp.text();
        let condData;
        try {
          condData = JSON.parse(condText);
        } catch (_) {
          condData = { raw: condText };
        }
        console.log('[Copar] Resposta condicoes', {
          status: condResp.status,
          ok: condResp.ok,
          bodySnippet: condText.slice(0, 500),
        });
        condicoes = condData;
      } catch (condErr) {
        console.error('[Copar] Erro ao chamar lista de condicoes', condErr);
      }
    }

    return success({
      success: true,
      sessao_uuid: sessaoUuid,
      onboarding_link: `https://copar.autonomia.site/${sessaoUuid}`,
      data,
      condicoes,
      step: validation.step,
    });
  } catch (err) {
    console.error('[Copar] Erro ao chamar API', err);
    return errorResponse({
      success: false,
      message: 'Erro interno ao chamar API da Copar',
      error: err.message,
    }, 500);
  }
};

const callCoparOnboardingPaymentStep = async (payload) => {
  try {
    return errorResponse({
      success: false,
      message: 'Etapa de pagamento da Copar requer cache de sessão, que está desativado nesta configuração.',
    }, 400);
  } catch (err) {
    console.error('[Copar Payment] Erro ao processar pagamento', err);
    return errorResponse({
      success: false,
      message: 'Erro interno ao processar pagamento na Copar',
      error: err.message,
    }, 500);
  }
};

const callCoparOnboardingPasswordStep = async (payload) => {
  try {
    return errorResponse({
      success: false,
      message: 'Etapa de senha da Copar requer cache de sessão, que está desativado nesta configuração.',
    }, 400);
  } catch (err) {
    console.error('[Copar Password] Erro ao processar senha', err);
    return errorResponse({
      success: false,
      message: 'Erro interno ao processar senha na Copar',
      error: err.message,
    }, 500);
  }
};

module.exports = {
  callCoparOnboarding,
  callCoparOnboardingPaymentStep,
  callCoparOnboardingPasswordStep,
};

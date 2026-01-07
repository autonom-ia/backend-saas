const { success, error: errorResponse } = require('../utils/response');

const COPAR_ENDPOINT = 'https://api.coparenergia.com.br/api/onboarding/cadastro';
const COPAR_VERIFICAR_SESSAO_ENDPOINT = 'https://api.coparenergia.com.br/api/onboarding/verificar-sessao';
const COPAR_SESSAO_ENDPOINT = 'https://api.coparenergia.com.br/api/onboarding/cadastro/sessao';
const COPAR_MEDIA_ENDPOINT = 'https://api-scraper.coparenergia.com.br/api/admin/data/media';
const COPAR_CONDICOES_ENDPOINT = 'https://api.coparenergia.com.br/api/onboarding/condicao/list';

const appendField = (formData, name, value) => {
  if (value === undefined || value === null) {
    formData.append(name, '');
    return;
  }
  formData.append(name, String(value));
};

const formatPhoneToCopar = (telefone) => {
  if (!telefone) {
    return telefone;
  }

  let digits = String(telefone).replace(/\D/g, '');

  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }

  if (digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const firstPart = digits.slice(2, 7);
    const secondPart = digits.slice(7);
    return `(${ddd}) ${firstPart}-${secondPart}`;
  }

  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const firstPart = digits.slice(2, 6);
    const secondPart = digits.slice(6);
    return `(${ddd}) ${firstPart}-${secondPart}`;
  }

  return telefone;
};

const formatDateToCopar = (value) => {
  if (!value) {
    return value;
  }

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const match = raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd}`;
  }

  return raw;
};

const REQUIRED_FIELDS_BY_STEP = {
  '1': ['email', 'telefone', 'step', 'tipo'],
  '3': [
    'tipo',
    'email',
    'telefone',
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
    'bairro_instalacao',
    'estado_instalacao',
    'cidade_instalacao',
    'unidade_consumidora',
    'tipo_fornecimento',
    'id_condicao',
  ],
  '5': [
    'tipo',
    'email',
    'telefone',
    'uuid_sessao',
    'pdf_conta_luz',
    'consumo_medio',
    'valor_fatura',
    'nome_razao_social_titular',
    'cpf_cnpj_titular',
    'cep_instalacao',
    'logradouro_instalacao',
    'numero_instalacao',
    'bairro_instalacao',
    'estado_instalacao',
    'cidade_instalacao',
    'unidade_consumidora',
    'tipo_fornecimento',
    'id_condicao',
    'step',
  ],
};

const validateStepFields = (payload, step) => {
  const baseRequired = REQUIRED_FIELDS_BY_STEP[step] || [];

  const extraForPFStep5 = ['nome', 'cpf', 'rg', 'nacionalidade', 'orgao_emissor', 'data_nascimento'];
  const extraForPJStep5 = ['razao_social', 'nome_fantasia', 'cnpj', 'nome_responsavel', 'cpf_responsavel', 'data_nascimento_responsavel'];
  const tipoUpper = String(payload?.tipo || '').toUpperCase();

  let required = baseRequired;
  if (step === '5' && tipoUpper === 'PF') {
    required = [...required, ...extraForPFStep5];
  }
  if (step === '5' && tipoUpper === 'PJ') {
    required = [...required, ...extraForPJStep5];
  }

  const missing = required.filter((field) => {
    const value = payload[field];
    if (value === undefined || value === null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    return false;
  });

  return missing;
};

const buildFormDataForStep = async (payload, step) => {
  const formData = new FormData();
  const formattedTelefone = formatPhoneToCopar(payload.telefone);
  const tipoUpper = String(payload?.tipo || '').toUpperCase();
  const isPJ = tipoUpper === 'PJ';

  if (step === '1') {
    appendField(formData, 'email', payload.email);
    appendField(formData, 'telefone', formattedTelefone);
    appendField(formData, 'is_logged', payload.is_logged);
    appendField(formData, 'step', '1');
    appendField(formData, 'tipo', payload.tipo);
    return formData;
  }

  if (step === '3' || step === '4' || step === '5') {
    appendField(formData, 'email', payload.email);
    appendField(formData, 'telefone', formattedTelefone);
    appendField(formData, 'tipo', payload.tipo);
    appendField(formData, 'step', step);
    appendField(formData, 'uuid_sessao', payload.uuid_sessao);

    if (payload.pdf_conta_luz) {
      try {
        const resp = await fetch(payload.pdf_conta_luz);
        const arrayBuffer = await resp.arrayBuffer();
        const contentType = resp.headers.get('content-type') || 'application/pdf';
        const blob = new Blob([arrayBuffer], { type: contentType });
        const filename = payload.pdf_conta_luz.split('/').pop() || 'conta_luz.pdf';
        formData.append('pdf_conta_luz', blob, filename);
      } catch (e) {
        console.error('[Copar NEW] Erro ao baixar pdf_conta_luz', e);
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

    if (step === '4' || step === '5') {
      appendField(formData, 'id_condicao', payload.id_condicao);
      appendField(formData, 'id_cupom', payload.id_cupom);
    }

    if (step === '5') {
      appendField(formData, 'nome', payload.nome);
      appendField(formData, 'cpf', payload.cpf);
      appendField(formData, 'rg', payload.rg);
      appendField(formData, 'nacionalidade', payload.nacionalidade);
      appendField(formData, 'orgao_emissor', payload.orgao_emissor);
      appendField(formData, 'data_nascimento', formatDateToCopar(payload.data_nascimento));
      if (isPJ) {
        appendField(formData, 'razao_social', payload.razao_social);
        appendField(formData, 'nome_fantasia', payload.nome_fantasia);
        appendField(formData, 'cnpj', payload.cnpj);
        appendField(formData, 'nome_responsavel', payload.nome_responsavel);
        appendField(formData, 'cpf_responsavel', payload.cpf_responsavel);
        appendField(formData, 'data_nascimento_responsavel', formatDateToCopar(payload.data_nascimento_responsavel));
      }
      appendField(formData, 'metodo_pagamento', payload.metodo_pagamento);
      appendField(formData, 'vale_bonus', payload.vale_bonus);
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
      appendField(formData, 'token_cartao', payload.token_cartao);
      appendField(formData, 'brand_cartao', payload.brand_cartao);

      if (payload.foto_documento_frente) {
        try {
          const resp = await fetch(payload.foto_documento_frente);
          const arrayBuffer = await resp.arrayBuffer();
          const contentType = resp.headers.get('content-type') || 'image/jpeg';
          const blob = new Blob([arrayBuffer], { type: contentType });
          const filename = payload.foto_documento_frente.split('/').pop() || 'foto_documento_frente.jpg';
          formData.append('foto_documento_frente', blob, filename);
        } catch (e) {
          console.error('[Copar NEW] Erro ao baixar foto_documento_frente', e);
        }
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
          console.error('[Copar NEW] Erro ao baixar foto_documento_verso', e);
        }
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
          console.error('[Copar NEW] Erro ao baixar foto_selfie_documento', e);
        }
      }

      appendField(formData, 'documento_copel', payload.documento_copel);
      appendField(formData, 'senha_copel', payload.senha_copel);
      appendField(formData, 'senha', payload.senha);
      appendField(formData, 'confirmacao_senha', payload.confirmacao_senha);
    }

    return formData;
  }

  return formData;
};

const fetchCondicoes = async (tipo) => {
  const url = `${COPAR_CONDICOES_ENDPOINT}?tipo_pessoa=${encodeURIComponent(tipo || 'PF')}`;
  const resp = await fetch(url, { method: 'GET' });
  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = { raw: text };
  }

  console.log('[Copar NEW] Resposta lista de condicoes', {
    status: resp.status,
    ok: resp.ok,
    bodySnippet: text.slice(0, 500),
  });

  return data;
};

const callCoparOnboardingFull = async (payload) => {
  try {
    const formattedTelefone = formatPhoneToCopar(payload.telefone);
    payload.telefone = formattedTelefone;
    if (payload.data_nascimento) {
      payload.data_nascimento = formatDateToCopar(payload.data_nascimento);
    }
    if (payload.data_nascimento_responsavel) {
      payload.data_nascimento_responsavel = formatDateToCopar(payload.data_nascimento_responsavel);
    }

    const stepsToValidate = ['1', '3', '4', '5'];
    const missingByStep = {};

    stepsToValidate.forEach((step) => {
      const cloned = { ...payload, step };
      const missing = validateStepFields(cloned, step);
      if (missing.length) {
        missingByStep[step] = missing;
      }
    });

    const allMissing = Object.values(missingByStep).flat();

    if (allMissing.length) {
      const missingWithoutIdCondicao = allMissing.filter((f) => f !== 'id_condicao');

      if (!payload.id_condicao) {
        const condicoes = await fetchCondicoes(payload.tipo);
        return success({
          success: false,
          message: 'id_condicao obrigatorio para concluir o fluxo',
          condicoes,
          missing_by_step: missingByStep,
        });
      }

      if (missingWithoutIdCondicao.length) {
        return success({
          success: false,
          message: 'Campos obrigatorios ausentes para steps 1 a 5',
          missing_by_step: missingByStep,
        });
      }
    }

    if (payload.id_condicao) {
      const normalizeCondName = (value) => {
        if (!value) return '';
        return String(value)
          .replace(/\s+/g, ' ')
          .trim()
          .toUpperCase();
      };

      const idCondicaoStr = normalizeCondName(payload.id_condicao);
      if (Number.isNaN(Number(idCondicaoStr))) {
        const condicoes = await fetchCondicoes(payload.tipo);

        if (!Array.isArray(condicoes)) {
          return success({
            success: false,
            message: 'Nao foi possivel obter lista de condicoes na API da Copar para mapear id_condicao',
            condicoes,
          });
        }

        const matched = condicoes.find((c) => normalizeCondName(c.cod_nome) === idCondicaoStr);
        if (!matched || matched.id == null) {
          return success({
            success: false,
            message: 'Condicao invalida: nenhum registro encontrado com o cod_nome informado em id_condicao',
            condicoes,
          });
        }

        payload.id_condicao = matched.id;
      }
    }

    const verificarBody = JSON.stringify({
      email: payload.email,
      telefone: String(payload.telefone || ''),
    });

    const verificarResp = await fetch(COPAR_VERIFICAR_SESSAO_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: verificarBody,
    });

    const verificarText = await verificarResp.text();
    let verificarData;
    try {
      verificarData = JSON.parse(verificarText);
    } catch (_) {
      verificarData = { raw: verificarText };
    }

    console.log('[Copar NEW] Resposta verificar-sessao', {
      status: verificarResp.status,
      ok: verificarResp.ok,
      bodySnippet: verificarText.slice(0, 500),
    });

    let sessaoUuid = null;
    let currentStep = '1';

    if (verificarResp.ok && verificarData && verificarData.success && verificarData.possui_sessao && verificarData.sessao_uuid) {
      sessaoUuid = verificarData.sessao_uuid;

      try {
        const sessaoResp = await fetch(`${COPAR_SESSAO_ENDPOINT}/${encodeURIComponent(sessaoUuid)}`, {
          method: 'GET',
        });
        const sessaoText = await sessaoResp.text();
        let sessaoData;
        try {
          sessaoData = JSON.parse(sessaoText);
        } catch (_) {
          sessaoData = { raw: sessaoText };
        }

        console.log('[Copar NEW] Resposta sessao existente', {
          status: sessaoResp.status,
          ok: sessaoResp.ok,
          bodySnippet: sessaoText.slice(0, 500),
        });

        if (sessaoResp.ok && sessaoData && typeof sessaoData === 'object' && typeof sessaoData.cse_step !== 'undefined') {
          currentStep = String(sessaoData.cse_step);
        }
      } catch (sessaoErr) {
        console.error('[Copar NEW] Erro ao consultar sessao existente', sessaoErr);
      }
    }

    if (!sessaoUuid) {
      const formStep1 = await buildFormDataForStep({ ...payload }, '1');
      const resp1 = await fetch(COPAR_ENDPOINT, { method: 'POST', body: formStep1 });
      const text1 = await resp1.text();
      let data1;
      try {
        data1 = JSON.parse(text1);
      } catch (_) {
        data1 = { raw: text1 };
      }

      console.log('[Copar NEW] Resposta step 1', {
        status: resp1.status,
        ok: resp1.ok,
        bodySnippet: text1.slice(0, 500),
      });

      if (!resp1.ok) {
        return success({
          success: false,
          step: '1',
          data: data1,
        });
      }

      if (data1 && data1.uuid_sessao) {
        sessaoUuid = data1.uuid_sessao;
      }
      payload.uuid_sessao = sessaoUuid;
      currentStep = '1';
    } else {
      payload.uuid_sessao = sessaoUuid;
    }

    const stepsSequence = ['1', '3', '4', '5'];
    const responsesByStep = {};

    for (const step of stepsSequence) {
      if (step === '1' && currentStep !== '1') {
        continue;
      }
      if (step !== '1' && Number(step) <= Number(currentStep)) {
        continue;
      }

      const formData = await buildFormDataForStep({ ...payload }, step);
      const resp = await fetch(COPAR_ENDPOINT, { method: 'POST', body: formData });
      const text = await resp.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = { raw: text };
      }

      console.log('[Copar NEW] Resposta step sequencial', {
        step,
        status: resp.status,
        ok: resp.ok,
        bodySnippet: text.slice(0, 500),
      });

      responsesByStep[step] = { status: resp.status, ok: resp.ok, data };

      if (!resp.ok) {
        return success({
          success: false,
          step,
          data,
          sessao_uuid: sessaoUuid,
          responses_by_step: responsesByStep,
        });
      }
    }

    let sessaoFinal = null;
    try {
      const sessaoResp = await fetch(`${COPAR_SESSAO_ENDPOINT}/${encodeURIComponent(sessaoUuid)}`, {
        method: 'GET',
      });
      const sessaoText = await sessaoResp.text();
      let sessaoData;
      try {
        sessaoData = JSON.parse(sessaoText);
      } catch (_) {
        sessaoData = { raw: sessaoText };
      }

      console.log('[Copar NEW] Sessao final apos fluxo completo', {
        status: sessaoResp.status,
        ok: sessaoResp.ok,
        bodySnippet: sessaoText.slice(0, 500),
      });

      if (sessaoResp.ok && sessaoData && typeof sessaoData === 'object') {
        sessaoFinal = sessaoData;
      }
    } catch (sessaoFinalErr) {
      console.error('[Copar NEW] Erro ao consultar sessao final', sessaoFinalErr);
    }

    return success({
      success: true,
      sessao_uuid: sessaoUuid,
      responses_by_step: responsesByStep,
      sessao_dados: sessaoFinal,
    });
  } catch (err) {
    console.error('[Copar NEW] Erro no fluxo completo', err);
    return errorResponse({
      success: false,
      message: 'Erro interno ao processar fluxo completo de onboarding Copar',
      error: err.message,
    }, 500);
  }
};

module.exports = {
  callCoparOnboardingFull,
};

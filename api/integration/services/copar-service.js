const { randomUUID } = require('crypto');
const { success, error: errorResponse } = require('../utils/response');

const COPAR_ENDPOINT = 'https://api.coparenergia.com.br/api/onboarding/cadastro';
// Verificação de sessão: POST JSON { email, telefone }
const COPAR_VERIFICAR_SESSAO_ENDPOINT = 'https://api.coparenergia.com.br/api/onboarding/verificar-sessao';
// Consulta de sessão: GET /api/onboarding/cadastro/sessao/{uuid_sessao}
const COPAR_SESSAO_ENDPOINT = 'https://api.coparenergia.com.br/api/onboarding/cadastro/sessao';
// Conforme collection oficial, rota de media usa o host api-scraper
const COPAR_MEDIA_ENDPOINT = 'https://api-scraper.coparenergia.com.br/api/admin/data/media';
// Listagem de condições: /api/onboarding/condicao/list?tipo_pessoa=PF|PJ
const COPAR_CONDICOES_ENDPOINT = 'https://api.coparenergia.com.br/api/onboarding/condicao/list';
// Verificação de cupom: POST JSON { codigo }
const COPAR_CUPOM_ENDPOINT = 'https://api.coparenergia.com.br/api/onboarding/cadastro/verificar-cupom';

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

  // Remove DDI Brasil (55) quando presente, para trabalhar só com DDD + número
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

  // Já está no formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  // Formatos DD/MM/YYYY ou DD-MM-YYYY
  const match = raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd}`;
  }

  return raw;
};

const REQUIRED_FIELDS_BY_STEP = {
  // Etapa 0 - Cadastro inicial
  // Collection: email, telefone, step
  '0': ['email', 'telefone', 'step'],

  // Etapa 1 - Tipo de cadastro
  // Collection: email, telefone, step, tipo
  '1': ['email', 'telefone', 'step', 'tipo'],

  // Etapa 3 - Dados da fatura
  // Collection: email, telefone, tipo, step, uuid_sessao, pdf_conta_luz,
  // consumo_medio, valor_fatura, nome_razao_social_titular, cpf_cnpj_titular,
  // cep_instalacao, logradouro_instalacao, numero_instalacao, complemento_instalacao,
  // bairro_instalacao, estado_instalacao, cidade_instalacao, unidade_consumidora, tipo_fornecimento
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
  // Etapa 4 - Condição e fidelidade
  // Collection base: mesmos campos da etapa 3 + id_condicao (id_cupom é opcional)
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
  // Etapa 5 - Dados da conta (mantemos base comum + validação PF/PJ específica)
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

const validateRequiredFieldsByStep = (payload) => {
  const stepValue = payload && payload.step != null ? String(payload.step) : '';
  const baseRequired = REQUIRED_FIELDS_BY_STEP[stepValue] || [];

  // Campos adicionais obrigatórios no step 5 para PF e PJ
  const extraForPFStep5 = ['nome', 'cpf', 'rg', 'nacionalidade', 'orgao_emissor', 'data_nascimento'];
  const extraForPJStep5 = ['razao_social', 'nome_fantasia', 'cnpj', 'nome_responsavel', 'cpf_responsavel', 'data_nascimento_responsavel'];
  const tipoUpper = String(payload?.tipo || '').toUpperCase();
  const isPFStep5 = stepValue === '5' && tipoUpper === 'PF';
  const isPJStep5 = stepValue === '5' && tipoUpper === 'PJ';

  let required = baseRequired;
  if (isPFStep5) {
    required = [...required, ...extraForPFStep5];
  }
  if (isPJStep5) {
    required = [...required, ...extraForPJStep5];
  }

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

  const formattedTelefone = formatPhoneToCopar(payload.telefone);

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

  const tipoUpper = String(payload?.tipo || '').toUpperCase();
  const isPJ = tipoUpper === 'PJ';

  pushField('tipo', payload.tipo);
  pushField('email', payload.email);
  pushField('telefone', formattedTelefone);
  pushField('nome', payload.nome);
  pushField('cpf', payload.cpf);
  pushField('rg', payload.rg);
  pushField('nacionalidade', payload.nacionalidade);
  pushField('orgao_emissor', payload.orgao_emissor);
  pushField('data_nascimento', formatDateToCopar(payload.data_nascimento));

  if (isPJ) {
    pushField('razao_social', payload.razao_social);
    pushField('nome_fantasia', payload.nome_fantasia);
    pushField('cnpj', payload.cnpj);
    pushField('nome_responsavel', payload.nome_responsavel);
    pushField('cpf_responsavel', payload.cpf_responsavel);
    pushField('data_nascimento_responsavel', formatDateToCopar(payload.data_nascimento_responsavel));
  }
  pushField('nome_razao_social_titular', payload.nome_razao_social_titular);
  pushField('cpf_cnpj_titular', payload.cpf_cnpj_titular);
  pushField('pdf_conta_luz', payload.pdf_conta_luz);
  pushField('consumo_medio', payload.consumo_medio);
  pushField('valor_fatura', payload.valor_fatura);
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
  const stepValue = payload && payload.step != null ? String(payload.step) : '';
  const formattedTelefone = formatPhoneToCopar(payload.telefone);
  const tipoUpper = String(payload?.tipo || '').toUpperCase();
  const isPJ = tipoUpper === 'PJ';

  if (stepValue === '0') {
    appendField(formData, 'email', payload.email);
    appendField(formData, 'telefone', formattedTelefone);
    appendField(formData, 'is_logged', payload.is_logged);
    appendField(formData, 'step', payload.step);
    return formData;
  }

  if (stepValue === '1') {
    appendField(formData, 'email', payload.email);
    appendField(formData, 'telefone', formattedTelefone);
    appendField(formData, 'is_logged', payload.is_logged);
    appendField(formData, 'step', payload.step);
    appendField(formData, 'tipo', payload.tipo);
    return formData;
  }
  if (stepValue === '3') {
    appendField(formData, 'email', payload.email);
    appendField(formData, 'telefone', formattedTelefone);
    appendField(formData, 'tipo', payload.tipo);
    appendField(formData, 'step', payload.step);
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

    return formData;
  }

  if (stepValue === '4') {
    appendField(formData, 'email', payload.email);
    appendField(formData, 'telefone', formattedTelefone);
    appendField(formData, 'tipo', payload.tipo);
    appendField(formData, 'step', payload.step);
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
    appendField(formData, 'id_condicao', payload.id_condicao);
    appendField(formData, 'id_cupom', payload.id_cupom);

    return formData;
  }

  if (stepValue === '5') {
    appendField(formData, 'email', payload.email);
    appendField(formData, 'telefone', formattedTelefone);
    appendField(formData, 'tipo', payload.tipo);
    appendField(formData, 'step', payload.step);
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
    appendField(formData, 'id_condicao', payload.id_condicao);
    appendField(formData, 'id_cupom', payload.id_cupom);

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
      appendField(formData, 'data_nascimento_responsavel', payload.data_nascimento_responsavel);
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
        console.error('[Copar] Erro ao baixar foto_documento_frente', e);
      }
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
        console.error('[Copar] Erro ao baixar foto_selfie_documento', e);
      }
    }

    appendField(formData, 'documento_copel', payload.documento_copel);
    appendField(formData, 'senha_copel', payload.senha_copel);

    return formData;
  }

  appendField(formData, 'tipo', payload.tipo);
  appendField(formData, 'email', payload.email);
  appendField(formData, 'telefone', formattedTelefone);
  appendField(formData, 'nome', payload.nome);
  appendField(formData, 'cpf', payload.cpf);
  appendField(formData, 'rg', payload.rg);
  appendField(formData, 'nacionalidade', payload.nacionalidade);
  appendField(formData, 'orgao_emissor', payload.orgao_emissor);
  appendField(formData, 'data_nascimento', payload.data_nascimento);

  if (isPJ) {
    appendField(formData, 'razao_social', payload.razao_social);
    appendField(formData, 'nome_fantasia', payload.nome_fantasia);
    appendField(formData, 'cnpj', payload.cnpj);
    appendField(formData, 'nome_responsavel', payload.nome_responsavel);
    appendField(formData, 'cpf_responsavel', payload.cpf_responsavel);
    appendField(formData, 'data_nascimento_responsavel', payload.data_nascimento_responsavel);
  }

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
    // Sempre consultar a Copar para verificar se já existe sessão ativa
    let sessaoUuidFromCopar = null;
    try {
      const verificarBody = JSON.stringify({
        email: payload.email,
        telefone: String(payload.telefone || ''),
      });

      const verificarCurl = `curl -X POST '${COPAR_VERIFICAR_SESSAO_ENDPOINT}' -H 'Content-Type: application/json' -d '${verificarBody}'`;
      console.log('[Copar] CURL verificar-sessao para debug externo', verificarCurl);

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

      console.log('[Copar] Resposta verificar-sessao', {
        status: verificarResp.status,
        ok: verificarResp.ok,
        bodySnippet: verificarText.slice(0, 500),
      });

      if (verificarResp.ok && verificarData && verificarData.success && verificarData.possui_sessao && verificarData.sessao_uuid) {
        sessaoUuidFromCopar = verificarData.sessao_uuid;
      }
    } catch (verificarErr) {
      console.error('[Copar] Erro ao verificar sessão na Copar', verificarErr);
    }

    const originalStep = payload && payload.step != null ? String(payload.step) : '';
    // Caso não exista sessão na Copar para o CPF/telefone informado e o step enviado
    // seja diferente de 1, forçamos o processamento como step 1 para criar a sessão
    if (!sessaoUuidFromCopar && originalStep && originalStep !== '1') {
      payload.step = '1';
    }

    // Ignora qualquer uuid_sessao vindo do front:
    // usa sempre o retornado pela Copar (quando existir),
    // caso contrário gera um novo UUID local
    const sessaoUuid = sessaoUuidFromCopar || randomUUID();
    payload.uuid_sessao = sessaoUuid;

    // Tenta hidratar o payload com dados já existentes na sessão da Copar,
    // SEM sobrescrever valores enviados pelo front (front sempre tem prioridade)
    let sessaoDadosAntesValidacao = null;
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

      console.log('[Copar] Resposta sessao (antes validacao)', {
        status: sessaoResp.status,
        ok: sessaoResp.ok,
        bodySnippet: sessaoText.slice(0, 500),
      });

      if (sessaoResp.ok && sessaoData && typeof sessaoData === 'object') {
        sessaoDadosAntesValidacao = sessaoData;

        const cliente = sessaoData.cliente || {};
        const contrato = sessaoData.contrato || {};

        const mergeField = (field, sessionValue) => {
          const current = payload[field];
          if (current === undefined || current === null || (typeof current === 'string' && current.trim() === '')) {
            if (sessionValue !== undefined && sessionValue !== null && String(sessionValue).trim() !== '') {
              payload[field] = sessionValue;
            }
          }
        };

        // Campos de cliente (PF/PJ)
        mergeField('nome', cliente.cli_nome);
        mergeField('cpf', cliente.cli_cpf);
        mergeField('rg', cliente.cli_rg);
        mergeField('nacionalidade', cliente.cli_nacionalidade);
        mergeField('orgao_emissor', cliente.cli_orgao_emissor);
        mergeField('data_nascimento', cliente.cli_data_nascimento);

        mergeField('razao_social', cliente.cli_razao_social);
        mergeField('nome_fantasia', cliente.cli_nome_fantasia);
        mergeField('cnpj', cliente.cli_cnpj);
        mergeField('nome_responsavel', cliente.cli_nome_responsavel);
        mergeField('cpf_responsavel', cliente.cli_cpf_responsavel);
        mergeField('data_nascimento_responsavel', cliente.cli_data_nascimento_responsavel);

        // Campos de contrato
        mergeField('consumo_medio', contrato.con_consumo_medio);
        mergeField('valor_fatura', contrato.con_valor_fatura);
        mergeField('nome_razao_social_titular', contrato.con_fatura_nome_titular);
        mergeField('cpf_cnpj_titular', contrato.con_fatura_documento_titular);
        mergeField('cep_instalacao', contrato.con_cep);
        mergeField('logradouro_instalacao', contrato.con_logradouro);
        mergeField('numero_instalacao', contrato.con_numero);
        mergeField('complemento_instalacao', contrato.con_complemento);
        mergeField('bairro_instalacao', contrato.con_bairro);
        mergeField('cidade_instalacao', contrato.con_cidade);
        mergeField('estado_instalacao', contrato.con_estado);
        mergeField('unidade_consumidora', contrato.con_unidade_consumidora);
        mergeField('tipo_fornecimento', contrato.con_tipo_fornecimento);

        mergeField('vale_bonus', contrato.con_vale_bonus);
        mergeField('id_condicao', contrato.con_id_condicao);
      }
    } catch (sessaoErr) {
      console.error('[Copar] Erro ao consultar sessao antes da validacao', sessaoErr);
    }

    const validation = validateRequiredFieldsByStep(payload);
    if (!validation.ok) {
      const isStep4or5 = validation.step === '4' || validation.step === '5';
      const isMissingIdCondicao = Array.isArray(validation.missing) && validation.missing.includes('id_condicao');

      if (isStep4or5 && isMissingIdCondicao) {
        try {
          const tipoPessoa = payload.tipo || 'PF';
          const urlCond = `${COPAR_CONDICOES_ENDPOINT}?tipo_pessoa=${encodeURIComponent(tipoPessoa)}`;
          const condResp = await fetch(urlCond, { method: 'GET' });
          const condText = await condResp.text();
          let condData;
          try {
            condData = JSON.parse(condText);
          } catch (_) {
            condData = { raw: condText };
          }

          console.log('[Copar] Resposta condicoes para validacao local (id_condicao ausente)', {
            status: condResp.status,
            ok: condResp.ok,
            bodySnippet: condText.slice(0, 500),
          });

          return success({
            success: false,
            message: 'Campos obrigatórios ausentes para a etapa informada',
            step: validation.step,
            missing_fields: validation.missing,
            condicoes: condData,
          });
        } catch (condErr) {
          console.error('[Copar] Erro ao buscar condicoes na validacao local', condErr);
        }
      }

      if (validation.step === '3') {
        try {
          const tipoPessoa = payload.tipo || 'PF';
          const urlCond = `${COPAR_CONDICOES_ENDPOINT}?tipo_pessoa=${encodeURIComponent(tipoPessoa)}`;
          const condResp = await fetch(urlCond, { method: 'GET' });
          const condText = await condResp.text();
          let condData;
          try {
            condData = JSON.parse(condText);
          } catch (_) {
            condData = { raw: condText };
          }

          console.log('[Copar] Resposta condicoes para validacao local no step 3', {
            status: condResp.status,
            ok: condResp.ok,
            bodySnippet: condText.slice(0, 500),
          });

          return success({
            success: false,
            message: 'Campos obrigatórios ausentes para a etapa informada',
            step: validation.step,
            missing_fields: validation.missing,
            condicoes: condData,
          });
        } catch (condErr3) {
          console.error('[Copar] Erro ao buscar condicoes na validacao local (step 3)', condErr3);
        }
      }

      return success({
        success: false,
        message: 'Campos obrigatórios ausentes para a etapa informada',
        step: validation.step,
        missing_fields: validation.missing,
      });
    }

    // Se id_condicao vier como cod_nome (string nao numerica),
    // precisamos mapear para o id numerico usando a lista de condicoes da Copar
    if ((validation.step === '4' || validation.step === '5') && payload.id_condicao) {
      const normalizeCondName = (value) => {
        if (!value) return '';
        return String(value)
          .replace(/\s+/g, ' ') // colapsa tabs, quebras de linha e múltiplos espaços
          .trim()
          .toUpperCase();
      };

      const idCondicaoStr = normalizeCondName(payload.id_condicao);
      if (Number.isNaN(Number(idCondicaoStr))) {
        try {
          const tipoPessoa = payload.tipo || 'PF';
          const urlCond = `${COPAR_CONDICOES_ENDPOINT}?tipo_pessoa=${encodeURIComponent(tipoPessoa)}`;
          const condResp = await fetch(urlCond, { method: 'GET' });
          const condText = await condResp.text();
          let condData;
          try {
            condData = JSON.parse(condText);
          } catch (_) {
            condData = { raw: condText };
          }

          console.log('[Copar] Resposta condicoes para mapear id_condicao', {
            status: condResp.status,
            ok: condResp.ok,
            bodySnippet: condText.slice(0, 500),
          });

          if (!Array.isArray(condData)) {
            return success({
              success: false,
              message: 'Nao foi possivel obter lista de condicoes na API da Copar para mapear id_condicao',
              sessao_uuid: sessaoUuid,
              condicoes: condData,
            });
          }

          const matched = condData.find((c) => normalizeCondName(c.cod_nome) === idCondicaoStr);
          if (!matched || matched.id == null) {
            return success({
              success: false,
              message: 'Condicao invalida: nenhum registro encontrado com o cod_nome informado em id_condicao',
              sessao_uuid: sessaoUuid,
              condicoes: condData,
            });
          }

          payload.id_condicao = matched.id;
        } catch (mapErr) {
          console.error('[Copar] Erro ao mapear id_condicao via lista de condicoes', mapErr);
          return success({
            success: false,
            message: 'Erro ao mapear id_condicao via lista de condicoes da Copar',
            sessao_uuid: sessaoUuid,
          });
        }
      }
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

    // Se for etapa 4 e houver cupom_codigo, validar cupom antes de prosseguir
    if (validation.step === '4' && payload.cupom_codigo) {
      try {
        const cupomBody = JSON.stringify({ codigo: payload.cupom_codigo });
        const cupomResp = await fetch(COPAR_CUPOM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: cupomBody,
        });

        const cupomText = await cupomResp.text();
        let cupomData;
        try {
          cupomData = JSON.parse(cupomText);
        } catch (_) {
          cupomData = { raw: cupomText };
        }

        console.log('[Copar] Resposta verificacao cupom', {
          status: cupomResp.status,
          ok: cupomResp.ok,
          bodySnippet: cupomText.slice(0, 500),
        });

        if (!cupomResp.ok) {
          const errors = Array.isArray(cupomData?.errors) ? cupomData.errors : [];
          return success({
            success: false,
            statusCode: cupomResp.status,
            message: 'Cupom inválido na API da Copar',
            errors,
            sessao_uuid: sessaoUuid,
          });
        }

        // Tenta extrair id_cupom do retorno e colocar no payload
        if (cupomData && typeof cupomData === 'object') {
          const possibleId = cupomData.id_cupom || cupomData.id || cupomData.cupom_id;
          if (possibleId !== undefined && possibleId !== null) {
            payload.id_cupom = possibleId;
          }
        }
      } catch (cupomErr) {
        console.error('[Copar] Erro ao verificar cupom na Copar', cupomErr);
        return success({
          success: false,
          message: 'Erro ao verificar cupom na API da Copar',
          sessao_uuid: sessaoUuid,
        });
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
    let sessaoDados = null;
    if (response.ok) {
      // Após cadastro bem-sucedido, busca novamente os dados da sessão para retornar
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

        console.log('[Copar] Resposta sessao (apos cadastro)', {
          status: sessaoResp.status,
          ok: sessaoResp.ok,
          bodySnippet: sessaoText.slice(0, 500),
        });

        if (sessaoResp.ok && sessaoData && typeof sessaoData === 'object') {
          sessaoDados = sessaoData;
        }
      } catch (sessaoAfterErr) {
        console.error('[Copar] Erro ao consultar sessao apos cadastro', sessaoAfterErr);
      }
    }

    if (validation.step === '3' || validation.step === '4' || validation.step === '5') {
      try {
        const tipoPessoa = payload.tipo || 'PF';
        const urlCond = `${COPAR_CONDICOES_ENDPOINT}?tipo_pessoa=${encodeURIComponent(tipoPessoa)}`;
        const condResp = await fetch(urlCond, { method: 'GET' });
        const condText = await condResp.text();
        let condData;
        try {
          condData = JSON.parse(condText);
        } catch (_) {
          condData = { raw: condText };
        }

        console.log('[Copar] Resposta lista de condicoes', {
          status: condResp.status,
          ok: condResp.ok,
          bodySnippet: condText.slice(0, 500),
        });

        if (Array.isArray(condData)) {
          condicoes = condData;
        }
      } catch (condErr) {
        console.error('[Copar] Erro ao chamar lista de condicoes', condErr);
      }
    }

    const result = {
      success: true,
      sessao_uuid: sessaoUuid,
      data,
      condicoes,
      step: validation.step,
    };

    if (sessaoDados) {
      result.sessao_dados = sessaoDados;
    }

    if (validation.step === '5') {
      result.onboarding_link = `https://onboarding.coparenergia.com.br/onboarding?sessao=${sessaoUuid}`;
    }

    return success(result);
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

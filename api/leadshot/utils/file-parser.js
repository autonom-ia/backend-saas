const csv = require('csv-parser');
const XLSX = require('xlsx');
const fs = require('fs');

/**
 * Detecta colunas automaticamente baseado em nomes comuns
 * @param {Array} headers - Array de nomes de colunas
 * @returns {Object} Mapeamento de colunas
 */
const detectColumns = (headers) => {
  console.log('[FILE-PARSER] Detectando colunas - Headers recebidos:', headers);
  
  const mapping = {
    name: null,
    phone: null,
    cpf: null,
    others: []
  };

  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  console.log('[FILE-PARSER] Headers normalizados:', lowerHeaders);

  // Detectar coluna de nome
  const namePatterns = ['nome', 'name', 'cliente', 'contato'];
  for (const pattern of namePatterns) {
    const index = lowerHeaders.findIndex(h => h.includes(pattern));
    if (index !== -1) {
      mapping.name = headers[index];
      console.log(`[FILE-PARSER] Coluna NOME detectada: "${headers[index]}" (padrão: "${pattern}")`);
      break;
    }
  }

  // Detectar coluna de telefone
  const phonePatterns = ['telefone', 'phone', 'celular', 'whatsapp', 'fone', 'tel'];
  for (const pattern of phonePatterns) {
    const index = lowerHeaders.findIndex(h => h.includes(pattern));
    if (index !== -1) {
      mapping.phone = headers[index];
      console.log(`[FILE-PARSER] Coluna TELEFONE detectada: "${headers[index]}" (padrão: "${pattern}")`);
      break;
    }
  }

  // Detectar coluna de CPF
  const cpfPatterns = ['cpf', 'documento', 'doc'];
  for (const pattern of cpfPatterns) {
    const index = lowerHeaders.findIndex(h => h.includes(pattern));
    if (index !== -1) {
      mapping.cpf = headers[index];
      console.log(`[FILE-PARSER] Coluna CPF detectada: "${headers[index]}" (padrão: "${pattern}")`);
      break;
    }
  }

  // Adicionar outras colunas
  headers.forEach(header => {
    if (header !== mapping.name && header !== mapping.phone && header !== mapping.cpf) {
      mapping.others.push(header);
    }
  });

  console.log('[FILE-PARSER] Mapeamento final:', {
    name: mapping.name,
    phone: mapping.phone,
    cpf: mapping.cpf,
    others: mapping.others
  });

  return mapping;
};

/**
 * Parse arquivo CSV
 * @param {string} filePath - Caminho do arquivo
 * @returns {Promise<Object>} { headers, data, mapping }
 */
const parseCsv = (filePath) => {
  console.log('[FILE-PARSER] Iniciando parse de CSV:', filePath);
  return new Promise((resolve, reject) => {
    const results = [];
    let headers = [];

    fs.createReadStream(filePath)
      .pipe(csv({
        separator: ';',  // Usar ponto e vírgula como separador padrão (Excel BR)
        skipEmptyLines: true,
        trim: true
      }))
      .on('headers', (headerList) => {
        headers = headerList;
        console.log('[FILE-PARSER] CSV headers detectados:', headers);
      })
      .on('data', (data) => {
        if (results.length < 2) {
          console.log(`[FILE-PARSER] CSV linha ${results.length + 1}:`, data);
        }
        results.push(data);
      })
      .on('end', () => {
        console.log(`[FILE-PARSER] CSV parse concluído: ${results.length} linhas`);
        const mapping = detectColumns(headers);
        resolve({
          headers,
          data: results,
          mapping
        });
      })
      .on('error', (error) => {
        console.error('[FILE-PARSER] Erro ao fazer parse do CSV:', error);
        reject(error);
      });
  });
};

/**
 * Parse arquivo XLSX
 * @param {string} filePath - Caminho do arquivo
 * @returns {Object} { headers, data, mapping }
 */
const parseXlsx = (filePath) => {
  try {
    console.log('[FILE-PARSER] Iniciando parse de XLSX:', filePath);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    console.log('[FILE-PARSER] XLSX sheet:', sheetName);
    const worksheet = workbook.Sheets[sheetName];
    
    // Converter para JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log(`[FILE-PARSER] XLSX total de linhas (incluindo header): ${jsonData.length}`);
    
    if (jsonData.length === 0) {
      throw new Error('Arquivo está vazio');
    }

    const headers = jsonData[0];
    console.log('[FILE-PARSER] XLSX headers:', headers);
    const data = jsonData.slice(1).map((row, idx) => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });

    const mapping = detectColumns(headers);

    return {
      headers,
      data,
      mapping
    };
  } catch (error) {
    throw new Error(`Erro ao processar arquivo XLSX: ${error.message}`);
  }
};

/**
 * Parse arquivo baseado na extensão
 * @param {string} filePath - Caminho do arquivo
 * @param {string} mimeType - Tipo MIME do arquivo
 * @returns {Promise<Object>} { headers, data, mapping }
 */
const parseFile = async (filePath, mimeType) => {
  try {
    if (mimeType === 'text/csv' || filePath.endsWith('.csv')) {
      return await parseCsv(filePath);
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel' ||
      filePath.endsWith('.xlsx') ||
      filePath.endsWith('.xls')
    ) {
      return parseXlsx(filePath);
    } else {
      throw new Error('Formato de arquivo não suportado. Use CSV ou XLSX.');
    }
  } catch (error) {
    throw new Error(`Erro ao processar arquivo: ${error.message}`);
  }
};

/**
 * Valida se o arquivo tem as colunas obrigatórias
 * @param {Object} mapping - Mapeamento de colunas
 * @returns {Object} { isValid: boolean, errors: Array }
 */
const validateRequiredColumns = (mapping) => {
  const errors = [];

  if (!mapping.name) {
    errors.push('Coluna de nome não encontrada. Use: nome, name, cliente ou contato');
  }

  if (!mapping.phone) {
    errors.push('Coluna de telefone não encontrada. Use: telefone, phone, celular ou whatsapp');
  }

  if (!mapping.cpf) {
    errors.push('Coluna de CPF não encontrada. Use: cpf, documento ou doc');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  parseFile,
  detectColumns,
  validateRequiredColumns
};

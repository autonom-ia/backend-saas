const csv = require('csv-parser');
const XLSX = require('xlsx');
const fs = require('fs');

/**
 * Detecta colunas automaticamente baseado em nomes comuns
 * @param {Array} headers - Array de nomes de colunas
 * @returns {Object} Mapeamento de colunas
 */
const detectColumns = (headers) => {
  const mapping = {
    name: null,
    phone: null,
    cpf: null,
    others: []
  };

  const lowerHeaders = headers.map(h => h.toLowerCase().trim());

  // Detectar coluna de nome
  const namePatterns = ['nome', 'name', 'cliente', 'contato'];
  for (const pattern of namePatterns) {
    const index = lowerHeaders.findIndex(h => h.includes(pattern));
    if (index !== -1) {
      mapping.name = headers[index];
      break;
    }
  }

  // Detectar coluna de telefone
  const phonePatterns = ['telefone', 'phone', 'celular', 'whatsapp', 'fone', 'tel'];
  for (const pattern of phonePatterns) {
    const index = lowerHeaders.findIndex(h => h.includes(pattern));
    if (index !== -1) {
      mapping.phone = headers[index];
      break;
    }
  }

  // Detectar coluna de CPF
  const cpfPatterns = ['cpf', 'documento', 'doc'];
  for (const pattern of cpfPatterns) {
    const index = lowerHeaders.findIndex(h => h.includes(pattern));
    if (index !== -1) {
      mapping.cpf = headers[index];
      break;
    }
  }

  // Adicionar outras colunas
  headers.forEach(header => {
    if (header !== mapping.name && header !== mapping.phone && header !== mapping.cpf) {
      mapping.others.push(header);
    }
  });

  return mapping;
};

/**
 * Parse arquivo CSV
 * @param {string} filePath - Caminho do arquivo
 * @returns {Promise<Object>} { headers, data, mapping }
 */
const parseCsv = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    let headers = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headerList) => {
        headers = headerList;
      })
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', () => {
        const mapping = detectColumns(headers);
        resolve({
          headers,
          data: results,
          mapping
        });
      })
      .on('error', (error) => {
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
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Converter para JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) {
      throw new Error('Arquivo está vazio');
    }

    const headers = jsonData[0];
    const data = jsonData.slice(1).map(row => {
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
